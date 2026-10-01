import { defineAdapter } from '../src/adapter.js'
import { execute, wavProcess } from './external.js'
import { makeSignal } from '../src/signals.js'
import { readFile,realpath,mkdtemp,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hash } from '../src/provenance.js'
import { nativeMeasure } from './native-measure.js'
import { nativeCodec, codecSupported } from './codecs.js'
import { encodeWav, decodeWav } from '../src/wav.js'

const processorDefaults={
 compressor:{threshold:-20,ratio:4,knee:6,makeup:0,attack:5,release:100,upRatio:1},
 limiter:{ceiling:-.3,lookahead:5,release:50},
 tremolo:{rate:5,depth:.5},vibrato:{rate:5,depth:.5},
 softclip:{curve:'tanh',drive:1,ceiling:1,oversample:1},
 dcblocker:{R:.995},derivative:{},integral:{leak:1},emphasis:{alpha:.97},deemphasis:{alpha:.97}
}

// Processor controls use milliseconds; the behavioral dynamics cases use seconds.
// Unknown controls are rejected rather than silently replaced by engine defaults.
export function nativeProcessor(id,{name,params={}}){
 const defaults=processorDefaults[name]
 if(!defaults||Object.keys(params).some(k=>!(k in defaults)))return null
 const p={...defaults,...params},map=id==='ffmpeg'?ffmpegMap:soxMap
 if(Object.entries(p).some(([key,value])=>key!=='curve'&&!Number.isFinite(value)))return null
 const biquad=(b0,b1,a1)=>id==='ffmpeg'?`biquad=b0=${b0}:b1=${b1}:b2=0:a0=1:a1=${a1}:a2=0:precision=f64`:['biquad',String(b0),String(b1),'0','1',String(a1),'0']
 if(name==='compressor'){
  if(p.upRatio!==1||p.ratio<1||p.ratio>20||p.attack<.01||p.release<.01||p.threshold>0)return null
  if(id==='ffmpeg'&&(10**(p.threshold/20)<.000976563||p.knee<0||10**(p.knee/20)>8||p.makeup<0||10**(p.makeup/20)>64||p.attack>2000||p.release>9000))return null
  return map.compressor({...p,attack:p.attack/1000,release:p.release/1000})
 }
 if(name==='limiter'){
  if(p.ceiling>0||p.lookahead<0||p.release<1)return null
  if(id==='ffmpeg'&&(10**(p.ceiling/20)<.0625||p.lookahead<.1||p.lookahead>80||p.release>8000))return null
  return map.limiter({...p,lookahead:p.lookahead/1000,release:p.release/1000})
 }
 if(name==='tremolo'||name==='vibrato'){
  if(p.rate<.1||p.rate>20000||p.depth<0||p.depth>1)return null
  if(id==='sox'&&p.depth===0)return null
  return id==='ffmpeg'?`${name}=f=${p.rate}:d=${p.depth}`:name==='tremolo'?['tremolo',String(p.rate),String(p.depth*100)]:null
 }
 if(name==='softclip'){
  if(id!=='ffmpeg'||!['tanh','hard'].includes(p.curve)||p.drive<=0||p.ceiling<.000001||p.ceiling>1||!Number.isInteger(p.oversample)||p.oversample<1||p.oversample>64)return null
  return `volume=${p.drive}:precision=double,asoftclip=type=${p.curve}:threshold=${p.curve==='hard'?p.ceiling:1}:output=${p.curve==='hard'?1:p.ceiling}:oversample=${p.oversample}`
 }
 if(name==='dcblocker')return p.R>=0&&p.R<1?biquad(1,-1,-p.R):null
 if(name==='derivative')return map.derivative()
 if(name==='integral')return p.leak>=0&&p.leak<=1?biquad(1,0,-p.leak):null
 if(name==='emphasis'||name==='deemphasis')return p.alpha>=0&&p.alpha<1?biquad(1,name==='emphasis'?-p.alpha:0,name==='deemphasis'?-p.alpha:0):null
 return null
}

