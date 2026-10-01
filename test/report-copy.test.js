import test from 'node:test'
import assert from 'node:assert/strict'
import { caseCopy } from '../src/report-copy.js'
import { loadSpec } from '../src/spec.js'

const spec = await loadSpec()
const fixture = id => {
 const value = spec.cases.find(test => test.id === id)
 assert(value, `declared case ${id}`)
 return value
}
const copy = (id, metrics, status = 'fail') => caseCopy(fixture(id), { status, metrics })

test('case titles explain clip size, position, settings and authored intent without internal IDs', () => {
 assert.match(copy('edit.reverse.1f.1ch').title, /Reverse · 1 sample, mono/)
 assert.match(copy('edit.insert.17.2.start').title, /at the start.*17 samples per channel, stereo/)
 assert.match(copy('edit.insert.17.2.middle').title, /after 8 samples/)
 assert.match(copy('edit.insert.17.2.end').title, /at the end/)
 assert.match(copy('analysis.energy.sine').title, /sine wave/i)
 assert.match(copy('processor.compressor.silence.1025.1').title, /Silence.*default settings.*1,025 samples/)
 assert.match(caseCopy({ fixture: { signal: 'silence', frames: 0, channels: 1 }, steps: [{ op: 'processor', params: { depth: 0 } }] }).title, /depth 0.*0 samples/)
 assert.equal(caseCopy({ id: 'special.custom-check', title: 'Keep a marker at the last sample', fixture: {} }).title, 'Keep a marker at the last sample')
 for (const declared of spec.cases) {
  const text = caseCopy(declared).title
  assert(text.length > 3)
  assert(!text.includes(declared.id), `${declared.id} leaked into its label`)
  assert(!text.includes(declared.id.replaceAll('.', ' · ')), `${declared.id} remains an expanded ID`)
  assert.doesNotMatch(text, /undefined|NaN|null/)
 }
})

test('changed source, missing channels and empty output take priority over matching samples', () => {
 const id = 'edit.reverse.1f.1ch'
 assert.match(copy(id, { maxAbsError: 0, inputUnchanged: false }).summary, /changed the original audio/)
 assert.match(copy(id, { maxAbsError: 0, sourceUnchanged: false }).summary, /changed the original audio/)
 assert.match(copy(id, { channels: 0, expectedChannels: 2, maxAbsError: 0 }).summary, /Returned 0 channels; expected 2/)
 const empty = copy(id, { lengthDelta: [-1], maxAbsError: 0, reason: 'length' }).summary
 assert.match(empty, /1 sample per channel shorter/)
 assert.doesNotMatch(empty, /1 samples|Every sample matched/)
 for (const reason of ['invalid-channel-shape', 'non-finite', 'missing-output']) assert.doesNotMatch(copy(id, { reason }).summary, /matched|passed/i)
})

test('sample differences carry a full-scale unit and the declared tolerance', () => {
 const text = copy('edit.crossfade.17.1.end', { maxAbsError: .048761, rmsError: .02 }).summary
 assert.match(text, /4\.876% of full scale; allowed 0\.0001%/)
 assert.equal(copy('edit.reverse.1f.1ch', { maxAbsError: 0 }, 'pass').summary, 'Every sample matched.')
 assert.match(copy('editor.stream.17', { maxAbsError: 0, streamEqual: false }).summary, /Streamed output differed/)
 assert.match(copy('editor.undo-redo.roundtrip', { maxAbsError: 0, undoEqual: false }).summary, /Undo did not restore/)
})

test('rounded equal scalar readings still explain a real failure with its absolute error', () => {
 const text = copy('analysis.energy.dc', { actual: 299.9999880191375, expected: 300, absoluteError: .000011980862495875044 }).summary
 assert.match(text, /Signal energy: 300; expected 300/)
 assert.match(text, /Difference: 0\.00001198; allowed 0\.00001/)
 assert.doesNotMatch(text, /within|matched/)
 const zero = copy('analysis.energy.dc', { actual: 0, expected: 0, absoluteError: 0 }, 'pass').summary
 assert.match(zero, /energy: 0; expected 0\. Difference: 0/)
 const absent = copy('analysis.energy.dc', { actual: null, expected: 0, absoluteError: null }).summary
 assert.match(absent, /not reported; expected 0/)
 assert.doesNotMatch(absent, /Difference: 0/)
})

test('level errors remain visible when measured and expected values round alike', () => {
 const text = copy('analysis.level.analytic', { actual: { peak: .749996 }, expected: { peak: .75 }, errors: { peak: .000004 } }).summary
 assert.match(text, /Peak level: 0\.75; expected 0\.75/)
 assert.match(text, /Difference: 4e-6; allowed 0\.00001/)
})

