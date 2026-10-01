import test from 'node:test'
import assert from 'node:assert/strict'
import { featureDiagram } from '../src/report-diagram.js'
import { loadSpec } from '../src/spec.js'

const diagram = id => featureDiagram({ id })
const close = (actual, expected, tolerance = .002) => assert(Math.abs(actual - expected) <= tolerance, `${actual} should be ${expected}`)
const series = (svg, label) => {
 const group = svg.match(new RegExp(`<g class="diagram-series" aria-label="${label}">([\\s\\S]*?)</g>`))?.[1]
 assert(group, `series ${label}`)
 const points = group.match(/class="diagram-wave" points="([^"]+)"/)[1].split(' ').map(point => point.split(',').map(Number))
 const zero = Number(group.match(/class="diagram-zero"[^>]*y1="([^"]+)"/)?.[1] || 0)
 return { points, values: points.map(([, y]) => zero - y), group }
}
const compare = (actual, expected) => { assert.equal(actual.length, expected.length); actual.forEach((value, i) => close(value, expected[i])) }
const pair = id => { const svg = diagram(id); return [series(svg, 'Before'), series(svg, 'After')] }

test('editing diagrams preserve the exact retained samples and show duration changes', () => {
 let [before, after] = pair('edit.reverse')
 compare(after.values, [...before.values].reverse())
 ;[before, after] = pair('edit.reverse-range')
 compare(after.values, [...before.values.slice(0, 6), ...before.values.slice(6, 12).reverse(), ...before.values.slice(12)])
 ;[before, after] = pair('edit.trim')
 compare(after.values, before.values.slice(6, 12))
 ;[before, after] = pair('edit.remove')
 compare(after.values, [...before.values.slice(0, 6), ...before.values.slice(12)])
 ;[before, after] = pair('edit.repeat')
 compare(after.values, [...before.values, ...before.values])
 close(after.points[1][0] - after.points[0][0], before.points[1][0] - before.points[0][0])
 ;[before, after] = pair('edit.pad')
 compare(after.values, [...Array(4).fill(0), ...before.values, ...Array(4).fill(0)])
 ;[before, after] = pair('edit.insert')
 assert.equal(after.values.length, before.values.length + 4)
 compare(after.values.slice(0, 6), before.values.slice(0, 6))
 compare(after.values.slice(10), before.values.slice(6))
})

test('gain, polarity and muting keep time coordinates and use one vertical scale', () => {
 for (const [id, factor] of [['edit.gain', 2], ['edit.gain-db', 10 ** (-6 / 20)], ['edit.invert', -1], ['edit.mute', 0]]) {
  const [before, after] = pair(id)
  compare(after.values, before.values.map(value => value * factor))
  compare(after.points.map(p => p[0]), before.points.map(p => p[0]))
 }
 const [before, after] = pair('level.peak-normalize')
 compare(after.values, before.values.map(value => value / .8))
})

test('linear fades use sample index divided by length rather than endpoint-inclusive weights', () => {
 for (const out of [false, true]) {
  const [before, after] = pair(out ? 'edit.fade-out' : 'edit.fade-in')
  compare(after.values, before.values.map((value, i) => value * (out ? 1 - i / before.values.length : i / before.values.length)))
  if (out) assert.notEqual(after.values.at(-1), 0)
 }
})

test('mix adds at the stated offset and crossfade shortens the concatenation by the overlap', () => {
 const svg = diagram('edit.mix'), base = series(svg, 'Base'), added = series(svg, 'Added'), mix = series(svg, 'Mix')
 compare(mix.values, base.values.map((value, i) => value + (added.values[i - 4] || 0)))
 close(added.points[0][0], base.points[4][0])
 const cross = diagram('edit.crossfade'), joined = series(cross, 'A then B'), overlap = series(cross, 'Overlap')
 assert.equal(overlap.values.length, joined.values.length - 6)
 const a = joined.values.slice(0, 18), b = joined.values.slice(18)
 compare(overlap.values, [...a.slice(0, -6), ...a.slice(-6).map((value, i) => value * (1 - i / 6) + b[i] * i / 6), ...b.slice(6)])
 assert.match(cross, /Linear overlap/)
 assert.doesNotMatch(cross, /equal-power/)
})

test('channel diagrams implement averaging, exchange, copying and attenuation without boosting', () => {
 let svg = diagram('channels.swap')
 compare(series(svg, 'After left').values, series(svg, 'Before right').values)
 compare(series(svg, 'After right').values, series(svg, 'Before left').values)
 svg = diagram('channels.mono')
 const left = series(svg, 'Before left').values, right = series(svg, 'Before right').values
 compare(series(svg, 'After mono').values, left.map((value, i) => (value + right[i]) / 2))
 svg = diagram('channels.duplicate')
 compare(series(svg, 'After left').values, series(svg, 'Before mono').values)
 compare(series(svg, 'After right').values, series(svg, 'Before mono').values)
 svg = diagram('channels.balance')
 compare(series(svg, 'After left').values, series(svg, 'Before left').values)
 compare(series(svg, 'After right').values, series(svg, 'Before right').values.map(value => value * .25))
})