const soxEdits=['mix','insert','crossfade','reverse-range','remove']
async function soxEdit(step,input,sr){
 const dir=await mkdtemp(join(tmpdir(),'audio-sox-edit-')),source=join(dir,'input.wav'),target=join(dir,'output.wav'),frames=input[0].length
 try{
  await writeFile(source,encodeWav(input,sr))
  const output=file=>['-t','wav','-e','floating-point','-b','32',file]
  const run=args=>execute('sox',['-D',...args],{timeout:30000,maxBuffer:8*1024*1024})
  let count=0
  const part=async(start,length,reverse=false)=>{
   if(!length)return null
   const file=join(dir,`part-${count++}.wav`)
   await run([source,...output(file),'trim',`${start}s`,`${length}s`,...(reverse?['reverse']:[])])
   return file
  }
  let other
  if(step.other){other=join(dir,'other.wav');await writeFile(other,encodeWav(makeSignal(step.other).channels,sr))}
  if(step.op==='mix'){
   const delayed=join(dir,'delayed.wav')
   await run([other,...output(delayed),'pad',`${step.at}s`,'0s'])
   // Explicit input gains disable SoX's automatic 1/N attenuation.
   await run(['--combine','mix','-v','1',source,'-v','1',delayed,...output(target),'trim','0s',`${frames}s`])
  }else if(step.op==='crossfade'){
   // splice enforces a minimum overlap. Native fade + mix also handles tiny
   // overlaps without alignment search or changing the requested duration.
   const a=join(dir,'fade-out.wav'),b=join(dir,'fade-in.wav'),curve=step.curve==='equal-power'?'q':'t'
   await run([source,...output(a),'fade',curve,'0s',`${frames}s`,`${step.length}s`])
   await run([other,...output(b),'fade',curve,`${step.length}s`,'pad',`${frames-step.length}s`,'0s'])
   await run(['--combine','mix','-v','1',a,'-v','1',b,...output(target)])
  }else{
   const start=step.op==='insert'?step.at:step.start,end=step.op==='insert'?start:start+step.length
   const parts=[await part(0,start),step.op==='insert'?other:step.op==='reverse-range'?await part(start,step.length,true):null,await part(end,frames-end)].filter(Boolean)
   await run(parts.length?[...parts,...output(target)]:[source,...output(target),'trim','0s','0s'])
  }
  const result=decodeWav(await readFile(target))
  return {channels:result.channels,sampleRate:result.sampleRate}
 }finally{await rm(dir,{recursive:true,force:true})}
}

