import test from 'node:test'
import assert from 'node:assert/strict'
import adapter from '../adapters/audio.js'
import { loadSpec } from '../src/spec.js'
import { makeSignal } from '../src/signals.js'
import { expected } from '../src/reference.js'
import { judge } from '../src/oracles.js'

test('audio mappings reject dropped operations and unsupported measurement controls',()=>{
 for(const op of ['lowpass','highpass']) {
  for(const order of [1,3,0,-2,2.5,NaN,Infinity]) assert.equal(adapter.supports({steps:[{op,order}]}),false)
  for(const order of [undefined,2,4,6,8,10]) assert.equal(adapter.supports({steps:[{op,order}]}),true)
 }
 assert.equal(adapter.supports({steps:[{op:'measure',name:'pitch'},{op:'gain',value:.5}]}),false)
 assert.equal(adapter.supports({steps:[{op:'measure',name:'unknown'}]}),false)
 assert.equal(adapter.supports({steps:[{op:'dither',bits:16,distribution:'rectangular'}]}),false)
 assert.equal(adapter.supports({steps:[{op:'gain',value:.5},{op:'measure',name:'rms'}]}),false)
 assert.equal(adapter.supports({steps:[{op:'gain',value:.5},{op:'analyze',name:'rms'}]}),true)
})

test('audio composes undo/replay and spectrum from public APIs on repeated inputs',{skip:!process.env.AUDIO_MODULE},async()=>{
 const spec=await loadSpec(),undo=spec.cases.find(c=>c.id==='editor.undo-redo.roundtrip'),fft=spec.cases.find(c=>c.id==='analysis.spectrum.analytic')
 for(const t of [undo,undo,fft]){
  const input=makeSignal(t.fixture),out=await adapter.run(t,input.channels,input.sampleRate)
  assert(judge(t,out,expected(t,input.channels),input.channels,input.sampleRate).pass,t.id)
 }
})

test('audio delay mapping requests the canonical input-length render without changing echoes',{skip:!process.env.AUDIO_MODULE},async()=>{
 const spec=await loadSpec(),t=spec.cases.find(c=>c.id==='effect.delay.impulse')
 const input=makeSignal(t.fixture),out=await adapter.run(t,input.channels,input.sampleRate)
 assert(judge(t,out,expected(t,input.channels),input.channels,input.sampleRate).pass)
})

test('audio native streamed resampling retains final boundaries and recovers from invalid chunks',{skip:!process.env.AUDIO_MODULE,timeout:30000},async()=>{
 const steps=[],stream=chunks=>({steps,workflow:{op:'resample-chunks',to:32000,chunks}})
 for(const frames of [0,1,8193,8193,48001]){
  const input=makeSignal({signal:'sine',frequency:frames===48001?997:1500,frames,channels:2,sampleRate:48000,phase:0}).channels
  const out=await adapter.run(stream([1,17,8192]),input,48000)
  assert.equal(out.sampleRate,32000);assert.equal(out.channels.length,2)
  assert.deepEqual(out.channels,out.observations.batch)
  assert.equal(out.channels[0].length,Math.round(frames*2/3))
 }
 const input=[Float32Array.of(.25),Float32Array.of(-.5)]
 await assert.rejects(adapter.run(stream([0]),input,48000),/positive integer/)
 const recovered=await adapter.run(stream([1]),input,48000)
 assert.deepEqual(recovered.channels,recovered.observations.batch)
})

test('audio uses current frame rate and sample count after preceding edits',{skip:!process.env.AUDIO_MODULE},async()=>{
 const input=[new Float32Array(48).fill(.25),new Float32Array(48).fill(.5)]
 const out=await adapter.run({steps:[{op:'resample',to:24000},{op:'trim',start:4,length:8}]},input,48000)
 assert.equal(out.channels[0].length,8);assert.equal(out.sampleRate,24000)
 const energy=await adapter.run({steps:[{op:'trim',start:4,length:8},{op:'mono'},{op:'analyze',name:'energy'}]},input,48000)
 assert(Math.abs(energy.scalar-8*.375**2)<1e-6)
})
