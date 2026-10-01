import test from 'node:test'
import assert from 'node:assert/strict'
import { webaudio, webaudioProcessor } from '../adapters/webaudio.js'
import { applySteps, expected } from '../src/reference.js'
import { compareChannels } from '../src/metrics.js'
import { loadSpec } from '../src/spec.js'
import { makeSignal } from '../src/signals.js'
import { judge } from '../src/oracles.js'

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

test('Web Audio processor controls retain their units and reject unsupported options',()=>{
 const step=(name,params={})=>({op:'processor',name,params}),adapter=webaudio()
 assert.deepEqual(webaudioProcessor(step('compressor',{attack:5,release:250})),{op:'compressor',threshold:-20,ratio:4,knee:6,makeup:0,attack:.005,release:.25})
 assert.deepEqual(webaudioProcessor(step('delay',{time:.25,feedback:.5,mix:1})),{op:'delay',time:.25,feedback:.5,mix:1})
 for(const s of [step('compressor',{upRatio:2}),step('compressor',{attack:1001}),step('compressor',{unknown:1}),step('delay',{feedback:1}),step('delay',{time:Infinity}),step('tremolo',{rate:10000}),step('tremolo',{depth:NaN}),step('limiter')]){
  assert.equal(webaudioProcessor(s),null)
  assert.equal(adapter.supports({steps:[s]}),false)
 }
})

for(const engine of ['chromium','firefox','webkit'])test(`${engine} implements mapped processors with native nodes and fresh A/A/B state`,{skip:!process.env.AUDIO_TEST_BROWSERS,timeout:120000},async t=>{
 const adapter=webaudio(engine),processor=(name,params={})=>({op:'processor',name,params})
 try{
  assert.equal(await adapter.available(),true)
  const cases=(await loadSpec()).cases.filter(c=>c.status==='active'&&c.steps?.[0]?.op==='processor'&&adapter.supports(c))
  assert(cases.length>=56)
  let neutralFailures=0
  for(const spec of cases){
   const input=makeSignal(spec.fixture).channels,before=input.map(x=>x.slice()),output=await adapter.run(spec,input,spec.fixture.sampleRate)
   const result=judge(spec,output,expected(spec,input),input,spec.fixture.sampleRate)
   if(spec.feature==='neutral.compressor'){
    // Native compressor latency and automatic makeup are recorded discrepancies.
    // Compare the wrapper with the actual node operation, not an identity shortcut.
    const native=await adapter.run({steps:[webaudioProcessor(spec.steps[0])]},input,spec.fixture.sampleRate)
    assert(compareChannels(output.channels,native.channels,0).pass)
    if(!result.pass)neutralFailures++
   }else assert.equal(result.pass,true,JSON.stringify({id:spec.id,result}))
   assert.deepEqual(input,before,`${spec.id}: input unchanged`)
  }
  t.diagnostic(`${cases.length} additional catalog cases; ${neutralFailures} native compressor identity discrepancies retained`)
  const a=[Float32Array.from({length:1025},(_,i)=>i%2?.125:-.125),Float32Array.from({length:1025},(_,i)=>i%3?.0625:-.0625)]
  const b=[Float32Array.of(-.25),Float32Array.of(.125)]
  for(const name of ['compressor','delay','tremolo','dcblocker','derivative','integral','emphasis','deemphasis']){
   const spec={steps:[processor(name)]},before=a.map(x=>x.slice())
   const first=await adapter.run(spec,a,48000),again=await adapter.run(spec,a,48000),after=await adapter.run(spec,b,48000)
   assert(compareChannels(first.channels,again.channels,0).pass,`${name}: repeat A`)
   assert.deepEqual(a,before)
   assert.equal(after.channels.length,2);assert(after.channels.every(x=>x.length===1&&Number.isFinite(x[0])),`${name}: one-frame B`)
   assert.deepEqual(b,[Float32Array.of(-.25),Float32Array.of(.125)])
  }
  const impulse=[Float32Array.of(.25,0,0,0),Float32Array.of(0,.125,0,0)]
  for(const [name,params,wanted] of [
   ['dcblocker',{R:.5},[[.25,-.125,-.0625,-.03125],[0,.125,-.0625,-.03125]]],
   ['integral',{leak:.5},[[.25,.125,.0625,.03125],[0,.125,.0625,.03125]]],
   ['emphasis',{alpha:.5},[[.25,-.125,0,0],[0,.125,-.0625,0]]],
   ['deemphasis',{alpha:.5},[[.25,.125,.0625,.03125],[0,.125,.0625,.03125]]],
   ['derivative',{},[[.25,-.25,0,0],[0,.125,-.125,0]]]
  ]){
   const output=await adapter.run({steps:[processor(name,params)]},impulse,48000)
   assert(compareChannels(output.channels,wanted.map(x=>Float32Array.from(x)),1e-6).pass,`${name}: independent stereo impulse response`)
  }
  const tone=[new Float32Array(4800).fill(.25),new Float32Array(4800).fill(-.125)],rate=20,depth=.8
  const tremolo=await adapter.run({steps:[processor('tremolo',{rate,depth})]},tone,48000)
  const wanted=tone.map(x=>Float32Array.from(x,(v,i)=>v*(1-depth/2+depth/2*Math.sin(2*Math.PI*rate*i/48000))))
  for(const [at,value] of [[600,.25],[1800,.05],[3000,.25],[4200,.05]])assert(Math.abs(tremolo.channels[0][at]-value)<1e-6,'tremolo depth and 20 Hz envelope extrema')
  assert(compareChannels([tremolo.channels[1]],[Float32Array.from(tremolo.channels[0],v=>-.5*v)],1e-6).pass,'both channels share the same modulation')
  t.diagnostic(`native oscillator maximum deviation from ideal sine: ${compareChannels(tremolo.channels,wanted,1e-6).maxAbsError}`)
  const clicks=[new Float32Array(1024),new Float32Array(1024)];clicks[0][0]=.5;clicks[1][3]=-.25
  const single=await adapter.run({steps:[processor('delay',{time:128/48000,feedback:0,mix:1})]},clicks,48000)
  assert(compareChannels(single.channels,applySteps(clicks,[{op:'delay',delayFrames:128,feedback:0,mix:1}]),1e-6).pass,'delay seconds preserve sample timing and channels')
  const delayed=await adapter.run({steps:[processor('delay',{time:128/48000,feedback:.5,mix:1})]},clicks,48000)
  const nativeDelay=await adapter.run({steps:[{op:'delay',delayFrames:128,feedback:.5,mix:1}]},clicks,48000)
  assert(compareChannels(delayed.channels,nativeDelay.channels,0).pass,'the wrapper retains native feedback timing')
  for(const [c,inputPeak] of [[0,.5],[1,-.25]]){
   const peaks=Array.from(delayed.channels[c],(value,index)=>({value,index})).filter(p=>Math.abs(p.value)>1e-6)
   assert(peaks.length>=3);assert.equal(peaks[0].index,c===0?128:131)
   assert(peaks.every((p,i)=>Math.abs(p.value-inputPeak*.5**i)<1e-6),'feedback gain follows the requested decay')
   if(c===0)t.diagnostic(`native feedback impulse frames: ${peaks.map(p=>p.index).join(', ')}`)
  }
  await assert.rejects(adapter.run({steps:[processor('compressor',{upRatio:2})]},clicks,48000),/Unsupported Web Audio processor controls/)
 }finally{await adapter.close()}
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
