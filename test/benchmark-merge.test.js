import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeBenchmarks } from '../src/merge-benchmarks.js'

const primaryHost = { platform: 'darwin', arch: 'arm64', cpu: 'Primary CPU' }
const containerHost = { platform: 'linux', arch: 'arm64', cpu: 'Container CPU' }
const definitions = [
 { id: 'reverse', fixture: { frames: 4800, channels: 1, sampleRate: 48000 }, steps: [{ op: 'reverse' }], oracle: { type: 'exact', atol: 1e-6 } },
 { id: 'gain', fixture: { frames: 4800, channels: 1, sampleRate: 48000 }, steps: [{ op: 'gain', value: .5 }], oracle: { type: 'exact', atol: 1e-6 } }
]
function run(adapters, host, generatedAt) {
 return {
  schema: 1, generatedAt, host, repeats: 7, scope: 'Includes adapter I/O',
  profiles: [{ id: 'short-mono', frames: 4800, channels: 1 }], fixtures: structuredClone(definitions),
  results: adapters.flatMap(adapter => definitions.map(fixture => ({ adapter, case: fixture.id, status: 'pass', version: `${adapter}-1.0`, metadata: { mode: 'native' }, medianMs: 1, validation: { pass: true } })))
 }
}

test('benchmark merge keeps 14 primary contenders plus Audacity with their own environments and sessions', () => {
 const names = Array.from({ length: 14 }, (_, i) => `tool-${i}`)
 const primary = run(names, primaryHost, '2026-01-02T00:00:00Z')
 primary.sessions = [
  { generatedAt: '2026-01-01T00:00:00Z', adapters: names.slice(0, 8), host: { ...primaryHost, node: 'v22' } },
  { generatedAt: primary.generatedAt, adapters: names.slice(8), host: { ...primaryHost, node: 'v24' } }
 ]
 primary.environments = { 'tool-0': { label: 'Recorded primary host', host: primaryHost, generatedAt: '2025-12-31T00:00:00Z' } }
 const audacity = run(['audacity'], containerHost, '2026-01-03T00:00:00Z')
 audacity.environments = { audacity: { label: 'Linux container' } }
 audacity.results[1] = { adapter: 'audacity', case: 'gain', status: 'fail', validation: { pass: false } }
 const before = structuredClone([primary, audacity]), merged = mergeBenchmarks([primary, audacity])
 assert.equal(merged.results.length, 30)
 assert.equal(new Set(merged.results.map(row => row.adapter)).size, 15)
 assert.deepEqual(merged.results.slice(0, 28), primary.results)
 assert.deepEqual(merged.results.slice(28), audacity.results)
 assert.equal(merged.results[29].medianMs, undefined, 'failed measurements stay without timings')
 assert.deepEqual(merged.sessions.slice(0, 2), primary.sessions)
 assert.deepEqual(merged.sessions[2], { generatedAt: audacity.generatedAt, adapters: ['audacity'], host: containerHost })
 assert.deepEqual(merged.environments['tool-0'], primary.environments['tool-0'])
 assert.equal(merged.environments['tool-1'].host.node, 'v22')
 assert.equal(merged.environments['tool-13'].host.node, 'v24')
 assert.equal(merged.environments['tool-1'].generatedAt, primary.sessions[0].generatedAt)
 assert.deepEqual(merged.environments.audacity, { label: 'Linux container', host: containerHost, generatedAt: audacity.generatedAt })
 assert.deepEqual([primary, audacity], before, 'source artifacts are unchanged')
})

test('benchmark merge refuses fixture, oracle and repetition mismatches', () => {
 const primary = run(['audio'], primaryHost, '2026-01-01')
 for (const mutate of [
  file => { file.repeats = 3 },
  file => { file.fixtures[0].fixture.frames++ },
  file => { file.fixtures[1].steps[0].value = .25 },
  file => { file.fixtures[0].oracle.atol = .1 },
  file => { file.fixtures.pop() },
  file => { file.profiles[0].channels = 2 },
  file => { file.scope = 'Excludes adapter I/O' }
 ]) {
  const audacity = run(['audacity'], containerHost, '2026-01-02')
  mutate(audacity)
  assert.throws(() => mergeBenchmarks([primary, audacity]), /Cannot merge/)
 }
 const reordered = run(['audacity'], containerHost, '2026-01-02')
 reordered.fixtures.reverse()
 assert.equal(mergeBenchmarks([primary, reordered]).results.length, 4, 'fixture order does not alter the workload')
})

test('benchmark merge rejects duplicate contenders, duplicate rows and undefined fixtures', () => {
 const primary = run(['audio'], primaryHost, '2026-01-01')
 assert.throws(() => mergeBenchmarks([primary, primary]), /Duplicate benchmark contender/)
 const duplicateRow = structuredClone(primary)
 duplicateRow.results.push(structuredClone(duplicateRow.results[0]))
 assert.throws(() => mergeBenchmarks([duplicateRow]), /Duplicate benchmark result/)
 const duplicateFixture = structuredClone(primary)
 duplicateFixture.fixtures.push(structuredClone(duplicateFixture.fixtures[0]))
 assert.throws(() => mergeBenchmarks([duplicateFixture]), /Duplicate benchmark fixtures/)
 const unknown = structuredClone(primary)
 unknown.results[0].case = 'not-recorded'
 assert.throws(() => mergeBenchmarks([unknown]), /Unknown benchmark fixture/)
})

test('an isolated Audacity artifact retains provenance when the primary speed artifact is absent', () => {
 const audacity = run(['audacity'], containerHost, '2026-01-02')
 const merged = mergeBenchmarks([audacity])
 assert.deepEqual(merged.results, audacity.results)
 assert.deepEqual(merged.environments.audacity.host, containerHost)
 assert.deepEqual(merged.sessions[0].adapters, ['audacity'])
 assert.throws(() => mergeBenchmarks([]), /No benchmark results/)
})

test('benchmark merge preserves separate overhead diagnostics from any input with their own host', () => {
 const first = run(['audio'], primaryHost, '2026-01-01')
 const second = run(['ffmpeg'], containerHost, '2026-01-02')
 second.overhead = [{ adapter: 'ffmpeg', host: containerHost, repeats: 7, results: [{ id: 'version-command', medianMs: 17 }] }]
 const merged = mergeBenchmarks([first, second])
 assert.deepEqual(merged.overhead, second.overhead)
 assert.equal(merged.results.find(row => row.adapter === 'ffmpeg').medianMs, 1, 'overhead never adjusts operation times')
 second.overhead.push(structuredClone(second.overhead[0]))
 assert.throws(() => mergeBenchmarks([first, second]), /Duplicate benchmark overhead/)
 second.overhead = [{ adapter: 'not-recorded' }]
 assert.throws(() => mergeBenchmarks([first, second]), /Unknown benchmark overhead/)
})
