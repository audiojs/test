import test from 'node:test'
import assert from 'node:assert/strict'
import { applySteps,expected } from '../src/reference.js'
import { judge,toneFrequency } from '../src/oracles.js'
import { makeSignal } from '../src/signals.js'
const pcm=x=>[Float32Array.from(x)]
test('editing goldens are independent literal vectors',()=>{
 const input=pcm([.25,-.5,.75,1])
 const vectors=[[[{op:'reverse'}],[1,.75,-.5,.25]],[[{op:'reverse-range',start:1,length:2}],[.25,.75,-.5,1]],[[{op:'trim',start:1,length:2}],[-.5,.75]],[[{op:'remove',start:1,length:2}],[.25,1]],[[{op:'pad',before:1,after:2}],[0,.25,-.5,.75,1,0,0]],[[{op:'gain',value:2}],[.5,-1,1.5,2]],[[{op:'derivative'}],[.25,-.75,1.25,.25]],[[{op:'integral'}],[.25,-.25,.5,1.5]],[[{op:'fade',direction:'in',length:4}],[0,-.125,.375,.75]]]
 for(const [steps,want] of vectors)assert.deepEqual([...applySteps(input,steps)[0]],want)
 assert.deepEqual([...input[0]],[.25,-.5,.75,1])
})
test('mix, insert and crossfade goldens are literal',()=>{
 const x=pcm([1,1,1,1]),other={signal:'dc',value:0,frames:4,channels:1,sampleRate:48000}
 assert.deepEqual([...applySteps(x,[{op:'crossfade',other,length:2}])[0]],[1,1,1,.5,0,0])
 assert.deepEqual([...applySteps(x,[{op:'insert',other,at:2}])[0]],[1,1,0,0,0,0,1,1])
 assert.deepEqual([...applySteps(x,[{op:'mix',other:{...other,value:.25},at:2}])[0]],[1,1,1.25,1.25])
})
test('scalar oracle detects numerical discrepancies',()=>{
 const t={steps:[{op:'analyze',name:'rms'}],oracle:{type:'scalar',atol:1e-6}}
 assert.equal(expected(t,pcm([1,-1])).scalar,1)
 assert.equal(judge(t,{scalar:.5},{scalar:1}).pass,false)
 assert.equal(judge(t,{scalar:NaN},{scalar:1}).pass,false)
})
test('exact oracle rejects corruption, missing channels, ragged and NaN',()=>{
 const t={oracle:{type:'exact',atol:0}},wanted={channels:pcm([1,2])}
 for(const channels of [pcm([1,3]),[],[Float32Array.of(1,2),Float32Array.of(1)],pcm([1,NaN]),pcm([1,Infinity])])assert.equal(judge(t,{channels},wanted,pcm([1,2]),48000).pass,false)
})
test('integrity is not a quality assertion but rejects empty output',()=>{
 const t={oracle:{type:'integrity'}}
 assert.equal(judge(t,{channels:pcm([])},null,pcm([1]),48000).pass,false)
 assert.equal(judge(t,{channels:pcm([0])},null,pcm([1]),48000).pass,true)
})
test('spectral pitch ignores extra zero crossings and rejects wrong pitch',()=>{
 const sr=48000,x=Float32Array.from({length:24000},(_,i)=>Math.sin(2*Math.PI*440*i/sr)+.4*Math.sin(2*Math.PI*2200*i/sr))
 assert(Math.abs(toneFrequency(x,sr)-440)<1)
 const t={oracle:{type:'tone',lengthFactor:1,frequency:880}}
 assert.equal(judge(t,{channels:[x]},null,[x],sr).pass,false)
})
test('response rejects passthrough at a notch; zero is sufficient rejection',()=>{
 const x=makeSignal({signal:'sine',frequency:1000,frames:48000,channels:1,sampleRate:48000}).channels
 const t={oracle:{type:'response',min:-400,max:-35}}
 assert.equal(judge(t,{channels:x},null,x,48000).pass,false)
 assert.equal(judge(t,{channels:[new Float32Array(48000)]},null,x,48000).pass,true)
})
test('rate oracle detects metadata and duration changes',()=>{
 const x=makeSignal({signal:'sine',frequency:1000,frames:4800,channels:1,sampleRate:48000}).channels
 const t={oracle:{type:'resample',to:48000,min:-.1,max:.1,frequency:1000}}
 assert.equal(judge(t,{channels:x,sampleRate:44100},null,x,48000).pass,false)
})
