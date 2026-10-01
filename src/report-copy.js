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
 if (w.op === 'codec-roundtrip') return withClip(`${String(w.format || 'audio').toUpperCase()} ${w.bitDepth??16}-bit saving and reopening${w.split ? ', split at the first and last byte' : ''}`)
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
  const depth=test.workflow.bitDepth??16,format=depth===32?'float':'integer'
  if (m.encodedBytes === 0) notes.push('Saving produced no encoded audio.')
  if (m.bitDepth !== depth) notes.push(`Saved bit depth: ${number(m.bitDepth)}; expected ${depth} bits.`)
  if (m.sampleFormat!==undefined&&m.sampleFormat!==format) notes.push(`Saved sample format: ${m.sampleFormat}; expected ${format}.`)
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
 if (o.type === 'phase') detail = `Phase differs from the expected shift by ${number(p.phaseError)}°; allowed ${o.phaseTolerance}°. Level changed by ${number(p.gainDb)} dB; allowed ±${o.gainTolerance} dB.`
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

// Shared operation meanings cover behavior tests and the same processors' basic checks.
const purposes = {
 reverse: 'Play the audio backwards.', 'reverse-range': 'Reverse a selected part of the audio.',
 trim: 'Keep a selected part of the audio.', remove: 'Delete a selection and join the remaining audio.',
 pad: 'Add silence before or after the audio.', repeat: 'Repeat the clip end to end.',
 invert: 'Flip the sign of every sample.', mute: 'Replace the audio with silence.',
 gain: 'Multiply every sample by a volume factor.', 'gain-db': 'Change the volume by a specified number of decibels.',
 'fade-in': 'Raise the volume gradually from silence.', 'fade-out': 'Lower the volume gradually to silence.',
 fade: 'Change the volume gradually along a chosen curve.', crossfade: 'Blend the end of one clip into the start of another.',
 mix: 'Add one clip to another at a chosen position.', insert: 'Insert a clip and move the following audio later.',
 derivative: 'Measure the change between adjacent samples.', integral: 'Replace each sample with the running sum of samples.',
 swap: 'Exchange the left and right channels.', mono: 'Average the left and right channels into one.',
 duplicate: 'Copy a mono signal into both stereo channels.', balance: 'Turn down one side of a stereo signal.',
 min: 'Find the lowest signed sample value.', max: 'Find the highest signed sample value.',
 peak: 'Find the largest sample magnitude, whether positive or negative.', rms: 'Measure the signal’s average power as an equivalent sample level.',
 dc: 'Measure the average offset of the waveform from zero.', energy: 'Sum the squared sample values.',
 zcr: 'Measure how often the waveform changes sign.',
 lowpass: 'Reduce frequencies above the cutoff.', highpass: 'Reduce frequencies below the cutoff.',
 bandpass: 'Keep a band of frequencies and reduce those outside it.', notch: 'Reduce a narrow band of frequencies.',
 allpass: 'Change the timing of frequency components without changing their levels.',
 lowshelf: 'Raise or lower the bass frequencies.', highshelf: 'Raise or lower the treble frequencies.',
 eq: 'Raise or lower a selected band of frequencies.',
 compressor: 'Reduce the difference between loud and quiet sections.', limiter: 'Keep sample peaks below a chosen ceiling.',
 gate: 'Turn down the audio when it falls below a chosen level.',
 deesser: 'Reduce harsh “s” sounds in speech.', softclip: 'Shape loud peaks to add distortion.',
 expander: 'Make quiet parts quieter or loud parts louder.', compand: 'Control loud and quiet parts with a custom volume curve.',
 ducker: 'Turn one track down when another gets loud.', dewind: 'Reduce bursts of wind noise and low rumble.',
 declick: 'Remove isolated clicks and pops.', tremolo: 'Vary the volume in a repeating pattern.',
 defeedback: 'Reduce the ringing or whistling caused by audio feedback.',
 distortion: 'Reshape the waveform to add distortion.', freeverb: 'Add a fading trail of reflections, like sound lingering in a room.',
 chorus: 'Layer slightly delayed and detuned copies to thicken the sound.',
 autopan: 'Move the sound left and right in a repeating pattern.',
 surround: 'Create a 5.1-channel mix from stereo audio.',
 binaural: 'Position sound around the listener using differences in timing and level between the ears.',
 fm: 'Create tones by using one oscillator to modulate another, from mellow sounds to metallic ones.',
 emphasis: 'Boost higher frequencies before further processing.',
 deemphasis: 'Reduce higher frequencies to undo pre-emphasis.',
 tune: 'Move detected notes towards the notes of a chosen musical scale.',
 variable: 'Change the width of the frequency band allowed through.',
 dcblocker: 'Remove a constant offset from the waveform.',
 rhythm: 'Generate a click track at a chosen tempo.',
 delay: 'Repeat the sound after a delay, with optional fading echoes.',
 convolution: 'Apply an impulse response, such as the reflections of a room, to the audio.',
 dither: 'Add a small amount of noise when reducing bit depth to reduce rounding distortion.',
 denoise: 'Reduce background noise while preserving the wanted sound.',
 resample: 'Change the sample rate while keeping the same duration and pitch.',
 stretch: 'Change the duration without changing the pitch.', varispeed: 'Change playback speed and pitch together.',
 pitch: 'Change the pitch without changing the duration.'
}

