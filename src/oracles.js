import { compareChannels } from './metrics.js'
import { statistics } from './reference.js'
import { makeSignal } from './signals.js'
export const rms=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0)/Math.max(1,x.length))
const db=x=>20*Math.log10(Math.max(1e-30,x))
const sameShape=(channels,input)=>channels.length===input.length&&channels.every((x,c)=>x.length===input[c].length)
// Keep the first channel's metrics for existing reports, but every channel must pass.
function checkChannels(channels,input,measure) {
 const perChannel=input.map((ref,c)=>channels[c]?measure(channels[c],ref,c):{pass:false,reason:'missing-channel'})
 return {...perChannel[0],perChannel,pass:channels.length===input.length&&perChannel.every(v=>v.pass)}
}

// Independent direct-form implementation of the 48 kHz coefficients and gating in
// ITU-R BS.1770-5 Annex 1, tables 1–2. Scope: mono/stereo, integrated loudness.
export function integratedLoudness(channels,sr=48000) {
 if(sr!==48000||channels.length<1||channels.length>2)throw new RangeError('Loudness oracle requires 48 kHz mono/stereo')
 const n=channels[0].length,energy=new Float64Array(n+1)
 for(const x of channels){
   let x1=0,x2=0,y1=0,y2=0,z1=0,z2=0
   for(let i=0;i<n;i++){
     const y=1.53512485958697*x[i]-2.69169618940638*x1+1.19839281085285*x2+1.69065929318241*y1-.73248077421585*y2
     const z=y-2*y1+y2+1.99004745483398*z1-.99007225036621*z2
     x2=x1;x1=x[i];y2=y1;y1=y;z2=z1;z1=z
     energy[i+1]+=z*z
   }
 }
 for(let i=1;i<=n;i++)energy[i]+=energy[i-1]
 const block=19200,hop=4800,powers=[]
 for(let i=0;i+block<=n;i+=hop)powers.push((energy[i+block]-energy[i])/block)
 const abs=10**((-70+.691)/10),kept=powers.filter(p=>p>abs)
 if(!kept.length)return -Infinity
 const relative=kept.reduce((a,b)=>a+b,0)/kept.length/10,selected=kept.filter(p=>p>relative)
 return -.691+10*Math.log10(selected.reduce((a,b)=>a+b,0)/selected.length)
}

// Fourfold windowed-sinc reconstruction, independent of contenders' peak meters.
// Used for the declared synthetic normalization checks, not certification.
export function reconstructedPeak(channels) {
 const taps=32,phases=[.25,.5,.75].map(phase=>{
   const a=Float64Array.from({length:taps},(_,j)=>{const t=j-15-phase;return Math.sin(Math.PI*t)/(Math.PI*t)*(.5+.5*Math.cos(Math.PI*t/16))})
   const sum=a.reduce((s,v)=>s+v,0);return a.map(v=>v/sum)
 })
 let peak=statistics(channels).peak
 for(const x of channels)for(let i=15;i+16<x.length;i++)for(const kernel of phases){let y=0;for(let j=0;j<taps;j++)y+=x[i+j-15]*kernel[j];peak=Math.max(peak,Math.abs(y))}
 return peak
}

function snr(actual,wanted,start=0,end=Math.min(actual.length,wanted.length)) {
 let signal=0,error=0
 for(let i=start;i<end;i++){signal+=wanted[i]**2;error+=(actual[i]-wanted[i])**2}
 return 10*Math.log10(Math.max(1e-30,signal)/Math.max(1e-30,error))
}

