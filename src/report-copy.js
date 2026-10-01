const finite = Number.isFinite
const number = value => {
 if (!finite(value)) return 'not reported'
 if (value === 0) return '0'
 if (Number.isInteger(value)) return value.toLocaleString('en')
 const rounded = Number(value.toPrecision(4))
 return Math.abs(rounded) < .00001 ? rounded.toExponential(2).replace(/\.0+(?=e)/, '') : rounded.toLocaleString('en', { maximumSignificantDigits: 4 })
}
const words = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ')
const capital = value => value.charAt(0).toUpperCase() + value.slice(1)
const range = (min, max, unit = '') => `${number(min)} to ${number(max)}${unit ? ' ' + unit : ''}`
const percent = value => `${number(value * 100)}%`
const channels = count => count === 1 ? 'mono' : count === 2 ? 'stereo' : finite(count) ? `${number(count)} channels` : ''
const sampleCount = count => `${number(count)} sample${count === 1 ? '' : 's'}`

function title(test) {
 const f = test.fixture || {}, s = test.steps?.[0] || {}, w = test.workflow || {}, o = test.oracle || {}
 const authored = test.title && test.title !== test.id && test.title !== test.id?.replaceAll('.', ' · ') ? test.title : ''
 const signal = ({ sine: finite(f.frequency) ? `a ${number(f.frequency)} Hz tone` : 'a sine wave', silence: 'silence', impulse: 'an impulse', dc: 'a constant level', 'sample-id': 'a sample pattern', array: 'a sample sequence', segments: 'changing signal levels', 'tone-noise': 'a tone with steady noise', clicks: 'isolated clicks' })[f.signal] || (finite(f.frequency) ? `a ${number(f.frequency)} Hz tone` : 'audio')
 const clip = [finite(f.frames) && `${sampleCount(f.frames)}${f.channels > 1 ? ' per channel' : ''}`, channels(f.channels)].filter(Boolean).join(', ')
 const withClip = text => `${capital(text)}${clip ? ', ' + clip : ''}`
 if (w.op === 'codec-roundtrip') return withClip(`${String(w.format || 'audio').toUpperCase()} saving and reopening${w.split ? ', split at the first and last byte' : ''}`)
 if (w.op === 'resample-chunks') return `Resample ${number(f.sampleRate)} to ${number(w.to)} Hz in uneven chunks`
 if (w.op) return withClip(({ 'copy-reverse': 'Reverse a copy and check the original', 'clip-reverse': 'Reverse a selected clip and check the original', 'clone-reverse': 'Reverse a clone and check the original', undo: 'Edit, then undo', 'undo-redo': 'Edit, undo and redo', stream: 'Compare streamed and returned audio' })[w.op] || words(w.op))
 if (s.op === 'processor') {
  const settings = Object.entries(s.params || {}).map(([key, value]) => `${words(key)} ${typeof value === 'number' ? number(value) : String(value)}`).join(', ')
  return withClip(`${signal}${settings ? ', ' + settings : ', default settings'}`)
 }
 if (['response', 'resample', 'resample-snr'].includes(o.type)) return `${capital(signal)}${finite(f.sampleRate) ? ' at ' + number(f.sampleRate) + ' Hz sample rate' : ''}${finite(s.to) ? ' → ' + number(s.to) + ' Hz' : ''}`
 if (s.op === 'measure' || s.op === 'analyze') {
  if (s.name === 'loudness' && f.signal === 'segments') return `${number(f.frames / f.sampleRate)} seconds of quiet and loud sections`
  if (s.name === 'true-peak') return `${capital(signal)}, ${number((f.phase || 0) * 180 / Math.PI)}° phase, ${percent(f.amplitude)} of full scale`
  if (s.name === 'onsets') return `${number(f.events?.length)} clicks, checked within ${number(o.tolerance * 1000)} ms`
  if (s.name === 'tempo') return finite(o.min) && finite(o.max) ? `${number((o.min + o.max) / 2)} BPM click track` : 'Tempo of a click track'
  return withClip(signal)
 }
 if (s.op === 'normalize-loudness') return `${number(s.target)} LUFS target with a ${number(s.ceiling)} dB peak ceiling`
 if (s.op === 'compressor') return `${number(s.ratio)}:1 compression, ${number(s.attack * 1000)} ms attack, ${number(s.release * 1000)} ms release`
 if (s.op === 'limiter') return `${number(s.ceiling)} dB ceiling, ${number(s.lookahead * 1000)} ms lookahead`
 if (s.op === 'gate') return `${number(s.threshold)} dB gate threshold, ${number(s.hold * 1000)} ms hold`
 if (s.op === 'denoise') return `${capital(signal)}${finite(f.frequency) ? ' at ' + number(f.frequency) + ' Hz' : ''}`
 if (s.op === 'dither') return `Add ${number(s.bits)}-bit dither to ${signal}`
 if (s.op === 'convolve') return withClip(`${sampleCount(s.impulse?.length)} in the impulse response${s.tail ? ', keeping the full tail' : ''}`)
 if (s.op === 'delay') return `${number(s.delayFrames / f.sampleRate * 1000)} ms delay, ${percent(s.feedback)} feedback`
 if (s.op === 'pitch') return `Shift ${signal} by ${number(s.semitones)} semitones`
 if (s.op === 'stretch') return `Stretch ${signal} to ${number(s.factor)}× its duration`
 if (s.op === 'speed') return `Play ${signal} at ${number(s.factor)}× speed`
 if (test.steps?.length > 1) return withClip(test.steps.every(step => step.op === 'reverse') ? `Reverse ${number(test.steps.length)} times` : `Apply ${number(test.steps.length)} edits in order`)
 if (['mix', 'insert'].includes(s.op)) return withClip(`${capital(s.op)} ${s.at === 0 ? 'at the start' : s.at === f.frames ? 'at the end' : 'after ' + sampleCount(s.at)}`)
 if (s.op === 'crossfade') return withClip(`${words(s.curve || 'linear')} crossfade over ${sampleCount(s.length)}`)
 if (s.op === 'fade') return withClip(`${({ exp: 'Squared', log: 'Square-root', cos: 'Cosine', linear: 'Linear' })[s.curve || 'linear'] || capital(words(s.curve))} fade ${s.direction} over ${sampleCount(s.length)}`)
 if (['trim', 'remove', 'reverse-range'].includes(s.op)) return withClip(`${({ trim: 'Keep', remove: 'Remove', 'reverse-range': 'Reverse' })[s.op]} ${sampleCount(s.length)} starting at sample ${number(s.start)}`)
 if (s.op === 'pad') return withClip(`Add ${sampleCount(s.before)} before and ${sampleCount(s.after)} after`)
 if (s.op === 'gain') return withClip(s.value === 0 ? 'Mute' : s.value === -1 ? 'Invert polarity' : `Multiply volume by ${number(s.value)}`)
 if (s.op === 'gain-db') return withClip(`Change volume by ${number(s.db)} dB`)
 if (s.op === 'normalize') return withClip(`Bring ${signal} to a ${number(s.db)} dB peak`)
 if (s.op === 'repeat') return withClip(`Repeat ${number(s.count)} times`)
 if (s.op === 'balance') return withClip(`Balance ${number(s.value)}`)
 const operation = ({ reverse: 'Reverse', swap: 'Swap left and right', mono: 'Mix stereo to mono', duplicate: 'Copy mono to both channels', derivative: 'Difference between adjacent samples', integral: 'Running sum of samples' })[s.op]
 if (operation) return withClip(operation)
 if (!s.op) return authored || withClip(`Leave ${signal} unchanged`)
 return authored || withClip(words(s.op))
}

