const finite = Number.isFinite
const scale = (value, factor) => finite(value) ? value * factor : undefined
const count = value => finite(value) ? value.toLocaleString('en', { maximumFractionDigits: 6 }) : '?'
const hz = value => value >= 1000 ? `${count(value / 1000)} kHz` : `${count(value)} Hz`
const words = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ')
const capital = value => value.charAt(0).toUpperCase() + value.slice(1)

function condition(test) {
 const f = test.fixture || {}, s = test.steps?.[0] || {}, w = test.workflow || {}
 const signal = ({ silence: 'Silence', impulse: 'Impulse', dc: 'Constant level', 'sample-id': 'Sample pattern', array: 'Sample sequence', segments: 'Changing levels', 'tone-noise': 'Tone with noise', clicks: 'Click track' })[f.signal] || (finite(f.frequency) ? `${hz(f.frequency)} tone` : f.signal === 'sine' ? 'Sine wave' : 'Audio check')
 let label = signal
 const operations = { reverse: 'Reverse', 'reverse-range': 'Reverse selection', trim: 'Trim', remove: 'Remove selection', mix: 'Mix', insert: 'Insert', pad: 'Add silence', repeat: 'Repeat', gain: s.value === 0 ? 'Mute' : s.value === -1 ? 'Invert polarity' : 'Volume multiplier', 'gain-db': 'Volume change', normalize: 'Peak normalization', balance: 'Stereo balance', swap: 'Swap channels', mono: 'Stereo to mono', duplicate: 'Mono to stereo', derivative: 'Adjacent sample difference', integral: 'Running sample sum', stretch: 'Time stretch', speed: 'Playback speed', pitch: 'Pitch shift', 'normalize-loudness': 'Loudness target', compressor: 'Compression', limiter: 'Peak limiting', gate: 'Noise gate', delay: 'Delay', convolve: 'Impulse response', dither: 'Dither on silence', denoise: 'Noise reduction' }
 if (operations[s.op]) label = operations[s.op]
 if (s.op === 'crossfade') label = `${capital(words(s.curve || 'linear'))} crossfade`
 if (s.op === 'fade') label = `${({ exp: 'Squared', log: 'Square-root', cos: 'Cosine', linear: 'Linear' })[s.curve || 'linear'] || capital(words(s.curve))} fade ${s.direction || ''}`.trim()
 if (test.steps?.length > 1) label = test.steps.every(step => step.op === 'reverse') ? `${test.steps.length} reversals` : `${test.steps.length} chained operations`
 if (w.op) label = ({ 'codec-roundtrip': `${String(w.format || 'Audio').toUpperCase()} round trip`, 'copy-reverse': 'Reverse a copy', 'clip-reverse': 'Reverse a clip', 'clone-reverse': 'Reverse a clone', undo: 'Undo', 'undo-redo': 'Undo and redo', stream: 'Streamed output', 'resample-chunks': 'Chunked resampling' })[w.op] || capital(words(w.op))
 const chips = []
 if (finite(f.frames)) chips.push(`${count(f.frames)} ${f.frames === 1 ? 'frame' : 'frames'}`)
 if (finite(f.channels)) chips.push(f.channels === 1 ? 'Mono' : f.channels === 2 ? 'Stereo' : `${count(f.channels)} channels`)
 if (finite(f.sampleRate)) chips.push(hz(f.sampleRate))
 if (['true-peak', 'loudness'].includes(s.name) && finite(f.amplitude)) chips.push(`${count(f.amplitude * 100)}% full scale`)
 if (s.name === 'true-peak' && finite(f.phase)) chips.push(`${count(f.phase * 180 / Math.PI)}° phase`)
 const add = (value, label, unit = '') => { if (finite(value)) chips.push(`${label ? label + ' ' : ''}${count(value)}${unit ? ' ' + unit : ''}`) }
 if (finite(s.to ?? w.to)) chips.push(`To ${hz(s.to ?? w.to)}`)
 if (finite(s.at)) chips.push(s.at === 0 ? 'At start' : s.at === f.frames ? 'At end' : `At frame ${count(s.at)}`)
 add(s.start, 'Start', 'frames'); add(s.length, 'Length', 'frames')
 add(s.db, s.op === 'normalize' ? 'Peak' : '', 'dB'); add(s.value, s.op === 'gain' ? 'Multiplier' : 'Balance')
 add(s.factor, '', '×'); add(s.semitones, '', 'semitones'); add(s.count, '', 'repeats')
 if (finite(s.freq)) chips.push(`Cutoff ${hz(s.freq)}`)
 add(s.gain, 'Gain', 'dB'); add(s.order, '', 'pole')
 add(s.target, 'Target', 'LUFS'); add(s.ceiling, 'Ceiling', 'dB'); add(s.threshold, 'Threshold', 'dB')
 add(s.ratio, 'Ratio'); add(scale(s.attack, 1000), 'Attack', 'ms'); add(scale(s.release, 1000), 'Release', 'ms')
 add(scale(s.hold, 1000), 'Hold', 'ms'); add(scale(s.lookahead, 1000), 'Lookahead', 'ms')
 if (finite(s.delayFrames) && finite(f.sampleRate) && f.sampleRate > 0) add(s.delayFrames / f.sampleRate * 1000, 'Delay', 'ms')
 add(scale(s.feedback, 100), 'Feedback', '%'); add(s.bits, '', 'bits')
 if (Array.isArray(s.impulse)) chips.push(`${s.impulse.length} tap${s.impulse.length === 1 ? '' : 's'}`)
 if (s.tail === true) chips.push('Full tail')
 if (w.split) chips.push('First/last byte')
 if (Array.isArray(w.chunks)) chips.push(`${w.chunks.length} chunk sizes`)
 for (const [key, value] of Object.entries(s.params || {})) if (finite(value) || typeof value === 'boolean') chips.push(`${capital(words(key))} ${finite(value) ? count(value) : value ? 'on' : 'off'}`)
 return { label, chips }
}

