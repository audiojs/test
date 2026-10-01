import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSpec } from '../src/spec.js'
import { makeSignal } from '../src/signals.js'
import { expected, statistics } from '../src/reference.js'
import { integratedLoudness, reconstructedPeak, judge } from '../src/oracles.js'

const spec = await loadSpec()
const find = id => {
 const found = spec.cases.find(c => c.id === id)
 assert(found, `missing case ${id}`)
 return found
}
const evaluate = (t, actual) => {
 const input = makeSignal(t.fixture).channels
 return judge(t, actual, expected(t, input), input, t.fixture.sampleRate)
}

test('scalar expectations process long stereo signals without argument spreading', () => {
 const channels = [new Float32Array(480000).fill(.25), new Float32Array(480000).fill(-.5)]
 const values = statistics(channels)
 assert.equal(values.peak, .5)
 assert.equal(values.min, -.5)
 assert.equal(values.max, .25)
 assert.equal(values.dc, -.125)
 assert.equal(values.energy, 150000)
 assert.equal(values.rms, Math.sqrt(.15625))
 assert.equal(values.zcr, 0, 'channel boundaries are not zero crossings')
 assert.equal(expected({ oracle: { type: 'scalar' }, steps: [{ name: 'peak' }] }, channels).scalar, .5)
 assert.equal(judge({ oracle: { type: 'scalar', atol: 0 } }, { scalar: null }, { scalar: 0 }, channels, 48000).pass, false)
})

test('synthetic fixtures are reproducible and reject inconsistent segment lengths', () => {
 const t = find('restoration.denoise.reference')
 assert.deepEqual(makeSignal(t.fixture), makeSignal(t.fixture))
 assert.notDeepEqual(makeSignal(t.fixture).channels, makeSignal({ ...t.fixture, seed: t.fixture.seed + 1 }).channels)
 assert.throws(() => makeSignal({ signal: 'segments', frames: 4, segments: [{ signal: 'silence', frames: 3 }] }), /fill/)
 assert.throws(() => makeSignal({ signal: 'array', frames: 4, values: [1] }), /length/)
})

test('equal-power crossfade raises identical signals at the midpoint', () => {
 const t = find('edit.crossfade.equal-power'), input = makeSignal(t.fixture).channels
 const output = expected(t, input).channels[0]
 assert.equal(output.length, 96)
 assert(Math.abs(output[48] - Math.SQRT2 * .25) < 1e-7)
 const linear = expected({ ...t, steps: [{ ...t.steps[0], curve: 'linear' }] }, input)
 assert.equal(evaluate(t, linear).pass, false)
})

test('delay and convolution expectations agree with literal samples and tails', () => {
 const conv = find('effect.convolution.impulse')
 assert.deepEqual(Array.from(expected(conv, makeSignal(conv.fixture).channels).channels[0]), [1, .5, -.25, .5, .25, -.125])
 const delay = find('effect.delay.impulse'), out = expected(delay, makeSignal(delay.fixture).channels).channels[0]
 assert.deepEqual([out[0], out[2399], out[2400], out[4800], out[7200]], [0, 0, .5, .25, .125])
 assert.throws(() => expected({ ...delay, steps: [{ ...delay.steps[0], delayFrames: 0 }] }, makeSignal(delay.fixture).channels), /positive/)
 const stereo = expected({ oracle: { type: 'exact' }, steps: [{ op: 'delay', delayFrames: 2, feedback: .5, mix: 1 }] }, [Float32Array.from([1, 0, 0, 0, 0, 0, 0, 0]), Float32Array.from([0, -.5, 0, 0, 0, 0, 0, 0])]).channels
 assert.deepEqual(stereo.map(x => Array.from(x)), [[0, 0, 1, 0, .5, 0, .25, 0], [0, 0, 0, -.5, 0, -.25, 0, -.125]])
 assert.equal(evaluate(conv, { channels: [Float32Array.from([1, .5, -.25, .5])] }).pass, false)
})

test('constant-input convolution oracle matches direct algebra and rejects shifted or missing tails', () => {
 const fixture={signal:'dc',value:.125,frames:7,channels:2,sampleRate:48000},steps=[{op:'convolve',impulse:[1,-.5,.25,.125],tail:true}]
 const input=makeSignal(fixture).channels,t={fixture,steps,oracle:{type:'convolution-dc',atol:1e-7}}
 const output=expected({...t,oracle:{type:'exact'}},input)
 assert.equal(judge(t,output,null,input,48000).pass,true)
 assert.equal(judge(t,{channels:output.channels.map(ch=>ch.slice(0,-1))},null,input,48000).pass,false)
 const shifted=output.channels.map(ch=>{const out=new Float32Array(ch.length);out.set(ch.subarray(0,-1),1);return out})
 assert.equal(judge(t,{channels:shifted},null,input,48000).pass,false)
 const corrupted=output.channels.map(ch=>ch.slice());corrupted[1][8]+=.01
 assert.equal(judge(t,{channels:corrupted},null,input,48000).pass,false)
})