const featureDescriptions = {
 'execution.identity': ['Pass audio through without changing it.'],
 'execution.channel-independence': ['Process each channel without swapping it or leaking audio into another channel.'],
 'execution.composition': ['Apply a sequence of edits in order.', 'Checks combinations of reversal and volume changes.'],
 'execution.block-invariance': ['Process a clip in chunks without changing the result.', 'Compares streamed resampling with processing the whole clip, and checks edits across chunk boundaries.'],
 'editor.fragment-isolation': ['Edit a copy or selection without changing its source.'],
 'editor.undo-redo': ['Undo an edit, then apply it again.', 'Checks that undo restores the original samples and redo restores the edited samples.'],
 'editor.seams': ['Find abrupt jumps at the edges of an edit.', 'Checks exact reversal of a selection; smoothing clicks is not tested.'],
 'analysis.loudness': ['Measure perceived loudness across a clip.', 'Checks synthetic stereo signals and quiet sections using selected EBU loudness tests.'],
 'analysis.true-peak': ['Estimate peaks that can occur between stored samples.', 'Checks selected synthetic EBU signals, including peaks above full scale.'],
 'level.loudness-normalize': ['Adjust the volume to a chosen loudness while keeping peaks below a ceiling.', 'Checks a generated stereo tone; complete programmes are not tested.'],
 'analysis.level': ['Measure peak level, average signal level and the waveform’s offset from zero.'],
 'analysis.spectrum': ['Measure the frequencies in the audio and their levels.', 'Checks the frequency and amplitude of a generated tone.'],
 'analysis.pitch': ['Estimate a note’s fundamental frequency.', 'Checks individual generated tones; chords and recorded performances are not tested.'],
 'analysis.onset-tempo': ['Detect when sounds begin and estimate beats per minute.', 'Checks timing and tempo on a generated click track.']
}

const describedChecks = {
 'edit.crossfade': 'Checks the overlap length and the linear and equal-power fade curves.',
 'edit.mix': 'Checks the combined samples and position; the destination clip keeps its length.',
 'edit.fade': 'Checks the sample levels along linear, squared, square-root and cosine curves.',
 'level.gain': 'Checks the sample multiplier for each requested decibel change.',
 'rate.resample': 'Checks length, pitch, tone level, waveform accuracy and rejection of frequencies too high for the new rate.',
 'rate.stretch': 'Checks duration, tone pitch and the timing of a short burst.',
 'dynamics.compressor': 'Checks gain reduction and recovery as the input level changes.',
 'dynamics.limiter': 'Checks sample peaks and alignment in time; peaks between samples are not measured here.',
 'dynamics.gate': 'Checks quiet and loud sections, hold time and recovery.',
 'effect.delay': 'Checks the timing and level of each echo.',
 'effect.convolution': 'Checks the output samples and keeps the complete response tail.',
 'restoration.dither': 'Checks noise level, bias and sample distribution on digital silence.',
 'restoration.denoise': 'Checks a tone mixed with steady noise for cleaner output, retained tone level and reduced noise.'
}

