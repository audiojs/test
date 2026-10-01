const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const n = value => Number(value.toFixed(3))
const ink = '#126356', muted = '#65736a', line = '#dce2dc'
const clip = [0, .15, .35, .8, .45, .15, -.2, -.7, -.35, -.1, .3, .55, .25, .1, -.15, -.4, -.2, 0]
const tone = (cycles, count = 48) => Array.from({ length: count }, (_, i) => .75 * Math.sin(2 * Math.PI * cycles * i / count))
const text = (x, y, value, anchor = 'start') => `<text x="${n(x)}" y="${n(y)}" fill="${muted}" font-size="18" text-anchor="${anchor}">${esc(value)}</text>`

function svg(title, description, body, height, hint = '') {
 return `<svg xmlns="http://www.w3.org/2000/svg" class="feature-diagram" width="400" height="${height}" viewBox="0 0 400 ${height}" role="img" aria-label="${esc(title)}" style="width:100%;height:auto;font-family:inherit"><title>${esc(title)}</title><desc>${esc(description)}</desc>${text(12, 20, 'Example')}${hint ? text(388, 20, hint, 'end') : ''}${body}</svg>`
}

function trace(label, points, { x = 116, y, width = 268, duration, scale = 1, color = ink, dots = [], selection = [], caption = '', labelX = 12, visibleLabel = label } = {}) {
 const px = time => x + time / duration * width, py = value => y - value / scale * 22
 const bands = selection.map(([start, end]) => `<rect x="${n(px(start))}" y="${n(y - 24)}" width="${n(px(end) - px(start))}" height="48" fill="#fff0cf"/>`).join('')
 const wave = points.map(([time, value]) => `${n(px(time))},${n(py(value))}`).join(' ')
 return `<g class="diagram-series" aria-label="${esc(label)}">${bands}${text(labelX, y - 8, visibleLabel)}${caption ? text(labelX, y + 14, caption) : ''}<line class="diagram-zero" x1="${x}" x2="${x + width}" y1="${y}" y2="${y}" stroke="${line}"/><polyline class="diagram-wave" points="${wave}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>${dots.map(([time, value]) => `<circle cx="${n(px(time))}" cy="${n(py(value))}" r="2.4" fill="${color}"/>`).join('')}</g>`
}

function samples(title, description, rows, hint = '') {
 const duration = Math.max(...rows.map(row => (row.offset || 0) + row.values.length))
 const scale = Math.max(1, ...rows.flatMap(row => row.values.map(Math.abs)))
 const body = rows.map((row, i) => trace(row.label, row.values.map((value, j) => [j + (row.offset || 0), value]), {
  y: 54 + i * 62, duration, scale, color: i === rows.length - 1 ? ink : muted,
  caption: `${row.values.length} samples`, selection: row.selection
 })).join('')
 return svg(title, description, body, 90 + (rows.length - 1) * 62, hint)
}

function editDiagram(operation) {
 let before = clip, after, title, description, hint = '', selected = [], outputSelection = []
 switch (operation) {
  case 'reverse': after = [...before].reverse(); title = 'Reverse sample order'; description = 'The same samples run in the opposite order. Duration and sample values stay the same.'; break
  case 'reverse-range': after = [...before.slice(0, 6), ...before.slice(6, 12).reverse(), ...before.slice(12)]; selected = outputSelection = [[6, 12]]; title = 'Reverse a selection'; description = 'Only the six highlighted samples change order. Audio outside the selection stays unchanged.'; hint = 'Selected part'; break
  case 'trim': after = before.slice(6, 12); selected = [[6, 12]]; title = 'Keep a selection'; description = 'The six highlighted samples become the complete output clip.'; hint = 'Keep selected part'; break
  case 'remove': after = [...before.slice(0, 6), ...before.slice(12)]; selected = [[6, 12]]; title = 'Remove a selection'; description = 'The six highlighted samples are removed. The remaining samples join without smoothing.'; hint = 'Remove selected part'; break
  case 'pad': after = [...Array(4).fill(0), ...before, ...Array(4).fill(0)]; outputSelection = [[0, 4], [22, 26]]; title = 'Add silence'; description = 'Four zero-valued samples are added at each end. The original waveform stays unchanged.'; hint = 'Silence at both ends'; break
  case 'repeat': after = [...before, ...before]; title = 'Repeat a clip'; description = 'The original sample sequence plays twice. The output is twice as long.'; hint = 'Two copies'; break
  case 'insert': after = [...before.slice(0, 6), 0, .65, -.4, 0, ...before.slice(6)]; outputSelection = [[6, 10]]; title = 'Insert audio'; description = 'Four new samples are inserted after sample six. Following audio moves four samples later.'; hint = 'Insert four samples'; break
  case 'gain': after = before.map(value => value * 2); title = 'Multiply the volume'; description = 'Every sample is multiplied by two, including negative values. Timing is unchanged; peaks are not clipped.'; hint = '×2'; break
  case 'gain-db': after = before.map(value => value * 10 ** (-6 / 20)); title = 'Change volume in decibels'; description = 'A six-decibel reduction multiplies every sample by about one half. Timing stays unchanged.'; hint = '−6 dB'; break
  case 'invert': after = before.map(value => -value); title = 'Invert polarity'; description = 'Positive samples become negative and negative samples become positive. Duration and magnitude stay unchanged.'; hint = '×−1'; break
  case 'mute': after = before.map(() => 0); title = 'Mute audio'; description = 'Every sample becomes zero. The clip keeps its duration.'; hint = 'Silence'; break
  case 'peak-normalize': after = before.map(value => value / Math.max(...before.map(Math.abs))); title = 'Normalize the sample peak'; description = 'One shared multiplier brings the largest sample magnitude to one while preserving the waveform’s proportions.'; hint = 'Peak → 1'; break
  case 'fade': case 'fade-in': case 'fade-out': {
   before = tone(3)
   const out = operation === 'fade-out'
   after = before.map((value, i) => value * (out ? 1 - i / before.length : i / before.length))
   title = out ? 'Linear fade out' : 'Linear fade in'; description = `A tone’s volume ${out ? 'falls' : 'rises'} along a straight ramp. Weights use the sample position divided by the fade length.`; hint = 'Linear fade'; break
  }
  default: return ''
 }
 return samples(title, description, [{ label: 'Before', values: before, selection: selected }, { label: 'After', values: after, selection: outputSelection }], hint)
}

