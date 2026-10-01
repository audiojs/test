import test from 'node:test'
import assert from 'node:assert/strict'
import { native, nativeProcessor } from '../adapters/native.js'
import soundtouch from '../adapters/soundtouch.js'
import { exists } from '../adapters/external.js'
import { parseNativeStats } from '../adapters/native-measure.js'
import { loadSpec } from '../src/spec.js'
import { makeSignal } from '../src/signals.js'
import { judge } from '../src/oracles.js'
import { expected } from '../src/reference.js'

test('SoX statistics accept the CLI alignment spaces without inventing missing values', () => {
 const text = 'Maximum amplitude: 0.500000\nMinimum amplitude: -0.250000\nMean    amplitude: 0.125000\nRMS     amplitude: 0.250000\n'
 assert.deepEqual(parseNativeStats('sox', 'levels', text, 2, 100), { values: { peak: .5, rms: .25, dc: .125 } })
 assert.deepEqual(parseNativeStats('sox', 'energy', text, 2, 100), { scalar: 12.5 })
 assert.throws(() => parseNativeStats('sox', 'rms', text.replace('RMS     amplitude', 'Missing statistic'), 2, 100), /no valid RMS/)
})

test('FFmpeg statistics aggregate channel energy and DC before the overall summary', () => {
 const channel = (min, max, rms, dc, crossings) => `Min level: ${min}\nMax level: ${max}\nRMS level dB: ${rms}\nDC offset: ${dc}\nZero crossings: ${crossings}\n`
 const text = channel(-.5, .5, -6.020599913279624, .25, 4) + channel(-.25, .25, -12.041199826559248, -.125, 8) + channel(-.5, .5, -8, .0625, 6)
 const { values } = parseNativeStats('ffmpeg', 'levels', text, 2, 100)
 assert.equal(values.peak, .5)
 assert.equal(values.dc, .0625)
 assert(Math.abs(values.rms - Math.sqrt(.15625)) < 1e-12)
 assert.deepEqual(parseNativeStats('ffmpeg', 'zcr', text, 2, 100), { scalar: .06 })
 assert.equal(parseNativeStats('ffmpeg', 'rms', channel(0, 0, '-inf', 0, 0), 1, 100).scalar, 0)
 assert.throws(() => parseNativeStats('ffmpeg', 'rms', channel(0, 0, 'nan', 0, 0), 1, 100), /no valid RMS/)
})

test('native support rejects controls the mapped filters cannot honor', () => {
 const ffmpeg = native('ffmpeg'), sox = native('sox')
 const has = (adapter, step) => adapter.supports({ steps: [step] })
 assert.equal(has(ffmpeg, { op: 'limiter', lookahead: 0 }), false)
 assert.equal(has(ffmpeg, { op: 'limiter', lookahead: .005 }), true)
 assert.equal(has(sox, { op: 'limiter', lookahead: 0 }), true)
 for (const adapter of [ffmpeg, sox]) {
  assert.equal(has(adapter, { op: 'gate', hold: .1 }), false)
  assert.equal(has(adapter, { op: 'gate', hold: 0 }), true)
  assert.equal(has(adapter, { op: 'delay', feedback: .5 }), false)
  assert.equal(has(adapter, { op: 'dither', bits: 24 }), false)
  assert.equal(has(adapter, { op: 'dither', bits: 16, distribution: 'tpdf' }), true)
  assert.equal(has(adapter, { op: 'dither', bits: 16, distribution: 'gaussian' }), false)
  assert.equal(adapter.supports({ steps: [{ op: 'convolve', impulse: [1, .5] }, { op: 'gain', value: .5 }] }), false)
  for (const op of ['trim', 'pad', 'repeat', 'resample', 'speed', 'stretch']) {
   assert.equal(adapter.supports({ steps: [{ op }, { op: 'fade', direction: 'out', length: 10 }] }), false, `${adapter.id}: ${op} changes the following frame or rate coordinates`)
  }
  assert.equal(adapter.supports({ steps: [{ op: 'reverse' }, { op: 'gain', value: .5 }] }), true)
 }
 for (const steps of [[{ op: 'pitch', semitones: 7 }, { op: 'gain', value: .5 }], [{ op: 'gain', value: .5 }, { op: 'pitch', semitones: 7 }]]) assert.equal(ffmpeg.supports({ steps }), false)
 assert.equal(ffmpeg.supports({ steps: [{ op: 'pitch', semitones: 7 }] }), true)
 assert.equal(ffmpeg.supports({ steps: [{ op: 'denoise' }, { op: 'gain', value: .5 }] }), false)
})

