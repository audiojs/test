import { defineAdapter } from '../src/adapter.js'
import { makeSignal } from '../src/signals.js'

const filters=new Set(['lowpass','highpass','bandpass','notch','allpass','lowshelf','highshelf','eq'])
const operations=new Set(['gain','gain-db','fade','trim','pad','repeat','swap','mono','duplicate','balance','mix','insert','crossfade','speed','resample','delay','convolve','compressor'])
const processorDefaults={
 compressor:{threshold:-20,ratio:4,knee:6,makeup:0,attack:5,release:100,upRatio:1},
 delay:{time:.25,feedback:.3,mix:.5},tremolo:{rate:5,depth:.5},
 dcblocker:{R:.995},derivative:{},integral:{leak:1},emphasis:{alpha:.97},deemphasis:{alpha:.97}
}

export function webaudioProcessor({name,params={}}){
 const defaults=processorDefaults[name]
 if(!defaults||Object.keys(params).some(key=>!(key in defaults)))return null
 const p={...defaults,...params}
 if(Object.values(p).some(value=>!Number.isFinite(value)))return null
 if(name==='compressor'){
  if(p.upRatio!==1||p.threshold< -100||p.threshold>0||p.ratio<1||p.ratio>20||p.knee<0||p.knee>40||p.attack<0||p.attack>1000||p.release<0||p.release>1000||p.makeup< -12||p.makeup>24)return null
  return {op:'compressor',threshold:p.threshold,ratio:p.ratio,knee:p.knee,makeup:p.makeup,attack:p.attack/1000,release:p.release/1000}
 }
 if(name==='delay')return p.time>=0&&p.time<180&&p.feedback>=0&&p.feedback<1&&p.mix>=0&&p.mix<=1?{op:'delay',...p}:null
 if(name==='tremolo')return p.rate>=.1&&p.rate<=20&&p.depth>=0&&p.depth<=1?{op:'tremolo',...p}:null
 const iir=(feedforward,feedback)=>({op:'iir',feedforward,feedback})
 if(name==='dcblocker')return p.R>=0&&p.R<1?iir([1,-1],[1,-p.R]):null
 if(name==='derivative')return iir([1,-1],[1])
 if(name==='integral')return p.leak>=0&&p.leak<=1?iir([1],[1,-p.leak]):null
 if(name==='emphasis'||name==='deemphasis')return p.alpha>=0&&p.alpha<1?iir(name==='emphasis'?[1,-p.alpha]:[1],name==='deemphasis'?[1,-p.alpha]:[1]):null
 return null
}