test('shortened pitch and stretch output use their own length tolerances', () => {
 const pitch = copy('rate.pitch.frequency-duration', { frequency: 880.142552, expectedFrequency: 880, lengthError: -1042 }).summary
 assert.match(pitch, /1,042 samples per channel shorter/)
 assert.match(pitch, /allowed 480 samples/)
 assert.doesNotMatch(pitch, /Pitch:/, 'passing pitch is not presented as the cause of a duration failure')
 const tiny = { fixture: { frames: 17, sampleRate: 48000 }, oracle: { type: 'tone', frequency: 440 } }
 assert.doesNotMatch(caseCopy(tiny, { status: 'fail', metrics: { lengthError: -2, frequency: 600 } }).summary, /shorter/)
 assert.match(caseCopy(tiny, { status: 'fail', metrics: { lengthError: -3, frequency: 600 } }).summary, /allowed 2 samples/)
 const stretch = copy('rate.stretch.duration-pitch-transient', { lengthError: -2026, frequency: 440.008, timeError: -.01485 }).summary
 assert.match(stretch, /allowed 1,440 samples/)
 assert.doesNotMatch(stretch, /transient/, 'an in-range transient does not distract from the failing length')
})

test('frequency response explains the failing channel rather than the passing first channel', () => {
 const text = copy('filter.lowpass1.16000.4', { gainDb: -14.1, min: -14.495285, max: -13.895285, perChannel: [{ pass: true, gainDb: -14.1 }, { pass: false, gainDb: -11.39996 }] }).summary
 assert.match(text, /Channel 2: Tone level changed by -11\.4 dB/)
 assert.match(text, /expected -14\.5 to -13\.9 dB/)
 const alias = copy('rate.resample.48000-16000.alias', { gainDb: 0, lengthError: 0, sampleRate: 16000, expectedRate: 16000 }).summary
 assert.match(alias, /changed by 0 dB; expected -200 to -40 dB/)
})

test('resampling explains waveform accuracy, sample-rate errors and streaming mismatches', () => {
 assert.match(copy('rate.resample.snr-bandwidth', { snrDb: 56.4498, minSnr: 70, lengthError: 0 }).summary, /56\.45 dB.*resampling error; required at least 70 dB/)
 assert.match(copy('rate.resample.44100-48000.passband', { sampleRate: 44100, expectedRate: 48000, gainDb: 0, frequency: 997 }).summary, /44,100 Hz; expected 48,000 Hz/)
 const stream = copy('rate.resample.chunk-invariance', { maxAbsError: .1, frequency: 997, lengthError: 0 }).summary
 assert.match(stream, /Largest sample difference: 10%/)
 assert.doesNotMatch(stream, /Pitch:/, 'passing pitch does not hide the streaming sample mismatch')
 const wrongPitch = copy('rate.resample.44100-48000.passband', { gainDb: 0, frequency: 1500 }).summary
 assert.match(wrongPitch, /Pitch: 1,500 Hz; expected 997 Hz within 1%/)
 assert.doesNotMatch(wrongPitch, /Tone level/)
})

test('pitch, loudness and peak measurements keep their units and null is not silence', () => {
 assert.match(copy('analysis.pitch.tone-110', { actual: 110.7222578, min: 109.36644, max: 110.63722 }).summary, /Pitch: 110\.7 Hz; required 109\.4 to 110\.6 Hz/)
 assert.match(copy('analysis.loudness.ebu', { actual: -22.993, min: -23.1, max: -22.9 }, 'pass').summary, /Loudness: -22\.99 LUFS/)
 assert.match(copy('analysis.true-peak.bs1770', { actual: null, min: -6.4, max: -5.8 }).summary, /not reported; required -6\.4 to -5\.8 dBTP/)
 const normalize = copy('level.loudness-normalize.target', { loudness: -30, target: -23, truePeak: 0, ceiling: -1 }).summary
 assert.match(normalize, /-30 LUFS.*-23 LUFS/)
 assert.match(normalize, /0 dBTP; ceiling -1 dBTP/)
})