function mixDiagram(crossfade) {
 if (crossfade) {
  const a = clip, b = clip.map(value => -value * .7), overlap = 6
  const blend = a.slice(-overlap).map((value, i) => value * (1 - i / overlap) + b[i] * i / overlap)
  return samples('Crossfade two clips', 'The end of A and start of B overlap for six samples. Their linear fade weights add to one. The joined clip is six samples shorter than A followed by B.', [
   { label: 'A then B', values: [...a, ...b], selection: [[a.length - overlap, a.length + overlap]] },
   { label: 'Overlap', values: [...a.slice(0, -overlap), ...blend, ...b.slice(overlap)], selection: [[a.length - overlap, a.length]] }
  ], 'Linear overlap')
 }
 const added = [.1, .3, .5, .3, .1, -.1, -.3, -.5, -.3, -.1]
 return samples('Mix two clips', 'Samples from the added clip are summed with the base clip, starting after four samples. The base clip keeps its original length; the sum is not normalized.', [
  { label: 'Base', values: clip }, { label: 'Added', values: added, offset: 4 },
  { label: 'Mix', values: clip.map((value, i) => value + (added[i - 4] || 0)) }
 ], 'After four samples')
}

function channelDiagram(operation) {
 const left = clip, right = clip.map((value, i) => -.6 * clip[(i + 5) % clip.length])
 const input = operation === 'duplicate' ? [left] : [left, right]
 const output = operation === 'swap' ? [right, left] : operation === 'mono' ? [left.map((value, i) => (value + right[i]) / 2)] : operation === 'duplicate' ? [left, left] : [left, right.map(value => value * .25)]
 const title = ({ swap: 'Swap stereo channels', mono: 'Average stereo into mono', duplicate: 'Copy mono into stereo', balance: 'Adjust stereo balance' })[operation]
 const description = ({ swap: 'Left becomes right and right becomes left, without changing either sample sequence.', mono: 'Each output sample is the average of the matching left and right samples.', duplicate: 'Both output channels contain the same mono samples.', balance: 'The left channel stays unchanged. Every right-channel sample is multiplied by one quarter.' })[operation]
 let body = text(12, 40, 'Before') + text(220, 40, 'After')
 for (const [side, signals] of [input, output].entries()) for (const [i, values] of signals.entries()) {
  const label = signals.length === 1 ? 'Mono' : i === 0 ? 'Left' : 'Right', x = side ? 276 : 68, y = signals.length === 1 ? 109 : 77 + i * 64
  body += trace(`${side ? 'After' : 'Before'} ${label.toLowerCase()}`, values.map((value, j) => [j, value]), { x, y, width: 108, duration: clip.length, color: side ? ink : muted, labelX: side ? 220 : 12, visibleLabel: label })
 }
 return svg(title, description, body, 179, operation === 'mono' ? '(Left + Right) ÷ 2' : operation === 'balance' ? 'Right ×¼' : '')
}