const reasons = {
 'missing-output': ['Output', 'Missing'], 'invalid-channel-shape': ['Channel layout', 'Invalid'], 'shape': ['Output layout', 'Mismatch'],
 'non-finite': ['Audio samples', 'Non-finite'], 'missing-channel': ['Output channel', 'Missing'],
 'missing-batch-output': ['Full-clip output', 'Missing'], 'invalid-spectrum': ['Spectrum', 'Invalid'],
 'invalid-events': ['Onset times', 'Invalid']
}
const analysisLabels = { min: 'Lowest sample', max: 'Highest sample', peak: 'Peak', rms: 'RMS level', dc: 'DC offset', energy: 'Energy', zcr: 'Zero crossings', loudness: 'Loudness', 'true-peak': 'True peak', pitch: 'Pitch', tempo: 'Tempo' }
const analysisUnits = { loudness: 'LUFS', 'true-peak': 'dBTP', pitch: 'Hz', tempo: 'BPM' }

/** Unrounded measurements and declared bounds for the report. */
export function caseVisual(test = {}, result = {}) {
 test ||= {}; result ||= {}
 const f = test.fixture || {}, o = test.oracle || {}, w = test.workflow || {}, m = result.metrics || {}
 const basic = test.level === 'integrity' || o.type === 'integrity'
 const statusLabel = ({ pass: basic ? 'Basic checks passed' : 'Passed', fail: 'Failed', skip: 'Not compared', error: /timed? ?out|timeout/i.test(result.error || result.reason || '') ? 'Timed out' : 'Error' })[result.status] || 'No result'
 const output = { ...condition(test), metrics: [], statusLabel }, metrics = output.metrics
 if (!['pass', 'fail'].includes(result.status)) return output
 const add = (label, value, unit = '', bounds = {}, status) => {
  const limits = Object.fromEntries(Object.entries(bounds).filter(([key, value]) => ['minExclusive', 'maxExclusive'].includes(key) ? value === true : finite(value)))
  const known = finite(value), constrained = finite(limits.min) || finite(limits.max) || finite(limits.target)
  const within = (!finite(limits.min) || (limits.minExclusive ? value > limits.min : value >= limits.min)) && (!finite(limits.max) || (limits.maxExclusive ? value < limits.max : value <= limits.max)) && (finite(limits.min) || finite(limits.max) || !finite(limits.target) || value === limits.target)
  metrics.push({ label, value: known ? value : 'Not recorded', unit, ...limits, status: !known ? 'unknown' : status || (constrained ? within ? 'pass' : 'fail' : 'unknown') })
 }
 const flag = (label, value, yes, no) => metrics.push({ label, value: value === true ? yes : value === false ? no : 'Not recorded', status: typeof value === 'boolean' ? value ? 'pass' : 'fail' : 'unknown' })
 if (m.inputUnchanged === false || basic || m.sourceUnchanged !== undefined) flag('Original audio', m.inputUnchanged === false || m.sourceUnchanged === false ? false : m.sourceUnchanged ?? m.inputUnchanged, 'Unchanged', 'Changed')
 for (const [key, label] of [['streamEqual', 'Streamed output'], ['undoEqual', 'Undo']]) if (m[key] !== undefined) flag(label, m[key], 'Matched', 'Different')
 if (reasons[m.reason]) { const [label, value] = reasons[m.reason]; metrics.push({ label, value, status: 'fail' }) }
 if (m.channels !== undefined && (finite(m.expectedChannels) || basic)) add('Channels', m.channels, '', finite(m.expectedChannels) ? { target: m.expectedChannels } : { min: 1 })
 const allowedLength = o.type === 'tone' ? finite(f.frames) ? Math.max(2, f.frames * .01) : undefined : o.type === 'stretch-transient' ? scale(f.frames, .01) : ['resample', 'resample-snr', 'chunk-equivalence'].includes(o.type) ? 1 : 0
 if (Array.isArray(m.lengthDelta)) m.lengthDelta.forEach((delta, i) => add(m.lengthDelta.length > 1 ? `Ch ${i + 1} length error` : 'Length error', delta, 'frames', { min: 0, max: 0, target: 0 }))
 if (m.lengthError !== undefined) add('Length error', m.lengthError, 'frames', { min: scale(allowedLength, -1), max: allowedLength, target: 0 }, finite(allowedLength) ? undefined : 'unknown')
 if (m.frames !== undefined && finite(m.expectedFrames)) add('Output length', m.frames, 'frames', { target: m.expectedFrames })
 if (m.sampleRate !== undefined || w.op === 'codec-roundtrip') add('Sample rate', m.sampleRate, 'Hz', { target: m.expectedRate ?? o.to ?? w.to ?? f.sampleRate })
 if (w.op === 'codec-roundtrip') { add('Encoded size', m.encodedBytes, 'bytes', { min: 1 }); add('Bit depth', m.bitDepth, 'bits', { target: 16 }) }
 if (basic) {
  if (m.frames !== undefined) add('Output length', m.frames, 'frames', { min: 1 })
  if (m.finite !== undefined) flag('Audio samples', m.finite, 'Finite', 'Non-finite')
 } else {
  const exact = ['exact', 'exact-with-source', 'workflow', 'neutral', 'seams', 'convolution-dc', 'chunk-equivalence'].includes(o.type)
  if (exact && m.maxAbsError !== undefined) add('Sample error', scale(m.maxAbsError, 100), '% full scale', { min: 0, max: (o.atol ?? (o.type === 'convolution-dc' ? 2e-5 : 0)) * 100, target: 0 })
  const name = test.steps?.[0]?.name, unit = analysisUnits[name] || ''
  if (o.type === 'scalar') {
   const tolerance = o.atol ?? 0, error = finite(m.absoluteError) ? m.absoluteError : finite(m.actual) && finite(m.expected) ? Math.abs(m.actual - m.expected) : undefined
   add(analysisLabels[name] || 'Measurement', m.actual, unit, { target: m.expected, min: finite(m.expected) ? m.expected - tolerance : undefined, max: finite(m.expected) ? m.expected + tolerance : undefined })
   add('Difference', error, unit, { min: 0, max: tolerance, target: 0 })
  }
  if (o.type === 'scalar-range') add(analysisLabels[name] || 'Measurement', m.actual, unit, { min: m.min ?? o.min, max: m.max ?? o.max })
  if (o.type === 'loudness-target') {
   add('Loudness', m.loudness, 'LUFS', { target: o.target, min: finite(o.target) && finite(o.tolerance) ? o.target - o.tolerance : undefined, max: finite(o.target) && finite(o.tolerance) ? o.target + o.tolerance : undefined }, finite(o.tolerance) ? undefined : 'unknown')
   add('True peak', m.truePeak, 'dBTP', { target: o.ceiling, max: finite(o.ceiling) ? o.ceiling + .1 : undefined })
  }
  if (o.type === 'levels') for (const key of ['peak', 'rms', 'dc']) {
   const target = m.expected?.[key], tolerance = o.atol
   add(analysisLabels[key], m.actual?.[key], '', { target, min: finite(target) && finite(tolerance) ? target - tolerance : undefined, max: finite(target) && finite(tolerance) ? target + tolerance : undefined }, finite(tolerance) ? undefined : 'unknown')
   if (m.errors?.[key] !== undefined) add(`${analysisLabels[key]} error`, m.errors[key], '', { min: 0, max: tolerance, target: 0 })
  }
  if (o.type === 'spectrum') {
   add('Frequency', m.frequency, 'Hz', { target: f.frequency, min: finite(f.frequency) && finite(o.hzTolerance) ? f.frequency - o.hzTolerance : undefined, max: finite(f.frequency) && finite(o.hzTolerance) ? f.frequency + o.hzTolerance : undefined }, finite(o.hzTolerance) ? undefined : 'unknown')
   add('Amplitude', scale(m.amplitude, 100), '% full scale', { target: scale(f.amplitude, 100), min: finite(f.amplitude) && finite(o.amplitudeTolerance) ? f.amplitude * (1 - o.amplitudeTolerance) * 100 : undefined, max: finite(f.amplitude) && finite(o.amplitudeTolerance) ? f.amplitude * (1 + o.amplitudeTolerance) * 100 : undefined }, finite(o.amplitudeTolerance) ? undefined : 'unknown')
  }
  if (o.type === 'events') {
   add('Matched clicks', m.matched, 'clicks', { target: m.expected }, 'unknown')
   add('Detected clicks', m.detected, 'clicks', { target: m.expected }, 'unknown')
   add('Match score', scale(m.fscore, 100), '%', { min: scale(o.minFscore, 100), max: 100 })
   if (m.maxError !== undefined) add('Timing error', scale(m.maxError, 1000), 'ms', { min: 0, max: scale(o.tolerance, 1000), target: 0 })
  }
  const perChannel = Array.isArray(m.perChannel) && m.perChannel.length ? m.perChannel : [m]
  perChannel.forEach((channel, index) => {
   if (!channel || typeof channel !== 'object') return
   const prefix = perChannel.length > 1 ? `Ch ${index + 1} ` : '', metric = (label, ...args) => add(prefix + label, ...args)
   if (reasons[channel.reason] && channel !== m) { const [label, value] = reasons[channel.reason]; metrics.push({ label: prefix + label, value, status: 'fail' }) }
   if (['response', 'resample'].includes(o.type)) metric('Gain', channel.gainDb, 'dB', { min: m.min ?? o.min, max: m.max ?? o.max })
   if (['tone', 'stretch-transient', 'chunk-equivalence'].includes(o.type) || o.type === 'resample' && finite(o.frequency)) {
    const target = m.expectedFrequency ?? o.frequency ?? f.frequency, tolerance = ['resample', 'chunk-equivalence'].includes(o.type) ? .01 : .02
    const error = finite(channel.frequency) && finite(target) && target !== 0 ? Math.abs(channel.frequency / target - 1) : undefined
    metric('Pitch', channel.frequency, 'Hz', { target, min: finite(target) ? target * (1 - tolerance) : undefined, max: finite(target) ? target * (1 + tolerance) : undefined, minExclusive: tolerance === .01, maxExclusive: tolerance === .01 }, finite(error) ? (tolerance === .01 ? error < tolerance : error <= tolerance) ? 'pass' : 'fail' : undefined)
   }
   if (o.type === 'stretch-transient') metric('Transient shift', scale(channel.timeError, 1000), 'ms', { min: scale(o.timeTolerance, -1000), max: scale(o.timeTolerance, 1000), target: 0 })
   if (o.type === 'resample-snr') metric('Signal / error', channel.snrDb, 'dB', { min: m.minSnr ?? o.minSnr })
   if (o.type === 'dynamics') for (const window of (Array.isArray(channel.windows) ? channel.windows : []).filter(Boolean)) metric(finite(window.start) && finite(window.end) ? `${count(window.start)}–${count(window.end)} s gain` : 'Gain window', window.gainDb, 'dB', { min: window.minDb, max: window.maxDb })
   if (o.type === 'limiter') {
    const ceiling = m.ceiling ?? (finite(o.ceiling) ? 10 ** (o.ceiling / 20) : undefined), maximum = finite(ceiling) && finite(channel.inputPeak) ? Math.min(ceiling, channel.inputPeak) : undefined
    metric('Peak', scale(channel.peak, 100), '% full scale', { min: scale(maximum, 80), max: finite(maximum) && finite(o.atol) ? (maximum + o.atol) * 100 : undefined })
    metric('Timing shift', channel.latencyFrames, 'frames', { min: scale(o.latencyTolerance, -1), max: o.latencyTolerance, target: 0 })
   }
   if (o.type === 'denoise') {
    metric('Signal improvement', channel.improvement, 'dB', { min: o.minImprovement })
    metric('Signal level', channel.gainDb, 'dB', { min: scale(o.maxSignalLoss, -1), max: o.maxSignalLoss, target: 0 })
    metric('Noise reduction', channel.noiseReduction, 'dB', { min: o.minNoiseReduction })
   }
   if (o.type === 'dither') {
    const checks = [['Bias', 'mean', 'steps', -.02, .02, true], ['Noise level', 'rms', 'steps', .45, .55], ['Silent samples', 'zero', '%', 71, 79], ['Adjacent correlation', 'lag', '', -.04, .04, true], ['Quantization error', 'gridError', 'steps', 0, .001, true], ['Noise peak', 'peak', 'steps', 0, 1.001]]
    for (const [label, key, unit, min, max, strict] of checks) {
     const value = key === 'zero' ? scale(channel[key], 100) : channel[key]
     metric(label, value, unit, { min, max, minExclusive: strict && key !== 'gridError', maxExclusive: strict }, finite(value) && strict ? (key === 'gridError' ? value >= min && value < max : value > min && value < max) ? 'pass' : 'fail' : undefined)
    }
   }
  })
 }
 if (result.status === 'fail') {
  const failed = metrics.filter(metric => metric.status === 'fail')
  output.metrics = [...failed, ...metrics.filter(metric => metric.status === 'unknown')]
 } else if (!basic) {
  const shape = metric => ['Channels', 'Length error', 'Output length', 'Sample rate'].includes(metric.label) || /^Ch \d+ length error$/.test(metric.label)
  const substantive = metrics.some(metric => !shape(metric) && metric.label !== 'Original audio' && metric.status !== 'unknown')
  if (substantive) output.metrics = metrics.filter(metric => !shape(metric) || metric.status !== 'pass')
 }
 return output
}
