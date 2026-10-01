// Baselines acknowledge discrepancies; they never turn a failed measurement green.
import { readFile,writeFile } from 'node:fs/promises'
if(process.argv[2]!=='--accept'||!process.argv[3])throw new Error('Usage: node scripts/baseline.js --accept "review reason"')
const data=JSON.parse(await readFile('results/latest.json','utf8'))
if(data.runs.some(r=>!r.available||r.summary.error))throw new Error('Cannot baseline unavailable contenders or adapter errors')
const expected={},coverage={}
for(const r of data.runs){coverage[r.adapter]=r.cases.filter(c=>c.status!=='skip').map(c=>c.id);for(const c of r.cases.filter(c=>c.status==='fail'))expected[`${r.adapter}:${c.id}`]={reason:process.argv[3],metrics:c.metrics}}
await writeFile('results/baseline.json',JSON.stringify({schema:1,specSha256:data.specSha256,generatedAt:data.generatedAt,expected,coverage},null,2)+'\n')
console.log(`${Object.keys(expected).length} explicitly acknowledged discrepancies; errors are never allowlisted`)