test('native processor mappings convert units and reject controls they cannot apply', () => {
 const step=(name,params={})=>({op:'processor',name,params})
 assert.match(nativeProcessor('ffmpeg',step('compressor',{attack:5,release:100})),/attack=5:release=100/)
 assert.deepEqual(nativeProcessor('sox',step('tremolo',{rate:2,depth:.25})),['tremolo','2','25'])
 for(const id of ['ffmpeg','sox']){
  for(const s of [step('compressor',{upRatio:2}),step('compressor',{unmapped:1}),step('dcblocker',{R:NaN}),step('integral',{leak:Infinity}),step('deesser')])assert.equal(nativeProcessor(id,s),null)
  assert.equal(native(id).supports({steps:[step('tremolo'),{op:'gain',value:.5}]}),false)
 }
 assert.equal(nativeProcessor('sox',step('tremolo',{depth:0})),null,'SoX does not accept a zero-depth tremolo')
 assert.equal(nativeProcessor('sox',step('vibrato')),null)
 assert.equal(nativeProcessor('ffmpeg',step('limiter',{ceiling:-30})),null,'the native limiter cannot set this ceiling directly')
 assert.equal(nativeProcessor('ffmpeg',step('softclip',{curve:'cubic'})),null,'unverified curve semantics remain unmapped')
})

test('SoX native edit composition and cosine fades satisfy the existing sample contracts', {skip:!process.env.AUDIO_TEST_NATIVE}, async t=>{
 if(!await exists('sox'))return t.skip('sox unavailable')
 const adapter=native('sox'),cases=(await loadSpec()).cases.filter(c=>c.status==='active'&&c.steps?.length===1&&(['mix','insert','crossfade','reverse-range','remove'].includes(c.steps[0].op)||c.steps[0].op==='fade'&&c.steps[0].curve==='cos'))
 assert(cases.length>=71)
 for(const spec of cases){
  assert.equal(adapter.supports(spec),true,spec.id)
  const input=makeSignal(spec.fixture).channels,before=input.map(x=>x.slice())
  const output=await adapter.run(spec,input,spec.fixture.sampleRate),result=judge(spec,output,expected(spec,input),input,spec.fixture.sampleRate)
  assert.equal(result.pass,true,JSON.stringify({id:spec.id,result}))
  assert.deepEqual(input,before,`${spec.id}: input unchanged`)
 }
})

test('SoX edit runs do not share buffers or retain earlier input across A/A/B calls', {skip:!process.env.AUDIO_TEST_NATIVE}, async t=>{
 if(!await exists('sox'))return t.skip('sox unavailable')
 const adapter=native('sox')
 for(const op of ['reverse-range','remove','mix','insert','crossfade']){
  let previous
  for(const frames of [17,17,1]){
   const fixture={signal:'sample-id',frames,channels:2,sampleRate:48000},other={signal:'dc',value:.125,frames:3,channels:2,sampleRate:48000}
   const step={op,start:frames===1?0:1,length:Math.min(2,frames),at:frames,curve:'linear',...(['mix','insert','crossfade'].includes(op)?{other}:{})}
   const spec={fixture,steps:[step],oracle:{type:'exact',atol:1e-6}},input=makeSignal(fixture).channels,before=input.map(x=>x.slice())
   const output=await adapter.run(spec,input,48000)
   assert.equal(judge(spec,output,expected(spec,input),input,48000).pass,true,`${op}, ${frames} frames`)
   assert.deepEqual(input,before)
   if(previous&&frames===17)assert.deepEqual(output,previous,`${op}: repeated A`)
   previous=output
  }
 }
})

