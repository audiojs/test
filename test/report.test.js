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
 assert.equal(mixed.description, '2 passed. 6 tests were not run.')
 const incomplete = featureResult(outcomes('pass', 'pass'), 8)
 assert.equal(incomplete.state, 'partial')
 assert.equal(incomplete.label, '◐ 2/8')
})

test('basic checks cannot produce a behavior-test pass', () => {
 const basic = featureResult(outcomes('pass', 'pass', 'pass'), 3, true)
 assert.notEqual(basic.state, 'pass')
 assert.equal(basic.label, '○ 3/3')
 assert.match(basic.description, /All 3 tests passed\..*do not measure sound quality/)
 const behavior = featureResult(outcomes('pass', 'pass', 'pass'), 3)
 assert.equal(behavior.state, 'pass')
 assert.equal(behavior.label, '✓ 3/3')
})

test('missing, failing and broken tests never look like a pass', () => {
 assert.equal(featureResult([], 3).label, '—')
 assert.equal(featureResult(outcomes('skip'), 1).label, '—')
 assert.equal(featureResult(outcomes('pass', 'fail'), 2).state, 'fail')
 assert.equal(featureResult(outcomes('pass', 'error'), 2).state, 'error')
 assert.equal(featureResult(outcomes('fail'), 1).description, 'The test failed.')
 assert.equal(featureResult(outcomes('pass'), 1).description, 'The test passed.')
 assert.equal(featureResult([], 3).description, 'No results recorded for this tool.')
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
  assert.match(row('edit.fade'), /data-popover="feature"[^>]*href="#edit\.fade"/)
  assert.match(html, /id="cell-popover" popover="auto" role="dialog" aria-labelledby="cell-popover-tool cell-popover-title"/)
  assert.equal((html.match(/id="cell-popover"/g)||[]).length,1)
  assert.match(html, /<div id="evidence" class="cell-details">/)
  assert.doesNotMatch(html, /id="failures"|<summary>Results to investigate|<summary>Test details|<summary>Speed details/)
  assert.match(html, /class="case-output pass" data-tool="audio" data-status="pass"/)
  assert.match(html, /class="case-result" data-title="/)
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
   assert.match(workspace, /2\.9\.0, local build/)
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
    { adapter: 'audio', case: 'reverse-10s-stereo', status: 'skip', reason: 'No <reverse> & mapping' },
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
  const records=[...html.matchAll(/<details id="bench-\d+" class="bench-result">([\s\S]*?)<\/details>/g)].map(m=>m[1]).join('')
  assert.match(records, /Benchmark worker/)
  assert.match(speed, />&lt;0\.01<\/a>/, 'positive sub-resolution times must not display as zero')
  assert.match(speed, /less than 0\.01 milliseconds/)
  assert.match(records, /<dt>95th percentile<\/dt><dd>0\.0004 ms/)
  assert.match(records, /data-stat="median" data-ms="0\.0003"><strong>&lt;0\.01 <small>ms<\/small><\/strong> median/)
  assert.match(records, /data-stat="p95" data-ms="0\.0004"><dt>95th percentile<\/dt><dd>0\.0004 ms/)
  assert.match(records, /<details class="technical-details"><summary>Evidence<\/summary>/)
  const skipped=html.match(/<details id="bench-0" class="bench-result">([\s\S]*?)<\/details>/)?.[1]
  assert.match(skipped, /No &lt;reverse&gt; &amp; mapping/, 'skipped speed reasons remain readable without JavaScript')
  assert.doesNotMatch(skipped, /Median:|Output did not pass/)
  assert.match(speed, /class="skip" data-tool="audio"><a class="result" data-popover="speed" href="#bench-0"/)
  assert.match(speed, /href="#benchmark-method" data-description="Not measured"/, 'missing cells retain a method link')
  assert.doesNotMatch(speed, /<details|<summary/,'cell interaction must not expand a table row')
  for(const [,id] of speed.matchAll(/data-popover="speed" href="#(bench-\d+)"/g))assert(html.includes(`id="${id}" class="bench-result"`),'each measured cell retains its static evidence target')
  assert.match(speed, /data-ms="0\.0003"/, 'fastest highlighting uses the unrounded measurement')
  assert.match(speed, /class="environment">Linux container/)
  assert.match(records, /linux, arm64, Container CPU/)
  assert.doesNotMatch(speed, /class="speed-ranked"/, 'singleton environments have no relative ranking')
  assert.match(html, /data-rankable="false"/)
  assert.match(html, /compare timings within one environment/)
  const overhead = html.match(/<details class="overhead">([\s\S]*?)<\/details>/)?.[1]
  assert(overhead, 'separate process and I/O costs are explained')
  assert.match(overhead, /Launch and print version: <strong>16\.12 ms/)
  assert.match(overhead, /Full adapter round trip, 1 s, stereo: <strong>20\.12 ms/)
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
   assert(row.includes(fixture.profileTitle.replaceAll(' · ', ', ')), 'clip duration and channels appear beside every operation')
   assert.equal([...row.matchAll(/<td\b/g)].length, adapters.length)
  }
  assert.equal([...speed.matchAll(/<th scope="col"/g)].length, adapters.length + 1)
  assert.doesNotMatch(html, /<input|<select|<form|view-tab|data-default-profile/)
  assert(html.indexOf('id="features"') < html.indexOf('id="speed"'))
  assert(html.indexOf('id="speed"') < html.indexOf('id="basic-checks"'))
  assert.match(html, /--tool-count:14/)
  assert.match(html, /maxAbsError/)
  assert.match(html, /0\.1 s, mono/)
  assert.match(html, /1 s, stereo/)
  assert.match(html, /10 s, stereo/)
  assert.doesNotMatch(html, /10 seconds of stereo audio/)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})