test('undo-redo checks both restored and redone buffers', () => {
 const t = find('editor.undo-redo.roundtrip'), input = makeSignal(t.fixture).channels
 const good = expected(t, input)
 assert.equal(evaluate(t, good).pass, true)
 good.observations.undone[0][0] += .01
 assert.equal(evaluate(t, good).pass, false)
})

test('independent loudness weighting matches EBU stereo calibration', () => {
 for (const level of [-23, -33]) {
  const input = makeSignal({ signal: 'sine', frequency: 1000, frames: 96000, channels: 2, sampleRate: 48000, phase: 0, amplitude: 10 ** (level / 20) }).channels
  assert(Math.abs(integratedLoudness(input) - level) < .1)
 }
 assert.equal(integratedLoudness([new Float32Array(48000)]), -Infinity)
 assert.throws(() => integratedLoudness([new Float32Array(48000)], 44100), /48 kHz/)
 assert.equal(find('analysis.loudness.ebu').fixture.frames, 960000)
 assert.equal(find('analysis.loudness.ebu-4').fixture.frames, 4800000)
})

test('intersample peak is not mistaken for sample peak', () => {
 const t = find('analysis.true-peak.ebu-16'), input = makeSignal(t.fixture).channels
 const sampleDb = 20 * Math.log10(statistics(input).peak)
 assert(sampleDb < -9)
 assert(Math.abs(20 * Math.log10(reconstructedPeak(input)) + 6.020599913) < .02)
 assert.equal(evaluate(t, { scalar: sampleDb }).pass, false)
 assert.equal(evaluate(t, { scalar: -6 }).pass, true)
 assert.equal(evaluate(t, { scalar: NaN }).pass, false)
 assert.equal(evaluate(t, { scalar: t.oracle.min }).pass, true)
 assert.equal(evaluate(t, { scalar: t.oracle.max }).pass, true)
})

test('normalization oracle rejects untouched, muted and over-ceiling output', () => {
 const t = find('level.loudness-normalize.target'), input = makeSignal(t.fixture).channels
 const gain = 10 ** ((-23 - integratedLoudness(input)) / 20)
 const normalized = input.map(x => Float32Array.from(x, v => v * gain))
 assert.equal(evaluate(t, { channels: normalized }).pass, true)
 assert.equal(evaluate(t, { channels: input }).pass, false)
 assert.equal(evaluate(t, { channels: input.map(x => new Float32Array(x.length)) }).pass, false)
 normalized[0][40000] = 1
 assert.equal(evaluate(t, { channels: normalized }).pass, false)
})

test('resampler SNR rejects wrong phase and chunk oracle rejects lost flush samples', () => {
 const t = find('rate.resample.snr-bandwidth')
 const ideal = makeSignal({ ...t.fixture, sampleRate: 32000, frames: 32000 }).channels
 assert.equal(evaluate(t, { channels: ideal, sampleRate: 32000 }).pass, true)
 assert.equal(evaluate(t, { channels: ideal.map(x => x.map(v => -v)), sampleRate: 32000 }).pass, false)
 const chunk = find('rate.resample.chunk-invariance')
 const batch = makeSignal({ ...chunk.fixture, sampleRate: 32000, frames: Math.round(chunk.fixture.frames * 2 / 3) }).channels
 assert.equal(evaluate(chunk, { channels: batch, sampleRate: 32000, observations: { batch } }).pass, true)
 assert.equal(evaluate(chunk, { channels: batch, sampleRate: 32000 }).pass, false)
 assert.equal(evaluate(chunk, { channels: batch.map(x => x.slice(0, -3)), sampleRate: 32000, observations: { batch } }).pass, false)
})