for(const id of ['sox','ffmpeg'])test(`${id} native processor controls run every newly supported existing integrity and neutral case`, {skip:!process.env.AUDIO_TEST_NATIVE}, async t=>{
 if(!await exists(id))return t.skip(`${id} unavailable`)
 const adapter=native(id),cases=(await loadSpec()).cases.filter(c=>c.status==='active'&&c.steps?.[0]?.op==='processor'&&adapter.supports(c))
 assert(cases.length>=44)
 for(const spec of cases){
  const input=makeSignal(spec.fixture).channels,before=input.map(x=>x.slice()),output=await adapter.run(spec,input,spec.fixture.sampleRate)
  const result=judge(spec,output,expected(spec,input),input,spec.fixture.sampleRate)
  assert.equal(result.pass,true,JSON.stringify({id:spec.id,result}))
  assert.deepEqual(input,before,`${spec.id}: input unchanged`)
 }
})

for(const id of ['sox','ffmpeg'])test(`${id} native filter processors preserve channel independence and reset A/A/B state`, {skip:!process.env.AUDIO_TEST_NATIVE}, async t=>{
 if(!await exists(id))return t.skip(`${id} unavailable`)
 const adapter=native(id),a=[Float32Array.of(.25,0,0,0),Float32Array.of(0,.125,0,0)],b=[Float32Array.of(-.125),Float32Array.of(.0625)]
 for(const [name,params,wanted] of [
  ['dcblocker',{R:.5},[[.25,-.125,-.0625,-.03125],[0,.125,-.0625,-.03125]]],
  ['integral',{leak:.5},[[.25,.125,.0625,.03125],[0,.125,.0625,.03125]]],
  ['emphasis',{alpha:.5},[[.25,-.125,0,0],[0,.125,-.0625,0]]],
  ['deemphasis',{alpha:.5},[[.25,.125,.0625,.03125],[0,.125,.0625,.03125]]],
  ['derivative',{},[[.25,-.25,0,0],[0,.125,-.125,0]]]
 ]){
  const spec={steps:[{op:'processor',name,params}],oracle:{type:'exact',atol:1e-6}}
  for(const input of [a,a,b]){
   const before=input.map(x=>x.slice()),output=await adapter.run(spec,input,48000)
   const result=judge(spec,output,{channels:input===b?b:wanted.map(x=>Float32Array.from(x))},input,48000)
   assert.equal(result.pass,true,JSON.stringify({name,result}));assert.deepEqual(input,before)
  }
 }
})

test('FFmpeg soft clipping applies drive before the curve and ceiling after it', {skip:!process.env.AUDIO_TEST_NATIVE}, async t=>{
 if(!await exists('ffmpeg'))return t.skip('ffmpeg unavailable')
 const adapter=native('ffmpeg'),input=[Float32Array.of(-.75,-.25,0,.25,.75),Float32Array.of(.125,0,-.125,0,.125)]
 for(const curve of ['tanh','hard']){
  const spec={steps:[{op:'processor',name:'softclip',params:{curve,drive:2,ceiling:.5}}],oracle:{type:'exact',atol:1e-6}}
  const wanted={channels:input.map(x=>Float32Array.from(x,v=>curve==='tanh'?.5*Math.tanh(2*v):Math.max(-.5,Math.min(.5,2*v))))}
  assert.equal(judge(spec,await adapter.run(spec,input,48000),wanted,input,48000).pass,true)
 }
})

test('FFmpeg delay preserves channel gains and the declared input length', { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 if (!await exists('ffmpeg')) return t.skip('ffmpeg unavailable')
 const adapter = native('ffmpeg'), input = [Float32Array.from([.5, 0, 0, 0, 0, 0, 0, .25]), Float32Array.from([0, -.25, 0, 0, 0, 0, 0, 0])]
 for (const mix of [1, .25]) {
  const spec = { fixture: { frames: 8, channels: 2, sampleRate: 48000 }, steps: [{ op: 'delay', delayFrames: 2, feedback: 0, mix }], oracle: { type: 'exact', atol: 1e-6 } }
  assert.equal(adapter.supports(spec), true)
  const output = await adapter.run(spec, input, 48000)
  assert.equal(output.channels[0].length, 8)
  assert.equal(judge(spec, output, expected(spec, input), input, 48000).pass, true)
 }
})