function measurement(test,actual,input,sr) {
 const o=test.oracle
 if(o.type==='scalar-range')return {pass:Number.isFinite(actual.scalar)&&actual.scalar>=o.min&&actual.scalar<=o.max,actual:actual.scalar,min:o.min,max:o.max}
 if(o.type==='levels'){
   const expected=statistics(input),errors=Object.fromEntries(['peak','rms','dc'].map(k=>[k,Math.abs((actual.values?.[k]??NaN)-expected[k])]))
   return {pass:Object.values(errors).every(e=>Number.isFinite(e)&&e<=o.atol),actual:actual.values,expected:{peak:expected.peak,rms:expected.rms,dc:expected.dc},errors}
 }
 if(o.type==='spectrum'){
   const f=actual.spectrum?.frequencies,m=actual.spectrum?.magnitudes
   if(!f?.length||m?.length!==f.length||!Array.from(f).every(Number.isFinite)||!Array.from(m).every(v=>Number.isFinite(v)&&v>=0))return {pass:false,reason:'invalid-spectrum'}
   let peak=0;for(let i=1;i<m.length;i++)if(m[i]>m[peak])peak=i
   const frequency=f[peak],amplitude=m[peak],frequencyError=Math.abs(frequency-test.fixture.frequency),amplitudeError=Math.abs(amplitude/test.fixture.amplitude-1)
   return {pass:frequencyError<=o.hzTolerance&&amplitudeError<=o.amplitudeTolerance,frequency,amplitude,frequencyError,amplitudeError}
 }
 if(o.type==='events'){
   const events=actual.events,expected=test.fixture.events
   if(!Array.isArray(events)||!events.every(Number.isFinite))return {pass:false,reason:'invalid-events'}
   const used=new Set();let matched=0,maxError=0
   for(const time of expected){let nearest=-1,error=Infinity;for(let i=0;i<events.length;i++)if(!used.has(i)&&Math.abs(events[i]-time)<error){nearest=i;error=Math.abs(events[i]-time)}if(error<=o.tolerance){used.add(nearest);matched++;maxError=Math.max(maxError,error)}}
   const precision=matched/Math.max(1,events.length),recall=matched/expected.length,fscore=2*precision*recall/Math.max(1e-30,precision+recall)
   return {pass:fscore>=o.minFscore,matched,expected:expected.length,detected:events.length,precision,recall,fscore,maxError}
 }
 return null
}
// Windowed spectral peak, not zero crossings (which mistake added harmonics for pitch).
export function toneFrequency(x,sr){
 let n=1;while(n*2<=x.length&&n<32768)n*=2
 if(n<4)return 0
 const re=new Float64Array(n),im=new Float64Array(n)
 for(let i=0;i<n;i++)re[i]=x[i]*(.5-.5*Math.cos(2*Math.PI*i/(n-1)))
 for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j)[re[i],re[j]]=[re[j],re[i]]}
 for(let size=2;size<=n;size*=2)for(let start=0;start<n;start+=size)for(let j=0;j<size/2;j++){
   const a=-2*Math.PI*j/size,c=Math.cos(a),s=Math.sin(a),u=start+j,v=u+size/2,r=re[v]*c-im[v]*s,q=re[v]*s+im[v]*c
   re[v]=re[u]-r;im[v]=im[u]-q;re[u]+=r;im[u]+=q
 }
 const p=Float64Array.from(re,(r,i)=>Math.hypot(r,im[i]));let k=1
 for(let i=2;i<n/2;i++)if(p[i]>p[k])k=i
 if(p[k]<1e-12)return 0
 const a=Math.log(p[k-1]+1e-30),b=Math.log(p[k]+1e-30),c=Math.log(p[k+1]+1e-30)
 return (k+.5*(a-c)/(a-2*b+c))*sr/n
}
export function judge(test,actual,wanted,input,sr){
  const o=test.oracle
  if(!actual||typeof actual!=='object')return {pass:false,reason:'missing-output'}
  const measured=measurement(test,actual,input,sr)
  if(measured)return measured
  if(o.type==='scalar'){const error=Math.abs(actual.scalar-wanted.scalar);return {pass:Number.isFinite(actual.scalar)&&Number.isFinite(error)&&error<=(o.atol??0),actual:actual.scalar,expected:wanted.scalar,absoluteError:error}}
  const channels=actual.channels
  const rectangular=Array.isArray(channels)&&channels.length>0&&channels.every(x=>x!=null&&typeof x.length==='number'&&x.length===channels[0].length)
  const finite=rectangular&&channels.every(x=>Array.from(x).every(Number.isFinite))
  if(!rectangular||!finite)return {pass:false,reason:!rectangular?'invalid-channel-shape':'non-finite'}
  if(o.type==='phase'){
    const frequency=test.fixture.frequency,start=Math.floor(input[0].length/2),omega=2*Math.PI*frequency/sr
    const components=x=>{
      let sine=0,cosine=0
      for(let i=start;i<x.length;i++){sine+=x[i]*Math.sin(omega*i);cosine+=x[i]*Math.cos(omega*i)}
      return {angle:Math.atan2(cosine,sine),amplitude:2*Math.hypot(sine,cosine)/(x.length-start)}
    }
    const measured=checkChannels(channels,input,(x,ref)=>{
      const output=components(x),source=components(ref),phaseDegrees=(output.angle-source.angle)*180/Math.PI
      const delta=(phaseDegrees-o.phaseDegrees)*Math.PI/180,phaseError=Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI)
      const gainDb=20*Math.log10(output.amplitude/source.amplitude)
      return {phaseDegrees,phaseError,gainDb,pass:Number.isFinite(gainDb)&&Math.abs(gainDb)<=o.gainTolerance&&phaseError<=o.phaseTolerance}
    })
    return {...measured,channels:channels.length,expectedChannels:input.length,lengthDelta:input.map((ch,c)=>(channels[c]?.length??0)-ch.length),sampleRate:actual.sampleRate,expectedRate:sr,pass:sameShape(channels,input)&&measured.pass&&(actual.sampleRate===undefined||actual.sampleRate===sr)}
  }
  if(o.type==='convolution-dc'){
    const step=test.steps[0],impulse=step?.impulse,n=input[0].length,level=Math.fround(test.fixture.value??.25)
    if(test.fixture.signal!=='dc'||step?.op!=='convolve'||test.steps.length!==1||!impulse?.length)throw new Error('convolution-dc requires one convolution of a constant fixture')
    const frames=n+(step.tail?impulse.length-1:0),prefix=new Float64Array(impulse.length+1)
    for(let i=0;i<impulse.length;i++)prefix[i+1]=prefix[i]+impulse[i]
    if(channels.length!==input.length||channels[0].length!==frames)return {pass:false,reason:'shape',frames:channels[0].length,expectedFrames:frames}
    let maxAbsError=0,squared=0,count=0
    for(const ch of channels)for(let i=0;i<frames;i++){
      const first=Math.max(0,i-n+1),last=Math.min(impulse.length-1,i),wanted=level*(prefix[last+1]-prefix[first]),error=ch[i]-wanted
      maxAbsError=Math.max(maxAbsError,Math.abs(error));squared+=error*error;count++
    }
    return {pass:maxAbsError<=(o.atol??2e-5),maxAbsError,rmsError:Math.sqrt(squared/Math.max(1,count)),frames,expectedFrames:frames}
  }
  if(['exact','exact-with-source','workflow','neutral'].includes(o.type)){
    const metrics=compareChannels(channels,wanted.channels,o.atol??0)
    if(test.workflow){const source=compareChannels(actual.observations?.sourceAfter,wanted.observations.sourceAfter,0);metrics.sourceUnchanged=source.pass;metrics.sourceMaxAbsError=source.maxAbsError;metrics.pass&&=source.pass}
    if(test.workflow?.op==='codec-roundtrip'){
      const depth=test.workflow.bitDepth??16,format=depth===32?'float':'integer'
      metrics.sampleRate=actual.sampleRate;metrics.encodedBytes=actual.encodedBytes;metrics.bitDepth=actual.bitDepth;metrics.sampleFormat=actual.sampleFormat
      metrics.pass&&=actual.sampleRate===sr&&actual.encodedBytes>0&&actual.bitDepth===depth&&actual.sampleFormat===format
    }
    if(test.workflow?.op==='stream'){const stream=compareChannels(actual.observations?.stream,channels,0);metrics.streamEqual=stream.pass;metrics.pass&&=stream.pass}
    if(test.workflow?.op==='undo-redo'){const undone=compareChannels(actual.observations?.undone,wanted.observations.undone,0);metrics.undoEqual=undone.pass;metrics.pass&&=undone.pass}
    return metrics
  }
  if(o.type==='chunk-equivalence'){
    const to=test.workflow.to,batch=actual.observations?.batch
    if(!Array.isArray(batch)||!batch.length||batch.some(x=>!x||typeof x.length!=='number'))return {pass:false,reason:'missing-batch-output'}
    const compared=compareChannels(channels,batch,o.atol)
    const lengthError=channels[0].length-Math.round(input[0].length*to/sr)
    const measured=checkChannels(channels,input,x=>{const frequency=toneFrequency(x.slice(Math.floor(x.length/4)),to);return {frequency,pass:Math.abs(frequency/test.fixture.frequency-1)<.01}})
    return {...compared,...measured,pass:compared.pass&&measured.pass&&Math.abs(lengthError)<=1&&actual.sampleRate===to,lengthError}
  }
  if(o.type==='seams'){
    const compared=compareChannels(channels,wanted.channels,o.atol),jumps=o.boundaries.map(frame=>({frame,channels:channels.map(x=>Math.abs(x[frame]-x[frame-1]))}))
    return {...compared,jumps,scope:'Measures introduced jumps; exact reversal does not promise click suppression'}
  }
  if(o.type==='loudness-target'){
    const loudness=integratedLoudness(channels,actual.sampleRate??sr),truePeak=db(reconstructedPeak(channels))
    return {pass:sameShape(channels,input)&&Math.abs(loudness-o.target)<=o.tolerance&&truePeak<=o.ceiling+.1,loudness,target:o.target,truePeak,ceiling:o.ceiling}
  }
  if(o.type==='dynamics'){
    const measured=checkChannels(channels,input,(x,ref)=>{
      const windows=o.windows.map(w=>{
        const a=Math.round(w.start*sr),b=Math.round(w.end*sr),gainDb=db(rms(x.slice(a,b)))-db(rms(ref.slice(a,b)))
        return {...w,gainDb,pass:Number.isFinite(gainDb)&&gainDb>=w.minDb&&gainDb<=w.maxDb}
      })
      return {pass:windows.every(w=>w.pass),windows}
    })
    return {...measured,pass:sameShape(channels,input)&&measured.pass}
  }
  if(o.type==='limiter'){
    const peak=statistics(channels).peak,ceiling=10**(o.ceiling/20)
    const measured=checkChannels(channels,input,(x,ref)=>{
      const inputPeak=statistics([ref]).peak,peak=statistics([x]).peak
      const probe=ref.findIndex(v=>Math.abs(v)>o.probeThreshold),found=x.findIndex(v=>Math.abs(v)>o.probeThreshold),latencyFrames=found-probe
      const aligned=probe<0?found<0:found>=0&&Math.abs(latencyFrames)<=o.latencyTolerance
      return {pass:peak<=Math.min(ceiling,inputPeak)+o.atol&&peak>=Math.min(ceiling,inputPeak)*.8&&aligned,peak,inputPeak,latencyFrames}
    })
    return {...measured,pass:sameShape(channels,input)&&measured.pass,peak,ceiling}
  }
  if(o.type==='dither'){
    const quantum=1/(2**(o.bits-1)),n=channels[0].length
    const perChannel=channels.map(x=>{
      let sum=0,power=0,zero=0,lag=0,gridError=0,peak=0
      for(let i=0;i<n;i++){const q=x[i]/quantum;sum+=q;power+=q*q;zero+=Math.abs(q)<.1;peak=Math.max(peak,Math.abs(q));gridError=Math.max(gridError,Math.abs(q-Math.round(q)));if(i)lag+=q*x[i-1]/quantum}
      return {mean:sum/n,rms:Math.sqrt(power/n),zero:zero/n,lag:lag/Math.max(power,1e-30),gridError,peak}
    })
    const pass=sameShape(channels,input)&&perChannel.every(v=>Math.abs(v.mean)<.02&&v.rms>=.45&&v.rms<=.55&&v.zero>=.71&&v.zero<=.79&&Math.abs(v.lag)<.04&&v.gridError<.001&&v.peak<=1.001)
    return {pass,quantum,perChannel,scope:'TPDF followed by quantization, digital silence'}
  }
  if(o.type==='denoise'){
    const clean=makeSignal({...test.fixture,noiseAmplitude:0}).channels,start=test.fixture.startFrames+Math.round(.1*sr)
    const measured=checkChannels(channels,input,(x,ref,c)=>{
      const before=snr(ref,clean[c],start),after=snr(x,clean[c],start)
      let dot=0,power=0;for(let i=start;i<clean[c].length;i++){dot+=x[i]*clean[c][i];power+=clean[c][i]**2}
      const gainDb=db(Math.abs(dot/power)),noiseReduction=db(rms(ref.slice(4096,test.fixture.startFrames)))-db(rms(x.slice(4096,test.fixture.startFrames)))
      return {pass:after-before>=o.minImprovement&&Math.abs(gainDb)<=o.maxSignalLoss&&noiseReduction>=o.minNoiseReduction,before,after,improvement:after-before,gainDb,noiseReduction}
    })
    return {...measured,pass:sameShape(channels,input)&&measured.pass,scope:'Seeded stationary noise plus one tone; no perceptual-quality claim'}
  }
  if(o.type==='resample-snr'){
    const rate=actual.sampleRate??sr,ideal=makeSignal({...test.fixture,frames:Math.round(input[0].length*o.to/sr),sampleRate:o.to}).channels
    const lengthError=channels[0].length-ideal[0].length
    const measured=checkChannels(channels,input,(x,ref,c)=>{const start=128,end=Math.min(x.length,ideal[c].length)-128,snrDb=snr(x,ideal[c],start,end);return {snrDb,pass:end>start&&snrDb>=o.minSnr}})
    return {...measured,pass:measured.pass&&rate===o.to&&Math.abs(lengthError)<=1,minSnr:o.minSnr,lengthError}
  }
  if(o.type==='stretch-transient'){
    const rate=actual.sampleRate??sr,lengthError=channels[0].length-input[0].length*o.factor
    const measured=checkChannels(channels,input,x=>{
      const frequency=toneFrequency(x.slice(0,Math.round(o.toneSeconds*o.factor*sr)),rate)
      let peak=Math.round(o.searchStart*o.factor*sr);for(let i=peak+1;i<x.length;i++)if(Math.abs(x[i])>Math.abs(x[peak]))peak=i
      const timeError=peak/sr-o.transientTime*o.factor
      return {pass:Math.abs(frequency/o.frequency-1)<=.02&&Math.abs(timeError)<=o.timeTolerance,frequency,timeError}
    })
    return {...measured,pass:measured.pass&&Math.abs(lengthError)<=input[0].length*.01,lengthError}
  }
  if(o.type==='integrity')return {pass:channels[0].length>0,finite,frames:channels[0].length,channels:channels.length,peak:Math.max(...channels.map(x=>x.reduce((p,v)=>Math.max(p,Math.abs(v)),0))),scope:'integrity only; no algorithm-quality assertion'}
  if(['response','resample','tone'].includes(o.type)){
    const rate=actual.sampleRate??sr
    const measured=checkChannels(channels,input,(output,source)=>{
      const x=output.slice(Math.floor(output.length/2)),ref=source.slice(Math.floor(source.length/2)),gainDb=20*Math.log10(Math.max(1e-15,rms(x))/Math.max(1e-15,rms(ref)))
      if(o.type==='response')return {pass:gainDb>=o.min&&gainDb<=o.max,gainDb}
      const frequency=toneFrequency(x,rate)
      if(o.type==='resample')return {pass:gainDb>=o.min&&gainDb<=o.max&&(!o.frequency||Math.abs(frequency/o.frequency-1)<.01),gainDb,frequency}
      const pitchError=Math.abs(frequency/o.frequency-1)
      return {pass:pitchError<=.02,frequency,pitchError}
    })
    if(o.type==='response')return {...measured,pass:measured.pass&&sameShape(channels,input),min:o.min,max:o.max}
    if(o.type==='resample'){
      const lengthError=channels[0].length-Math.round(input[0].length*o.to/sr)
      return {...measured,pass:measured.pass&&rate===o.to&&Math.abs(lengthError)<=1,sampleRate:rate,expectedRate:o.to,lengthError}
    }
    const lengthError=channels[0].length-input[0].length*o.lengthFactor
    return {...measured,pass:measured.pass&&Math.abs(lengthError)<=Math.max(2,input[0].length*.01),lengthError,expectedFrequency:o.frequency}
  }
  throw new Error(`Unknown oracle: ${o.type}`)
}