function packagePurpose(feature) {
 const description = String(feature.description || '').replace(/\s+/g, ' ').trim()
 // Package descriptions carry the purpose; citations, brands and implementation notes stay in their docs.
 const text = description.replace(/\s*\([^)]*\)/g, '').split(/\.\s+(?=[A-Z])/)[0].replace(/[.;,\s]+$/, '')
 return text ? capital(text) + '.' : ''
}

/** A row explains its purpose and test scope, independently of any contender's results. */
export function featureCopy(feature = {}) {
 feature ||= {}
 const id = String(feature.id || ''), [family, method = ''] = id.split('.'), operation = method.replace(/^(lowpass|highpass)1$/, '$1')
 const basic = family === 'processor'
 if (featureDescriptions[id]) {
  const [description, checks = ''] = featureDescriptions[id]
  return { description, checks }
 }
 let description = purposes[operation] || '', checks = describedChecks[id] || ''
 if (basic) {
  const pkg = feature.package || ''
  if (!description && pkg.startsWith('@audio/reverb-')) description = 'Add a fading trail of reflections, like sound lingering in a room.'
  if (!description && pkg.startsWith('@audio/stretch-')) description = purposes.stretch
  if (!description && (pkg.startsWith('@audio/shift-') || pkg === '@audio/shift')) description = purposes.pitch
  if (!description && ['@audio/denoise-spectral', '@audio/denoise-wiener', '@audio/denoise-omlsa'].includes(pkg)) description = 'Estimate background noise and reduce it in each frequency band.'
  if (!description && pkg === '@audio/neural-denoise') description = 'Reduce background noise in speech using a trained model.'
  if (!description && pkg.startsWith('@audio/saturate-')) description = 'Reshape the waveform to add harmonic distortion.'
  description ||= packagePurpose(feature) || feature.contract || ''
  return { description, checks: 'Checks valid output and that the original audio stays unchanged. Sound quality is not tested.' }
 }
 if (family === 'neutral') return { description: description || packagePurpose(feature) || feature.contract || '', checks: 'Checks that neutral settings leave every sample unchanged.' }
 if (family === 'filter') {
  if (method === 'biquad') description = 'A two-pole low-pass filter reduces frequencies above its cutoff.'
  checks = method === 'biquad' ? 'Checks a tone at the cutoff for a 3.01 dB reduction.' : method === 'allpass' ? 'Checks unchanged tone levels and the expected phase shift below, at and above the selected frequency, in both channels.' : 'Checks tone levels below, at and above the cutoff or selected frequency.'
 }
 if (family === 'codec') return { description: ({wav:'Save uncompressed audio samples in a WAV file.',flac:'Compress audio without losing any sample data.'})[method] || `Save audio as ${method.toUpperCase()} and read it back.`, checks: `Checks that 16-bit and 24-bit samples${method==='wav'?', plus 32-bit floating point':''}, channels and sample rate survive unchanged, including reading the file in chunks.` }
 if (family === 'editor' && ['copy-reverse', 'clip-reverse', 'clone-reverse'].includes(method)) return { description: `Reverse ${method === 'clip-reverse' ? 'a selected clip' : method === 'clone-reverse' ? 'a clone' : 'a copy'} without changing the original audio.`, checks: '' }
 if (id === 'editor.undo') return { description: 'Return the audio to its state before an edit.', checks: '' }
 if (id === 'editor.stream') return { description: 'Read the audio in successive chunks.', checks: 'Checks that the streamed samples match the complete returned clip.' }
 if (id === 'level.peak-normalize') return { description: 'Adjust the volume so the highest sample reaches the target.', checks: 'Checks a shared volume change across channels and leaves silence unchanged.' }
 if (id === 'level.gain') description = purposes['gain-db']
 return { description: description || feature.contract || packagePurpose(feature), checks }
}
