import test from 'node:test'
import assert from 'node:assert/strict'
import { python } from '../adapters/python.js'
import { judge } from '../src/oracles.js'

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
 assert.equal(adapter.supports(spec({ op: 'limiter', lookahead: .005 })), true)
 assert.equal(adapter.supports(spec({ op: 'gain', value: 0 })), true)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'compressor', params: { ratio: 1, upRatio: 1, makeup: 0 } })), true)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'compressor', params: { upRatio: 2 } })), false)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'freeverb', params: { mix: 0 } })), true)
 assert.equal(adapter.supports(spec({ op: 'processor', name: 'freeverb', params: { unknown: 0 } })), false)
 for (const [name, params] of [['compressor', { threshold: -20, knee: 0 }], ['limiter', { ceiling: -1, lookahead: 5 }], ['delay', { time: .25, feedback: .5 }], ['chorus', { rate: 2, delay: .01 }], ['phaser', { fc: 1000 }], ['bitcrusher', { bits: 12 }], ['moog', { fc: 800, resonance: .5 }], ['pitch-shift', { semitones: 7 }]])
  assert.equal(adapter.supports(spec({ op: 'processor', name, params })), true, name)
 for (const [name, params] of [['compressor', { knee: 6 }], ['gate', { hold: 20 }], ['chorus', { voices: 3 }], ['phaser', { stages: 8 }], ['bitcrusher', { rate: .5 }], ['pitch-shift', { formant: true }]])
  assert.equal(adapter.supports(spec({ op: 'processor', name, params })), false, name)
 for (const id of ['scipy', 'librosa']) {
  const a = python(id)
  for (const [name, params] of [['emphasis', { alpha: .5 }], ['deemphasis', { alpha: .9 }], ['integral', { leak: .95 }], ['derivative', {}]])
   assert.equal(a.supports(spec({ op: 'processor', name, params })), true, `${id} ${name}`)
  assert.equal(a.supports(spec({ op: 'processor', name: 'emphasis', params: { unknown: 1 } })), false)
 }
 assert.equal(python('librosa').supports(spec({ op: 'processor', name: 'dcblocker', params: {} })), false)
 for (const [format, bitDepth] of [['wav', 16], ['wav', 24], ['wav', 32], ['flac', 16], ['flac', 24]])
  assert.equal(adapter.supports({ workflow: { op: 'codec-roundtrip', format, bitDepth }, steps: [] }), true)
 for (const workflow of [{ format: 'flac', bitDepth: 32 }, { format: 'mp3' }, { format: 'wav', split: true }])
  assert.equal(adapter.supports({ workflow: { op: 'codec-roundtrip', ...workflow }, steps: [] }), false)
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
  await t.test('librosa native edits preserve exact stereo order, empty results and repeated requests', async () => {
   const a = adapter('librosa')
   for (const frames of [0, 1, 2, 17, 17, 257]) {
    const input = [Float32Array.from({ length: frames }, (_, i) => i / 512), Float32Array.from({ length: frames }, (_, i) => -(i + 1) / 1024)]
    const start = Math.min(1, frames), length = Math.min(3, frames - start)
    for (const [step, expected] of [
     [{ op: 'trim', start, length }, input.map(ch => ch.slice(start, start + length))],
     [{ op: 'remove', start, length }, input.map(ch => Float32Array.from([...ch.slice(0, start), ...ch.slice(start + length)]))],
     [{ op: 'repeat', count: 3 }, input.map(ch => Float32Array.from([...ch, ...ch, ...ch]))],
     [{ op: 'repeat', count: 0 }, input.map(() => new Float32Array())]
    ]) {
     const out = await a.run(spec(step), input, 48000)
     assert.equal(out.sampleRate, 48000)
     assert.deepEqual(out.channels, expected, `${step.op} ${frames} frames`)
    }
   }
  })
  for (const id of ['librosa', 'scipy']) await t.test(`${id} native first-order filters preserve channel state and transfer functions`, async () => {
   const a = adapter(id), impulse = [Float32Array.of(1, 0, 0, 0), Float32Array.of(0, .5, 0, 0)]
   const checks = [
    ['emphasis', { alpha: .5 }, [[1, -.5, 0, 0], [0, .5, -.25, 0]]],
    ['deemphasis', { alpha: .5 }, [[1, .5, .25, .125], [0, .5, .25, .125]]],
    ['derivative', {}, [[1, -1, 0, 0], [0, .5, -.5, 0]]],
    ['integral', { leak: .5 }, [[1, .5, .25, .125], [0, .5, .25, .125]]]
   ]
   if (id === 'scipy') checks.push(['dcblocker', { R: .5 }, [[1, -.5, -.25, -.125], [0, .5, -.25, -.125]]])
   for (const [name, params, expected] of checks) {
    const step = spec({ op: 'processor', name, params })
    for (const input of [impulse, impulse, [Float32Array.of(.25), Float32Array.of(-.5)]]) {
     const out = await a.run(step, input, 48000)
     assert.equal(out.sampleRate, 48000)
     assert.deepEqual(out.channels, input === impulse ? expected.map(ch => Float32Array.from(ch)) : input, name)
    }
   }
   const input = [Float32Array.of(.25, -.125, .5, -.5, 0), Float32Array.of(-.25, 0, .125, .5, -.25)]
   const restored = await a.run(spec({ op: 'processor', name: 'emphasis', params: { alpha: .97 } }, { op: 'processor', name: 'deemphasis', params: { alpha: .97 } }), input, 48000)
   assert.ok(restored.channels.every((ch, c) => ch.every((value, i) => Math.abs(value - input[c][i]) < 1e-6)), 'emphasis/deemphasis inverse')
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
  await t.test('Pedalboard BrickwallLimiter uses ceiling, lookahead and a fresh envelope', async () => {
   const a = adapter('pedalboard'), input = [new Float32Array(4800).fill(.8), new Float32Array(4800).fill(.2)]
   const step = spec({ op: 'limiter', ceiling: -6, release: .05, lookahead: .005 })
   const first = await a.run(step, input, 48000), repeated = await a.run(step, input, 48000)
   assert.deepEqual(repeated.channels, first.channels)
   assert.ok(first.channels.every(ch => ch.length === 4800 && ch.every(Number.isFinite)))
   assert.ok(Math.abs(Math.max(...first.channels[0]) - 10 ** (-6 / 20)) < 1e-6, 'actual ceiling without automatic makeup')
   const quiet = [new Float32Array(4800).fill(.1), new Float32Array(4800).fill(.05)]
   const next = await a.run(step, quiet, 48000)
   assert.ok(next.channels.every((ch, c) => ch.every(v => Math.abs(v - quiet[c][0]) < 1e-6)), 'no envelope retained from louder request')
   const transient = [new Float32Array(4800).fill(.1)]; transient[0][1000] = .9
   const short = await a.run(spec({ op: 'limiter', ceiling: -6, release: .05, lookahead: .001 }), transient, 48000)
   const long = await a.run(step, transient, 48000)
   assert.equal(long.channels[0].indexOf(Math.max(...long.channels[0])), 1000, 'native offline engine compensates lookahead latency')
   assert.ok(short.channels[0][900] > .099 && long.channels[0][900] < .06, '5 ms applies gain earlier than 1 ms')
   const zero = await a.run(spec({ op: 'limiter', ceiling: -6, release: .05, lookahead: 0 }), quiet, 48000)
   assert.ok(zero.channels[0].some(v => v > .1), 'zero lookahead preserves original Limiter makeup behavior')
   assert.match((await a.metadata()).mapping, /BrickwallLimiter/)
  })
  await t.test('Pedalboard native processor controls preserve tiny stereo layout and reset A/A/B', async () => {
   const a = adapter('pedalboard')
   for (const [name, params] of [['delay', { time: .001, feedback: 0, mix: 1 }], ['moog', { fc: 1000, resonance: .5 }], ['pitch-shift', { semitones: 7 }], ['chorus', { rate: 2, delay: .01 }], ['phaser', { fc: 800 }], ['bitcrusher', { bits: 4 }]]) {
    const step = spec({ op: 'processor', name, params })
    let previous
    for (const frames of [0, 1, 2, 257, 257, 17]) {
     const input = [Float32Array.from({ length: frames }, (_, i) => i === 0 ? .5 : 0), new Float32Array(frames)]
     const out = await a.run(step, input, 48000)
     assert.equal(out.sampleRate, 48000)
     assert.equal(out.channels.length, 2, `${name} channels`)
     assert.ok(out.channels.every(ch => ch.length === frames && ch.every(Number.isFinite)), `${name} ${frames} shape/finite`)
     assert.ok(out.channels[1].every(v => v === 0), `${name} no channel bleed`)
     if (frames === 257 && previous?.[0].length === 257) assert.deepEqual(out.channels, previous, `${name} fresh state`)
     if (name === 'delay' && frames > 48) assert.equal(out.channels[0][48], .5, 'delay time is seconds')
     previous = out.channels
    }
   }
  })
  await t.test('Pedalboard AudioFile roundtrips actual codec depths, zero work and square stereo across A/A/B', async () => {
   const a = adapter('pedalboard')
   for (const [format, bitDepth] of [['wav', 16], ['wav', 24], ['wav', 32], ['flac', 16], ['flac', 24]]) {
    const test = { workflow: { op: 'codec-roundtrip', format, bitDepth }, steps: [] }
    for (const frames of [0, 1, 2, 17, 17, 1025]) {
     const input = [Float32Array.from({ length: frames }, (_, i) => (i % 17 - 8) / 16), Float32Array.from({ length: frames }, (_, i) => (i % 7 - 3) / 8)]
     const out = await a.run(test, input, 48000)
     assert.equal(out.sampleRate, 48000)
     assert.equal(out.bitDepth, bitDepth)
     assert.equal(out.sampleFormat, bitDepth === 32 ? 'float' : 'integer')
     assert.ok(out.encodedBytes > 0)
     assert.equal(out.encoded, undefined, 'transport bytes do not leak into results')
     assert.deepEqual(out.observations.sourceAfter, input)
     assert.equal(out.channels.length, 2)
     const tolerance = bitDepth === 32 ? 0 : 2 ** (1 - bitDepth)
     assert.ok(out.channels.every((ch, c) => ch.length === frames && ch.every((v, i) => Number.isFinite(v) && Math.abs(v - input[c][i]) <= tolerance)), `${format}${bitDepth} ${frames}: channel order, duration and quantization`)
    }
   }
   for (const [format, bitDepth] of [['wav', 16], ['wav', 24], ['flac', 16], ['flac', 24]]) {
    const test = { workflow: { op: 'codec-roundtrip', format, bitDepth }, steps: [], oracle: { type: 'exact', atol: 0 } }
    const input = [Float32Array.of(-1, -.5, 0, .25)]
    const out = await a.run(test, input, 48000)
    const measured = judge(test, out, { channels: input, observations: { sourceAfter: input } }, input, 48000)
    assert.equal(measured.pass, false, 'native integer normalization remains visible to the exact oracle')
    assert.equal(measured.reason, 'samples')
    assert.ok(measured.maxAbsError > 0 && measured.maxAbsError <= 2 ** (1 - bitDepth), 'preserve native rounding without assuming one OS residual')
   }
   const invalid = { workflow: { op: 'codec-roundtrip', format: 'wav', bitDepth: 12 }, steps: [] }
   await assert.rejects(a.run(invalid, [Float32Array.of(.25)], 48000), /bit depth/)
   const valid = { workflow: { op: 'codec-roundtrip', format: 'wav', bitDepth: 32 }, steps: [] }
   const input = [Float32Array.of(.25), Float32Array.of(-.5)]
   assert.deepEqual((await a.run(valid, input, 48000)).channels, input, 'worker recovers after native writer rejects a format')
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
