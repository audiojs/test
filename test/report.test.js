import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { featureResult, generateReport } from '../src/report.js'
import { loadSpec } from '../src/spec.js'
import { benchmarkCases } from '../src/bench-cases.js'
import { encodeWav } from '../src/wav.js'

const outcomes = (...statuses) => statuses.map(status => ({ status }))

test('partially tested features retain the full case count', () => {
 const mixed = featureResult(outcomes('pass', 'pass', ...Array(6).fill('skip')), 8)
 assert.equal(mixed.state, 'partial')
 assert.equal(mixed.label, '◐ 2/8')
 const incomplete = featureResult(outcomes('pass', 'pass'), 8)
 assert.equal(incomplete.state, 'partial')
 assert.equal(incomplete.label, '◐ 2/8')
})

test('basic checks cannot produce a behavior-test pass', () => {
 const basic = featureResult(outcomes('pass', 'pass', 'pass'), 3, true)
 assert.notEqual(basic.state, 'pass')
 assert.equal(basic.label, '○ 3/3')
 const behavior = featureResult(outcomes('pass', 'pass', 'pass'), 3)
 assert.equal(behavior.state, 'pass')
 assert.equal(behavior.label, '✓ 3/3')
})

test('missing, failing and broken tests never look like a pass', () => {
 assert.equal(featureResult([], 3).label, '—')
 assert.equal(featureResult(outcomes('skip'), 1).label, '—')
 assert.equal(featureResult(outcomes('pass', 'fail'), 2).state, 'fail')
 assert.equal(featureResult(outcomes('pass', 'error'), 2).state, 'error')
})

