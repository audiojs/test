import test from 'node:test'
import assert from 'node:assert/strict'
import { caseVisual } from '../src/report-visual.js'
import { loadSpec } from '../src/spec.js'

const spec = await loadSpec()
const fixture = id => { const value = spec.cases.find(t => t.id === id); assert(value, id); return value }
const visual = (id, metrics, status = 'fail') => caseVisual(fixture(id), { status, metrics })
const metric = (value, label) => { const found = value.metrics.find(m => m.label === label); assert(found, label); return found }

test('phase and expanded codec results expose the tested units and requested format',()=>{
 const phase=visual('filter.allpass.phase.48000.1',{perChannel:[{gainDb:0,phaseError:0},{gainDb:0,phaseError:180}]})
 assert.equal(phase.metrics.some(m=>m.label==='Ch 1 Phase error'),false,'passing channel does not distract from the failure')
 assert.equal(metric(phase,'Ch 2 Phase error').unit,'°')
 assert.equal(metric(phase,'Ch 2 Phase error').status,'fail')
 assert.equal(metric(phase,'Ch 2 Phase error').max,.1)
 const file=visual('codec.wav.32bit.17f.2ch',{sampleRate:44100,encodedBytes:180,bitDepth:32,sampleFormat:'integer'})
 assert.equal(metric(file,'Sample format').status,'fail')
 assert.match(file.label,/32-bit/)
 const passed=visual('codec.wav.32bit.17f.2ch',{sampleRate:44100,encodedBytes:180,bitDepth:32,sampleFormat:'float'},'pass')
 assert.equal(metric(passed,'Bit depth').target,32)
})

test('conditions use short labels and literal chips, not prose or internal IDs', () => {
 const crossfade = visual('edit.crossfade.17.1.end')
 assert.equal(crossfade.label, 'Linear crossfade')
 assert.deepEqual(crossfade.chips, ['17 frames', 'Mono', '48 kHz', 'At end', 'Length 8 frames'])
 assert.equal(visual('filter.lowpass1.16000.4').label, '4 kHz tone')
 assert(visual('edit.reverse.1f.1ch').chips.includes('1 frame'))
 const processor = caseVisual({ fixture: { frames: 0, channels: 1, sampleRate: 48000, signal: 'silence' }, steps: [{ op: 'processor', params: { mix: 0, enabled: false } }] })
 assert(processor.chips.includes('0 frames')); assert(processor.chips.includes('Mix 0')); assert(processor.chips.includes('Enabled off'))
 for (const definition of spec.cases) {
  const { label, chips } = caseVisual(definition)
  assert(label && chips.every(chip => typeof chip === 'string'))
  assert(![label, ...chips].some(text => text.includes('·') || text.includes(definition.id)))
  assert.doesNotMatch([label, ...chips].join(' '), /undefined|NaN|null/)
 }
})

test('waveform error uses full-scale percent with unrounded value and tolerance', () => {
 const raw = .04876059293746948
 const out = visual('edit.crossfade.17.1.end', { maxAbsError: raw, lengthDelta: [0], channels: 1, expectedChannels: 1 })
 assert.equal(out.metrics.length, 1, 'passing shape checks do not compete with the failure')
 assert.deepEqual(out.metrics[0], { label: 'Sample error', value: raw * 100, unit: '% full scale', min: 0, max: 1e-6 * 100, target: 0, status: 'fail' })
 const passed = visual('edit.reverse.1f.1ch', { maxAbsError: 0, lengthDelta: [0] }, 'pass')
 assert.equal(metric(passed, 'Sample error').value, 0)
 assert.equal(metric(passed, 'Sample error').status, 'pass')
})

test('signed length errors have the exact oracle bounds and remain separate from waveform error', () => {
 const dropped = visual('edit.reverse.1f.1ch', { lengthDelta: [-1], maxAbsError: 0 })
 assert.deepEqual(dropped.metrics, [{ label: 'Length error', value: -1, unit: 'frames', min: 0, max: 0, target: 0, status: 'fail' }])
 const pitch = visual('rate.pitch.frequency-duration', { lengthError: -1042, frequency: 880, expectedFrequency: 880 })
 assert.equal(pitch.metrics.length, 1)
 assert.equal(metric(pitch, 'Length error').min, -480)
 const small = { fixture: { frames: 17 }, oracle: { type: 'tone', frequency: 440 } }
 const edge = caseVisual(small, { status: 'fail', metrics: { lengthError: 3, frequency: 440 } })
 assert.equal(metric(edge, 'Length error').max, 2)
 assert.equal(metric(edge, 'Length error').status, 'fail')
 const stretch = visual('rate.stretch.duration-pitch-transient', { lengthError: -2026, frequency: 440, timeError: 0 })
 assert.equal(metric(stretch, 'Length error').max, 1440)
 assert.equal(stretch.metrics.length, 1)
})

