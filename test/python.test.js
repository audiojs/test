import test from 'node:test'
import assert from 'node:assert/strict'
import { python } from '../adapters/python.js'

const spec = (...steps) => ({ steps })
const tone = (frames = 4096, rate = 48000, frequency = 1500) => [Float32Array.from({ length: frames }, (_, i) => .5 * Math.sin(2 * Math.PI * frequency * i / rate))]

test('Python contenders only claim operations supplied by their own libraries', () => {
 for (const id of ['librosa', 'pedalboard', 'scipy', 'soxr', 'libsamplerate', 'pyloudnorm']) {
  const adapter = python(id)
  assert.equal(adapter.supports(spec({ op: 'reverse' })), false, id)
  assert.equal(adapter.supports(spec()), false, `${id} empty identity`)
  assert.equal(adapter.supports({ workflow: { op: 'undo' }, steps: [] }), false, id)
 }
 assert.equal(python('scipy').supports(spec({ op: 'convolve', impulse: [1] })), true)
 assert.equal(python('pyloudnorm').supports(spec({ op: 'measure', name: 'loudness' })), true)
 assert.equal(python('soxr').supports({ workflow: { op: 'resample-chunks' }, steps: [] }), true)
 assert.equal(python('librosa').supports(spec({ op: 'measure', name: 'pitch' }, { op: 'resample', to: 16000 })), false)
})

test('Pedalboard mappings reject unsupported controls and hard/soft clipping substitution', () => {
 const adapter = python('pedalboard')
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'softclip', params: {} })), false)
 assert.equal(adapter.supports(spec({ op: 'lowpass', freq: 1000, order: 2 })), false)
 assert.equal(adapter.supports(spec({ op: 'lowpass', freq: 1000, order: 1 })), true)
 assert.equal(adapter.supports(spec({ op: 'compressor', knee: 6 })), false)
 assert.equal(adapter.supports(spec({ op: 'gate', hold: .02 })), false)
 assert.equal(adapter.supports(spec({ op: 'limiter', lookahead: .005 })), false)
 assert.equal(adapter.supports(spec({ op: 'gain', value: 0 })), true)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'compressor', params: { ratio: 1, upRatio: 1, makeup: 0 } })), true)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'compressor', params: { upRatio: 2 } })), false)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'freeverb', params: { mix: 0 } })), true)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'freeverb', params: { unknown: 0 } })), false)
})

test('installed Python libraries execute real DSP and analysis', { skip: !process.env.AUDIO_TEST_PYTHON, timeout: 180000 }, async t => {
 const adapters = new Map()
 const adapter = id => {
  if (!adapters.has(id)) adapters.set(id, python(id))
  return adapters.get(id)
 }
 try {
  await t.test('concurrent bridge requests retain their responses', async () => {
   const a = adapter('scipy')
   const [version, metadata, first, second] = await Promise.all([
    a.version(), a.metadata(),
    a.run(spec({ op: 'convolve', impulse: [1, .5], tail: true }), [Float32Array.of(1, 0)], 48000),
    a.run(spec({ op: 'convolve', impulse: [1], tail: false }), [Float32Array.of(.25, 0)], 48000)
   ])
   assert.match(version, /^\d+\./)
   assert.ok(metadata.packages.scipy)
   assert.equal(first.channels[0].length, 3)
   assert.ok(first.channels[0].every((value, index) => Math.abs(value - [1, .5, 0][index]) < 1e-6))
   assert.deepEqual(Array.from(second.channels[0]), [.25, 0])
  })
  for (const id of ['scipy', 'librosa']) await t.test(`${id} preserves FFT units and coherent window gain`, async () => {
   const out = await adapter(id).run(spec({ op: 'measure', name: 'spectrum', size: 4096, window: 'hann' }), tone(), 48000)
   const peak = out.spectrum.magnitudes.indexOf(Math.max(...out.spectrum.magnitudes))
   assert.equal(out.spectrum.frequencies[peak], 1500)
   assert.ok(Math.abs(out.spectrum.magnitudes[peak] - .5) < 1e-5)
  })
  await t.test('librosa zero crossings exclude channel boundaries across repeated requests', async () => {
   const a = adapter('librosa'), step = spec({ op: 'analyze', name: 'zcr' })
   const isolated = [Float32Array.of(.25), Float32Array.of(-.5)]
   const transitions = [Float32Array.of(.25, -.25, .25), Float32Array.of(-.5, .5, -.5)]
   for (const [input, expected] of [[isolated, 0], [isolated, 0], [transitions, 2 / 3]]) {
    const out = await a.run(step, input, 48000)
    assert.equal(out.scalar, expected)
   }
  })
  await t.test('pyloudnorm measures and normalizes EBU-style stereo tones', async () => {
   const a = adapter('pyloudnorm'), input = tone(48000, 48000, 1000)
   const stereo = [input[0], input[0]]
   const out = await a.run(spec({ op: 'normalize-loudness', target: -23, ceiling: -1 }), stereo, 48000)
   const measured = await a.run(spec({ op: 'measure', name: 'loudness' }), out.channels, 48000)
   assert.ok(Math.abs(measured.scalar + 23) < .01)
  })
  await t.test('Pedalboard delay maps frames to seconds without manufacturing output', async () => {
   const input = [new Float32Array(4800)]; input[0][0] = 1
   const out = await adapter('pedalboard').run(spec({ op: 'delay', delayFrames: 2400, feedback: 0, mix: 1 }), input, 48000)
   const peak = out.channels[0].indexOf(Math.max(...out.channels[0]))
   assert.equal(peak, 2400)
   assert.ok(Math.abs(out.channels[0][peak] - 1) < 1e-5)
  })
  await t.test('Pedalboard native gain and neutral controls handle A/A/B without stale state', async () => {
   const a=adapter('pedalboard')
   for(const frames of [1,1025,1025,17]){
    const input=[Float32Array.from({length:frames},(_,i)=>(i%7-3)/8),Float32Array.from({length:frames},(_,i)=>(i%5-2)/8)]
    for(const [name,params] of [['compressor',{ratio:1,upRatio:1,makeup:0}],['delay',{mix:0}],['freeverb',{mix:0}]]){
     const out=await a.run(spec({op:'processor',name,params}),input,48000)
     assert.deepEqual(out.channels,input,`${name} neutral ${frames}`)
    }
    const mute=await a.run(spec({op:'gain',value:0}),input,48000)
    assert.ok(mute.channels.every(ch=>ch.length===frames&&ch.every(value=>value===0)))
   }
  })
 } finally {
  for (const a of adapters.values()) a.close()
 }
})