test('sample rate, stretching, varispeed and pitch shift have distinct time and frequency semantics', () => {
 const cycles = row => row.values.slice(1).filter((value, i) => value > 0 && row.values[i] <= 0).length
 const width = row => row.points.at(-1)[0] - row.points[0][0]
 let [before, after] = pair('rate.resample')
 compare(after.values, before.values)
 compare(after.points.map(p => p[0]), before.points.map(p => p[0]))
 assert.equal((before.group.match(/<circle /g) || []).length, 12)
 assert.equal((after.group.match(/<circle /g) || []).length, 24)
 ;[before, after] = pair('rate.stretch')
 close(width(after) / width(before), 2)
 assert.equal(cycles(after), cycles(before) * 2, 'doubling duration retains the local period')
 ;[before, after] = pair('rate.varispeed')
 close(width(after) / width(before), .5)
 assert.equal(cycles(after), cycles(before), 'the same cycles fit into half the time')
 ;[before, after] = pair('rate.pitch')
 close(width(after), width(before))
 assert.equal(cycles(after), cycles(before) * 2, 'twice the frequency within unchanged duration')
})

test('delay illustrates the exact offset and geometric feedback levels', () => {
 const svg = diagram('effect.delay'), input = series(svg, 'Input').values, output = series(svg, 'Echoes').values
 assert.equal(input.findIndex(value => value !== 0), 2)
 assert.equal(output.findIndex(value => value !== 0), 6)
 const echoes = output.map((value, i) => [i, value]).filter(([, value]) => value !== 0)
 for (const [i, [at, value]] of echoes.entries()) { assert.equal(at, 6 + i * 4); close(value, input[2] * .5 ** i) }
})

test('low-pass and high-pass responses have the correct cutoff and order', () => {
 for (const order of ['', '1']) {
  const low = series(diagram(`filter.lowpass${order}`), 'Frequency response').points
  const high = series(diagram(`filter.highpass${order}`), 'Frequency response').points
  const db = point => (42 - point[1]) / 86 * 40
  close(db(low[32]), -3.0103, .001)
  close(db(high[32]), -3.0103, .001)
  assert(db(low[0]) > db(low.at(-1)))
  assert(db(high[0]) < db(high.at(-1)))
 }
 const one = series(diagram('filter.lowpass1'), 'Frequency response').points
 const two = series(diagram('filter.lowpass'), 'Frequency response').points
 assert(two.at(-1)[1] > one.at(-1)[1], 'two poles attenuate high frequencies more strongly')
})

test('SVG is deterministic, labeled as an example, self-contained and safe to repeat', async () => {
 const spec = await loadSpec(), supported = spec.features.features.filter(feature => featureDiagram(feature))
 assert(supported.length >= 25)
 for (const feature of supported) {
  const svg = featureDiagram(feature), tags = []
  assert.equal(svg, featureDiagram(feature))
  assert.match(svg, /role="img" aria-label="[^"]+"/)
  assert.match(svg, /<title>[^<]+<\/title><desc>[^<]+<\/desc>/)
  assert.match(svg, />Example<\/text>/)
  assert.match(svg, /viewBox="0 0 400 \d+"/)
  assert.doesNotMatch(svg, /style="[^"]*max-width:/, 'the report can cap diagram width without fighting an inline rule')
  const textSizes = [...svg.matchAll(/<text\b[^>]*font-size="([^"]+)"/g)].map(match => Number(match[1]))
  assert(textSizes.length > 0 && textSizes.every(size => size >= 18), 'labels remain approximately 12px when the illustration shrinks to a 320px popup')
  assert.doesNotMatch(svg, /\bid=|\bhref=|<script|<foreignObject|\bon\w+=|NaN|Infinity|&(?!amp;|lt;|gt;|quot;|#39;)/)
  for (const tag of svg.matchAll(/<(\/?)([\w-]+)\b[^>]*?(\/?)>/g)) {
   if (tag[1]) assert.equal(tags.pop(), tag[2], 'generated XML tags are nested and balanced')
   else if (!tag[3]) tags.push(tag[2])
  }
  assert.equal(tags.length, 0)
  assert.equal(featureDiagram({...feature,title:'<script>alert(1)</script>',description:'" onload="evil()'}), svg, 'untrusted feature text never enters mathematical diagrams')
 }
 for (const feature of [null, {}, {id:'unknown.operation'}, {id:'processor.rnnoise'}, {id:'analysis.loudness'}, {id:'filter.allpass'}]) assert.equal(featureDiagram(feature), '')
})