function rateDiagram(operation) {
 const stretch = operation === 'stretch', speed = operation === 'varispeed', resample = operation === 'resample'
 const inputDuration = 1, outputDuration = stretch ? 2 : speed ? .5 : 1
 const inputFrequency = 3, outputFrequency = stretch || resample ? 3 : 6
 const duration = Math.max(inputDuration, outputDuration)
 const wave = (seconds, frequency, samples = 96 * seconds) => Array.from({ length: samples + 1 }, (_, i) => [seconds * i / samples, .75 * Math.sin(2 * Math.PI * frequency * seconds * i / samples)])
 const dots = count => Array.from({ length: count }, (_, i) => [i / count, .75 * Math.sin(2 * Math.PI * 3 * i / count)])
 const title = ({ resample: 'Change sample rate', stretch: 'Stretch time without changing pitch', varispeed: 'Change playback speed and pitch', pitch: 'Shift pitch without changing duration' })[operation]
 const description = ({ resample: 'Both rows show the same continuous three-cycle tone lasting one second. Dots mark twelve input samples and twenty-four output samples. Pitch and duration stay the same.', stretch: 'The input tone lasts one second. The output lasts two seconds, with the same spacing between cycles and therefore the same pitch.', varispeed: 'Playing twice as fast fits the same three cycles into half the time, doubling the pitch.', pitch: 'The output has twice as many cycles within the same one-second duration, raising pitch by one octave.' })[operation]
 const hint = ({ resample: '12 → 24 samples/s', stretch: 'Duration ×2', varispeed: 'Speed ×2', pitch: 'One octave up' })[operation]
 const body = trace('Before', wave(inputDuration, inputFrequency), { y: 56, duration, dots: resample ? dots(12) : [], color: muted, caption: '1 second' }) + trace('After', wave(outputDuration, outputFrequency), { y: 124, duration, dots: resample ? dots(24) : [], caption: `${outputDuration} second${outputDuration === 1 ? '' : 's'}` })
 return svg(title, description, body, 160, hint)
}

function delayDiagram() {
 const before = Array(24).fill(0), after = Array(24).fill(0); before[2] = .8
 for (let at = 6, gain = .8; at < after.length; at += 4, gain *= .5) after[at] = gain
 return samples('Delay with fading echoes', 'One impulse is delayed by four samples. Each later echo is half as loud as the previous echo. The output contains only the delayed sound.', [{ label: 'Input', values: before }, { label: 'Echoes', values: after }], '4-sample delay, ½ feedback')
}

function filterDiagram(method) {
 const high = method.startsWith('high'), order = method.endsWith('1') ? 1 : 2
 const frequencies = Array.from({ length: 65 }, (_, i) => 100 * 100 ** (i / 64))
 const gains = frequencies.map(frequency => {
  const ratio = Math.tan(Math.PI * frequency / 48000) / Math.tan(Math.PI * 1000 / 48000)
  const magnitude = order === 1 ? (high ? ratio : 1) / Math.sqrt(1 + ratio ** 2) : (high ? ratio ** 2 : 1) / Math.sqrt((1 - ratio ** 2) ** 2 + 2 * ratio ** 2)
  return Math.max(-40, 20 * Math.log10(magnitude))
 })
 const x = frequency => 82 + Math.log10(frequency / 100) / 2 * 302, y = db => 42 - db / 40 * 86
 const points = frequencies.map((frequency, i) => `${n(x(frequency))},${n(y(gains[i]))}`).join(' ')
 const body = `<g class="diagram-series" aria-label="Frequency response"><line x1="82" x2="384" y1="42" y2="42" stroke="${line}"/><line x1="82" x2="384" y1="128" y2="128" stroke="${line}"/><line x1="233" x2="233" y1="35" y2="128" stroke="${line}" stroke-dasharray="3 3"/><polyline class="diagram-wave" points="${points}" fill="none" stroke="${ink}" stroke-width="1.7"/>${text(72, 46, '0 dB', 'end')}${text(72, 132, '−40 dB', 'end')}${text(82, 152, '100 Hz')}${text(233, 152, '1 kHz', 'middle')}${text(384, 152, '10 kHz', 'end')}</g>`
 return svg(`${high ? 'High' : 'Low'}-pass frequency response`, `A ${order === 1 ? 'one-pole' : 'two-pole Butterworth'} filter at a 48 kHz sample rate and 1 kHz cutoff. ${high ? 'Low' : 'High'} frequencies are reduced; the cutoff is about 3 dB below the unaffected level. The vertical scale stops at minus 40 dB.`, body, 174, 'Cutoff: 1 kHz')
}

/** Mathematical illustrations of operations, never contender output or measured results. */
export function featureDiagram(feature = {}) {
 const id = feature?.id || '', [family, method] = id.split('.')
 if (family === 'edit') return method === 'mix' || method === 'crossfade' ? mixDiagram(method === 'crossfade') : editDiagram(method)
 if (family === 'channels' && ['swap', 'mono', 'duplicate', 'balance'].includes(method)) return channelDiagram(method)
 if (family === 'rate' && ['resample', 'stretch', 'varispeed', 'pitch'].includes(method)) return rateDiagram(method)
 if (family === 'filter' && ['lowpass', 'highpass', 'lowpass1', 'highpass1', 'biquad'].includes(method)) return filterDiagram(method === 'biquad' ? 'lowpass' : method)
 if (id === 'level.gain') return editDiagram('gain-db')
 if (id === 'level.peak-normalize') return editDiagram('peak-normalize')
 if (id === 'effect.delay' || id === 'processor.delay') return delayDiagram()
 return ''
}
