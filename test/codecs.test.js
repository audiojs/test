import test from 'node:test'
import assert from 'node:assert/strict'
import audio from '../adapters/audio.js'
import { native } from '../adapters/native.js'
import { makeSignal } from '../src/signals.js'
import { expected } from '../src/reference.js'
import { judge } from '../src/oracles.js'
import { loadSpec } from '../src/spec.js'
import { encodedBitDepth } from '../adapters/codecs.js'

test('encoded depth comes from bounded WAV fmt and FLAC STREAMINFO headers',()=>{
 // Literal mono PCM16 WAV and stereo PCM16 FLAC STREAMINFO, both at 48 kHz.
 const wav=Buffer.from('524946462400000057415645666d7420100000000100010080bb000000770100020010006461746100000000','hex')
 const flac=Buffer.from('664c614380000022001000100000000000000bb802f00000000100000000000000000000000000000000','hex')
 assert.equal(encodedBitDepth(wav,'wav'),16)
 assert.equal(encodedBitDepth(flac,'flac'),16)
 const wav24=Buffer.from(wav);wav24.writeUInt32LE(144000,28);wav24.writeUInt16LE(3,32);wav24.writeUInt16LE(24,34)
 const flac24=Buffer.from(flac);flac24[20]=3;flac24[21]=0x70
 assert.equal(encodedBitDepth(wav24,'wav'),24)
 assert.equal(encodedBitDepth(flac24,'flac'),24)
 // RIFF chunks can precede fmt, including an odd-size chunk with a pad byte.
 const prefixed=Buffer.concat([wav.subarray(0,12),Buffer.from('4a554e4b010000007f00','hex'),wav.subarray(12)])
 prefixed.writeUInt32LE(prefixed.length-8,4)
 assert.equal(encodedBitDepth(prefixed,'wav'),16)
 for(const [bytes,format] of [[wav,'wav'],[flac,'flac']]){
  const wrapped=Buffer.concat([Buffer.alloc(3,255),bytes,Buffer.alloc(5,255)])
  assert.equal(encodedBitDepth(wrapped.subarray(3,3+bytes.length),format),16)
  for(const size of [0,3,11,19,bytes.length-1])assert.throws(()=>encodedBitDepth(bytes.subarray(0,size),format),/Invalid|Truncated|truncated/)
 }
 const shortFmt=Buffer.from(wav);shortFmt.writeUInt32LE(14,16)
 assert.throws(()=>encodedBitDepth(shortFmt,'wav'),/fmt chunk/)
 const hugeFmt=Buffer.from(wav);hugeFmt.writeUInt32LE(0xffffffff,16)
 assert.throws(()=>encodedBitDepth(hugeFmt,'wav'),/Truncated/)
 const wrongBlock=Buffer.from(flac);wrongBlock[4]=0x81
 assert.throws(()=>encodedBitDepth(wrongBlock,'flac'),/STREAMINFO/)
 const shortBlock=Buffer.from(flac);shortBlock[7]=33
 assert.throws(()=>encodedBitDepth(shortBlock,'flac'),/STREAMINFO/)
})

test('lossless PCM alone cannot pass a roundtrip at the wrong encoded depth',()=>{
 const channels=[Float32Array.from([-.5,0,.5])],t={steps:[],workflow:{op:'codec-roundtrip',format:'wav'},oracle:{type:'exact',atol:0}}
 const wanted=expected(t,channels),actual={channels,sampleRate:48000,encodedBytes:50,bitDepth:16,observations:{sourceAfter:channels}}
 assert.equal(judge(t,actual,wanted,channels,48000).pass,true)
 for(const bitDepth of [undefined,null,8,24,32]){
  const metrics=judge(t,{...actual,bitDepth},wanted,channels,48000)
  assert.equal(metrics.pass,false)
  assert.equal(metrics.bitDepth,bitDepth)
 }
})

test('codec mappings distinguish byte streams from native file roundtrips',()=>{
 for(const format of ['wav','flac','mp3']){
  const t={steps:[],workflow:{op:'codec-roundtrip',format}}
  assert.equal(audio.supports(t),format!=='mp3')
  for(const id of ['ffmpeg','sox']){
   assert.equal(native(id).supports(t),format!=='mp3')
   assert.equal(native(id).supports({...t,workflow:{...t.workflow,split:true}}),false)
  }
 }
})

for(const id of ['audio','ffmpeg','sox'])test(`${id} lossless codecs preserve PCM and rate across A → A → B`,{skip:id==='audio'?!process.env.AUDIO_MODULE:!process.env.AUDIO_TEST_NATIVE},async()=>{
 const adapter=id==='audio'?audio:native(id),spec=await loadSpec()
 for(const format of ['wav','flac']){
  const ids=[`codec.${format}.1f.1ch`,`codec.${format}.1f.1ch`,`codec.${format}.17f.2ch`]
  if(id==='audio')ids.push(`codec.${format}.byte-boundaries`)
  for(const name of ids){
   const t=spec.cases.find(c=>c.id===name),input=makeSignal(t.fixture),before=input.channels.map(ch=>ch.slice())
   const out=await adapter.run(t,input.channels,input.sampleRate)
   assert.equal(out.bitDepth,16,name)
   assert(judge(t,out,expected(t,input.channels),input.channels,input.sampleRate).pass,name)
   assert.deepEqual(input.channels,before)
   const wrongRate={...out,sampleRate:input.sampleRate+1}
   assert.equal(judge(t,wrongRate,expected(t,input.channels),input.channels,input.sampleRate).pass,false)
  }
  const t={steps:[],workflow:{op:'codec-roundtrip',format}},empty=[new Float32Array()]
  if(id==='audio'){
   await assert.rejects(adapter.run(t,empty,48000),/nothing to encode.*empty range/)
   const recovered=await adapter.run(t,[Float32Array.of(.5)],48000)
   assert.deepEqual(recovered.channels,[Float32Array.of(.5)])
  }else{
   const out=await adapter.run(t,empty,48000)
   assert.deepEqual(out.channels,empty)
   assert.equal(out.sampleRate,48000)
  }
 }
})
