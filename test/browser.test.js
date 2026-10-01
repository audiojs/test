import test from 'node:test'
import assert from 'node:assert/strict'
import { webaudio } from '../adapters/webaudio.js'
import { applySteps } from '../src/reference.js'
import { compareChannels } from '../src/metrics.js'

test('Web Audio probes distinguish native filters from unsupported orders',()=>{
 const a=webaudio()
 assert.equal(a.supports({steps:[{op:'lowpass',order:1}]}),false)
 assert.equal(a.supports({steps:[{op:'lowpass',order:2}]}),true)
 for(const op of ['lowpass','highpass','bandpass','notch','allpass','lowshelf','highshelf','eq']){
  assert.equal(a.supports({steps:[{op}]}),true)
  assert.equal(a.supports({steps:[{op,order:2}]}),true)
  assert.equal(a.supports({steps:[{op,order:4}]}),false)
 }
 assert.equal(a.supports({steps:[],workflow:{op:'undo'}}),false)
})

for(const engine of ['chromium','firefox','webkit'])test(`${engine} renders boundaries and repeated inputs without stale state`,{skip:!process.env.AUDIO_TEST_BROWSERS,timeout:120000},async()=>{
 const a=webaudio(engine)
 try{
  assert.equal(await a.available(),true)
  for(const n of [0,1,127,128,129,129,17,8191,8192,8193]){
   const input=[Float32Array.from({length:n},(_,i)=>(i%13-6)/10)]
   if(n>=8191)input.push(Float32Array.from({length:n},(_,i)=>(i%17-8)/12))
   const before=input.map(ch=>ch.slice())
   const steps=[{op:'gain',value:.5},...(n>1?[{op:'fade',direction:'out',length:n,curve:'linear'}]:[])]
   const out=await a.run({steps},input,48000)
   assert.equal(out.sampleRate,48000)
   assert(compareChannels(out.channels,applySteps(input,steps),1e-6).pass,`${engine} ${n} frames`)
   assert.deepEqual(input,before)
  }
  const empty=[new Float32Array(),new Float32Array()]
  const padding=[{op:'pad',before:2,after:3}]
  const padded=await a.run({steps:padding},empty,48000)
  assert(compareChannels(padded.channels,applySteps(empty,padding),0).pass,`${engine} padding empty stereo creates exactly five silent frames`)
  await assert.rejects(a.run({steps:[{op:'gain',value:NaN}]},[Float32Array.of(.25)],48000))
  const recovered=await a.run({steps:[]},[Float32Array.of(-.25)],48000)
  assert.deepEqual(recovered.channels,[Float32Array.of(-.25)],`${engine} identity after rejected render retains only the new input`)
  const input=[new Float32Array(1024)];input[0][0]=.5
  const steps=[{op:'delay',delayFrames:128,feedback:0,mix:1}]
  const out=await a.run({steps},input,48000)
  assert(compareChannels(out.channels,applySteps(input,steps),1e-6).pass)
  const compressor={op:'compressor',threshold:-18,ratio:4,knee:0,attack:.001,release:.05}
  const tone=[Float32Array.from({length:24000},(_,i)=>.1*Math.sin(2*Math.PI*997*i/48000))]
  const baseline=await a.run({steps:[{...compressor,makeup:0}]},tone,48000)
  const raised=await a.run({steps:[{...compressor,makeup:6}]},tone,48000)
  assert(baseline.channels[0].some(value=>Math.abs(value)>.001))
  const wanted=baseline.channels.map(channel=>Float32Array.from(channel,value=>value*10**(6/20)))
  assert(compareChannels(raised.channels,wanted,1e-6).pass,`${engine} explicit makeup applies to native compressor output`)
 }finally{await a.close()}
})