test('dynamics windows reject bypass and preserve a fully closed gate as valid', () => {
 const compressor = find('dynamics.compressor.envelope'), input = makeSignal(compressor.fixture).channels
 assert.equal(evaluate(compressor, { channels: input }).pass, false)
 const shaped = input.map(x => x.slice())
 for (const w of compressor.oracle.windows) {
  const gain = 10 ** ((w.minDb + w.maxDb) / 40)
  for (let i = Math.round(w.start * 48000); i < Math.round(w.end * 48000); i++) shaped[0][i] *= gain
 }
 assert.equal(evaluate(compressor, { channels: shaped }).pass, true)
 const gate = find('dynamics.gate.zero-hold'), gated = makeSignal(gate.fixture).channels.map(x => x.map(v => v < .01 ? 0 : v))
 assert.equal(evaluate(gate, { channels: gated }).pass, true)
 assert.equal(evaluate(gate, { channels: gated.map(x => new Float32Array(x.length)) }).pass, false)
})

test('limiter checks ceiling and timeline independently of finite output', () => {
 const t = find('dynamics.limiter.ceiling-latency'), input = makeSignal(t.fixture).channels
 const limited = input.map(x => x.map(v => Math.min(v, 10 ** (-6 / 20))))
 assert.equal(evaluate(t, { channels: limited }).pass, true)
 assert.equal(evaluate(t, { channels: input }).pass, false)
 const shifted = limited.map(x => { const y = new Float32Array(x.length); y.set(x.subarray(0, x.length - 20), 20); return y })
 assert.equal(evaluate(t, { channels: shifted }).pass, false)
})

test('dither statistics reject silence and unquantized random noise', () => {
 const t = find('restoration.dither.statistics')
 const noise = makeSignal({ ...t.fixture, signal: 'noise', noiseAmplitude: 1 }).channels
 const quantum = 1 / 32768
 const quantized = noise.map(x => x.map(v => v < -.75 ? -quantum : v > .75 ? quantum : 0))
 assert.equal(evaluate(t, { channels: quantized }).pass, true)
 assert.equal(evaluate(t, makeSignal(t.fixture)).pass, false)
 assert.equal(evaluate(t, { channels: noise.map(x => x.map(v => v * quantum)) }).pass, false)
})

test('denoise cannot pass by attenuating or discarding the clean signal', () => {
 const t = find('restoration.denoise.reference'), input = makeSignal(t.fixture).channels
 const clean = makeSignal({ ...t.fixture, noiseAmplitude: 0 }).channels
 assert.equal(evaluate(t, { channels: clean }).pass, true)
 assert.equal(evaluate(t, { channels: input }).pass, false)
 assert.equal(evaluate(t, { channels: clean.map(x => x.map(v => v * .1)) }).pass, false)
 assert.equal(evaluate(t, { channels: clean.map(x => new Float32Array(x.length)) }).pass, false)
})

test('analysis rejects wrong amplitude, missing events and octave tempo errors', () => {
 const spectrum = find('analysis.spectrum.analytic')
 assert.equal(evaluate(spectrum, { spectrum: { frequencies: [0, 1500, 3000], magnitudes: [0, .25, 0] } }).pass, true)
 assert.equal(evaluate(spectrum, { spectrum: { frequencies: [0, 1500, 3000], magnitudes: [0, .125, 0] } }).pass, false)
 const events = find('analysis.onset-tempo.synthetic')
 assert.equal(evaluate(events, { events: events.fixture.events }).pass, true)
 assert.equal(evaluate(events, { events: [] }).pass, false)
 assert.equal(evaluate(events, { events: events.fixture.events.flatMap(t => [t, t]) }).pass, false)
 const tempo = find('analysis.onset-tempo.tempo')
 assert.equal(evaluate(tempo, { scalar: 120 }).pass, true)
 assert.equal(evaluate(tempo, { scalar: 60 }).pass, false)
 assert.equal(evaluate(tempo, { scalar: 240 }).pass, false)
})

test('every channel must satisfy response, pitch, resampling and chunk quality', () => {
 const stereo=id=>{const t=find(id);return {...t,fixture:{...t.fixture,channels:2,phase:undefined}}}
 const response=stereo('filter.lowpass.16000.0.1'),tone=stereo('rate.stretch.1')
 const resample=stereo('rate.resample.44100-48000.passband'),snr=stereo('rate.resample.snr-bandwidth'),chunk=stereo('rate.resample.chunk-invariance')
 for(const t of [response,tone,resample,snr,chunk]){
  const rate=t.oracle.to??t.workflow?.to??t.fixture.sampleRate
  const fixture={...t.fixture,sampleRate:rate,frames:Math.round(t.fixture.frames*rate/t.fixture.sampleRate)}
  const channels=makeSignal(fixture).channels
  const actual=output=>({channels:output,sampleRate:rate,...(t.workflow?{observations:{batch:output}}:{})})
  const good=evaluate(t,actual(channels))
  assert.equal(good.pass,true,t.id)
  assert.equal(good.perChannel.length,2)
  for(const key of ['gainDb','frequency','snrDb'])if(key in good)assert.equal(good[key],good.perChannel[0][key],`${t.id}: retain channel 0 ${key}`)
  const muted=[channels[0],new Float32Array(channels[1].length)]
  assert.equal(evaluate(t,actual(muted)).pass,false,`${t.id}: muted right channel`)
  const wrong=t===response?channels[1].map(v=>v*.01):t===snr?channels[1].map(v=>-v):makeSignal({...fixture,frequency:fixture.frequency*2}).channels[1]
  const bad=evaluate(t,actual([channels[0],wrong]))
  assert.equal(bad.pass,false,`${t.id}: incorrect right channel`)
  assert.equal(bad.perChannel[0].pass,true)
  assert.equal(bad.perChannel[1].pass,false)
  assert.equal(evaluate(t,actual([channels[0]])).pass,false,`${t.id}: missing right channel`)
 }
})