test('the matrix preserves partial results and keeps plans in their own details', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-report-'))
 try {
  const spec = await loadSpec()
  const fade = spec.cases.filter(c => c.feature === 'edit.fade' && c.status === 'active')
  const basic = spec.cases.filter(c => c.feature === 'processor.compressor' && c.status === 'active')
  const reverse = spec.cases.filter(c => c.feature === 'edit.reverse' && c.status === 'active')
  assert(fade.length >= 8, 'fixture covers all fade curves')
  const reason = 'Missing <img src=x onerror="alert(1)"> & mapping'
  const cases = [
   ...fade.map((c, index) => ({ ...c, status: index < 2 ? 'pass' : 'skip', reason: index < 2 ? undefined : reason })),
   ...basic.map(c => ({ ...c, status: 'pass' })),
   { ...reverse[0], status: 'fail' },
   { ...reverse[1], status: 'error', error: 'Adapter stopped' }
  ]
  cases[0].artifact = 'artifacts/a&b/case.json'
  cases[0].metrics = { actual: '<unsafe>', expected: 1 }
  await mkdir(join(dir, 'results/artifacts/a&b'), { recursive: true })
  await writeFile(join(dir, 'results/artifacts/a&b/input.wav'), encodeWav([Float32Array.of(0, .5)]))
  const run = {
   adapter: 'audio', version: '2.9.0', platform: 'test', runtime: 'node',
   metadata: {}, cases,
   summary: { pass: 2 + basic.length, fail: 1, error: 1, skip: fade.length - 2 }
  }
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  const out = await generateReport({ generatedAt: '2026-09-30T00:00:00.000Z', specSha256: 'test', runs: [run] }, { root: dir })
  const html = await readFile(out.site, 'utf8')
  const matrix = html.match(/<tbody\b[^>]*id="feature-rows"[^>]*>([\s\S]*?)<\/tbody>/)?.[1]
  assert(matrix, 'main matrix exists')
  const row = id => [...matrix.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(m => m[0]).find(r => r.includes(`data-feature="${id}"`))
  assert.match(row('edit.fade'), /class="[^"]*\bpartial\b/)
  assert(row('edit.fade').includes(`◐ 2/${fade.length}`))
  assert.doesNotMatch(row('edit.fade'), /class="[^"]*\bpass\b/)
  const basicMatrix = html.match(/<tbody id="basic-rows">([\s\S]*?)<\/tbody>/)?.[1]
  assert(basicMatrix.includes(`○ ${basic.length}/${basic.length}`))
  assert(basicMatrix.includes('data-feature="processor.compressor"'))
  assert.equal(row('processor.compressor'), undefined, 'basic checks have a separate permanent table')
  assert.doesNotMatch(basicMatrix, /<td class="pass"/)
  const statuses = row('edit.reverse').match(/data-status="([^"]*)"/)[1].split(' ')
  assert(statuses.includes('fail'), 'a mixed result remains discoverable under Differences')
  assert(statuses.includes('error'), 'a mixed result remains discoverable under Errors')
  const plannedOnly = spec.features.features.filter(f => !spec.cases.some(c => c.feature === f.id && c.status === 'active'))
  for (const feature of plannedOnly) assert.equal(row(feature.id), undefined, 'wholly planned feature is absent from the matrix')
  assert(row('dynamics.compressor'), 'executable compressor tests are present in the matrix')
  assert.match(html, /<details\b[^>]*id="planned"/)
  assert.match(html, /<details\b[^>]*id="dynamics\.compressor"/)
  assert.match(html, /Missing &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; mapping/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;unsafe&gt;/)
  assert.match(html, /href="artifacts\/a&amp;b\/case\.json"/)
  assert.match(html, /href="artifacts\/a&amp;b\/input\.wav"/)
  assert.match(html, /No speed measurements yet\./)
  const exported = JSON.parse(await readFile(join(dir, 'site/spec.json'), 'utf8'))
  assert.deepEqual(exported, spec.cases, 'every original case remains available')
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('npm file origins and workspace builds remain distinct in both comparisons', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-origin-report-'))
 try {
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  const runs = [
   { adapter: 'registry-audio', metadata: { origin: 'file:///private/tmp/audio-parity.GTi638/contenders/npm/node_modules/audio/audio.js', source: { dirty: null, revision: null } } },
   { adapter: 'workspace-audio', metadata: { origin: 'file:///Users/div/projects/audio/audio.js', source: { dirty: false } } }
  ].map(run => ({ version: '2.9.0', platform: 'test', runtime: 'node', cases: [], summary: { pass: 0, fail: 0, error: 0, skip: 0 }, ...run }))
  await mkdir(join(dir, 'results'))
  await writeFile(join(dir, 'results/benchmarks.json'), JSON.stringify({
   generatedAt: '2026-09-30T00:00:00.000Z',
   results: runs.map(({ adapter, version, metadata }) => ({ adapter, version, metadata, case: 'gain-10s-stereo', status: 'pass', medianMs: 2 }))
  }))
  const input = { generatedAt: '2026-09-30T00:00:00.000Z', specSha256: 'test', runs }
  const out = await generateReport(input, { root: dir })
  const html = await readFile(out.site, 'utf8')
  const tables = [...html.matchAll(/<table\b[^>]*class="[^"]*\bmatrix\b[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map(m => m[1])
  assert.equal(tables.length, 3)
  for (const table of tables) {
   const headers = [...table.matchAll(/<th\b[^>]*scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1])
   const registry = headers.find(header => header.includes('registry-audio'))
   const workspace = headers.find(header => header.includes('workspace-audio'))
   assert.match(registry, /2\.9\.0/)
   assert.doesNotMatch(registry, /local build/)
   assert.match(workspace, /2\.9\.0 · local build/)
  }
  await writeFile(join(dir, 'results/benchmarks.json'), JSON.stringify({ generatedAt: input.generatedAt, results: [] }))
  await generateReport(input, { root: dir })
  assert.match(await readFile(out.site, 'utf8'), /No speed measurements yet\./)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('speed results keep their own contenders and versions', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-bench-report-'))
 try {
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  await mkdir(join(dir, 'results'))
  await writeFile(join(dir, 'results/benchmarks.json'), JSON.stringify({
   generatedAt: '2026-09-29T00:00:00.000Z', scope: 'Independent speed run', repeats: 3,
   host: { cpu: 'Benchmark machine' },
   overhead: [{ adapter: 'ffmpeg', results: [
    { id: 'version-command', title: 'Launch and print version', status: 'pass', medianMs: 16.123, samplesMs: [16, 16.123, 16.2] },
    { id: 'adapter-identity-stereo', title: 'Full adapter round trip', profileTitle: '1 s · stereo', status: 'pass', medianMs: 20.123 },
    { id: 'adapter-identity-short-mono', title: 'Failed diagnostic', status: 'error', medianMs: 999 },
    { id: 'read-discard-stereo', title: 'Read input', status: 'pass', medianMs: 18 }
   ] }],
   environments: {
    audio: { label: 'macOS native', host: { platform: 'darwin', arch: 'arm64', cpu: 'Native CPU' } },
    'benchmark-only': { label: 'Linux container', host: { platform: 'linux', arch: 'arm64', cpu: 'Container CPU' } }
   },
   results: [
    { adapter: 'audio', case: 'reverse-10s-stereo', status: 'skip' },
    { adapter: 'audio', case: 'gain-10s-stereo', status: 'pass', version: '9.8.7', medianMs: 2, metadata: { mode: 'Benchmark worker' } },
    { adapter: 'benchmark-only', case: 'gain-10s-stereo', status: 'pass', version: '4.5.6', medianMs: .0003, p95Ms: .0004 }
   ]
  }))
  const run = {
   adapter: 'audio', version: '1.2.3', platform: 'test', runtime: 'node',
   metadata: { origin: 'file:///local/audio.js' }, cases: [],
   summary: { pass: 0, fail: 0, error: 0, skip: 0 }
  }
  const out = await generateReport({ generatedAt: '2026-09-30T00:00:00.000Z', specSha256: 'test', runs: [run] }, { root: dir })
  const html = await readFile(out.site, 'utf8')
  const speed = html.match(/<table\b[^>]*class="[^"]*\bspeed-matrix\b[^"]*"[^>]*>([\s\S]*?)<\/table>/)?.[1]
  assert(speed, 'speed comparison exists')
  assert.match(speed, /benchmark-only/)
  assert.match(speed, /4\.5\.6/)
  assert.match(speed, /9\.8\.7/)
  assert.doesNotMatch(speed, /1\.2\.3|local build/)
  assert.match(speed, /Benchmark worker/)
  assert.match(speed, />&lt;0\.01<\/summary>/, 'positive sub-resolution times must not display as zero')
  assert.match(speed, /less than 0\.01 milliseconds/)
  assert.match(speed, /95th percentile: &lt;0\.01 ms/)
  assert.match(speed, /data-ms="0\.0003"/, 'fastest highlighting uses the unrounded measurement')
  assert.match(speed, /class="environment">Linux container/)
  assert.match(speed, /linux · arm64 · Container CPU/)
  assert.doesNotMatch(speed, /class="fastest"/, 'different environments must not share a fastest ranking')
  assert.match(html, /data-rankable="false"/)
  assert.match(html, /compare timings within one environment/)
  const overhead = html.match(/<details class="overhead">([\s\S]*?)<\/details>/)?.[1]
  assert(overhead, 'separate process and I/O costs are explained')
  assert.match(overhead, /Launch and print version: <strong>16\.12 ms/)
  assert.match(overhead, /Full adapter round trip · 1 s · stereo: <strong>20\.12 ms/)
  assert.match(overhead, /nothing is subtracted from the operation timings/)
  assert.doesNotMatch(overhead, /Failed diagnostic|999|Read input/)
  const exported = JSON.parse(await readFile(join(dir, 'site/benchmarks.json'), 'utf8'))
  assert.equal(exported.overhead[0].results.length, 4, 'every diagnostic remains in the download')
  assert.equal(exported.results.find(result => result.adapter === 'audio' && result.status === 'pass').medianMs, 2, 'diagnostics never adjust operation times')
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('empty and reference-only runs show an empty comparison without inventing measurements', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-empty-report-'))
 try {
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  const input = { generatedAt: '2026-09-30T00:00:00.000Z', specSha256: 'test', runs: [] }
  for (const benchmark of [undefined, null, { results: [] }]) {
   if (benchmark !== undefined) await writeFile(join(dir, 'results/benchmarks.json'), JSON.stringify(benchmark))
   const out = await generateReport(input, { root: dir })
   const html = await readFile(out.site, 'utf8')
   assert.match(html, /No tool results in this run\./)
   assert.match(html, /No speed measurements yet\./)
   assert.doesNotMatch(html, /<form|<input|<select|view-tab|<table/)
   for (const id of ['features', 'speed', 'basic-checks']) assert.match(html, new RegExp(`<section id="${id}"[^>]+>`))
   assert.match(html, /Features <small>0<\/small>/)
   assert.match(html, /Basic checks <small>0<\/small>/)
  }
  const out = await generateReport({ ...input, runs: [{ adapter: 'reference', cases: [] }] }, { root: dir })
  assert.match(await readFile(out.site, 'utf8'), /No tool results in this run\./)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('speed comparison preserves every operation, profile and tool without fixed dimensions', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-wide-report-'))
 try {
  const fixtures = benchmarkCases()
  const adapters = Array.from({ length: 14 }, (_, i) => `tool-${i}`)
  const measured = adapters.flatMap((adapter, i) => fixtures.map((fixture, j) => ({
   adapter, case: fixture.id, version: '1.2.3',
   status: i === 1 ? 'skip' : i === 2 ? 'fail' : 'pass',
   medianMs: i === 1 || i === 2 ? undefined : i + j + .5,
   p95Ms: i + j + 1,
   validation: i === 2 ? { pass: false, maxAbsError: .125 } : undefined
  })))
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  await mkdir(join(dir, 'results'))
  await writeFile(join(dir, 'results/benchmarks.json'), JSON.stringify({ fixtures, results: measured }))
  const out = await generateReport({ generatedAt: '2026-09-30T00:00:00.000Z', runs: [], specSha256: 'test' }, { root: dir })
  const html = await readFile(out.site, 'utf8')
  const speed = html.match(/<table\b[^>]*class="[^"]*\bspeed-matrix\b[^>]*>([\s\S]*?)<\/table>/)[1]
  const rows = [...speed.matchAll(/<tr class="speed-row"[^>]*>[\s\S]*?<\/tr>/g)].map(match => match[0])
  assert.equal(rows.length, fixtures.length)
  assert.equal(rows.filter(row => !row.slice(0, row.indexOf('>')).includes(' hidden')).length, fixtures.length, 'every clip is visible without selecting a profile')
  for (const fixture of fixtures) {
   const row = rows.find(row => row.includes(`data-case="${fixture.id}"`))
   assert(row.includes(fixture.title), 'operation title comes from the measured fixture')
   assert(row.includes(`data-profile="${fixture.profile}"`))
   assert(row.includes(fixture.profileTitle), 'clip duration and channels appear beside every operation')
   assert.equal([...row.matchAll(/<td\b/g)].length, adapters.length)
  }
  assert.equal([...speed.matchAll(/<th scope="col"/g)].length, adapters.length + 1)
  assert.doesNotMatch(html, /<input|<select|<form|view-tab|data-default-profile/)
  assert(html.indexOf('id="features"') < html.indexOf('id="speed"'))
  assert(html.indexOf('id="speed"') < html.indexOf('id="basic-checks"'))
  assert.match(html, /--tool-count:14/)
  assert.match(html, /maxAbsError/)
  assert.match(html, /0\.1 s · mono/)
  assert.match(html, /1 s · stereo/)
  assert.match(html, /10 s · stereo/)
  assert.doesNotMatch(html, /10 seconds of stereo audio/)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('speed columns follow correctness order and append benchmark-only tools', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-report-order-'))
 try {
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  await mkdir(join(dir, 'results'))
  const runs = ['second', 'first', 'correctness-only'].map(adapter => ({ adapter, version: '1.0.0', cases: [], summary: { pass: 0, fail: 0, error: 0, skip: 0 } }))
  await writeFile(join(dir, 'results/benchmarks.json'), JSON.stringify({ results: ['bench-only', 'first', 'second'].map(adapter => ({ adapter, version: '2.0.0', case: 'gain', status: 'pass', medianMs: 1 })) }))
  const out = await generateReport({ generatedAt: '2026-09-30T00:00:00.000Z', runs, specSha256: 'test' }, { root: dir })
  const html = await readFile(out.site, 'utf8')
  const speed = html.match(/<table\b[^>]*class="[^"]*\bspeed-matrix\b[^>]*>([\s\S]*?)<\/table>/)[1]
  const ids = [...speed.matchAll(/<th scope="col" data-tool="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(ids, ['second', 'first', 'bench-only'])
  assert.doesNotMatch(speed, /correctness-only/)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('case evidence combines ordinary skips while preserving custom reasons and measurements', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'audio-test-report-skips-'))
 try {
  const spec = await loadSpec(), fixture = spec.cases.find(c => c.status === 'active')
  const outcomes = [
   ['unmapped-a', { status: 'skip', reason: 'adapter has no equivalent mapping' }],
   ['unmapped-b', { status: 'skip', reason: 'No equivalent adapter mapping' }],
   ['custom-skip', { status: 'skip', reason: 'Requires <optional> extension' }],
   ['skip-with-data', { status: 'skip', reason: 'adapter has no equivalent mapping', metrics: { missingChannels: 2 } }],
   ['failed-tool', { status: 'fail', metrics: { maxAbsError: .25 }, artifact: 'artifacts/failed/case.json' }],
   ['broken-tool', { status: 'error', reason: 'Worker failed', error: 'Missing <binary>' }],
   ['passed-tool', { status: 'pass', metrics: { maxAbsError: 0 } }]
  ]
  const runs = outcomes.map(([adapter, result]) => ({ adapter, version: '1.0.0', cases: [{ ...fixture, ...result }], summary: { pass: 0, fail: 0, error: 0, skip: 0 } }))
  await writeFile(join(dir, 'README.md'), '<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  const input = { generatedAt: '2026-09-30T00:00:00.000Z', runs, specSha256: 'test' }
  const out = await generateReport(input, { root: dir })
  const html = await readFile(out.site, 'utf8')
  const evidence = html.slice(html.indexOf(`<details id="case-${fixture.id}"`)).split('</details>')[0]
  assert.match(evidence, /<p class="not-tested">Not tested: unmapped-a, unmapped-b\.<\/p>/)
  assert.doesNotMatch(evidence, /<strong>unmapped-[ab]:/)
  assert.match(evidence, /custom-skip: not tested/)
  assert.match(evidence, /Requires &lt;optional&gt; extension/)
  assert.match(evidence, /missingChannels/)
  assert.match(evidence, /maxAbsError/)
  assert.match(evidence, /artifacts\/failed\/case\.json/)
  assert.doesNotMatch(evidence, /Input WAV|input\.wav/, 'missing local WAV files never produce broken published links')
  assert.match(evidence, /Worker failed · Missing &lt;binary&gt;/)
  assert.match(evidence, /passed-tool: pass/)
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'site/results.json'), 'utf8')), input)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})