export const ffmpegMap={
 reverse:()=> 'areverse',trim:s=>`atrim=start_sample=${s.start}:end_sample=${s.start+s.length},asetpts=PTS-STARTPTS`,
 gain:s=>`volume=${s.value}:precision=double`,'gain-db':s=>`volume=${s.db}dB:precision=double`,
 normalize:s=>`volume=${s.linearGain}:precision=double`,
 pad:s=>`adelay=${s.before}S:all=1,apad=pad_len=${s.after}`,repeat:(s,t)=>`aloop=loop=${s.count-1}:size=${t.fixture.frames}`,
 fade:(s,t)=>`afade=t=${s.direction}:ss=${s.direction==='in'?0:t.fixture.frames-s.length}:ns=${s.length}:curve=${({linear:'tri',exp:'qua',log:'squ',cos:'hsin'})[s.curve||'linear']}`,
 swap:()=> 'pan=stereo|c0=c1|c1=c0',mono:()=> 'pan=mono|c0=0.5*c0+0.5*c1',duplicate:()=> 'pan=stereo|c0=c0|c1=c0',
 balance:s=>`pan=stereo|c0=${Math.min(1,1-s.value)}*c0|c1=${Math.min(1,1+s.value)}*c1`,
 derivative:()=> 'aderivative',integral:()=> 'aintegral',
 lowpass:s=>`lowpass=f=${s.freq}:p=${s.order||2}:t=q:w=${s.Q}`,highpass:s=>`highpass=f=${s.freq}:p=${s.order||2}:t=q:w=${s.Q}`,
 bandpass:s=>`bandpass=f=${s.freq}:t=q:w=${s.Q}`,notch:s=>`bandreject=f=${s.freq}:t=q:w=${s.Q}`,allpass:s=>`allpass=f=${s.freq}:t=q:w=${s.Q}`,
 lowshelf:s=>`bass=f=${s.freq}:g=${s.gain}:t=q:w=${s.Q}`,highshelf:s=>`treble=f=${s.freq}:g=${s.gain}:t=q:w=${s.Q}`,eq:s=>`equalizer=f=${s.freq}:g=${s.gain}:t=q:w=${s.Q}`,
 compressor:s=>`acompressor=threshold=${10**(s.threshold/20)}:ratio=${s.ratio}:knee=${10**((s.knee||0)/20)}:attack=${s.attack*1000}:release=${s.release*1000}:makeup=${10**((s.makeup||0)/20)}:detection=peak`,
 limiter:s=>`alimiter=limit=${10**(s.ceiling/20)}:attack=${s.lookahead*1000}:release=${s.release*1000}:level=false:latency=true`,
 gate:s=>`agate=threshold=${10**(s.threshold/20)}:range=0:ratio=9000:attack=${s.attack*1000}:release=${s.release*1000}:knee=1:detection=peak`,
 'normalize-loudness':(s,t)=>`loudnorm=I=${s.target}:TP=${s.ceiling}:LRA=7,aresample=${t.fixture.sampleRate}`,
 // Prepend the declared noise region for native profile capture, then discard that
 // warmup. The learned profile therefore applies to the entire original signal.
 denoise:(s,t)=>{
  // afftdn buffers two advances (sample_rate / 80); pad and remove that latency.
  // FFmpeg n8.0 libavfilter/af_afftdn.c: config_input() and output_frame().
  const latency=2*Math.floor(t.fixture.sampleRate/80),start=s.noiseFrames+latency
  return `asplit[learn][body];[learn]atrim=end_sample=${s.noiseFrames},asetpts=PTS-STARTPTS[prefix];[prefix][body]concat=n=2:v=0:a=1,apad=pad_len=${latency},asendcmd=c='0 afftdn sn start;${s.noiseFrames/t.fixture.sampleRate} afftdn sn stop',afftdn=nr=${s.reduction??12}:nf=${s.noiseFloor??-50}:tn=0,atrim=start_sample=${start}:end_sample=${start+t.fixture.frames},asetpts=PTS-STARTPTS`
 },
 dither:s=>`aresample=osf=s16:dither_method=triangular:output_sample_bits=${s.bits},aformat=sample_fmts=flt`,
 delay:s=>`asplit[dd][dw];[dd]volume=${1-s.mix}[dry];[dw]adelay=${s.delayFrames}S:all=1,volume=${s.mix}[wet];[dry][wet]amix=inputs=2:normalize=0:duration=first`,
 resample:s=>`aresample=${s.to}`,stretch:s=>`atempo=${1/s.factor}`,speed:(s,t)=>`asetrate=${t.fixture.sampleRate*s.factor},aresample=${t.fixture.sampleRate}`
}
export const soxMap={
 reverse:()=>['reverse'],trim:s=>['trim',`${s.start}s`,`${s.length}s`],gain:s=>['vol',String(s.value)],'gain-db':s=>['gain',String(s.db)],
 pad:s=>['pad',`${s.before}s`,`${s.after}s`],repeat:s=>['repeat',String(s.count-1)],
 fade:(s,t)=>['fade',s.curve==='cos'?'h':'t',`${s.direction==='in'?s.length:0}s`,`${t.fixture.frames}s`,`${s.direction==='out'?s.length:0}s`],
 derivative:()=>['fir','1','-1'],integral:()=>['biquad','1','0','0','1','-1','0'],
 swap:()=>['remix','2','1'],mono:()=>['remix','1v0.5,2v0.5'],duplicate:()=>['remix','1','1'],balance:s=>['remix',`1v${Math.min(1,1-s.value)}`,`2v${Math.min(1,1+s.value)}`],normalize:s=>['norm',String(s.db)],
 lowpass:s=>['lowpass',`-${s.order||2}`,String(s.freq),...(s.order===1?[]:[`${s.Q}q`])],highpass:s=>['highpass',`-${s.order||2}`,String(s.freq),...(s.order===1?[]:[`${s.Q}q`])],
 bandpass:s=>['bandpass',String(s.freq),`${s.Q}q`],notch:s=>['bandreject',String(s.freq),`${s.Q}q`],allpass:s=>['allpass',String(s.freq),`${s.Q}q`],
 lowshelf:s=>['bass',String(s.gain),String(s.freq),`${s.Q}q`],highshelf:s=>['treble',String(s.gain),String(s.freq),`${s.Q}q`],eq:s=>['equalizer',String(s.freq),`${s.Q}q`,String(s.gain)],
 compressor:s=>['compand',`${s.attack},${s.release}`,`${s.knee||0}:-90,-90,${s.threshold},${s.threshold},0,${s.threshold-s.threshold/s.ratio}`,String(s.makeup||0),'-90'],
 limiter:s=>['compand',`0,${s.release}`,`0:-90,-90,${s.ceiling},${s.ceiling},0,${s.ceiling}`,'0','-90',String(s.lookahead)],
 gate:s=>['compand',`${s.attack},${s.release}`,`0:-90,-inf,${s.threshold-.01},-inf,${s.threshold},${s.threshold},0,0`,'0','-90'],
 dither:s=>['dither','-p',String(s.bits)],
 convolve:(s,t)=>{
  if(s.impulse.length===1)return ['vol',String(s.impulse[0])]
  // SoX fir discards its centered filter delay. Native padding restores causal
  // alignment and the requested tail (src/fir.c and src/dft_filter.c).
  const before=Math.floor((s.impulse.length-1)/2),after=s.impulse.length-1-before
  return ['pad',`${before}s`,`${after}s`,'fir',...(s.coefficientFile?[s.coefficientFile]:s.impulse.map(String)),...(s.tail?[]:['trim','0s',`${t.fixture.frames}s`])]
 },
 resample:s=>['rate','-v',String(s.to)],stretch:s=>['tempo',String(1/s.factor)],speed:s=>['speed',String(s.factor)],pitch:s=>['pitch',String(s.semitones*100)]
}
export function native(id){
 const map=id==='ffmpeg'?ffmpegMap:soxMap
 let firNormalization
 const normalization=()=>firNormalization??=(execute(id,['-hide_banner','-h','filter=afir']).then(({stdout,stderr})=>/\birnorm\s/.test(stdout+stderr)?'irnorm=-1':'gtype=none'))
 let identity
 const info=()=>identity??=(async()=>{
  const {stdout,stderr}=await execute(id,[id==='ffmpeg'?'-version':'--version']),build=stdout+stderr
  let version=build.trim().split('\n')[0],executable,executableSha256,packageVersion,versionSource='executable version output'
  try{
   executable=await realpath((await execute(process.platform==='win32'?'where':'which',[id])).stdout.trim().split('\n')[0])
   executableSha256=hash(await readFile(executable))
   packageVersion=executable.match(/\/Cellar\/sox\/([^/]+)\/bin\/sox$/)?.[1]
   if(id==='sox'&&!/\d+\.\d+/.test(version)&&packageVersion){version=`SoX ${packageVersion} (Homebrew package)`;versionSource='resolved Homebrew installation path; binary omits version'}
  }catch{}
  return {version,build,executable,executableSha256,packageVersion,versionSource}
 })()
 return defineAdapter({id,
  async available(){await execute(id,[id==='ffmpeg'?'-version':'--version'],{timeout:5000});return true},
  async version(){return (await info()).version},
  async metadata(){return {...await info(),mode:'subprocess with float WAV I/O',measurementPrecision:'Statistics use the CLI text precision; derived energy inherits rounded RMS error.'}},
  supports(t){
   if(t.workflow)return codecSupported(t)&&!t.workflow.split
   if(t.steps.some(s=>s.op==='processor'))return t.steps.length===1&&nativeProcessor(id,t.steps[0])!==null
   if(t.steps.some(s=>['analyze','measure'].includes(s.op)))return t.steps.length===1&&(['min','max','peak','rms','dc','energy','levels',...(id==='ffmpeg'?['zcr','loudness','true-peak']:[])].includes(t.steps[0].name))
   if(t.steps.some(s=>s.op==='delay'&&s.feedback!==0||s.op==='dither'&&(s.bits!==16||s.distribution!=null&&s.distribution!=='tpdf')))return false
   if(t.steps.some(s=>s.op==='gate'&&s.hold>0))return false
   if(id==='ffmpeg'&&t.steps.some(s=>s.op==='limiter'&&s.lookahead<.0001))return false
   if(id==='ffmpeg'&&t.steps.length>1&&t.steps.some(s=>s.op==='pitch'))return false
   if(id==='ffmpeg'&&t.steps.length>1&&t.steps.some(s=>s.op==='normalize'))return false
   if(t.steps.slice(0,-1).some(s=>['trim','pad','repeat','resample','speed','stretch'].includes(s.op)))return false
   if(t.steps.some(s=>s.other||['reverse-range','remove','convolve','delay','denoise'].includes(s.op))&&t.steps.length!==1)return false
   return t.steps.every(s=>(!!map[s.op]||id==='sox'&&soxEdits.includes(s.op)||id==='ffmpeg'&&['mix','insert','crossfade','reverse-range','remove','convolve','pitch'].includes(s.op))&&!(id==='sox'&&s.op==='fade'&&s.curve&&!['linear','cos'].includes(s.curve)))
  },
  async run(t,input,sr){
   if(codecSupported(t))return nativeCodec(id,t,input,sr)
   const s=t.steps[0]
   if(['analyze','measure'].includes(s?.op))return nativeMeasure(id,s,input,sr)
   if(s?.op==='processor'){
    const effect=nativeProcessor(id,s)
    if(effect===null)throw new RangeError(`Unsupported ${id} processor controls: ${s.name}`)
    return wavProcess(id,(source,target)=>id==='ffmpeg'?['-nostdin','-v','error','-y','-i',source,'-af',effect,'-c:a','pcm_f32le',target]:['-D',source,'-t','wav','-e','floating-point','-b','32',target,...effect],input,sr)
   }
   if(id==='sox'&&soxEdits.includes(s?.op))return soxEdit(s,input,sr)
   if(id==='ffmpeg'){
    if(s?.op==='normalize'){
      const {scalar:peak}=await nativeMeasure(id,{name:'peak'},input,sr)
      const filters=map.normalize({...s,linearGain:peak?10**(s.db/20)/peak:1})
      return wavProcess(id,(source,target)=>['-nostdin','-v','error','-y','-i',source,'-af',filters,'-c:a','pcm_f32le',target],input,sr)
    }
    if(s?.op==='denoise'){
      const {scalar:rms}=await nativeMeasure(id,{name:'rms'},input.map(x=>x.slice(0,s.noiseFrames)),sr)
      const noiseFloor=Math.max(-80,Math.min(-20,20*Math.log10(rms)))
      const filters=map.denoise({...s,noiseFloor},t)
      return wavProcess(id,(source,target)=>['-nostdin','-v','error','-y','-i',source,'-af',filters,'-c:a','pcm_f32le',target],input,sr)
    }
    if(s?.other||['reverse-range','remove','convolve'].includes(s?.op)){
      let graph,other
      if(s.other)other=makeSignal(s.other).channels
      if(s.op==='crossfade')graph=`[0:a][1:a]acrossfade=ns=${s.length}:c1=${s.curve==='equal-power'?'qsin':'tri'}:c2=${s.curve==='equal-power'?'qsin':'tri'}[out]`
      if(s.op==='mix')graph=`[1:a]adelay=${s.at}S:all=1[b];[0:a][b]amix=inputs=2:normalize=0:duration=first[out]`
      if(s.op==='insert')graph=`[0:a]asplit[a][b];[a]atrim=end_sample=${s.at},asetpts=PTS-STARTPTS[head];[b]atrim=start_sample=${s.at},asetpts=PTS-STARTPTS[tail];[head][1:a][tail]concat=n=3:v=0:a=1[out]`
      if(s.op==='remove')graph=`[0:a]asplit[a][b];[a]atrim=end_sample=${s.start},asetpts=PTS-STARTPTS[head];[b]atrim=start_sample=${s.start+s.length},asetpts=PTS-STARTPTS[tail];[head][tail]concat=n=2:v=0:a=1[out]`
      if(s.op==='reverse-range')graph=`[0:a]asplit=3[a][b][c];[a]atrim=end_sample=${s.start},asetpts=PTS-STARTPTS[head];[b]atrim=start_sample=${s.start}:end_sample=${s.start+s.length},areverse,asetpts=PTS-STARTPTS[mid];[c]atrim=start_sample=${s.start+s.length},asetpts=PTS-STARTPTS[tail];[head][mid][tail]concat=n=3:v=0:a=1[out]`
      if(s.op==='convolve'){other=[Float32Array.from(s.impulse)];graph=`[0:a]apad=pad_len=${s.tail?s.impulse.length-1:0}[padded];[padded][1:a]afir=dry=1:wet=1:${await normalization()}:irfmt=mono:precision=double[out]`}
      return wavProcess(id,(source,target,secondary)=>['-nostdin','-v','error','-y','-i',source,...(other?['-i',secondary]:[]),'-filter_complex',graph,'-map','[out]','-c:a','pcm_f32le',target],input,sr,other)
    }
    if(s?.op==='pitch')return wavProcess(id,(source,target)=>['-nostdin','-v','error','-y','-i',source,'-af',`asetrate=${sr*2**(s.semitones/12)},aresample=${sr},atempo=${1/2**(s.semitones/12)}`,'-c:a','pcm_f32le',target],input,sr)
    const filters=t.steps.map(s=>map[s.op](s,t)).join(',')
    return wavProcess(id,(source,target)=>['-nostdin','-v','error','-y','-i',source,...(filters?['-af',filters]:[]),'-c:a','pcm_f32le',target],input,sr)
   }
   const directory=s?.op==='convolve'&&s.impulse.length>1?await mkdtemp(join(tmpdir(),'audio-sox-ir-')):null
   try{
     const coefficientFile=directory?join(directory,'coefficients.txt'):null
     if(coefficientFile)await writeFile(coefficientFile,s.impulse.join('\n')+'\n')
     const effects=t.steps.flatMap(step=>map[step.op](coefficientFile?{...step,coefficientFile}:step,t));if(t.steps.some(step=>step.op==='speed'))effects.push('rate',String(sr))
     return await wavProcess(id,(source,target)=>['-D',source,'-t','wav','-e','floating-point','-b','32',target,...effects],input,sr)
   }finally{if(directory)await rm(directory,{recursive:true,force:true})}
  }
 })
}