const reasons = {
 'missing-output': 'No output was returned.',
 'invalid-channel-shape': 'Output channels were missing or had different lengths.',
 'non-finite': 'Output contained values that are not valid audio samples.',
 'missing-channel': 'An output channel was missing.',
 'missing-batch-output': 'The full-clip result needed to check streaming was missing.',
 'invalid-spectrum': 'Frequency analysis returned missing or invalid values.',
 'invalid-events': 'The detected onset times were missing or invalid.'
}
const measureName = test => ({ min: 'Lowest sample', max: 'Highest sample', peak: 'Peak level', rms: 'Average signal level', dc: 'Average offset', energy: 'Signal energy', zcr: 'Zero-crossing rate', pitch: 'Pitch', tempo: 'Tempo', loudness: 'Loudness', 'true-peak': 'Peak between samples' })[test.steps?.[0]?.name] || 'Measured value'
const measureUnit = test => ({ pitch: 'Hz', tempo: 'BPM', loudness: 'LUFS', 'true-peak': 'dBTP' })[test.steps?.[0]?.name] || ''
const measured = (value, unit) => finite(value) ? `${number(value)}${unit ? ' ' + unit : ''}` : 'not reported'

function summary(test, result) {
 const o = test.oracle || {}, m = result.metrics || {}, status = result.status
 if (m.inputUnchanged === false || m.sourceUnchanged === false) return 'The operation changed the original audio.'
 if (status === 'skip') return !result.reason || /no equivalent (adapter )?mapping|adapter has no equivalent mapping/i.test(result.reason) ? 'Not run by this tool’s test adapter.' : `Not compared: ${result.reason}`
 if (status === 'error') {
  const error = result.error || result.reason || ''
  if (/timed? ?out|timeout/i.test(error)) return 'The tool did not finish within the time limit.'
  if (/not installed|ENOENT|cannot find (package|module)|module not found/i.test(error)) return 'The tool or a required component was unavailable.'
  return 'The tool could not complete this test.'
 }
 if (!['pass', 'fail'].includes(status)) return 'No result was recorded.'
 if (reasons[m.reason]) return reasons[m.reason]
 if (m.streamEqual === false) return 'Streamed output differed from the returned audio.'
 if (m.undoEqual === false) return 'Undo did not restore the original audio.'
 if (finite(m.channels) && finite(m.expectedChannels) && m.channels !== m.expectedChannels) return `Returned ${number(m.channels)} channels; expected ${number(m.expectedChannels)}.`
 const notes = []
 const deltas = Array.isArray(m.lengthDelta) ? m.lengthDelta.filter(v => finite(v) && v !== 0) : []
 const delta = deltas.length ? deltas.reduce((a, b) => Math.abs(a) >= Math.abs(b) ? a : b) : m.lengthError
 if (finite(delta) && delta !== 0) {
  const allowed = o.type === 'tone' ? Math.max(2, (test.fixture?.frames ?? 0) * .01) : o.type === 'stretch-transient' ? test.fixture?.frames * .01 : ['resample', 'resample-snr', 'chunk-equivalence'].includes(o.type) ? 1 : 0
  if (Math.abs(delta) > allowed) notes.push(`Output was ${sampleCount(Math.abs(delta))} per channel ${delta < 0 ? 'shorter' : 'longer'} than expected${finite(test.fixture?.sampleRate) ? ` (${number(Math.abs(delta) / (m.sampleRate || o.to || test.workflow?.to || test.fixture.sampleRate) * 1000)} ms)` : ''}${allowed ? `; allowed ${sampleCount(allowed)}` : ''}.`)
 }
 if (finite(m.frames) && finite(m.expectedFrames) && m.frames !== m.expectedFrames) notes.push(`Returned ${sampleCount(m.frames)} per channel; expected ${number(m.expectedFrames)}.`)
 const expectedRate = m.expectedRate ?? o.to ?? (test.workflow?.op === 'codec-roundtrip' ? test.fixture?.sampleRate : undefined)
 if (finite(expectedRate) && m.sampleRate !== undefined && m.sampleRate !== expectedRate) notes.push(`Output sample rate: ${measured(m.sampleRate, 'Hz')}; expected ${measured(expectedRate, 'Hz')}.`)
 if (test.workflow?.op === 'codec-roundtrip' && status === 'fail') {
  if (m.encodedBytes === 0) notes.push('Saving produced no encoded audio.')
  if (m.bitDepth !== 16) notes.push(`Saved bit depth: ${number(m.bitDepth)}; expected 16 bits.`)
 }
 if (o.type === 'integrity' || test.level === 'integrity') return notes.join(' ') || (status === 'pass' ? 'Output was nonempty and contained valid samples. Effect quality was not tested.' : m.frames === 0 ? 'The operation returned empty audio.' : 'The output failed basic validity checks; effect quality was not tested.')
 const failedChannel = Array.isArray(m.perChannel) ? m.perChannel.findIndex(channel => channel?.pass === false) : -1
 const p = failedChannel >= 0 ? { ...m, ...m.perChannel[failedChannel] } : m
 const channelLabel = failedChannel >= 0 && m.perChannel.length > 1 ? `Channel ${failedChannel + 1}: ` : ''
 let detail = ''
 if (['exact', 'exact-with-source', 'workflow', 'neutral', 'seams', 'convolution-dc', 'chunk-equivalence'].includes(o.type) && finite(m.maxAbsError)) {
  if (m.maxAbsError > (o.atol ?? 0)) detail = `Largest sample difference: ${percent(m.maxAbsError)} of full scale; allowed ${percent(o.atol ?? 0)}.`
  else if (status === 'pass') detail = m.maxAbsError === 0 ? 'Every sample matched.' : `Largest sample difference: ${percent(m.maxAbsError)} of full scale, within the ${percent(o.atol ?? 0)} limit.`
  if (status === 'pass' && m.sourceUnchanged === true) detail += ' The original stayed unchanged.'
 }
 if (o.type === 'scalar') {
  const error = finite(m.absoluteError) ? m.absoluteError : finite(m.actual) && finite(m.expected) ? Math.abs(m.actual - m.expected) : undefined
  detail = `${measureName(test)}: ${measured(m.actual, measureUnit(test))}; expected ${measured(m.expected, measureUnit(test))}.`
  if (finite(error)) detail += ` Difference: ${number(error)}${finite(o.atol) ? `; allowed ${number(o.atol)}` : ''}.`
 }
 if (o.type === 'scalar-range') detail = `${measureName(test)}: ${measured(m.actual, measureUnit(test))}; required ${range(m.min ?? o.min, m.max ?? o.max, measureUnit(test))}.`
 if (['response', 'resample'].includes(o.type) && finite(p.gainDb) && (status === 'pass' || p.gainDb < (m.min ?? o.min) || p.gainDb > (m.max ?? o.max))) detail = `Tone level changed by ${number(p.gainDb)} dB; expected ${range(m.min ?? o.min, m.max ?? o.max, 'dB')}.`
 if (o.type === 'resample' && finite(o.frequency) && (status === 'pass' || !finite(p.frequency) || Math.abs(p.frequency / o.frequency - 1) >= .01)) detail += `${detail ? ' ' : ''}Pitch: ${measured(p.frequency, 'Hz')}; expected ${number(o.frequency)} Hz within 1%.`
 if (['tone', 'stretch-transient', 'chunk-equivalence'].includes(o.type)) {
  const expected = m.expectedFrequency ?? o.frequency ?? test.fixture?.frequency
  const tolerance = o.type === 'chunk-equivalence' ? 1 : 2
  const error = Math.abs(p.frequency / expected - 1), outside = o.type === 'chunk-equivalence' ? error >= .01 : error > .02
  if (status === 'pass' || !finite(p.frequency) || outside) detail = (detail ? detail + ' ' : '') + `Pitch: ${measured(p.frequency, 'Hz')}; expected ${number(expected)} Hz within ${tolerance}%.`
  if (finite(p.timeError) && (status === 'pass' || Math.abs(p.timeError) > o.timeTolerance)) detail += `${detail ? ' ' : ''}The transient was ${number(Math.abs(p.timeError) * 1000)} ms ${p.timeError < 0 ? 'early' : 'late'}; allowed ${number(o.timeTolerance * 1000)} ms.`
 }
 if (o.type === 'resample-snr' && finite(p.snrDb)) detail = `Signal was ${number(p.snrDb)} dB above the resampling error; required at least ${number(m.minSnr ?? o.minSnr)} dB.`
 if (o.type === 'loudness-target') detail = `Loudness: ${measured(m.loudness, 'LUFS')}; target ${measured(m.target ?? o.target, 'LUFS')} within ${number(o.tolerance)}. Peak between samples: ${measured(m.truePeak, 'dBTP')}; ceiling ${measured(m.ceiling ?? o.ceiling, 'dBTP')}.`
 if (o.type === 'dynamics' && Array.isArray(p.windows)) {
  const failed = p.windows.filter(window => window.pass === false), window = failed[0]
  detail = window ? `${failed.length} of ${p.windows.length} time windows missed the expected level. From ${range(window.start, window.end, 'seconds')}, gain was ${number(window.gainDb)} dB; expected ${range(window.minDb, window.maxDb, 'dB')}.` : status === 'pass' ? 'The open, settling and recovery levels met their limits.' : ''
 }
 if (o.type === 'limiter' && finite(p.peak)) {
  const ceiling = m.ceiling ?? (finite(o.ceiling) ? 10 ** (o.ceiling / 20) : undefined), maximum = finite(p.inputPeak) && finite(ceiling) ? Math.min(p.inputPeak, ceiling) : ceiling
  if (status === 'pass' || p.peak < maximum * .8 || p.peak > maximum + (o.atol ?? 0)) detail = `Peak level: ${percent(p.peak)} of full scale; ${finite(maximum) ? `allowed ${percent(maximum * .8)} to ${percent(maximum + (o.atol ?? 0))} of full scale` : 'ceiling not reported'}.`
  if (finite(p.latencyFrames) && (status === 'pass' || Math.abs(p.latencyFrames) > o.latencyTolerance)) detail += `${detail ? ' ' : ''}Output shifted by ${number(p.latencyFrames)} samples; allowed ${number(o.latencyTolerance)}.`
 }
 if (o.type === 'denoise' && finite(p.improvement)) detail = `Signal accuracy ${p.improvement < 0 ? 'fell' : 'improved'} by ${number(Math.abs(p.improvement))} dB; required a ${number(o.minImprovement)} dB improvement. Signal level changed by ${number(p.gainDb)} dB; allowed ±${number(o.maxSignalLoss)} dB. Noise fell by ${number(p.noiseReduction)} dB; required ${number(o.minNoiseReduction)} dB.`
 if (o.type === 'dither' && Array.isArray(m.perChannel)) {
  const checks = [
   ['mean', -.02, .02, value => `Average noise was ${number(value)} of one ${number(o.bits)}-bit step; allowed ±0.02.`],
   ['rms', .45, .55, value => `Noise level was ${number(value)} steps; expected 0.45 to 0.55.`],
   ['zero', .71, .79, value => `${percent(value)} of samples stayed silent; expected 71% to 79%.`],
   ['lag', -.04, .04, value => `Correlation between neighboring samples was ${number(value)}; expected within ±0.04.`],
   ['gridError', 0, .001, value => `Samples missed the ${number(o.bits)}-bit grid by up to ${number(value)} steps; allowed less than 0.001.`],
   ['peak', 0, 1.001, value => `Noise peaks reached ${number(value)} steps; allowed at most 1.001.`]
  ]
  const failures = m.perChannel.flatMap((channel, index) => checks.filter(([key, min, max]) => finite(channel?.[key]) && (channel[key] < min || channel[key] > max || ['mean', 'lag', 'gridError'].includes(key) && (channel[key] === max || key !== 'gridError' && channel[key] === min))).map(([key, , , explain]) => `${m.perChannel.length > 1 ? `Channel ${index + 1}: ` : ''}${explain(channel[key])}`))
  detail = failures.length ? failures.slice(0, 2).join(' ') : status === 'pass' ? 'Noise level, bias and sample distribution met the limits for dither on silence.' : ''
 }
 if (o.type === 'levels' && m.errors) {
  const key = Object.keys(m.errors).filter(key => finite(m.errors[key])).sort((a, b) => m.errors[b] - m.errors[a])[0]
  const label = ({ peak: 'Peak level', rms: 'Average signal level', dc: 'Average offset' })[key]
  if (label) detail = `${label}: ${number(m.actual?.[key])}; expected ${number(m.expected?.[key])}. Difference: ${number(m.errors[key])}; allowed ${number(o.atol)}.`
 }
 if (o.type === 'spectrum') detail = `Strongest frequency: ${measured(m.frequency, 'Hz')}; expected ${measured(test.fixture?.frequency, 'Hz')} within ${number(o.hzTolerance)} Hz. Amplitude: ${number(m.amplitude)}; expected ${number(test.fixture?.amplitude)} within ${percent(o.amplitudeTolerance)}.`
 if (o.type === 'events' && finite(m.matched)) detail = `Matched ${number(m.matched)} of ${number(m.expected)} clicks within ${number(o.tolerance * 1000)} ms; detected ${number(m.detected)} in total.`
 if (detail) notes.push(channelLabel + detail)
 return notes.join(' ') || (status === 'pass' ? 'Met this test’s stated limits.' : 'The result did not meet this test’s requirements.')
}

/** Plain text for a declared test and one tool's recorded result; raw evidence stays separate. */
export function caseCopy(test = {}, result = {}) {
 test ||= {}; result ||= {}
 return { title: title(test), summary: summary(test, result) }
}