export function webaudio(engine='chromium') {
 let browser,page
 const id=engine==='chromium'?'webaudio':`webaudio-${engine}`
 async function connect(){
  if(page)return page
  const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
  browser=await playwright[engine].launch({headless:true})
  page=await browser.newPage()
  return page
 }
 return defineAdapter({id,
  async available(){return (await connect()).evaluate(()=>typeof OfflineAudioContext==='function')},
  async version(){await connect();return `${engine} ${browser.version()}`},
  async metadata(){return {engine,mode:'OfflineAudioContext in a persistent browser; base64 float32 PCM crosses Playwright',source:'https://www.w3.org/TR/webaudio-1.0/'}},
  supports(test){return !test.workflow&&test.steps.every(s=>s.op==='processor'?webaudioProcessor(s)!==null:(operations.has(s.op)||filters.has(s.op))&&!(filters.has(s.op)&&s.order!==undefined&&s.order!==2))},
  async run(test,input,sampleRate){
   const encode=x=>Buffer.from(x.buffer,x.byteOffset,x.byteLength).toString('base64')
   const steps=test.steps.map(step=>{
    const s=step.op==='processor'?webaudioProcessor(step):step
    if(!s)throw new RangeError(`Unsupported Web Audio processor controls: ${step.name}`)
    return {...s,...(s.other?{other:makeSignal(s.other).channels.map(encode)}:{})}
   })
   const result=await (await connect()).evaluate(async({steps,input,sampleRate})=>{
    const decode=value=>{const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new Float32Array(bytes.buffer)}
    const encode=x=>{
     const bytes=new Uint8Array(x.buffer,x.byteOffset,x.byteLength);let text=''
     for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768))
     return btoa(text)
    }
    let pcm=input.map(decode),rate=sampleRate
    for(const step of steps)if(step.other)step.other=step.other.map(decode)
    // Each operation is rendered by browser nodes. Array copies only carry PCM across the bridge.
    for(const step of steps.length?steps:[{op:'identity'}]){
     const n=pcm[0].length,s=step
     let outRate=s.op==='resample'?s.to:rate,frames=n,channels=pcm.length
     if(s.op==='trim')frames=Math.min(s.length,Math.max(0,n-s.start))
     if(s.op==='pad')frames=n+s.before+s.after
     if(s.op==='repeat')frames=n*s.count
     if(s.op==='insert')frames=n+s.other[0].length
     if(s.op==='crossfade')frames=n+s.other[0].length-s.length
     if(s.op==='speed')frames=Math.round(n/s.factor)
     if(s.op==='resample')frames=Math.round(n*outRate/rate)
     if(s.op==='convolve'&&s.tail)frames=n+s.impulse.length-1
     if(s.op==='mono')channels=1
     if(s.op==='duplicate')channels=2
     if(frames===0){pcm=Array.from({length:channels},()=>new Float32Array());rate=outRate;continue}
     const ctx=new OfflineAudioContext(channels,frames,outRate)
     // A null source buffer renders silence; Web Audio cannot allocate zero frames.
     const buffer=data=>{if(!data[0].length)return null;const b=ctx.createBuffer(data.length,data[0].length,rate);data.forEach((x,c)=>b.copyToChannel(Float32Array.from(x),c));return b}
     const source=ctx.createBufferSource();source.buffer=buffer(pcm)
     let last=source,scheduled=false
     const gain=value=>{const g=ctx.createGain();g.gain.value=value;return g}
     const connect=node=>{last.connect(node);last=node}
     if(s.op==='gain'||s.op==='gain-db')connect(gain(s.op==='gain'?s.value:10**(s.db/20)))
     else if(s.op==='iir')connect(ctx.createIIRFilter(s.feedforward,s.feedback))
     else if(s.op==='tremolo'){
      const volume=gain(1-s.depth/2),depth=gain(s.depth/2),oscillator=ctx.createOscillator()
      oscillator.type='sine';oscillator.frequency.value=s.rate
      oscillator.connect(depth).connect(volume.gain);oscillator.start();connect(volume)
     }
     else if(s.op==='fade'){
      const g=gain(1),start=s.direction==='in'?0:(n-s.length)/rate
      const values=Float32Array.from({length:s.length+1},(_,i)=>{const t=s.direction==='in'?i/s.length:1-i/s.length;return ({linear:t,exp:t*t,log:Math.sqrt(t),cos:(1-Math.cos(Math.PI*t))/2})[s.curve||'linear']})
      g.gain.setValueCurveAtTime(values,start,s.length/rate);connect(g)
     }else if(['lowpass','highpass','bandpass','notch','allpass','lowshelf','highshelf','eq'].includes(s.op)){
      const f=ctx.createBiquadFilter();f.type=s.op==='eq'?'peaking':s.op;f.frequency.value=s.freq
      f.Q.value=['lowpass','highpass'].includes(s.op)?20*Math.log10(s.Q??Math.SQRT1_2):(s.Q??Math.SQRT1_2)
      f.gain.value=s.gain??0;connect(f)
     }else if(s.op==='compressor'){
     const c=ctx.createDynamicsCompressor();c.threshold.value=s.threshold;c.ratio.value=s.ratio;c.knee.value=s.knee??0;c.attack.value=s.attack;c.release.value=s.release;connect(c)
      if(s.makeup)connect(gain(10**(s.makeup/20)))
     }else if(s.op==='convolve'){
      const c=ctx.createConvolver();c.normalize=false;c.buffer=buffer([s.impulse]);connect(c)
     }else if(s.op==='delay'){
      const seconds=s.time??s.delayFrames/rate
      const bus=gain(1),dry=gain(1-s.mix),wet=gain(s.mix),delay=ctx.createDelay(Math.max(1,seconds));delay.delayTime.value=seconds
      if(s.feedback)delay.connect(gain(s.feedback)).connect(delay)
      source.connect(dry).connect(bus);source.connect(delay).connect(wet).connect(bus);last=bus
     }else if(['swap','mono','duplicate','balance'].includes(s.op)){
      const split=ctx.createChannelSplitter(pcm.length),merge=ctx.createChannelMerger(channels);source.connect(split)
      for(let out=0;out<channels;out++){
       const ins=s.op==='mono'?Array.from({length:pcm.length},(_,i)=>i):[s.op==='swap'?1-out:s.op==='duplicate'?0:out]
       for(const c of ins){const g=gain(s.op==='mono'?1/pcm.length:s.op==='balance'?Math.min(1,out===0?1-s.value:1+s.value):1);split.connect(g,c);g.connect(merge,0,out)}
      }last=merge
     }else if(['mix','insert','crossfade'].includes(s.op)){
      const other=ctx.createBufferSource();other.buffer=buffer(s.other)
      if(s.op==='mix'){other.connect(ctx.destination);other.start(s.at/rate)}
      if(s.op==='insert'){
       const tail=ctx.createBufferSource();tail.buffer=source.buffer;tail.connect(ctx.destination)
       source.start(0,0,s.at/rate);other.connect(ctx.destination);other.start(s.at/rate);tail.start((s.at+s.other[0].length)/rate,s.at/rate);scheduled=true
      }
      if(s.op==='crossfade'){
       const a=gain(1),b=gain(0),at=(n-s.length)/rate,duration=s.length/rate
       if(s.curve==='equal-power'){
        const x=Float32Array.from({length:s.length+1},(_,i)=>Math.cos(i/s.length*Math.PI/2)),y=Float32Array.from(x,(_,i)=>Math.sin(i/s.length*Math.PI/2))
        a.gain.setValueCurveAtTime(x,at,duration);b.gain.setValueCurveAtTime(y,at,duration)
       }else {a.gain.setValueAtTime(1,at);a.gain.linearRampToValueAtTime(0,at+duration);b.gain.setValueAtTime(0,at);b.gain.linearRampToValueAtTime(1,at+duration)}
       connect(a);other.connect(b).connect(ctx.destination);other.start(at)
      }
     }
     last.connect(ctx.destination)
     if(!scheduled){
      if(s.op==='trim')source.start(0,s.start/rate,s.length/rate)
      else if(s.op==='pad')source.start(s.before/rate)
      else {if(s.op==='repeat'){source.loop=true;source.loopEnd=n/rate}if(s.op==='speed')source.playbackRate.value=s.factor;source.start()}
     }
     const rendered=await ctx.startRendering();pcm=Array.from({length:rendered.numberOfChannels},(_,c)=>rendered.getChannelData(c));rate=rendered.sampleRate
    }
    return {channels:pcm.map(encode),sampleRate:rate}
   },{steps,input:input.map(encode),sampleRate})
   return {...result,channels:result.channels.map(value=>{const bytes=Buffer.from(value,'base64');return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))})}
  },
  async close(){await browser?.close();browser=page=undefined}
 })
}
export default webaudio()
