import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { runSuite } from './harness.js'
import { generateReport } from './report.js'
import { loadSpec } from './spec.js'
import { isolated } from './isolate.js'
import { createHash } from 'node:crypto'
import { provenance } from './provenance.js'
import { benchmark } from './benchmark.js'
import { contenders } from '../adapters/index.js'

const option = (args, name, fallback) => {
  const index = args.indexOf(name)
  return index < 0 ? fallback : args[index + 1]
}

const help = `Usage:
  audio-test run [--adapter all|reference,audio,ffmpeg,sox] [--tier smoke|core|quality|research]
                 [--case text] [--out results/latest.json] [--report-only]
  audio-test report [--input results/latest.json]
  audio-test bench [--adapter all|audio,ffmpeg,sox] [--repeats 7] [--case text] [--profile short-mono|stereo|long-stereo]
  audio-test merge result1.json result2.json [--out results/latest.json]
  audio-test gate [--input results/latest.json] [--baseline results/baseline.json]
  audio-test list`

export async function main(args) {
  const command = args[0] || 'help'
  if (command === 'help' || args.includes('--help')) { console.log(help); return }
  if(command==='bench'){
    const selected=option(args,'--adapter','all'),names=selected==='all'?contenders:selected.split(',')
    const result=await benchmark(names,Number(option(args,'--repeats',7)),{match:option(args,'--case',''),profile:option(args,'--profile','')})
    const out=resolve(option(args,'--out','results/benchmarks.json'));await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n')
    if(result.results.some(r=>r.status==='error'))process.exitCode=1
    return result
  }
  if(command==='merge'){
    const stop=args.indexOf('--out'),paths=args.slice(1,stop<0?undefined:stop)
    if(!paths.length)throw new Error('No result files')
    const files=await Promise.all(paths.map(async p=>JSON.parse(await readFile(p,'utf8'))))
    if(files.some(f=>f.specSha256!==files[0].specSha256||f.tier!==files[0].tier))throw new Error('Cannot merge different specifications or tiers')
    const runs=files.flatMap(f=>f.runs)
    if(new Set(runs.map(r=>r.adapter)).size!==runs.length)throw new Error('Duplicate contenders in merge')
    const result={...files[0],generatedAt:new Date().toISOString(),command:'audio-test merge '+paths.join(' '),runs}
    const out=resolve(option(args,'--out','results/latest.json'));await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');return result
  }
  if(command==='gate'){
    const result=JSON.parse(await readFile(option(args,'--input','results/latest.json'),'utf8'))
    const baseline=JSON.parse(await readFile(option(args,'--baseline','results/baseline.json'),'utf8'))
    const regressions=[]
    if(result.specSha256!==baseline.specSha256)regressions.push('Specification changed: review and regenerate the baseline explicitly')
    for(const name of Object.keys(baseline.coverage||{}))if(!result.runs.some(r=>r.adapter===name))regressions.push(`${name}: missing contender`)
    for(const r of result.runs){
      if(!r.available)regressions.push(`${r.adapter}: unavailable`)
      for(const id of baseline.coverage?.[r.adapter]||[])if(!r.cases.some(c=>c.id===id&&c.status!=='skip'))regressions.push(`${r.adapter}:${id} lost coverage`)
      for(const c of r.cases){
        const known=baseline.expected?.[`${r.adapter}:${c.id}`]
        if(c.status==='error'||c.status==='fail'&&!known)regressions.push(`${r.adapter}:${c.id} ${c.status}`)
        if(known&&c.status==='fail')for(const key of ['maxAbsError','absoluteError','lengthError','pitchError'])if(Number.isFinite(c.metrics?.[key])&&Number.isFinite(known.metrics?.[key])&&Math.abs(c.metrics[key])>Math.max(1e-6,Math.abs(known.metrics[key])*1.2))regressions.push(`${r.adapter}:${c.id} worsened ${key}`)
      }
    }
    console.log(regressions.length?regressions.join('\n'):'No new discrepancies or adapter errors')
    if(regressions.length)process.exitCode=1
    return regressions
  }

  if (command === 'list') {
    const spec = await loadSpec()
    for (const feature of spec.features.features) {
      const cases = spec.cases.filter(test => test.feature === feature.id)
      console.log(`${feature.id}\t${feature.class}\t${cases.filter(test => test.status === 'active').length} active\t${cases.filter(test => test.status === 'planned').length} planned`)
    }
    return
  }

  if (command === 'run') {
    const selected=option(args,'--adapter','reference'),names=selected==='all'?contenders:selected.split(',').filter(Boolean)
    if(!names.length)throw new Error('No adapters selected')
    const tier = option(args, '--tier', 'core'), match = option(args, '--case', '')
    const output = resolve(option(args, '--out', 'results/latest.json'))
    const runs=[]
    const spec=await loadSpec()
    const host=await provenance()
    const cases=spec.cases
    for(const name of names){
      const adapter=isolated(name,Number(option(args,'--timeout','30000')))
      try { runs.push({...await runSuite(adapter,{tier,match,cases,artifacts:resolve(dirname(output),'artifacts'),progress:(r,n,total)=>{if(n%100===0)console.error(`${name}: ${n}/${total}`)}}),host}) }
      finally {await adapter.close()}
    }
    const result = {
      schema: 2,
      specSha256: createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
      catalog: {features:spec.features.features.length,packages:spec.ecosystem.packages.length,active:cases.filter(c=>c.status==='active').length,planned:cases.filter(c=>c.status==='planned').length},
      generatedAt: new Date().toISOString(),
      tier,
      command: `audio-test run --adapter ${names.join(',')} --tier ${tier}${match?' --case '+match:''}`,
      runs
    }
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, JSON.stringify(result, null, 2) + '\n')
    for (const run of runs) console.log(`${run.adapter}@${run.version}: ${run.summary.pass} pass, ${run.summary.fail} fail, ${run.summary.error} error, ${run.summary.skip} skip`)
    if (runs.some(run=>!run.available||run.summary.error)||(!args.includes('--report-only')&&runs.some(run=>run.summary.fail))) process.exitCode = 1
    return result
  }

  if (command === 'report') {
    const input = resolve(option(args, '--input', 'results/latest.json'))
    const results = JSON.parse(await readFile(input, 'utf8'))
    const output = await generateReport(results, { root: process.cwd() })
    console.log(`Generated ${output.readme} and ${output.site}`)
    return output
  }

  throw new RangeError(`Unknown command: ${command}\n\n${help}`)
}