test('dynamics explain a failing time window and limiter checks both ceiling and timing', () => {
 const compressor = copy('dynamics.compressor.envelope', { windows: [{ start: 0, end: .45, minDb: -.1, maxDb: .1, gainDb: 8.0998, pass: false }, { start: .9, end: 1.3, minDb: -9.2, maxDb: -8.7, gainDb: -9, pass: true }] }).summary
 assert.match(compressor, /1 of 2 time windows/)
 assert.match(compressor, /From 0 to 0\.45 seconds, gain was 8\.1 dB; expected -0\.1 to 0\.1 dB/)
 const limiter = copy('dynamics.limiter.zero-lookahead', { peak: 1, inputPeak: .8, ceiling: .5011872, latencyFrames: 0 }).summary
 assert.match(limiter, /Peak level: 100%.*allowed 40\.09% to 50\.12%/)
 assert.doesNotMatch(limiter, /shifted/, 'correct timing does not distract from an exceeded ceiling')
 const late = copy('dynamics.limiter.zero-lookahead', { peak: .5, inputPeak: .8, ceiling: .5011872, latencyFrames: 64 }).summary
 assert.match(late, /Output shifted by 64 samples; allowed 1/)
 assert.doesNotMatch(late, /Peak level/)
 assert.match(copy('dynamics.limiter.zero-lookahead', { peak: 0, inputPeak: .8, ceiling: .5011872, latencyFrames: -4800 }).summary, /Peak level: 0%.*allowed 40\.09%/)
})

test('noise reduction distinguishes quieter noise from loss of the wanted signal', () => {
 const text = copy('restoration.denoise.reference', { improvement: -11.31687, gainDb: -12.004, noiseReduction: 11.99999 }).summary
 assert.match(text, /accuracy fell by 11\.32 dB; required a 3 dB improvement/)
 assert.match(text, /Signal level changed by -12 dB; allowed ±1 dB/)
 assert.match(text, /Noise fell by 12 dB; required 6 dB/)
})

test('dither reports bias and checks silent-sample distribution in every channel', () => {
 const text = copy('restoration.dither.statistics', { perChannel: [{ mean: -.498428, rms: .70599, zero: .50157, lag: .49686, gridError: 0, peak: 1 }] }).summary
 assert.match(text, /Average noise was -0\.4984.*16-bit step; allowed ±0\.02/)
 assert.match(text, /Noise level was 0\.706 steps; expected 0\.45 to 0\.55/)
 const fine = { mean: 0, rms: .5, zero: .75, lag: 0, gridError: 0, peak: 1 }
 const second = copy('restoration.dither.statistics', { perChannel: [fine, { ...fine, zero: .5 }] }).summary
 assert.match(second, /Channel 2: 50% of samples stayed silent; expected 71% to 79%/)
 assert.doesNotMatch(second, /Channel 1|grid/)
})

test('onsets and spectrum summaries preserve counted events, frequency and amplitude limits', () => {
 assert.match(copy('analysis.onset-tempo.synthetic', { matched: 0, expected: 15, detected: 0 }).summary, /Matched 0 of 15 clicks within 50 ms; detected 0/)
 const spectrum = copy('analysis.spectrum.analytic', { frequency: 1500, amplitude: 0 }).summary
 assert.match(spectrum, /Strongest frequency: 1,500 Hz; expected 1,500 Hz/)
 assert.match(spectrum, /Amplitude: 0; expected 0\.25 within 1%/)
})

test('basic checks never claim effect quality or treat above-full-scale samples as invalid', () => {
 const basic = copy('processor.compressor.silence.1025.1', { frames: 1025, finite: true, peak: 1.2 }, 'pass').summary
 assert.match(basic, /valid samples\. Effect quality was not tested/)
 assert.doesNotMatch(basic, /quality passed|clipp|ceiling/i)
 assert.match(copy('processor.compressor.silence.1025.1', { frames: 0 }).summary, /empty audio/)
})

test('missing results, skips, errors and unknown metrics remain honest and do not expose stack traces', () => {
 assert.equal(caseCopy(null, null).summary, 'No result was recorded.')
 assert.match(caseCopy({}, { status: 'skip', reason: 'adapter has no equivalent mapping' }).summary, /Not run by this tool’s test adapter/)
 assert.doesNotMatch(caseCopy({}, { status: 'skip' }).summary, /unsupported|missing feature/)
 assert.equal(caseCopy({}, { status: 'error', error: 'Error: calculation failed\n at worker.js:10' }).summary, 'The tool could not complete this test.')
 assert.match(caseCopy({}, { status: 'error', error: 'Timed out after 30000ms' }).summary, /time limit/)
 for (const metrics of [undefined, null, {}, { unfamiliar: 0 }, { actual: null }, { perChannel: null }]) {
  const text = caseCopy({}, { status: 'fail', metrics }).summary
  assert.doesNotMatch(text, /undefined|NaN|null|passed|matched/)
 }
})

test('copy generation leaves source definitions and recorded evidence unchanged', () => {
 const declared = fixture('analysis.energy.dc'), result = { status: 'fail', metrics: { actual: 0, expected: 1, absoluteError: 1 } }
 const before = JSON.stringify([declared, result])
 caseCopy(declared, result)
 assert.equal(JSON.stringify([declared, result]), before)
})
