import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { dirname, join, isAbsolute } from 'node:path'
import { defineAdapter } from '../src/adapter.js'
import { hash,provenance } from '../src/provenance.js'
import { makeSignal } from '../src/signals.js'
import { audioCodec, codecSupported } from './codecs.js'
const require=createRequire(import.meta.url)
let lib, origin
async function library(){
  if(lib)return lib
  origin=process.env.AUDIO_MODULE ? (isAbsolute(process.env.AUDIO_MODULE)?pathToFileURL(process.env.AUDIO_MODULE).href:process.env.AUDIO_MODULE) : pathToFileURL(require.resolve('audio')).href
  lib=(await import(origin)).default
  return lib
}
const exactOps=['mix','insert','crossfade','reverse','reverse-range','trim','remove','pad','repeat','gain','gain-db','fade','swap','mono','duplicate','balance','normalize','derivative','integral']
const dspOps=['lowpass','highpass','bandpass','notch','allpass','lowshelf','highshelf','eq','resample','stretch','speed','pitch','processor','analyze','measure','normalize-loudness','compressor','limiter','gate','delay','dither','denoise']
const copy=chs=>chs.map(x=>Float32Array.from(x))
export default defineAdapter({
 id:'audio',
 async available(){await library();return true},
 async version(){const a=await library();return a.version||'unknown'},
 async metadata(){
   await library()
   const dir=origin.startsWith('file:')?dirname(fileURLToPath(origin)):null
   const p=dir?JSON.parse(await readFile(join(dir,'package.json'),'utf8')):null
   return {origin,packageVersion:p?.version,mode:'in-process library',sourceSha256:origin.startsWith('file:')?hash(await readFile(fileURLToPath(origin))):null,source:dir?await provenance(dir):null,dependencies:p?.dependencies}
 },
 supports(t){return t.workflow?codecSupported(t)||['clip-reverse','copy-reverse','clone-reverse','undo','undo-redo','stream','resample-chunks'].includes(t.workflow.op):t.steps.every((s,i)=>
   [...exactOps,...dspOps].includes(s.op)&&
   (!['lowpass','highpass'].includes(s.op)||(Number.isSafeInteger(s.order??2)&&(s.order??2)>=2&&(s.order??2)%2===0))&&
   (!['analyze','measure'].includes(s.op)||i===t.steps.length-1)&&
   (s.op!=='measure'||['loudness','true-peak','levels','pitch','onsets','tempo','spectrum'].includes(s.name))&&
   (s.op!=='analyze'||['min','max','peak','rms','dc','energy','zcr'].includes(s.name))&&
   (s.op!=='dither'||!s.distribution||s.distribution==='tpdf'))},
 async run(t,input,sr){
   const a=await library(),source=a.from(copy(input),{sampleRate:sr});let child
   try {
     if(t.workflow){
       if(codecSupported(t))return await audioCodec(a,source,t)
       if(t.workflow.op==='resample-chunks'){
         const {to,chunks}=t.workflow
         if(!chunks?.length||chunks.some(n=>!Number.isSafeInteger(n)||n<=0))throw new RangeError('Resampling chunks must have positive integer sizes')
         child=a(null,{sampleRate:sr,channels:input.length}).resample(to)
         const parts=[],collecting=(async()=>{for await(const block of child.stream())parts.push(copy(block))})()
         collecting.catch(()=>{})
         try{
           let pos=0,index=0
           while(pos<input[0].length){
             const end=Math.min(input[0].length,pos+chunks[index++%chunks.length])
             child.push(input.map(ch=>ch.slice(pos,end)),{sampleRate:sr});pos=end
             await new Promise(resolve=>setImmediate(resolve))
           }
         }finally{child.stop()}
         await collecting
         const frames=parts.reduce((n,p)=>n+p[0].length,0),channels=input.map(()=>new Float32Array(frames))
         let offset=0;for(const block of parts){block.forEach((ch,c)=>channels[c].set(ch,offset));offset+=block[0].length}
         source.resample(to)
         return {channels,sampleRate:to,observations:{batch:copy(await source.read())}}
       }
       const {op,start,length}=t.workflow,range={at:start/sr,duration:length/sr}
       if(op==='clip-reverse')child=source.clip(range).reverse()
       if(op==='clone-reverse')child=source.clone().reverse()
       if(op==='copy-reverse'){source.copy(range).paste();source.reverse({at:input[0].length/sr,duration:length/sr})}
       if(op==='undo'){source.reverse().gain(-6);source.undo(2)}
       if(op==='undo-redo'){
         child=source.clone().reverse().gain(.5,{unit:'linear'});await child.read()
         const edits=child.undo(2),undone=copy(await child.read());child.run(...edits.reverse())
         return {channels:copy(await child.read()),observations:{undone,sourceAfter:copy(await source.read())}}
       }
       if(op==='stream'){
         source.reverse().gain(.5,{unit:'linear'})
         const channels=copy(await source.read()), chunks=channels.map(()=>[])
         for await(const block of source.stream()) block.forEach((ch,c)=>chunks[c].push(...ch))
         return {channels,observations:{stream:chunks.map(x=>Float32Array.from(x)),sourceAfter:copy(input)}}
       }
       const channels=copy(await (child||source).read()),after=copy(await source.read())
       return {channels,observations:{sourceAfter:op==='copy-reverse'?after.map(x=>x.slice(0,input[0].length)):after}}
     }
     let rate=sr
     for(const s of t.steps){
       const range={at:s.start/rate,duration:s.length/rate}
       switch(s.op){
         case 'mix':source.mix(makeSignal(s.other).channels,s.at/rate);break
         case 'insert':source.insert(makeSignal(s.other).channels,s.at/rate);break
         case 'crossfade':source.crossfade(makeSignal(s.other).channels,s.length/rate,s.curve==='equal-power'?'equal':s.curve);break
         case 'reverse':source.reverse();break
         case 'reverse-range':source.reverse(range);break
         case 'trim':source.crop(range);break
         case 'remove':source.remove(range);break
         case 'pad':source.pad(s.before/rate,s.after/rate);break
         case 'repeat':source.repeat(s.count-1);break
         case 'gain':source.gain(s.value,{unit:'linear'});break
         case 'gain-db':source.gain(s.db);break
         case 'fade':source.fade((s.direction==='out'?-1:1)*s.length/rate,{curve:s.curve||'linear'});break
         case 'swap':source.remix([1,0]);break
         case 'mono':source.remix(1);break
         case 'duplicate':source.remix([0,0]);break
         case 'balance':source.pan(s.value);break
         case 'normalize':source.normalize(s.db,{dc:false});break
         case 'normalize-loudness':source.normalize(s.target,{mode:'lufs',ceiling:s.ceiling,dc:false});break
         case 'compressor':source.compressor({threshold:s.threshold,ratio:s.ratio,knee:s.knee,attack:s.attack*1000,release:s.release*1000,makeup:s.makeup??0,upRatio:1});break
         case 'limiter':source.limiter({ceiling:s.ceiling,lookahead:s.lookahead*1000,release:s.release*1000});break
         case 'gate':source.gate({threshold:s.threshold,closeThreshold:s.threshold,attack:s.attack*1000,hold:s.hold*1000,release:s.release*1000,range:-90});break
         case 'delay':{
           // The canonical delay renders the input span. audio deliberately adds
           // a wet tail, so request that span explicitly rather than compare defaults.
           const duration=source.duration
           source.delay({time:s.delayFrames/rate,feedback:s.feedback,mix:s.mix}).crop({at:0,duration})
           break
         }
         case 'dither':source.dither(s.bits);break
         case 'denoise':source.denoise({noise:{at:0,duration:s.noiseFrames/rate},reduction:s.reduction??12});break
         case 'measure':{
           if(s.name==='loudness')return {scalar:await source.stat('loudness')}
           if(s.name==='true-peak')return {scalar:await source.stat('truepeak')}
           if(s.name==='levels')return {values:{peak:10**(await source.stat('db')/20),rms:await source.stat('rms'),dc:await source.stat('dc')}}
           if(s.name==='pitch'){const notes=await source.notes();const weight=notes.reduce((sum,n)=>sum+n.duration,0);return {scalar:weight?notes.reduce((sum,n)=>sum+n.freq*n.duration,0)/weight:0}}
           if(s.name==='onsets')return {events:Array.from(await source.onsets())}
           if(s.name==='tempo')return {scalar:await source.bpm()}
           if(s.name==='spectrum'){
             const {magnitude}=await import(new URL('./fn/spectrum.js',origin));const pcm=await source.read(),size=s.size||pcm[0].length
             const magnitudes=Array.from(magnitude(pcm.map(ch=>ch.subarray(0,size))),v=>v*2*size/(size-1))
             return {spectrum:{frequencies:magnitudes.map((_,i)=>i*rate/size),magnitudes}}
           }
           throw new Error(`Unknown measurement: ${s.name}`)
         }
         case 'lowpass':case 'highpass':source[s.op](s.freq,s.order||2);break
         case 'bandpass':case 'notch':case 'allpass':source[s.op](s.freq,s.Q);break
         case 'lowshelf':case 'highshelf':case 'eq':source[s.op](s.freq,s.gain,s.Q);break
         case 'resample':source.resample(s.to);rate=s.to;break
         case 'stretch':source.stretch(s.factor);break
         case 'speed':source.speed(s.factor);break
         case 'pitch':source.pitch(s.semitones);break
         case 'processor':source[s.name](s.params);break
         case 'analyze':{
           const names={peak:'db',energy:'rms'}
           let scalar=await source.stat(names[s.name]||s.name)
           if(s.name==='peak')scalar=10**(scalar/20)
           if(s.name==='energy')scalar=scalar*scalar*source.channels*source.length
           return {scalar}
         }
         default:source[s.op]()
       }
     }
     return {channels:copy(await source.read()),sampleRate:rate}
   } finally{child?.dispose();source.dispose()}
 }
})