test('source mutation, missing channels and non-finite output remain visible despite matching samples', () => {
 const changed = visual('editor.stream.17', { inputUnchanged: false, sourceUnchanged: true, maxAbsError: 0, streamEqual: true })
 assert.deepEqual(changed.metrics, [{ label: 'Original audio', value: 'Changed', status: 'fail' }])
 assert.equal(metric(visual('edit.reverse.1f.1ch', { channels: 0, expectedChannels: 2, maxAbsError: 0 }), 'Channels').target, 2)
 assert.deepEqual(visual('edit.reverse.1f.1ch', { reason: 'non-finite' }).metrics, [{ label: 'Audio samples', value: 'Non-finite', status: 'fail' }])
 assert.equal(metric(visual('editor.undo-redo.roundtrip', { undoEqual: false }), 'Undo').value, 'Different')
})

test('scalar failures preserve tiny differences even when displayed actual and target could round alike', () => {
 const actual = 299.9999880191375, error = .000011980862495875044
 const out = visual('analysis.energy.dc', { actual, expected: 300, absoluteError: error })
 assert.equal(metric(out, 'Energy').value, actual)
 assert.equal(metric(out, 'Energy').target, 300)
 assert.equal(metric(out, 'Difference').value, error)
 assert.equal(metric(out, 'Difference').max, .00001)
 assert(out.metrics.every(metric => metric.status === 'fail'))
 const zero = visual('analysis.energy.dc', { actual: 0, expected: 0, absoluteError: 0 }, 'pass')
 assert.equal(metric(zero, 'Energy').target, 0)
 assert.equal(metric(zero, 'Difference').status, 'pass')
 const absent = visual('analysis.energy.dc', { actual: null, expected: 0, absoluteError: null })
 assert.equal(metric(absent, 'Energy').value, 'Not recorded')
 assert.equal(metric(absent, 'Difference').value, 'Not recorded')
 assert(absent.metrics.every(metric => metric.status === 'unknown'))
})

test('filter and resampling checks select actual failing channels and preserve strict pitch limits', () => {
 const filter = visual('filter.lowpass1.16000.4', { min: -14.495, max: -13.895, perChannel: [{ gainDb: -14.1, pass: true }, { gainDb: -11.4, pass: false }] })
 assert.deepEqual(filter.metrics.map(m => m.label), ['Ch 2 Gain'])
 assert.equal(filter.metrics[0].unit, 'dB')
 const pitch = visual('rate.resample.44100-48000.passband', { gainDb: 0, frequency: 1500, sampleRate: 48000, expectedRate: 48000 })
 assert.deepEqual(pitch.metrics.map(m => m.label), ['Pitch'])
 assert.equal(pitch.metrics[0].target, 997)
 assert.equal(pitch.metrics[0].min, 997 * .99)
 assert.equal(pitch.metrics[0].minExclusive, true)
 assert.equal(pitch.metrics[0].maxExclusive, true)
 const stream = visual('rate.resample.chunk-invariance', { maxAbsError: .1, frequency: 997, lengthError: 0 })
 assert.deepEqual(stream.metrics.map(m => m.label), ['Sample error'])
 const snr = visual('rate.resample.snr-bandwidth', { lengthError: 0, perChannel: [{ snrDb: 80 }, { snrDb: 56.4498 }] })
 assert.equal(metric(snr, 'Ch 2 Signal / error').min, 70)
 assert.equal(snr.metrics.length, 1)
})

test('loudness, pitch and intersample peaks retain measurement units and declared tolerances', () => {
 const pitch = visual('analysis.pitch.tone-110', { actual: 110.7222578078669, min: 109.3664466199302, max: 110.63722351746388 })
 assert.equal(metric(pitch, 'Pitch').unit, 'Hz')
 const loudness = visual('analysis.loudness.ebu', { actual: -22.99, min: -23.1, max: -22.9 }, 'pass')
 assert.equal(metric(loudness, 'Loudness').unit, 'LUFS')
 const nullPeak = visual('analysis.true-peak.bs1770', { actual: null, min: -6.4, max: -5.8 })
 assert.equal(metric(nullPeak, 'True peak').value, 'Not recorded')
 assert.equal(metric(nullPeak, 'True peak').unit, 'dBTP')
 const normalization = visual('level.loudness-normalize.target', { loudness: -30, truePeak: 0 })
 assert.equal(metric(normalization, 'Loudness').target, -23)
 assert.equal(metric(normalization, 'Loudness').min, -23.2)
 assert.equal(metric(normalization, 'True peak').max, -.9, 'the oracle permits 0.1 dB above the stated ceiling')
 assert(visual('analysis.true-peak.ebu-16').chips.some(chip => chip.includes('45° phase')))
})

