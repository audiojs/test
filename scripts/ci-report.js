import { access,cp,readFile,writeFile } from 'node:fs/promises'
import { main } from '../src/cli.js'
import { mergeBenchmarks } from '../src/merge-benchmarks.js'

async function optional(path){
 try{await access(path);return true}catch(e){if(e.code!=='ENOENT')throw e;return false}
}
await cp('ci-results/primary/results','results',{recursive:true})
const paths=['results/latest.json']
if(await optional('ci-results/audacity/results'))await cp('ci-results/audacity/results','results',{recursive:true})
if(await optional('ci-results/audacity/results/audacity.json'))paths.push('results/audacity.json')
else console.error('Audacity did not produce a result; report explicitly leaves it unmeasured')
if(paths.length>1)await main(['merge',...paths,'--out','results/latest.json'])
const benches=[]
for(const [path,label] of [['ci-results/primary/results/benchmarks.json','Primary CI job'],['ci-results/audacity/results/audacity-benchmarks.json','Audacity CI job']]){
 if(!await optional(path))continue
 const bench=JSON.parse(await readFile(path,'utf8'))
 bench.environments=Object.fromEntries([...new Set(bench.results.map(row=>row.adapter))].map(adapter=>[adapter,{label,...bench.environments?.[adapter]}]))
 benches.push(bench)
}
if(benches.length)await writeFile('results/benchmarks.json',JSON.stringify(mergeBenchmarks(benches),null,2)+'\n')
await main(['report'])
