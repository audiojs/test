import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep, join } from 'node:path'
import assert from 'node:assert/strict'
import { featureResult } from '../src/report.js'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = resolve(process.env.REPORT_SITE_ROOT || 'site')
const shots = process.env.REPORT_SCREENSHOT_DIR || 'results/screenshots'
const input = JSON.parse(await readFile(join(root, 'results.json')))
const spec = JSON.parse(await readFile(join(root, 'spec.json')))
let bench = { results: [] }
try { bench = JSON.parse(await readFile(join(root, 'benchmarks.json'))) || bench } catch (error) { if (error.code !== 'ENOENT') throw error }
const runs = input.runs.filter(run => run.adapter !== 'reference')
const active = spec.filter(c => c.status === 'active')
const behaviorCount = runs.length ? new Set(active.filter(c => c.level !== 'integrity').map(c => c.feature)).size : 0
const basicCount = runs.length ? new Set(active.filter(c => c.level === 'integrity').map(c => c.feature)).size : 0
const benchTools = [...new Set(bench.results.map(b => b.adapter))]
const benchCases = [...new Set(bench.results.map(b => b.case))]
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav' }
const server = createServer(async (req, res) => {
 try {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/\/$/, '/index.html'))
  if (!path.startsWith(root + sep)) throw Error('outside site')
  const bytes = await readFile(path)
  res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(bytes)
 } catch { res.statusCode = 404; res.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
let browser
try {
 browser = await chromium.launch({ headless: true })
 const errors = []
 let page
 const freshPage = async viewport => {
  await page?.close()
  page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(`${response.status()} ${response.url()}`) })
 }
 const allSections = async page => {
  assert.deepEqual(await page.locator('section.comparison').evaluateAll(sections => sections.map(s => s.id)), ['features', 'speed', 'basic-checks'])
  for (const id of ['features', 'speed', 'basic-checks']) assert(await page.locator(`#${id}`).isVisible(), `${id} remains visible`)
  assert.equal(await page.locator('#feature-rows .feature-row:visible').count(), behaviorCount)
  assert.equal(await page.locator('#basic-rows .feature-row:visible').count(), basicCount)
  assert.equal(await page.locator('.speed-row:visible').count(), benchCases.length)
  assert.equal(await page.locator('input, select, form, .view-tab').count(), 0, 'browsing needs no search or filtering controls')
  if (runs.length) {
   assert.equal(await page.locator('#feature-panel thead th').count(), runs.length + 1)
   assert.equal(await page.locator('#basic-panel thead th').count(), runs.length + 1)
  }
  if (benchCases.length) {
   assert.equal(await page.locator('.speed-matrix thead th').count(), benchTools.length + 1)
   assert(await page.locator('.speed-row > th small').evaluateAll(clips => clips.every(clip => clip.textContent.trim())), 'every speed row identifies its clip')
  }
  assert.equal(await page.locator('#basic-rows td.pass').count(), 0, 'basic checks cannot claim effect quality')
  assert.match(await page.locator('#basic-note').textContent(), /quality is not tested/i)
 }
 const readableText = async () => {
  await page.evaluate(() => scrollTo(0, scrollY))
  const clipped = await page.locator('.masthead, .intro, .contents, .comparison > h2, .note, .legend, main > .archive, footer').evaluateAll(elements => elements.filter(el => el.getClientRects().length).filter(el => { const box = el.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1 }).map(el => el.id || el.className))
  assert.deepEqual(clipped, [], 'text outside tables fits the viewport')
 }
 const checkMatrix = async panel => {
  const table = page.locator(`${panel} table`)
  if (!await table.count()) return
  await page.evaluate(() => scrollTo(0, 0))
  const before = await table.evaluate(table => {
   const wrap = table.parentElement, row = table.querySelector('tbody tr:not(.group-row)'), head = table.querySelector('thead th')
   const style = getComputedStyle(wrap)
   return { top: table.getBoundingClientRect().top, height: table.offsetHeight, headHeight: head.offsetHeight, left: row.querySelector('td').getBoundingClientRect().left, overflowX: style.overflowX, overflowY: style.overflowY, maxHeight: style.maxHeight, wrapWidth: wrap.clientWidth, tableWidth: table.offsetWidth }
  })
  assert.equal(before.overflowX, 'visible', `${panel}: no nested horizontal scrolling`)
  assert.equal(before.overflowY, 'visible', `${panel}: no nested vertical scrolling`)
  assert.equal(before.maxHeight, 'none')
  assert(before.wrapWidth >= before.tableWidth)
  await page.evaluate(({ top, height, headHeight }) => scrollTo(document.documentElement.scrollWidth, top + Math.min(120, Math.max(0, height - headHeight - 20))), before)
  const after = await table.evaluate(table => {
   const row = table.querySelector('tbody tr:not(.group-row)'), first = row.querySelector('th'), cell = row.querySelector('td'), head = table.querySelector('thead th'), label = table.querySelector('.group-label')
   return { x: scrollX, headTop: head.getBoundingClientRect().top, headLeft: head.getBoundingClientRect().left, firstLeft: first.getBoundingClientRect().left, cellLeft: cell.getBoundingClientRect().left, firstPosition: getComputedStyle(first).position, headZ: +getComputedStyle(head).zIndex, firstZ: +getComputedStyle(first).zIndex, cellWidth: cell.offsetWidth, minWidth: parseFloat(getComputedStyle(table).getPropertyValue('--tool-width')), groupLeft: label?.getBoundingClientRect().left, groupInset: label ? parseFloat(getComputedStyle(label).left) : null, wrapX: table.parentElement.scrollLeft, wrapY: table.parentElement.scrollTop }
  })
  assert.equal(after.firstPosition, 'sticky')
  assert(after.headZ > after.firstZ, 'header covers row labels at their intersection')
  assert(Math.abs(after.headTop) <= 2, `${panel}: tool header sticks to viewport top (${after.headTop})`)
  assert(after.cellWidth >= after.minWidth - 1, 'tool columns stay readable')
  assert.equal(after.wrapX, 0); assert.equal(after.wrapY, 0)
  if (after.x) {
   assert(Math.abs(after.firstLeft) <= 2, `${panel}: feature label sticks to viewport left (${after.firstLeft})`)
   assert(Math.abs(after.headLeft) <= 2, 'corner header stays at the viewport corner')
   assert(Math.abs(after.cellLeft - before.left + after.x) < 2, 'competitor cells move with the page')
   if (after.groupLeft !== undefined) assert(Math.abs(after.groupLeft - after.groupInset) < 2, 'group headings remain visible at the left edge')
  }
 }
 const benchmarkEnvironment = record => {
   const recorded = bench.environments?.[record.adapter], session = bench.sessions?.find(s => s.adapters?.includes(record.adapter))
   const host = recorded?.host || session?.host || record.host || bench.host || {}, timestamp = recorded?.generatedAt || session?.generatedAt || bench.generatedAt
   if (!host.platform || !host.arch || !host.cpu || host.cpu === 'unknown' || !timestamp) return null
   const label = recorded?.label || ({ darwin: 'macOS', linux: 'Linux', win32: 'Windows' })[host.platform] || host.platform
   return JSON.stringify([label, host.platform, host.arch, host.os, host.cpu, host.logicalCpus, host.totalMemoryBytes, host.node, timestamp])
 }
 const checkSpeedColors = async () => {
  const groups = new Map(), records = new Map()
  for (const result of bench.results) {
   records.set(`${result.case}\0${result.adapter}`, result)
   const cohort = benchmarkEnvironment(result)
   if (!cohort || result.status !== 'pass' || !Number.isFinite(result.medianMs) || result.medianMs <= 0) continue
   const key = `${result.case}\0${cohort}`
   if (!groups.has(key)) groups.set(key, [])
   groups.get(key).push(result.medianMs)
  }
  const cells = await page.locator('.speed-row td').evaluateAll(cells => cells.map(cell => ({ adapter: cell.dataset.tool, id: cell.parentElement.dataset.case, ranked: cell.classList.contains('speed-ranked'), ratio: cell.dataset.speedRatio, cohort: cell.dataset.speedCohort, hue: cell.style.getPropertyValue('--speed-hue'), color: getComputedStyle(cell).backgroundColor, label: cell.querySelector('.result')?.getAttribute('aria-label') })))
  const cohorts = new Map(), colored = new Map()
  for (const cell of cells) {
   const result = records.get(`${cell.id}\0${cell.adapter}`), cohort = result && benchmarkEnvironment(result), values = groups.get(`${cell.id}\0${cohort}`) || []
   const comparable = result?.status === 'pass' && Number.isFinite(result.medianMs) && result.medianMs > 0 && values.length > 1 && Math.min(...values) < Math.max(...values)
   assert.equal(cell.ranked, comparable, `${cell.id}/${cell.adapter}: color requires comparable successful timings from one environment and session`)
   if (!comparable) {
    assert.equal(cell.ratio, undefined, 'unranked cells do not imply a speed ratio')
    assert.equal(cell.hue, '', 'failed, skipped, unknown, singleton and tied timings have no speed color')
    continue
   }
   const ratio = result.medianMs / Math.min(...values)
   assert(Number.isFinite(ratio) ? Math.abs(Number(cell.ratio) - ratio) <= 1e-6 * ratio : Number(cell.ratio) === ratio, 'speed ratio uses only the fastest comparable result')
   assert(cell.cohort, 'ranked timings identify their comparison cohort')
   if (cohorts.has(cell.cohort)) assert.equal(cohorts.get(cell.cohort), cohort, 'a cohort never combines different environments or sessions')
   cohorts.set(cell.cohort, cohort)
   assert.match(cell.label || '', /on this host/i, 'speed comparisons identify their scope in text as well as color')
   const hue = Number(cell.hue)
   assert(Number.isFinite(hue) && hue >= 0 && hue <= 120, 'speed hue stays on the green-to-red scale')
   const key = `${cell.id}\0${cohort}`
   if (!colored.has(key)) colored.set(key, [])
   colored.get(key).push({ ratio, hue, color: cell.color })
  }
  for (const cells of colored.values()) {
   cells.sort((a, b) => a.ratio - b.ratio)
   if (cells[0].hue - cells.at(-1).hue >= 5) assert(new Set(cells.map(cell => cell.color)).size > 1, 'distinct speed ranges produce different visible colors')
   for (let i = 1; i < cells.length; i++) assert(cells[i].hue <= cells[i - 1].hue, 'slower timings move toward red within their cohort')
  }
 }
 const checkPopover = async (selector, { bottom = false, expandCase = false, screenshot } = {}) => {
  const trigger = page.locator(selector).first()
  if (!await trigger.count()) return
  const cell = trigger.locator('..'), panel = page.locator('#cell-popover')
  const href = await trigger.getAttribute('href'), archive = page.locator(`[id=${JSON.stringify(href.slice(1))}]`)
  const templates = await archive.locator('script.visual-template').allTextContents()
  await cell.evaluate((cell, bottom) => {
   const box = cell.getBoundingClientRect(), labelWidth = cell.parentElement.querySelector('th').offsetWidth
   scrollTo(box.left + scrollX - Math.max(labelWidth + 8, (innerWidth - box.width) / 2), box.top + scrollY - (bottom ? innerHeight - box.height - 10 : innerHeight / 3))
  }, bottom)
  const before = await cell.evaluate(cell => ({ x: scrollX, y: scrollY, hash: location.hash, tableHeight: cell.closest('table').offsetHeight, pageWidth: document.documentElement.scrollWidth }))
  const unchanged = async () => assert.deepEqual(await cell.evaluate(cell => ({ x: scrollX, y: scrollY, hash: location.hash, tableHeight: cell.closest('table').offsetHeight, pageWidth: document.documentElement.scrollWidth })), before, 'opening cell details preserves page position and table layout')
  const opened = async () => {
   await page.waitForFunction(() => document.getElementById('cell-popover')?.matches(':popover-open'))
   assert.equal(await page.locator('[popover]:popover-open').count(), 1, 'only one contextual panel is open')
   assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
   assert.equal(await panel.getAttribute('role'), 'dialog')
   const bounds = await panel.evaluate(el => {
    const box = el.getBoundingClientRect()
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight }
   })
   assert(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, `cell details fit viewport: ${JSON.stringify(bounds)}`)
   assert(bounds.bottom - bounds.top <= 480, 'cell details keep a bounded reading height')
   await unchanged()
  }
  const closed = async () => {
   await page.waitForFunction(() => !document.getElementById('cell-popover')?.matches(':popover-open'))
   assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
   await unchanged()
  }
  const folded = async () => {
   assert.equal(await panel.locator('.technical-details[open]').count(), 0, 'technical evidence starts folded')
   assert.equal(await panel.locator('pre:visible').count(), 0, 'raw JSON is hidden until requested')
   assert(await panel.locator('pre').evaluateAll(nodes => nodes.every(node => node.closest('.technical-details'))), 'raw JSON belongs inside technical details')
  }
  const visual = async () => {
   assert.doesNotMatch(await panel.innerText(), /·/, 'visible cell details use layout rather than middle-dot separators')
   const paragraphs = await panel.locator('p:visible').allTextContents()
   assert(paragraphs.every(text => text.trim().length <= 120), 'default cell details contain compact labels rather than long paragraphs')
   assert.equal(await panel.locator('svg, .result-bar, .case-chips, .pill, .speed-peers').count(), 0, 'results use text and measured values without decorative charts or chips')
   assert.equal(await panel.locator('.case-output a:visible').count(), 0, 'reproduction links stay inside folded Evidence')
   const metrics = await panel.locator('.metric[data-value]:visible').evaluateAll(metrics => metrics.map(metric => [metric.dataset.value, metric.dataset.min, metric.dataset.max].filter(value => value !== undefined)))
   assert(metrics.every(values => values.every(value => value !== '' && Number.isFinite(Number(value)))), 'metric values and tolerance bounds are finite numbers')
  }
  const box = await cell.boundingBox()
  await cell.click({ position: { x: box.width - 4, y: box.height - 4 } }); await opened(); await folded(); await visual()
  const adapter = await cell.getAttribute('data-tool'), feature = await cell.evaluate(cell => cell.parentElement.dataset.feature)
  const toolName = await cell.evaluate(cell => cell.closest('table').querySelector(`thead th[data-tool="${cell.dataset.tool}"] a`).textContent)
  assert((await panel.textContent()).includes(toolName), 'cell details identify the selected tool')
  if (feature) {
   const rowName = await cell.evaluate(cell => cell.parentElement.querySelector('th a').textContent)
   assert((await panel.textContent()).includes(rowName), 'feature details identify the selected row')
   const failures = runs.find(run => run.adapter === adapter)?.cases.filter(c => c.feature === feature && ['fail', 'error'].includes(c.status)) || []
   for (const failure of failures) assert((await panel.textContent()).includes(failure.id), `selected tool failure ${failure.id} is available in context`)
   assert(await panel.locator('.case-output[data-tool]').evaluateAll((outputs, adapter) => outputs.every(output => output.dataset.tool === adapter), adapter), 'contextual evidence belongs only to the selected tool')
   const summary = panel.locator('.result-summary')
   assert(await summary.isVisible(), 'feature cells show their result counts before technical details')
   const statuses = ['pass', 'fail', 'error', 'skip'], reported = runs.find(run => run.adapter === adapter)?.cases.filter(c => c.feature === feature) || []
   const expected = Object.fromEntries(statuses.map(status => [status, reported.filter(c => c.status === status).length]))
   const total = active.filter(c => c.feature === feature).length
   expected.skip += Math.max(0, total - reported.length)
   const counts = await summary.locator('[data-status][data-count]').evaluateAll(counters => counters.map(counter => ({ status: counter.dataset.status, count: Number(counter.dataset.count) })))
   assert(counts.every(counter => statuses.includes(counter.status) && Number.isInteger(counter.count) && counter.count > 0), 'the summary includes only nonzero result counts')
   assert.equal(new Set(counts.map(counter => counter.status)).size, counts.length, 'each result state is counted once')
   const countLines = await summary.locator('[data-status][data-count]').evaluateAll(counters => counters.map(counter => counter.getBoundingClientRect().top))
   assert(Math.max(...countLines) - Math.min(...countLines) < 2, 'result counts read as one inline summary')
   assert.deepEqual(Object.fromEntries(statuses.map(status => [status, counts.find(counter => counter.status === status)?.count || 0])), expected, 'the summary preserves every recorded test outcome')
   assert.equal(counts.reduce((sum, counter) => sum + counter.count, 0), total, 'the summary sums to the feature test count')
   const evidence = await panel.locator('.case-output[data-tool]').evaluateAll(outputs => outputs.map(output => ({ id: output.querySelector('.technical-details code')?.textContent, raw: output.querySelector('.technical-details pre')?.textContent })))
   for (const { id, raw } of evidence) {
    if (!raw) continue
    const recorded = runs.find(run => run.adapter === adapter)?.cases.find(c => c.id === id), decoded = JSON.parse(raw)
    assert(recorded, `technical evidence identifies recorded case ${id}`)
    if (recorded.metrics) assert.deepEqual(decoded.metrics, recorded.metrics, 'folded evidence preserves the exact recorded metrics')
    if (recorded.error) assert.equal(decoded.error, recorded.error, 'folded evidence preserves the original error')
   }
  }
  const benchmark = await cell.evaluate(cell => cell.parentElement.dataset.case)
  if (benchmark) {
   const environmentLabel = await cell.evaluate(cell => cell.closest('table').querySelector(`thead th[data-tool="${cell.dataset.tool}"] .environment`)?.textContent)
   if (environmentLabel) {
    assert(await panel.locator('.speed-clip').isVisible(), 'the benchmark environment stays visible with the clip')
    assert((await panel.locator('.speed-clip').textContent()).includes(environmentLabel), 'the popup retains its column’s benchmark environment')
   }
   const result = bench.results.find(b => b.adapter === adapter && b.case === benchmark)
   const records = (await panel.locator('.technical-details pre').allTextContents()).map(text => JSON.parse(text))
   if (result?.status !== 'pass' && result?.validation) {
    assert(records.some(raw => JSON.stringify(raw.validation) === JSON.stringify(result.validation)), 'failed timing retains its output-check evidence')
   }
   if (result?.error) assert(records.some(raw => raw.error === result.error), 'failed timing preserves the original error')
   if (result?.status === 'skip' && result.reason) assert(records.some(raw => raw.reason === result.reason), 'unmeasured timing preserves its recorded reason')
   if (result?.status === 'pass') assert(records.some(raw => raw.medianMs === result.medianMs && raw.p95Ms === result.p95Ms && JSON.stringify(raw.samplesMs) === JSON.stringify(result.samplesMs)), 'folded timing evidence preserves all samples and summary measurements')
   assert(await panel.locator(result ? '.bench-output' : '.case-state').isVisible(), 'speed cells show their result before technical details')
   if (result?.status === 'pass' && Number.isFinite(result.medianMs) && result.medianMs > 0) {
    const median = panel.locator('[data-stat="median"]')
    assert(await median.isVisible(), 'the median is the primary timing')
    assert.equal(Number(await median.getAttribute('data-ms')), result.medianMs, 'the visible median preserves its recorded value')
    assert.equal(await panel.locator('[data-stat]:visible').count(), 1, 'secondary timings stay folded')
    if (Number.isFinite(result.p95Ms) && result.p95Ms >= result.medianMs) assert.equal(Number(await panel.locator('.technical-details [data-stat="p95"]').getAttribute('data-ms')), result.p95Ms, 'folded Evidence preserves the 95th percentile')
    const samples = await panel.locator('.technical-details .speed-samples [data-call][data-ms]').evaluateAll(calls => calls.map(call => ({ call: Number(call.dataset.call), ms: Number(call.dataset.ms) })))
    const expectedSamples = (result.samplesMs || []).map((ms, index) => ({ call: index + 1, ms })).filter(sample => Number.isFinite(sample.ms) && sample.ms >= 0)
    assert.deepEqual(samples, expectedSamples, 'Evidence preserves sample order, original call numbers and zero values')
    assert(await panel.locator('.speed-samples [data-call][data-ms]').evaluateAll(calls => calls.every(call => Number(call.textContent) === Number(call.dataset.ms))), 'individual call values remain readable as exact numbers')
    assert.equal(await panel.locator('[data-call][data-ms]:visible').count(), 0, 'individual calls remain folded until requested')
   }
   const environment = result && benchmarkEnvironment(result)
   const peers = environment && result.status === 'pass' && result.medianMs > 0 ? bench.results.filter(b => b.case === benchmark && b.status === 'pass' && Number.isFinite(b.medianMs) && b.medianMs > 0 && benchmarkEnvironment(b) === environment) : []
   if (peers.length > 1) {
    const comparison = panel.locator('.speed-comparison')
    assert(await comparison.isVisible(), 'speed comparison is readable without relying on color')
    assert.match(await comparison.textContent(), /on this host/i)
    const ratio = await cell.getAttribute('data-speed-ratio')
    if (ratio) assert.equal(await comparison.getAttribute('data-speed-ratio'), ratio, 'the plain comparison preserves the table’s speed ratio')
    else assert.match(await comparison.textContent(), /same median/i, 'tied cohorts report their equal measurements')
   } else assert.equal(await panel.locator('.speed-comparison').count(), 0, 'unknown and singleton timings omit an empty comparison')
  }
  let collapsedBounds
  const firstCase = panel.locator('.popover-case').first()
  const hasCases = await firstCase.count()
  const initiallyOpen = await panel.locator('.popover-case[open]').count()
  if (hasCases) {
   const failed = runs.find(run => run.adapter === adapter)?.cases.some(c => c.feature === feature && ['fail', 'error'].includes(c.status)) || false
   assert.equal(initiallyOpen, failed ? 1 : 0, 'only a failing feature opens a case initially')
   assert.equal(await firstCase.evaluate(el => el.open), failed, 'passing and skipped cases start closed')
   if (failed) assert(['fail', 'error'].includes(await firstCase.locator('.case-output').getAttribute('data-status')), 'the initial case prioritizes a failure')
  }
  if (screenshot && !expandCase) await page.screenshot({ path: join(shots, screenshot) })
  if (expandCase) {
   assert(hasCases && !await firstCase.evaluate(el => el.open), 'passing cases stay closed until selected')
   collapsedBounds = await panel.boundingBox()
   assert(collapsedBounds.y + collapsedBounds.height < box.y, 'details open above a cell near the viewport bottom')
  }
  if (hasCases) {
   const values = await firstCase.locator('.metric-value').allTextContents()
   if (!await firstCase.evaluate(el => el.open)) await firstCase.locator(':scope > summary').click()
   await opened(); await visual()
   assert.deepEqual(await firstCase.locator('.metric-value:visible').allTextContents(), values, 'opening a passing case reveals its unchanged measured values')
   if (await firstCase.locator('.case-context').count()) assert(await firstCase.locator('.case-context').first().isVisible(), 'fixture context remains readable without chips')
   if (await firstCase.locator('.metric-grid').count()) {
    assert(await firstCase.locator('.metric-grid').isVisible(), 'the open case shows its measured result')
    assert(await firstCase.locator('.metric-value').count() > 0, 'measured results include a visible value')
   } else assert(await firstCase.locator('.case-state').isVisible(), 'a case without measurements shows its state without inventing numbers')
   await folded()
  }
  if (expandCase) {
   const expandedBounds = await panel.boundingBox()
   assert(expandedBounds.height > collapsedBounds.height, `opening a case grows the panel (${collapsedBounds.height} to ${expandedBounds.height}px)`)
   assert(expandedBounds.y + expandedBounds.height < box.y, 'expanded results remain above a cell near the viewport bottom')
  }
  if (await panel.locator('.popover-case').count() > 1) {
   const original = await firstCase.locator('.case-output').textContent(), secondCase = panel.locator('.popover-case').nth(1)
   await secondCase.locator(':scope > summary').click()
   assert(await secondCase.evaluate(el => el.open)); assert.equal(await firstCase.evaluate(el => el.open), false)
   assert.equal(await panel.locator('.popover-case[open]').count(), 1, 'opening another case closes the previous case')
   await opened()
   await firstCase.locator(':scope > summary').click()
   assert.equal(await secondCase.evaluate(el => el.open), false)
   assert.equal(await firstCase.locator('.case-output').textContent(), original, 'returning to the first case preserves its own metrics and evidence')
   await firstCase.locator(':scope > summary').click()
   assert.equal(await panel.locator('.popover-case[open]').count(), 0, 'all case details can be closed')
   await firstCase.locator(':scope > summary').click(); await opened(); await folded()
  }
  const technical = panel.locator('.case-output .technical-details, .bench-output .technical-details').first()
  if (await technical.count()) {
   assert.equal(await technical.locator(':scope > summary').textContent(), 'Evidence', 'raw records and reproduction files share one Evidence disclosure')
   const raw = await technical.locator('pre').allTextContents()
   await technical.locator(':scope > summary').click()
   assert(await technical.evaluate(el => el.open))
   for (const pre of await technical.locator('pre').all()) assert(await pre.isVisible(), 'opening technical details reveals the raw evidence')
   for (const value of await technical.locator('[data-stat], [data-call][data-ms]').all()) assert(await value.isVisible(), 'opening Evidence reveals secondary timings and individual calls')
   assert.deepEqual(await technical.locator('pre').allTextContents(), raw, 'revealing evidence does not change it')
   await opened()
   const body = panel.locator('.popover-body')
   if (await body.evaluate(el => el.scrollHeight > el.clientHeight)) {
    const close = panel.getByRole('button', { name: /close/i }), header = await close.boundingBox()
    await body.evaluate(el => { el.scrollTop = el.scrollHeight })
    assert(await body.evaluate(el => el.scrollTop > 0), 'long evidence scrolls inside the panel')
    await opened()
    assert.deepEqual(await close.boundingBox(), header, 'Close remains visible while evidence scrolls')
    await body.evaluate(el => { el.scrollTop = 0 })
   }
   await technical.locator(':scope > summary').click(); await opened(); await folded()
  }
  if (screenshot && expandCase) await page.screenshot({ path: join(shots, screenshot) })
  if (expandCase) {
   await firstCase.locator(':scope > summary').click()
   await page.waitForFunction(({ y, height }) => {
    const panel = document.getElementById('cell-popover'), box = panel.getBoundingClientRect()
    return !panel.querySelector('.popover-case').open && Math.abs(box.top - y) < 1 && Math.abs(box.height - height) < 1
   }, collapsedBounds)
   await opened()
  }
  if (await technical.count()) {
   if (await firstCase.count() && !await firstCase.evaluate(el => el.open)) await firstCase.locator(':scope > summary').click()
   if (!await technical.evaluate(el => el.open)) await technical.locator(':scope > summary').click()
  }
  await page.keyboard.press('Escape'); await closed()
  assert(await trigger.evaluate(el => document.activeElement === el), 'Escape restores focus to the cell trigger')
  for (const key of ['Enter', 'Space']) {
   await trigger.evaluate(el => el.focus({ preventScroll: true }))
   await page.keyboard.press(key); await opened(); await folded()
   assert.equal(await panel.locator('.popover-case[open]').count(), initiallyOpen, 'reopening restores the initial case disclosures')
   await page.keyboard.press('Escape'); await closed()
  }
  await trigger.click(); await opened(); await folded()
  await trigger.click(); await closed()
  await trigger.click(); await opened()
  await panel.getByRole('button', { name: /close/i }).click(); await closed()
  await trigger.click(); await opened()
  await page.mouse.click(2, 2); await closed()
  assert.deepEqual(await archive.locator('script.visual-template').allTextContents(), templates, 'cell popovers preserve inert archive graphics for later visits')
 }
 await mkdir(shots, { recursive: true })
 for (const width of [1440, 768, 414, 375, 320]) {
  await freshPage({ width, height: width > 700 ? 1000 : 844 }); await page.goto(url)
  await allSections(page); await readableText()
  assert.equal(await page.locator('#evidence .metric').count(), 0, 'archived metric rows do not populate the initial DOM')
  assert.equal(await page.locator('#speed-evidence svg').count(), 0, 'speed evidence has no decorative charts')
  if (width === 1440) await checkSpeedColors()
  if (width === 1440 || width === 375) await page.screenshot({ path: join(shots, `report-${width}.png`) })
  for (const panel of ['#feature-panel', '#speed-panel', '#basic-panel']) await checkMatrix(panel)
  if (width === 1440 || width === 375) {
   await page.evaluate(() => { const section = document.getElementById('speed'); scrollTo(0, section.offsetTop - 16) })
   await page.screenshot({ path: join(shots, `report-speed-${width}.png`) })
   await checkMatrix('#speed-panel')
   await page.screenshot({ path: join(shots, `report-speed-scrolled-${width}.png`) })
  }
 }
 for (const width of [1440, 375, 320]) {
  await freshPage({ width, height: width === 1440 ? 1000 : 844 }); await page.goto(url)
  for (let cycle = 0; cycle < 2; cycle++) for (const section of ['speed', 'basic-checks', 'features']) {
   await page.locator(`.contents a[href="#${section}"]`).click()
   assert.equal(new URL(page.url()).hash, `#${section}`)
   await allSections(page)
  }
  const partial = runs.flatMap(run => [...new Set(active.filter(c => c.level !== 'integrity').map(c => c.feature))].map(feature => ({ adapter: run.adapter, feature, value: featureResult(run.cases.filter(c => c.feature === feature), active.filter(c => c.feature === feature).length) }))).find(item => item.value.state === 'partial')
  if (partial) assert.equal(await page.locator(`.feature-row[data-feature="${partial.feature}"] td[data-tool="${partial.adapter}"]`).textContent(), partial.value.label)
  for (const selector of ['#feature-rows td.fail .result[data-popover]', '#feature-rows td.error .result[data-popover]', '#feature-rows td.pass .result[data-popover]', '#feature-rows td.skip .result[data-popover]', '#basic-rows .result[data-popover]', '.speed-row td[data-ms] .result[data-popover]', '.speed-row td.error .result[data-popover]', '.speed-row td.skip .result[data-popover]']) await checkPopover(selector, { screenshot: selector.includes('td.pass') ? `report-pass-${width}.png` : undefined })
  await checkPopover('#feature-rows td.fail .result[data-popover]', { bottom: true, screenshot: `report-failure-${width}.png` })
  await checkPopover('.speed-row td:last-child .result[data-popover]', { bottom: true, screenshot: `report-speed-detail-${width}.png` })
  const expandable = runs.flatMap(run => [...new Set(run.cases.map(c => c.feature))].map(feature => ({ adapter: run.adapter, feature, cases: run.cases.filter(c => c.feature === feature) }))).find(item => item.cases.length === 1 && item.cases[0].status === 'pass' && item.cases[0].metrics)
  if (expandable) await checkPopover(`.feature-row[data-feature="${expandable.feature}"] td[data-tool="${expandable.adapter}"] .result[data-popover]`, { bottom: true, expandCase: true, screenshot: `report-expanded-case-${width}.png` })
  if (width === 1440 && runs.length) {
   const original = page.locator('#feature-rows .result[data-popover]').first(), href = await original.getAttribute('href')
   const adapter = await original.locator('..').getAttribute('data-tool')
   await page.goto(url + href)
   await page.waitForFunction(href => document.activeElement === document.getElementById(href.slice(1))?.querySelector('summary'), href)
   const sourceCase = page.locator(`[id=${JSON.stringify(href.slice(1))}] .case-result`).first()
   const sourceTechnical = sourceCase.locator(`.case-output[data-tool="${adapter}"] .technical-details`)
   if (await sourceTechnical.count()) {
    await sourceCase.locator(':scope > summary').click()
    await sourceTechnical.locator(':scope > summary').click()
    assert(await sourceTechnical.evaluate(el => el.open), 'archive raw evidence is open before the cell is clicked')
   }
   await checkPopover('#feature-rows .result[data-popover]')
   assert.equal(new URL(page.url()).hash, href, 'same-hash cell clicks open locally without the legacy evidence jump')
   if (await sourceTechnical.count()) assert(await sourceTechnical.evaluate(el => el.open), 'opening the cell leaves archive disclosure state intact')
   await page.goto(url)
  }
  if (width === 1440 && runs.length > 1) {
   const first = page.locator('#feature-rows .feature-row').first().locator('.result[data-popover]').nth(0)
   const second = page.locator('#feature-rows .feature-row').first().locator('.result[data-popover]').nth(1)
   await first.evaluate(el => { const box = el.getBoundingClientRect(); scrollTo(0, box.top + scrollY - innerHeight / 3) })
   await first.click(); await page.waitForFunction(() => document.getElementById('cell-popover').matches(':popover-open'))
   await second.click(); await page.waitForFunction(() => document.querySelectorAll('.result[aria-expanded="true"]').length === 1)
   assert.equal(await first.getAttribute('aria-expanded'), 'false')
   assert.equal(await second.getAttribute('aria-expanded'), 'true')
   const adapter = await second.locator('..').getAttribute('data-tool')
   assert(await page.locator('#cell-popover .case-output[data-tool]').evaluateAll((outputs, adapter) => outputs.every(output => output.dataset.tool === adapter), adapter), 'switching cells replaces the previous tool evidence')
   await page.evaluate(() => scrollBy(0, 1))
   await page.waitForFunction(() => !document.getElementById('cell-popover').matches(':popover-open'))
   assert.equal(await second.getAttribute('aria-expanded'), 'false', 'page scrolling dismisses the panel')
   await second.click(); await page.waitForFunction(() => document.getElementById('cell-popover').matches(':popover-open'))
   await page.setViewportSize({ width: 1439, height: 1000 })
   await page.waitForFunction(() => !document.getElementById('cell-popover').matches(':popover-open'))
   assert.equal(await second.getAttribute('aria-expanded'), 'false', 'resizing dismisses the panel')
   await page.setViewportSize({ width: 1440, height: 1000 })
  }
  assert.equal(await page.locator('.matrix .bench-detail').count(), 0, 'speed details never expand the table')
  assert(await page.locator('td[data-ms] .result').evaluateAll(cells => cells.every(el => /^(\d+(\.\d+)?|<0\.01)$/.test(el.textContent.trim()))))
  for (const id of ['planned', 'evidence', 'ecosystem', 'methodology']) {
   const disclosure = page.locator(`details#${id}`)
   if (!await disclosure.isVisible()) continue
   await disclosure.locator(':scope > summary').click(); assert(await disclosure.evaluate(el => el.open))
   await readableText()
   await disclosure.locator(':scope > summary').click(); assert.equal(await disclosure.evaluate(el => el.open), false)
  }
  const failure = page.locator('#failures a[href^="#case-"]').first()
  if (await failure.count()) {
   await page.locator('#failures > summary').click()
   const href = await failure.getAttribute('href')
   const waitForCase = (focus = true) => page.waitForFunction(({ id, focus }) => { const el = document.getElementById(id); if (!el?.open || el.querySelector('script.visual-template')) return false; for (let p = el; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) return false; return !focus || document.activeElement === el.querySelector('summary') }, { id: href.slice(1), focus })
   await failure.click(); await waitForCase(); await readableText()
   assert(await page.locator(`[id=${JSON.stringify(href.slice(1))}] .metric`).count() > 0, 'archive hash navigation creates measurement rows for the selected case')
   await page.goto('about:blank'); await page.goto(url + href); await waitForCase(false)
  }
  for (const fragment of ['#missing-feature', '#%E0%A4%A']) { await page.goto('about:blank'); await page.goto(url + fragment); await allSections(page) }
  await page.goto(url); await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Skip to comparison')
  assert(await page.locator(':focus').evaluate(el => el.getBoundingClientRect().top >= 0))
  await page.keyboard.press('Enter'); assert.equal(new URL(page.url()).hash, '#features')
 }
 const brokenFragments = await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')).filter(href => href.length > 1 && !document.getElementById(decodeURIComponent(href.slice(1)))))
 assert.deepEqual(brokenFragments, [])
 for (const name of ['results.json', 'spec.json', 'ecosystem.json', ...(benchCases.length ? ['benchmarks.json'] : [])]) {
  assert(await page.locator(`a[href="${name}"]`).count() > 0)
  const response = await page.request.get(`${url}/${name}`); assert(response.ok())
  const data = await response.json(); if (name === 'results.json') assert.equal(data.runs.length, input.runs.length)
 }
 for (const selector of ['#failures a[href$="case.json"]', 'a[href$="input.wav"]']) {
  const artifact = page.locator(selector).first()
  if (await artifact.count()) assert((await page.request.get(new URL(await artifact.getAttribute('href'), url).href)).ok())
 }
 await page.close()
 const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 844 } })
 await staticPage.goto(url); await allSections(staticPage)
 await staticPage.locator('.contents a[href="#speed"]').click(); assert.equal(new URL(staticPage.url()).hash, '#speed')
 await staticPage.locator('#evidence > summary').click(); assert(await staticPage.locator('#evidence').evaluate(el => el.open))
 await staticPage.locator('#evidence > summary').click(); assert.equal(await staticPage.locator('#evidence').evaluate(el => el.open), false)
 for (const selector of ['#feature-rows .result[data-popover]', '.speed-row td[data-ms] .result[data-popover]', '.speed-row td.skip .result[data-popover]']) {
  const link = staticPage.locator(selector).first()
  if (!await link.count()) continue
  const href = await link.getAttribute('href')
  assert(href?.startsWith('#') && href.length > 1, 'cell has a real evidence link without JavaScript')
  await link.click(); assert.equal(new URL(staticPage.url()).hash, href)
  const evidence = staticPage.locator(`[id=${JSON.stringify(href.slice(1))}]`)
  assert(await evidence.isVisible(), 'linked evidence can be read without JavaScript')
  const recorded = await link.evaluate(el => ({ adapter: el.closest('td').dataset.tool, id: el.closest('tr').dataset.case }))
  const result = bench.results.find(b => b.adapter === recorded.adapter && b.case === recorded.id)
  if (result) {
   if (!await evidence.evaluate(el => el.open)) await evidence.locator(':scope > summary').click()
   const timed = result.status === 'pass' && Number.isFinite(result.medianMs) && result.medianMs > 0
   assert(await evidence.locator(timed ? '[data-stat="median"]' : '.speed-state').isVisible(), 'timing and status remain readable without JavaScript')
   assert.equal(await evidence.locator('.technical-details[open]').count(), 0, 'raw timing evidence stays folded without JavaScript')
   if (result.status === 'skip' && result.reason) assert((await evidence.locator('.technical-details pre').allTextContents()).some(text => JSON.parse(text).reason === result.reason), 'recorded skip reason remains available without JavaScript')
  }
 }
 await staticPage.close()
 const fallbackPage = await browser.newPage({ viewport: { width: 375, height: 844 } })
 await fallbackPage.addInitScript(() => { delete HTMLElement.prototype.showPopover })
 await fallbackPage.goto(url)
 for (const selector of ['#feature-rows .result[data-popover]', '.speed-row td[data-ms] .result[data-popover]', '.speed-row td.skip .result[data-popover]']) {
  const fallbackLink = fallbackPage.locator(selector).first()
  if (!await fallbackLink.count()) continue
  const href = await fallbackLink.getAttribute('href')
  await fallbackLink.click(); assert.equal(new URL(fallbackPage.url()).hash, href)
  const evidence = fallbackPage.locator(`[id=${JSON.stringify(href.slice(1))}]`)
  assert(await evidence.isVisible(), 'browsers without the Popover API retain evidence links')
  const recorded = await fallbackLink.evaluate(el => ({ adapter: el.closest('td').dataset.tool, id: el.closest('tr').dataset.case }))
  const result = bench.results.find(b => b.adapter === recorded.adapter && b.case === recorded.id)
  if (result) {
   if (!await evidence.evaluate(el => el.open)) await evidence.locator(':scope > summary').click()
   const timed = result.status === 'pass' && Number.isFinite(result.medianMs) && result.medianMs > 0
   assert(await evidence.locator(timed ? '[data-stat="median"]' : '.speed-state').isVisible(), 'timing and status remain readable without the Popover API')
   assert.equal(await evidence.locator('.technical-details[open]').count(), 0, 'raw timing evidence stays folded without the Popover API')
   if (result.status === 'skip' && result.reason) assert((await evidence.locator('.technical-details pre').allTextContents()).some(text => JSON.parse(text).reason === result.reason), 'recorded skip reason remains available without the Popover API')
  }
 }
 await fallbackPage.close()
 assert.deepEqual(errors, [])
 console.log(`Report verified: ${runs.length} contenders, ${behaviorCount} features, ${basicCount} basic checks, ${benchCases.length} speed cases; page scrolling, sticky labels and headers, contextual cell details, downloads, keyboard navigation, JavaScript disabled, Popover API fallback, and five viewport widths`)
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