test('limiter metrics distinguish excessive attenuation, excess peak and timing shift', () => {
 const tooQuiet = visual('dynamics.limiter.zero-lookahead', { peak: 0, inputPeak: .8, ceiling: .5011872, latencyFrames: 0 })
 const peak = metric(tooQuiet, 'Peak')
 assert.equal(peak.value, 0); assert.equal(peak.min, .5011872 * 80)
 assert.equal(peak.max, (.5011872 + 1e-5) * 100)
 assert.equal(tooQuiet.metrics.length, 1)
 const shifted = visual('dynamics.limiter.zero-lookahead', { peak: .5, inputPeak: .8, ceiling: .5011872, latencyFrames: -64 })
 assert.deepEqual(shifted.metrics, [{ label: 'Timing shift', value: -64, unit: 'frames', min: -1, max: 1, target: 0, status: 'fail' }])
})

test('dynamics exposes each failing window as a bounded gain measurement', () => {
 const windows = [{ start: 0, end: .45, gainDb: 8.1, minDb: -.1, maxDb: .1 }, { start: .9, end: 1.3, gainDb: -9, minDb: -9.2, maxDb: -8.7 }]
 const out = visual('dynamics.compressor.envelope', { windows })
 assert.deepEqual(out.metrics, [{ label: '0–0.45 s gain', value: 8.1, unit: 'dB', min: -.1, max: .1, status: 'fail' }])
 assert.doesNotThrow(() => visual('dynamics.compressor.envelope', { windows: [null, {}] }))
})

test('denoise distinguishes signal loss from successful noise suppression', () => {
 const out = visual('restoration.denoise.reference', { improvement: -11.31687, gainDb: -12.004, noiseReduction: 12 })
 assert.deepEqual(out.metrics.map(m => m.label), ['Signal improvement', 'Signal level'])
 assert.equal(metric(out, 'Signal improvement').min, 3)
 assert.equal(metric(out, 'Signal level').min, -1)
 assert.equal(metric(out, 'Signal level').max, 1)
})

test('dither shows correct units and enforces strict zero-bias and quantization boundaries', () => {
 const fine = { mean: 0, rms: .5, zero: .75, lag: 0, gridError: 0, peak: 1 }
 const out = visual('restoration.dither.statistics', { perChannel: [fine, { ...fine, mean: -.5, zero: .5 }] })
 assert.deepEqual(out.metrics.map(m => m.label), ['Ch 2 Bias', 'Ch 2 Silent samples'])
 assert.equal(metric(out, 'Ch 2 Silent samples').value, 50)
 assert.equal(metric(out, 'Ch 2 Silent samples').min, 71)
 assert.equal(metric(out, 'Ch 2 Bias').unit, 'steps')
 const edge = visual('restoration.dither.statistics', { perChannel: [{ ...fine, mean: .02, gridError: .001 }] })
 assert(edge.metrics.every(m => m.status === 'fail'))
 assert.deepEqual(edge.metrics.map(m => m.label), ['Bias', 'Quantization error'])
 assert.equal(metric(edge, 'Bias').minExclusive, true)
 assert.equal(metric(edge, 'Bias').maxExclusive, true)
 assert.equal(metric(edge, 'Quantization error').maxExclusive, true)
 assert.equal(metric(edge, 'Quantization error').minExclusive, undefined)
})

test('events and spectrum carry counts, frequency, amplitude and tolerance data', () => {
 const clicks = visual('analysis.onset-tempo.synthetic', { matched: 0, expected: 15, detected: 0, fscore: 0, maxError: 0 })
 assert.equal(clicks.metrics[0].label, 'Match score')
 assert.equal(clicks.metrics[0].min, 95)
 assert.equal(metric(clicks, 'Matched clicks').value, 0)
 assert.equal(metric(clicks, 'Matched clicks').target, 15)
 const spectrum = visual('analysis.spectrum.analytic', { frequency: 1500, amplitude: 0 })
 assert.deepEqual(spectrum.metrics, [{ label: 'Amplitude', value: 0, unit: '% full scale', target: 25, min: 24.75, max: 25.25, status: 'fail' }])
})