test('streaming resamplers preserve empty, tiny and final-boundary inputs across worker requests', { skip: !process.env.AUDIO_TEST_PYTHON, timeout: 120000 }, async t => {
 const stream = chunks => ({ workflow: { op: 'resample-chunks', to: 32000, chunks }, steps: [] })
 const signal = (frames, frequencies = [1500, 750], amplitudes = [.5, .25]) => frequencies.map((frequency, c) =>
  Float32Array.from({ length: frames }, (_, i) => amplitudes[c] * Math.sin(2 * Math.PI * frequency * i / 48000 + c * .17)))
 const matchesBatch = (out, input) => {
  assert.equal(out.sampleRate, 32000)
  assert.equal(out.channels.length, input.length)
  assert.equal(out.observations.batch.length, input.length)
  for (let c = 0; c < input.length; c++) {
   const actual = out.channels[c], batch = out.observations.batch[c]
   assert.equal(actual.length, batch.length, `channel ${c} native batch length`)
   assert.ok(Math.abs(actual.length - input[c].length * 2 / 3) <= 1)
   assert.ok(actual.every((value, i) => Number.isFinite(value) && Math.abs(value - batch[i]) < 1e-5), `channel ${c} native batch samples`)
  }
 }
 const preservesTone = (out, frequencies, amplitudes) => {
  for (let c = 0; c < frequencies.length; c++) {
   let energy = 0, error = 0
   for (let i = 512; i < out.channels[c].length - 512; i++) {
    const ideal = amplitudes[c] * Math.sin(2 * Math.PI * frequencies[c] * i / 32000 + c * .17)
    energy += ideal * ideal
    error += (out.channels[c][i] - ideal) ** 2
   }
   const snr = 10 * Math.log10(energy / error)
   assert.ok(snr > 70, `channel ${c}: expected frequency, amplitude and phase; SNR ${snr} dB`)
  }
 }
 for (const id of ['soxr', 'libsamplerate']) await t.test(id, async () => {
  const adapter = python(id)
  try {
   for (const count of [1, 2]) {
    const empty = Array.from({ length: count }, () => new Float32Array())
    const out = await adapter.run(stream([1]), empty, 48000)
    matchesBatch(out, empty)
    assert.ok(out.channels.every(channel => channel.length === 0))
    const directEmpty = await adapter.run(spec({ op: 'resample', to: 32000 }), empty, 48000)
    assert.equal(directEmpty.sampleRate, 32000)
    assert.deepEqual(directEmpty.channels, out.channels)
    const single = Array.from({ length: count }, (_, c) => Float32Array.of((c + 1) / 4))
    const tiny = await adapter.run(stream([1]), single, 48000)
    matchesBatch(tiny, single)
    const directTiny = await adapter.run(spec({ op: 'resample', to: 32000 }), single, 48000)
    assert.equal(directTiny.sampleRate, 32000)
    assert.deepEqual(directTiny.channels, tiny.observations.batch)
   }
   const a = signal(8193)
   let previous
   for (const chunks of [[8192, 1], [8193], [1, 8192]]) {
    const out = await adapter.run(stream(chunks), a, 48000)
    matchesBatch(out, a)
    preservesTone(out, [1500, 750], [.5, .25])
    if (previous) assert.deepEqual(out.channels, previous, 'fresh stream state across identical requests')
    previous = out.channels
   }
   const b = signal(48000, [375, 2250], [.125, .375])
   const out = await adapter.run(stream([1, 17, 1024, 31]), b, 48000)
   matchesBatch(out, b)
   preservesTone(out, [375, 2250], [.125, .375])
   for (const chunks of [[], [0]]) {
    await assert.rejects(adapter.run(stream(chunks), a, 48000), /positive integer sizes/)
    const recovered = await adapter.run(stream([8193]), a, 48000)
    matchesBatch(recovered, a)
    assert.deepEqual(recovered.channels, previous, 'worker recovers after a rejected request')
   }
   await assert.rejects(adapter.run(spec({ op: 'resample', to: -1 }), a, 48000))
   const recovered = await adapter.run(stream([8193]), a, 48000)
   matchesBatch(recovered, a)
   assert.deepEqual(recovered.channels, previous, 'worker recovers after a native library error')
  } finally {
   adapter.close()
  }
 })
})