test('dynamics and restoration reject muted or incorrect right channels', () => {
 const stereo=id=>{const t=find(id);return {...t,fixture:{...t.fixture,channels:2}}}
 const compressor=stereo('dynamics.compressor.envelope'),gate=stereo('dynamics.gate.zero-hold'),limiter=stereo('dynamics.limiter.ceiling-latency'),denoise=stereo('restoration.denoise.reference')
 for(const t of [compressor,gate,limiter,denoise]){
  const input=makeSignal(t.fixture).channels
  let channels
  if(t===compressor){
   channels=input.map(x=>x.slice())
   for(const x of channels)for(const w of t.oracle.windows){const gain=10**((w.minDb+w.maxDb)/40);for(let i=Math.round(w.start*48000);i<Math.round(w.end*48000);i++)x[i]*=gain}
  }else if(t===gate)channels=input.map(x=>x.map(v=>v<.01?0:v))
  else if(t===limiter)channels=input.map(x=>x.map(v=>Math.min(v,10**(-6/20))))
  else channels=makeSignal({...t.fixture,noiseAmplitude:0}).channels
  const good=evaluate(t,{channels})
  assert.equal(good.pass,true,t.id)
  assert.equal(good.perChannel.length,2)
  assert.equal(evaluate(t,{channels:[channels[0],new Float32Array(channels[1].length)]}).pass,false,`${t.id}: muted right channel`)
  const bad=evaluate(t,{channels:[channels[0],input[1]]})
  assert.equal(bad.pass,false,`${t.id}: bypassed right channel`)
  assert.equal(bad.perChannel[0].pass,true)
  assert.equal(bad.perChannel[1].pass,false)
  if(t===limiter){
   const delayed=new Float32Array(channels[1].length);delayed.set(channels[1].subarray(0,-20),20)
   assert.equal(evaluate(t,{channels:[channels[0],delayed]}).pass,false,'right channel latency')
   const quiet=input[1].map(v=>v*.5)
   const quietInput=[input[0],quiet]
   assert.equal(judge(t,{channels:[channels[0],quiet]},null,quietInput,48000).pass,true,'below-ceiling channel need not reach the ceiling')
   assert.equal(judge(t,{channels:[channels[0],new Float32Array(quiet.length)]},null,quietInput,48000).pass,false,'below-ceiling channel must survive')
   const silent=new Float32Array(input[1].length)
   assert.equal(judge(t,{channels:[channels[0],silent]},null,[input[0],silent],48000).pass,true,'silent input channel stays valid')
  }
 }
})

test('stretch checks pitch and transient timing on the right channel', () => {
 const original=find('rate.stretch.duration-pitch-transient'),t={...original,fixture:{...original.fixture,channels:2}}
 const fixture={...t.fixture,frames:t.fixture.frames*t.oracle.factor,segments:t.fixture.segments.map(s=>({...s,frames:s.frames*t.oracle.factor}))}
 const channels=makeSignal(fixture).channels
 assert.equal(evaluate(t,{channels}).pass,true)
 assert.equal(evaluate(t,{channels:[channels[0],new Float32Array(channels[1].length)]}).pass,false)
 const shifted=channels[1].slice(),at=Math.round(t.oracle.transientTime*t.oracle.factor*48000)
 shifted[at]=0;shifted[at+4800]=1
 const bad=evaluate(t,{channels:[channels[0],shifted]})
 assert.equal(bad.pass,false)
 assert.equal(bad.perChannel[0].pass,true)
 assert.equal(bad.perChannel[1].pass,false)
 assert.equal(bad.timeError,bad.perChannel[0].timeError)
})