test('FFmpeg peak normalization uses linked native peak measurement and preserves silence', { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 if(!await exists('ffmpeg'))return t.skip('ffmpeg unavailable')
 const adapter=native('ffmpeg'),spec={fixture:{frames:4,channels:2,sampleRate:48000},steps:[{op:'normalize',db:-6}],oracle:{type:'exact',atol:1e-6}}
 assert.equal(adapter.supports(spec),true)
 assert.equal(adapter.supports({...spec,steps:[...spec.steps,{op:'gain',value:.5}]}),false)
 for(const input of [[Float32Array.of(.25,-.125,.125,0),Float32Array.of(.5,-.25,.5,0)],[new Float32Array(4),new Float32Array(4)]]){
  const output=await adapter.run(spec,input,48000)
  assert.equal(judge(spec,output,expected(spec,input),input,48000).pass,true)
 }
})

test('SoX native FIR and biquad implement derivative and accumulator coordinates', { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 if(!await exists('sox'))return t.skip('sox unavailable')
 const adapter=native('sox'),input=[Float32Array.of(.125,.25,-.125,0),Float32Array.of(-.125,.25,0,.125)]
 for(const op of ['derivative','integral']){
  const spec={fixture:{frames:4,channels:2,sampleRate:48000},steps:[{op}],oracle:{type:'exact',atol:1e-6}}
  assert.equal(adapter.supports(spec),true)
  const output=await adapter.run(spec,input,48000)
  assert.equal(judge(spec,output,expected(spec,input),input,48000).pass,true)
 }
})

for (const id of ['sox', 'ffmpeg']) test(`${id} native convolution preserves causal timing, channels and the requested tail`, { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 const adapter = native(id)
 if (!await exists(id)) return t.skip(`${id} unavailable`)
 assert.equal(await adapter.available(), true)
 const input = [Float32Array.from([.5, 0, -.25, 0]), Float32Array.from([0, .25, 0, 0])]
 for (const impulse of [[.5], [.5, -.25], [.5, .25, -.125]]) for (const tail of [true, false]) {
  const spec = { fixture: { frames: 4, channels: 2, sampleRate: 48000 }, steps: [{ op: 'convolve', impulse, tail }], oracle: { type: 'exact', atol: 1e-6 } }
  const output = await adapter.run(spec, input, 48000)
  const result = judge(spec, output, expected(spec, input), input, 48000)
  assert.equal(result.pass, true, JSON.stringify({ impulse, tail, result }))
 }
})

test('SoX reads a long impulse from a coefficient file and preserves its full tail', { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 if(!await exists('sox'))return t.skip('sox unavailable')
 const impulse=Array.from({length:4097},(_,i)=>(i%2?-1:1)/8192),fixture={signal:'dc',value:.125,frames:17,channels:2,sampleRate:48000}
 const spec={fixture,steps:[{op:'convolve',impulse,tail:true}],oracle:{type:'convolution-dc',atol:2e-5}},input=makeSignal(fixture).channels
 const output=await native('sox').run(spec,input,48000)
 assert.equal(judge(spec,output,null,input,48000).pass,true)
})

test('FFmpeg noise profiling preserves the signal timeline while reducing the declared noise', { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 const adapter = native('ffmpeg')
 if (!await exists('ffmpeg')) return t.skip('ffmpeg unavailable')
 assert.equal(await adapter.available(), true)
 const spec = (await loadSpec()).cases.find(c => c.id === 'restoration.denoise.reference')
 const input = makeSignal(spec.fixture).channels, output = await adapter.run(spec, input, spec.fixture.sampleRate)
 const result = judge(spec, output, expected(spec, input), input, spec.fixture.sampleRate)
 assert.equal(result.pass, true, JSON.stringify(result))
})

test('SoundStretch accepts its version exit status and converts stretch, rate and pitch units', { skip: !process.env.AUDIO_TEST_NATIVE }, async t => {
 if (!await exists('soundstretch')) return t.skip('soundstretch unavailable')
 assert.equal(await soundtouch.available(), true)
 assert.match(await soundtouch.version(), /^\d+\.\d+/)
 const cases = (await loadSpec()).cases
 for (const id of ['rate.varispeed.duration-pitch', 'rate.pitch.frequency-duration', 'rate.stretch.duration-pitch-transient']) {
  const spec = cases.find(c => c.id === id), input = makeSignal(spec.fixture).channels
  const output = await soundtouch.run(spec, input, spec.fixture.sampleRate)
  const result = judge(spec, output, expected(spec, input), input, spec.fixture.sampleRate)
  assert.equal(result.pass, true, JSON.stringify({ id, result }))
 }
})