test('speed colors compare measured ratios only within the same clip, host and session', async () => {
 const dir=await mkdtemp(join(tmpdir(),'audio-test-speed-colors-'))
 try{
  const host={platform:'darwin',arch:'arm64',os:'25.5',cpu:'Test CPU',logicalCpus:8,totalMemoryBytes:16000000000,node:'v24'},generatedAt='2026-10-01T01:00:00Z'
  const linux={...host,platform:'linux',os:'6.10',cpu:'Linux CPU'}
  const row=(adapter,medianMs,extra={},id='ratios')=>({adapter,case:id,status:'pass',version:'1.0.0',medianMs,p95Ms:medianMs*1.2,samplesMs:[medianMs,medianMs*1.2],...extra})
  const results=[
   row('audio',1),row('near',1.00001),row('ffmpeg',2,{metadata:{mode:'subprocess with float WAV I/O',dependencies:{unneededTree:'not repeated'}}}),
   row('four',4),row('sixteen',16),row('outlier',1e12),row('linux-one',.01),row('linux-two',.04),
   row('other-host',.001),row('other-session',.001),row('unknown-one',.001),row('unknown-two',.002),
   row('zero',0),row('negative',-1),row('infinite',Infinity),row('not-a-number',NaN),
   row('skipped',.0001,{status:'skip',reason:'No equivalent adapter mapping'}),
   row('failed',.0001,{status:'fail',validation:{pass:false,inputUnchanged:false}}),
   row('errored',.0001,{status:'error',error:'worker <failed>\nNative error details'}),
   row('audio',5,{},'equal'),row('ffmpeg',5,{},'equal'),row('four',5,{},'equal'),
   row('audio',.25,{},'singleton'),row('audio',100,{},'other-clip'),row('ffmpeg',200,{},'other-clip')
  ]
  const environments=Object.fromEntries([...new Set(results.map(r=>r.adapter))].map(adapter=>[adapter,{label:'macOS',host,generatedAt}]))
  for(const adapter of ['linux-one','linux-two'])environments[adapter]={label:'Linux',host:linux,generatedAt}
  environments['other-host']={label:'macOS',host:{...host,cpu:'Different CPU'},generatedAt}
  environments['other-session']={label:'macOS',host,generatedAt:'2026-10-01T02:00:00Z'}
  for(const adapter of ['unknown-one','unknown-two'])environments[adapter]={label:'Unknown',host:{}}
  const fixtures=['ratios','equal','singleton','other-clip'].map(id=>({id,title:id,profile:'short-mono',profileTitle:'0.1 s · mono',fixture:{frames:4800,sampleRate:48000,channels:1},steps:[{op:'gain',value:.5}],oracle:{type:'exact',atol:1e-6}}))
  await writeFile(join(dir,'README.md'),'<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  await mkdir(join(dir,'results'))
  await writeFile(join(dir,'results/benchmarks.json'),JSON.stringify({generatedAt,host,environments,fixtures,results}))
  const out=await generateReport({generatedAt,runs:[],specSha256:'test'},{root:dir}),html=await readFile(out.site,'utf8')
  const rows=[...html.matchAll(/<tr class="speed-row"[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0])
  const cell=(adapter,id='ratios')=>[...rows.find(row=>row.includes(`data-case="${id}"`)).matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/g)].map(m=>m[0]).find(cell=>cell.includes(`data-tool="${adapter}"`))
  const attr=(adapter,name,id)=>cell(adapter,id).match(new RegExp(`${name}="([^"]+)"`))?.[1]
  const hue=adapter=>Number(attr(adapter,'style').match(/--speed-hue:([\d.]+)/)[1])
  assert.match(html,/data-rankable="true"/,'mixed environments retain comparisons within each cohort')
  assert.deepEqual(['audio','ffmpeg','four','sixteen','outlier'].map(hue),[120,90,60,0,0],'log ratios are capped without flattening smaller differences')
  assert.deepEqual(['audio','ffmpeg','four','sixteen','outlier'].map(id=>Number(attr(id,'data-speed-ratio'))),[1,2,4,16,1e12])
  assert.equal(attr('audio','data-speed-cohort'),attr('ffmpeg','data-speed-cohort'))
  assert.notEqual(attr('audio','data-speed-cohort'),attr('linux-one','data-speed-cohort'))
  assert.equal(attr('linux-one','data-speed-cohort'),attr('linux-two','data-speed-cohort'))
  assert.equal(hue('linux-one'),120);assert.equal(hue('linux-two'),60)
  for(const adapter of ['other-host','other-session','unknown-one','unknown-two','zero','negative','infinite','not-a-number','skipped','failed','errored']){
   assert.doesNotMatch(cell(adapter),/speed-ranked|data-speed-ratio|--speed-hue/,adapter)
  }
  for(const adapter of ['zero','negative','infinite','not-a-number'])assert.doesNotMatch(cell(adapter),/data-ms=/,'invalid or zero times do not show a timing score')
  for(const adapter of ['audio','ffmpeg','four'])assert.doesNotMatch(cell(adapter,'equal'),/speed-ranked|data-speed-ratio/,'identical medians remain neutral')
  assert.doesNotMatch(cell('audio','singleton'),/speed-ranked|data-speed-ratio/)
  assert.equal(Number(attr('ffmpeg','data-speed-ratio','other-clip')),2,'each clip has its own baseline')
  const record=adapter=>html.split(`<details id="bench-${results.findIndex(r=>r.adapter===adapter)}" class="bench-result">`)[1].split('</details>')[0]
  assert.match(record('near'),/Less than 1% longer/,'near ties cannot round to an apparent exact tie')
  assert.match(record('ffmpeg'),/2× audio’s time on this host\./)
  assert.match(record('ffmpeg'),/class="speed-scope">Includes starting FFmpeg and reading\/writing files\./)
  assert.match(record('ffmpeg'),/<details class="technical-details"><summary>Evidence<\/summary>/)
  const visible=record('ffmpeg').split('<details class="technical-details">')[0]
  assert.match(visible,/data-stat="median" data-ms="2"><strong>2\.00 <small>ms<\/small><\/strong> median/)
  assert.equal([...visible.matchAll(/data-stat=/g)].length,1,'the median is the only prominent timing')
  assert.match(visible,/class="speed-comparison" data-speed-ratio="2">2× audio’s time on this host\./)
  assert.doesNotMatch(visible,/data-stat="p95"|data-call=|speed-peer|<svg|class="pill"|Unranked|Only result| · /,'secondary numbers and decorations do not compete with the result')
  assert.doesNotMatch(visible,/subprocess|samplesMs|medianMs|<pre>/,'raw data and execution mode stay folded')
  const evidence=record('ffmpeg').split('<details class="technical-details">')[1]
  assert.match(evidence,/data-stat="p95" data-ms="2\.4"><dt>95th percentile<\/dt><dd>2\.4 ms/)
  assert.match(evidence,/data-call="1" data-ms="2"[^>]*>2<\/span>, <span data-call="2" data-ms="2\.4"[^>]*>2\.4<\/span>/)
  for(const adapter of ['other-host','other-session','unknown-one','unknown-two'])assert.doesNotMatch(record(adapter).split('<details class="technical-details">')[0],/speed-comparison|Unranked|Only result/,'singleton and unknown environments have no empty comparison badge')
  assert.match(record('ffmpeg'),/subprocess with float WAV I\/O/)
  assert.doesNotMatch(record('ffmpeg'),/unneededTree|not repeated/,'dependency trees are retained only in the full download')
  assert.match(record('failed'),/original input|original audio|input audio/i)
  assert.match(record('failed'),/&quot;inputUnchanged&quot;: false/)
  assert.match(record('errored'),/worker &lt;failed&gt;\\nNative error details/,'raw multiline errors remain escaped and intact')
  assert.match(record('unknown-one'),/Host or run details are missing/)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('speed evidence preserves recorded samples, zeroes and missing measurements', async () => {
 const dir=await mkdtemp(join(tmpdir(),'audio-test-speed-evidence-'))
 try{
  const generatedAt='2026-10-01T01:00:00Z',host={platform:'darwin',arch:'arm64',cpu:'Test CPU'}
  const values=[
   {case:'empty',medianMs:1,p95Ms:2,samplesMs:[]},
   {case:'single',medianMs:5,p95Ms:5,samplesMs:[5]},
   {case:'zero',medianMs:0,p95Ms:0,samplesMs:[0,0]},
   {case:'gaps',medianMs:5,p95Ms:7,samplesMs:[0,null,-1,NaN,5,Infinity,7]},
   {case:'large',medianMs:Number.MAX_VALUE/2,p95Ms:Number.MAX_VALUE,samplesMs:[0,Number.MAX_VALUE/2,Number.MAX_VALUE]},
   {case:'missing-p95',medianMs:1,samplesMs:[1]},
   {case:'invalid-p95',medianMs:2,p95Ms:1,samplesMs:[2]},
   {case:'invalid-samples',medianMs:1,p95Ms:1,samplesMs:[null,-1,Infinity]}
  ]
  const results=values.map(value=>({adapter:'audio',status:'pass',version:'1.0.0',...value}))
  await writeFile(join(dir,'README.md'),'<!-- results:start --><!-- results:end -->\n<!-- features:start --><!-- features:end -->')
  await mkdir(join(dir,'results'))
  await writeFile(join(dir,'results/benchmarks.json'),JSON.stringify({generatedAt,host,results}))
  const out=await generateReport({generatedAt,runs:[],specSha256:'test'},{root:dir}),html=await readFile(out.site,'utf8')
  const record=id=>html.split(`<details id="bench-${values.findIndex(value=>value.case===id)}" class="bench-result">`)[1].split('</details>')[0]
  const samples=id=>[...record(id).matchAll(/<span data-call="(\d+)" data-ms="([^"]+)"[^>]*>([^<]+)<\/span>/g)].map(([,call,ms,text])=>({call:Number(call),ms:Number(ms),text}))
  assert.match(record('empty'),/Calls \(ms\)<\/dt><dd>Not recorded/)
  assert.match(record('invalid-samples'),/Calls \(ms\)<\/dt><dd>Not recorded/)
  assert.deepEqual(samples('empty'),[],'a median alone does not invent sample observations')
  assert.deepEqual(samples('single'),[{call:1,ms:5,text:'5'}],'one measured call is listed once')
  assert.deepEqual(samples('zero'),[{call:1,ms:0,text:'0'},{call:2,ms:0,text:'0'}])
  assert.match(record('zero'),/class="speed-state pass"><strong>No timing/,'zero median is not ranked or presented as a successful speed score')
  assert.deepEqual(samples('gaps').map(({call,ms})=>({call,ms})),[{call:1,ms:0},{call:5,ms:5},{call:7,ms:7}],'invalid samples neither become zero nor renumber later calls')
  assert.match(record('gaps'),/3 of 7 valid/)
  assert.deepEqual(samples('large').map(({ms})=>ms),[0,Number.MAX_VALUE/2,Number.MAX_VALUE])
  for(const id of ['single','zero','gaps','large'])for(const sample of samples(id))assert.equal(Number(sample.text),sample.ms,'displayed samples retain their exact recorded values')
  for(const id of ['missing-p95','invalid-p95'])assert.match(record(id),/data-stat="p95"><dt>95th percentile<\/dt><dd>Not recorded<\/dd>/,'unknown p95 is never synthesized from median or samples')
  for(const {case:id} of values){
   const visible=record(id).split('<details class="technical-details">')[0]
   assert.doesNotMatch(visible,/speed-comparison|data-stat="p95"|data-call=/,'only the main timing is visible for a single tool')
   assert.doesNotMatch(record(id),/speed-peer\b|<svg|class="pill"| · /,'plain evidence retains numbers without decorative graphics')
  }
 }finally{await rm(dir,{recursive:true,force:true})}
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
  const start=html.indexOf(`<details id="case-${fixture.id}"`),next=html.indexOf('<details id="case-',start+1)
  const evidence=html.slice(start,next<0?undefined:next)
  assert.match(evidence, /<p class="not-tested">Not tested: unmapped-a, unmapped-b\.<\/p>/)
  assert.doesNotMatch(evidence, /<strong>unmapped-[ab]:/)
  assert.match(evidence, /custom-skip: not tested/)
  assert.match(evidence, /Requires &lt;optional&gt; extension/)
  assert.match(evidence, /missingChannels/)
  assert.match(evidence, /maxAbsError/)
  assert.match(evidence, /artifacts\/failed\/case\.json/)
  assert.doesNotMatch(evidence, /Input WAV|input\.wav/, 'missing local WAV files never produce broken published links')
  assert.match(evidence, /Worker failed/)
  assert.match(evidence, /Missing &lt;binary&gt;/)
  assert.match(evidence, /passed-tool: pass/)
  assert.match(evidence, /<p class="case-explanation">[^<]+<\/p>/)
  assert.match(evidence, /<details class="technical-details"><summary>Evidence<\/summary>/)
  assert.doesNotMatch(evidence, /class="technical-details" open/)
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'site/results.json'), 'utf8')), input)
 } finally {
  await rm(dir, { recursive: true, force: true })
 }
})
