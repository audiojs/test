import { isDeepStrictEqual } from 'node:util'

export function mergeBenchmarks(files) {
 if (!files.length) throw new Error('No benchmark results to merge')
 const base = files[0], results = [], sessions = [], environments = {}, adapters = new Set(), overhead = [], diagnosticAdapters = new Set()
 if (!Number.isInteger(base.repeats) || base.repeats < 3) throw new Error('Invalid benchmark repetition count')
 const fixtures = file => {
  const rows = [...file.fixtures].sort((a, b) => a.id.localeCompare(b.id))
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate benchmark fixtures')
  return rows
 }
 const definitions = fixtures(base), caseIds = new Set(definitions.map(row => row.id))
 for (const file of files) {
  if (file.schema !== base.schema || file.repeats !== base.repeats) throw new Error('Cannot merge benchmark schemas or repetition counts that differ')
  if (!isDeepStrictEqual(fixtures(file), definitions) || !isDeepStrictEqual(file.profiles, base.profiles) || file.scope !== base.scope) throw new Error('Cannot merge different benchmark fixtures or measurement scopes')
  const rows = new Set(), names = [...new Set(file.results.map(row => row.adapter))]
  for (const row of file.results) {
   if (!caseIds.has(row.case)) throw new Error(`Unknown benchmark fixture: ${row.case}`)
   const key = JSON.stringify([row.adapter, row.case])
   if (rows.has(key)) throw new Error(`Duplicate benchmark result: ${row.adapter} / ${row.case}`)
   rows.add(key)
  }
  const recordedSessions = file.sessions?.length ? file.sessions : [{ generatedAt: file.generatedAt, adapters: names, host: file.host }]
  for (const adapter of names) {
   if (adapters.has(adapter)) throw new Error(`Duplicate benchmark contender: ${adapter}`)
   adapters.add(adapter)
   const recorded = file.environments?.[adapter] || {}, session = recordedSessions.find(run => run.adapters?.includes(adapter))
   environments[adapter] = { ...recorded, host: recorded.host || session?.host || file.host, generatedAt: recorded.generatedAt || session?.generatedAt || file.generatedAt }
  }
  sessions.push(...recordedSessions)
  results.push(...file.results)
  for (const diagnostic of file.overhead || []) {
   if (!names.includes(diagnostic.adapter)) throw new Error(`Unknown benchmark overhead contender: ${diagnostic.adapter}`)
   if (diagnosticAdapters.has(diagnostic.adapter)) throw new Error(`Duplicate benchmark overhead: ${diagnostic.adapter}`)
   diagnosticAdapters.add(diagnostic.adapter)
   overhead.push(diagnostic)
  }
 }
 return { ...base, generatedAt: new Date().toISOString(), results, sessions, environments, overhead }
}