test('integrity remains limited to basic flags and never treats high peaks as an automatic failure', () => {
 const out = visual('processor.compressor.silence.1025.1', { frames: 1025, channels: 1, finite: true, peak: 1.2, inputUnchanged: true }, 'pass')
 assert.equal(out.statusLabel, 'Basic checks passed')
 assert.equal(metric(out, 'Audio samples').value, 'Finite')
 assert.equal(metric(out, 'Output length').min, 1)
 assert.equal(metric(out, 'Original audio').value, 'Unchanged')
 assert(out.metrics.every(m => m.status === 'pass'))
 assert(!out.metrics.some(m => /peak|quality|clipping/i.test(m.label)))
 const empty = visual('processor.compressor.silence.1025.1', { frames: 0, finite: true, inputUnchanged: true })
 assert.deepEqual(empty.metrics.map(m => m.label), ['Output length'])
})

test('skips, errors, nulls and unknown measurements use compact honest fallback states', () => {
 assert.deepEqual(caseVisual(null, null), { label: 'Audio check', chips: [], metrics: [], statusLabel: 'No result' })
 assert.equal(caseVisual({}, { status: 'skip' }).statusLabel, 'Not compared')
 assert.equal(caseVisual({}, { status: 'error', error: 'Timed out after 30000ms' }).statusLabel, 'Timed out')
 for (const metrics of [null, undefined, {}, { unrecognized: 0 }]) assert.deepEqual(caseVisual({}, { status: 'fail', metrics }).metrics, [])
 const rate = visual('codec.wav.1f.1ch', { sampleRate: 0, encodedBytes: 0, bitDepth: 0 })
 assert.equal(metric(rate, 'Sample rate').value, 0)
 assert.equal(metric(rate, 'Sample rate').target, 8000)
 assert.equal(metric(rate, 'Encoded size').status, 'fail')
 const missingBounds = caseVisual({ oracle: { type: 'tone', frequency: 440 } }, { status: 'fail', metrics: { lengthError: 1, frequency: 440 } })
 assert.equal(metric(missingBounds, 'Length error').status, 'unknown')
 const shape = visual('effect.convolution.impulse', { reason: 'shape', frames: 6, expectedFrames: 6 })
 assert.deepEqual(shape.metrics, [{ label: 'Output layout', value: 'Mismatch', status: 'fail' }])
})

test('visual extraction does not mutate recorded values or the specification', () => {
 const definition = fixture('analysis.energy.dc'), result = { status: 'fail', metrics: { actual: 0, expected: 1, absoluteError: 1 } }
 const before = JSON.stringify([definition, result])
 caseVisual(definition, result)
 assert.equal(JSON.stringify([definition, result]), before)
})


test('passing waveform checks omit redundant shape cards but preserve source and channel measurements', () => {
 const unchanged = { maxAbsError: 0, lengthDelta: [0, 0], channels: 2, expectedChannels: 2 }
 const reverse = visual('edit.reverse.17f.2ch', unchanged, 'pass')
 assert.deepEqual(reverse.metrics.map(metric => metric.label), ['Sample error'])
 const copy = visual('editor.copy-reverse.17', { ...unchanged, sourceUnchanged: true }, 'pass')
 assert.deepEqual(copy.metrics.map(metric => metric.label), ['Original audio', 'Sample error'])
 const response = visual('filter.lowpass1.16000.4', { channels: 2, expectedChannels: 2, lengthDelta: [0, 0], perChannel: [{ gainDb: -14.1 }, { gainDb: -14.2 }] }, 'pass')
 assert.deepEqual(response.metrics.map(metric => metric.label), ['Ch 1 Gain', 'Ch 2 Gain'])
 assert.deepEqual(response.metrics.map(metric => metric.value), [-14.1, -14.2])
 const shapeOnly = visual('edit.reverse.17f.2ch', { channels: 2, expectedChannels: 2, lengthDelta: [0, 0] }, 'pass')
 assert.equal(shapeOnly.metrics.length, 3, 'shape is useful when it is the only recorded measurement')
 const invalid = visual('edit.reverse.17f.2ch', { ...unchanged, lengthDelta: [-1, -1] }, 'fail')
 assert.deepEqual(invalid.metrics.map(metric => metric.label), ['Ch 1 length error', 'Ch 2 length error'])
})
