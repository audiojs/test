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
 const page = await browser.newPage(), errors = []
 page.setDefaultTimeout(10000)
 page.on('pageerror', error => errors.push(error.message))
 page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(`${response.status()} ${response.url()}`) })
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
   if (await page.locator('.speed-matrix').getAttribute('data-rankable') === 'false') assert.equal(await page.locator('.speed-matrix .fastest').count(), 0)
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
 await mkdir(shots, { recursive: true })
 for (const width of [1440, 768, 414, 375, 320]) {
  await page.setViewportSize({ width, height: width > 700 ? 1000 : 844 }); await page.goto(url)
  await allSections(page); await readableText()
  if (width === 1440 || width === 375) await page.screenshot({ path: join(shots, `report-${width}.png`) })
  for (const panel of ['#feature-panel', '#speed-panel', '#basic-panel']) await checkMatrix(panel)
  if (width === 1440 || width === 375) {
   await page.evaluate(() => { const section = document.getElementById('speed'); scrollTo(0, section.offsetTop - 16) })
   await page.screenshot({ path: join(shots, `report-speed-${width}.png`) })
   await checkMatrix('#speed-panel')
   await page.screenshot({ path: join(shots, `report-speed-scrolled-${width}.png`) })
  }
 }
 for (const width of [1440, 375]) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.goto(url)
  for (let cycle = 0; cycle < 2; cycle++) for (const section of ['speed', 'basic-checks', 'features']) {
   await page.locator(`.contents a[href="#${section}"]`).click()
   assert.equal(new URL(page.url()).hash, `#${section}`)
   await allSections(page)
  }
  const partial = runs.flatMap(run => [...new Set(active.filter(c => c.level !== 'integrity').map(c => c.feature))].map(feature => ({ adapter: run.adapter, feature, value: featureResult(run.cases.filter(c => c.feature === feature), active.filter(c => c.feature === feature).length) }))).find(item => item.value.state === 'partial')
  if (partial) assert.equal(await page.locator(`.feature-row[data-feature="${partial.feature}"] td[data-tool="${partial.adapter}"]`).textContent(), partial.value.label)
  for (const selector of ['.speed-row td[data-ms] .bench-detail', '.speed-row td.error .bench-detail']) {
   const detail = page.locator(selector).first()
   if (!await detail.count()) continue
   for (let cycle = 0; cycle < 2; cycle++) {
    await detail.locator('summary').click(); assert(await detail.evaluate(el => el.open))
    await detail.locator('summary').click(); assert.equal(await detail.evaluate(el => el.open), false)
   }
  }
  assert(await page.locator('td[data-ms] summary').evaluateAll(cells => cells.every(el => /^(\d+(\.\d+)?|<0\.01)$/.test(el.textContent.trim()))))
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
   const waitForCase = (focus = true) => page.waitForFunction(({ id, focus }) => { const el = document.getElementById(id); if (!el?.open) return false; for (let p = el; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) return false; return !focus || document.activeElement === el.querySelector('summary') }, { id: href.slice(1), focus })
   await failure.click(); await waitForCase(); await readableText()
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
 const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 844 } })
 await staticPage.goto(url); await allSections(staticPage)
 await staticPage.locator('.contents a[href="#speed"]').click(); assert.equal(new URL(staticPage.url()).hash, '#speed')
 await staticPage.locator('#evidence > summary').click(); assert(await staticPage.locator('#evidence').evaluate(el => el.open))
 await staticPage.locator('#evidence > summary').click(); assert.equal(await staticPage.locator('#evidence').evaluate(el => el.open), false)
 await staticPage.close()
 assert.deepEqual(errors, [])
 console.log(`Report verified: ${runs.length} contenders, ${behaviorCount} features, ${basicCount} basic checks, ${benchCases.length} speed cases; page scrolling, sticky labels and headers, evidence, downloads, keyboard navigation, JavaScript disabled, and five viewport widths`)
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
