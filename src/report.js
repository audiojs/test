import { mkdir, readFile, writeFile, cp, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { loadSpec } from './spec.js'
import { caseCopy } from './report-copy.js'

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const cell = v => String(v ?? '').replaceAll('|','\\|').replaceAll('\n',' ')
const replace = (s,n,v) => s.replace(new RegExp(`<!-- ${n}:start -->[\\s\\S]*?<!-- ${n}:end -->`),`<!-- ${n}:start -->\n${v}\n<!-- ${n}:end -->`)
const counts = cases => ['pass','fail','error','skip'].map(s=>cases.filter(c=>c.status===s).length)
const repo = 'https://github.com/audiojs/test/blob/main/'
const milliseconds = value => value > 0 && value < .01 ? '<0.01' : value.toFixed(2)

export function featureResult(cases, expected=cases.length, basic=false) {
 const [pass,fail,error]=counts(cases),total=Math.max(expected,cases.length),missing=total-pass-fail-error
 const description=[
   fail&&(fail===total?(total===1?'The test failed.':`All ${total} tests failed.`):`${fail} of ${total} tests failed.`),
   error&&`${error} ${error===1?'test could':'tests could'} not finish.`,
   pass&&(pass===total?(total===1?'The test passed.':`All ${total} tests passed.`):`${pass} passed.`),
   missing&&cases.length&&`${missing} ${missing===1?'test was':'tests were'} not run.`,
   !cases.length&&'No results recorded for this tool.',
   basic&&'These checks cover valid output and unchanged input; they do not measure sound quality.'
 ].filter(Boolean).join(' ')
 if(error)return {state:'error',label:`! ${error} errors`,description}
 if(fail)return {state:'fail',label:`! ${fail} failed`,description}
 if(!pass)return {state:'skip',label:'—',description:description||'Not tested'}
 if(missing)return {state:'partial',label:`◐ ${pass}/${total}`,description}
 return {state:basic?'basic':'pass',label:`${basic?'○':'✓'} ${pass}/${total}`,description}
}

const labels = {
 'execution.identity':'Leave audio unchanged','execution.block-invariance':'Block boundary edits',
 'execution.channel-independence':'Keep channels separate','execution.composition':'Chain operations',
 'editor.fragment-isolation':'Keep the original intact','editor.copy-reverse':'Edit a copy',
 'editor.clip-reverse':'Edit a clip','editor.clone-reverse':'Edit a clone','editor.stream':'Stream audio',
 'edit.reverse-range':'Reverse a selection','edit.pad':'Add silence','edit.invert':'Invert polarity',
 'edit.gain':'Volume multiplier','edit.gain-db':'Volume in dB','level.gain':'Volume accuracy',
 'channels.swap':'Swap channels','channels.mono':'Mix to mono','channels.duplicate':'Mono to stereo',
 'analysis.min':'Lowest sample','analysis.max':'Highest sample','analysis.rms':'RMS level',
 'analysis.dc':'DC offset','analysis.zcr':'Zero-crossing rate','rate.varispeed':'Speed & pitch',
 'filter.lowpass':'Low-pass','filter.highpass':'High-pass','filter.bandpass':'Band-pass',
 'filter.allpass':'All-pass','filter.lowshelf':'Low shelf','filter.highshelf':'High shelf',
 'filter.lowpass1':'Low-pass, 1 pole','filter.highpass1':'High-pass, 1 pole','filter.eq':'Equalizer',
 'codec.wav':'Save and reopen WAV','codec.flac':'Save and reopen FLAC'
}
const featureName = f => labels[f.id] || (f.title.charAt(0).toUpperCase()+f.title.slice(1)).replaceAll('-', ' ')
const categoryName = c => ({Level:'Volume','Time and rate':'Time & pitch','Editor integrity':'Editor behavior','DSP invariants':'Bypass behavior',Execution:'Processing','Processor integrity':'Basic checks'})[c]||c
const categoryOrder = ['Codecs','Editing','Level','Channels','Filters','Dynamics','Effects','Restoration','Time and rate','Analysis','DSP invariants','Editor integrity','Execution','Processor integrity']
const shortVersion = r => {
 const version=String(r.version||'').match(/\d+\.\d+(?:\.\d+)?/)?.[0]
 const local=!r.metadata?.origin?.includes('/node_modules/')&&(r.metadata?.source?.dirty||r.metadata?.origin?.startsWith('file:'))
 return `${version||'Version unavailable'}${local?' · local build':''}`
}

export async function generateReport(results, options={}) {
 const root=options.root||process.cwd(),spec=await loadSpec(),runs=results.runs.filter(r=>r.adapter!=='reference')
 let registry=null;try{registry=JSON.parse(await readFile(join(root,'results/registry.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const active=spec.cases.filter(c=>c.status==='active'),integrity=active.filter(c=>c.level==='integrity').length
 const summary=`${spec.features.features.length} features · ${active.length-integrity} behavior tests · ${integrity} basic checks · ${spec.ecosystem.packages.length} packages`
 const md=['| Contender | Version | Conformance pass / run | Integrity pass / run | Fail | Error | Unmapped |','|---|---|---:|---:|---:|---:|---:|',...runs.map(r=>{
   const c=r.cases.filter(c=>c.level!=='integrity'&&c.status!=='skip'),i=r.cases.filter(c=>c.level==='integrity'&&c.status!=='skip')
   return `| ${cell(r.adapter)} | ${cell(r.version)} | ${c.filter(c=>c.status==='pass').length} / ${c.length} | ${i.filter(c=>c.status==='pass').length} / ${i.length} | ${r.summary.fail} | ${r.summary.error} | ${r.summary.skip} |`
 })].join('\n')
 let readme=await readFile(join(root,'README.md'),'utf8')
 readme=replace(readme,'results',`${summary}\n\nMeasured ${results.generatedAt}. Spec SHA-256: \`${results.specSha256}\`.\n\n${md}\n\nFailures are contract discrepancies pending triage, not automatically engine bugs. Unmapped is not unsupported. See [findings](results/FINDINGS.md) and [full report](site/index.html).`)
 const categories=[...new Set(spec.features.features.map(f=>f.category))]
 const hasPlans=spec.cases.some(c=>c.status==='planned')
 readme=replace(readme,'features',[`| Family | Features | Behavior tests | Basic checks |${hasPlans?' Planned tests |':''}`,`|---|---:|---:|---:|${hasPlans?'---:|':''}`,...categories.map(category=>{const fs=spec.features.features.filter(f=>f.category===category),cs=spec.cases.filter(c=>fs.some(f=>f.id===c.feature));return `| ${cell(categoryName(category))} | ${fs.length} | ${cs.filter(c=>c.status==='active'&&c.level!=='integrity').length} | ${cs.filter(c=>c.status==='active'&&c.level==='integrity').length} |${hasPlans?` ${cs.filter(c=>c.status==='planned').length} |`:''}`})].join('\n'))
 const findings=['# Contract discrepancies','',`Run: ${results.generatedAt}. No engine fixes are made by this repository.`,``,`Replay a case with its recorded contender version and source hash. WAV files are float32; differences below export quantization are not necessarily DSP bugs.`,``,...runs.flatMap(r=>r.cases.filter(c=>['fail','error'].includes(c.status)).map(c=>`## ${r.adapter}: ${c.id}\n\nStatus: ${c.status}.${c.level==='integrity'?' Integrity only.':''}\n\n\`node bin/audio-test.js run --adapter ${r.adapter} --tier ${spec.cases.find(test=>test.id===c.id)?.tier||results.tier||'research'} --case ${c.id}\`\n\n${c.artifact?`[Reproduction and metrics](${c.artifact})`:''}\n\n\`\`\`json\n${JSON.stringify(c.metrics||{error:c.error},null,2)}\n\`\`\`\n`))].join('\n')
 let bench=null;try{bench=JSON.parse(await readFile(join(root,'results/benchmarks.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const name = id => spec.contenders.contenders.find(c=>c.id===id)?.name||id
 const inputWav=artifact=>artifact.replace(/case\.json$/,'input.wav')
 const wavFiles=new Set((await Promise.all([...new Set(runs.flatMap(run=>run.cases.filter(result=>result.artifact?.endsWith('case.json')).map(result=>inputWav(result.artifact))))].map(async path=>{
   try{return (await stat(join(root,'results',path))).isFile()?path:null}catch(error){if(error.code==='ENOENT')return null;throw error}
 }))).filter(Boolean))
 const featureCases = f => spec.cases.filter(c=>c.feature===f.id)
 const isBasic = f => {const active=featureCases(f).filter(c=>c.status==='active');return active.length>0&&active.every(c=>c.level==='integrity')}
 const measured=spec.features.features.filter(f=>featureCases(f).some(c=>c.status==='active'))
 const planned=spec.features.features.filter(f=>!measured.includes(f))
 const groups=[...new Set(measured.map(f=>f.category))].sort((a,b)=>categoryOrder.indexOf(a)-categoryOrder.indexOf(b))
 const tableHead = (first='Feature',columns=runs) => `<colgroup><col class="feature-col">${columns.map(r=>`<col data-tool="${esc(r.adapter)}">`).join('')}</colgroup><thead><tr><th scope="col">${first}</th>${columns.map(r=>`<th scope="col" data-tool="${esc(r.adapter)}"><a href="${esc(spec.contenders.contenders.find(c=>c.id===r.adapter)?.url||'#methodology')}">${esc(name(r.adapter))}</a><small>${esc(shortVersion(r))}</small>${r.environmentLabel?`<small class="environment">${esc(r.environmentLabel)}</small>`:''}</th>`).join('')}</tr></thead>`
 const featureRows=basic=>runs.length?groups.map(category=>{
   const fs=measured.filter(f=>f.category===category&&isBasic(f)===basic)
   if(!fs.length)return ''
   return `<tr class="group-row" data-group="${esc(category)}"><th colspan="${runs.length+1}" scope="rowgroup"><span class="group-label">${esc(categoryName(category))}</span></th></tr>`+fs.map(f=>{
     const cs=featureCases(f).filter(c=>c.status==='active')
     const reported=runs.map(r=>r.cases.filter(c=>c.feature===f.id))
     const values=reported.map(cases=>featureResult(cases,cs.length,basic))
     const statuses=[...new Set([...values.map(v=>v.state),...reported.flat().filter(c=>['fail','error'].includes(c.status)).map(c=>c.status)])]
     return `<tr class="feature-row" data-feature="${esc(f.id)}" data-scope="${basic?'integrity':'behavior'}" data-status="${statuses.join(' ')}"><th scope="row"><a href="#${esc(f.id)}">${esc(featureName(f))}</a></th>${values.map((v,i)=>`<td class="${v.state}" data-tool="${esc(runs[i].adapter)}"><a class="result" data-popover="feature" data-description="${esc(v.description)}" href="#${esc(f.id)}" aria-label="${esc(`${name(runs[i].adapter)}, ${featureName(f)}: ${v.description}`)}">${v.label}</a></td>`).join('')}</tr>`
   }).join('')
 }).join(''):''
 const caseEvidence = test => {
   const skipped=[],outputs=[]
   const defaultReasons=new Set(['','adapter has no equivalent mapping','No equivalent adapter mapping'])
   for(const run of runs){
     const result=run.cases.find(c=>c.id===test.id)
     if(!result)continue
     if(result.status==='skip'&&defaultReasons.has(result.reason||'')&&!result.error&&!result.metrics&&!result.artifact){
       skipped.push(name(run.adapter));continue
     }
     const copy=caseCopy(test,result)
     const raw={...(result.metrics==null?{}:{metrics:result.metrics}),...(result.reason?{reason:result.reason}:{}),...(result.error?{error:result.error}:{})}
     outputs.push(`<div class="case-output ${esc(result.status)}" data-tool="${esc(run.adapter)}" data-status="${esc(result.status)}"><p class="case-tool"><strong>${esc(name(run.adapter))}: ${esc(result.status==='skip'?'not tested':result.status)}</strong></p><p class="case-explanation">${esc(copy.summary)}</p>${result.artifact?`<p class="case-artifacts"><a href="${esc(result.artifact)}">Reproduction files</a>${wavFiles.has(inputWav(result.artifact))?` · <a href="${esc(inputWav(result.artifact))}">Input WAV</a>`:''}</p>`:''}<details class="technical-details"><summary>Technical details</summary><p><code>${esc(test.id)}</code></p>${Object.keys(raw).length?`<pre>${esc(JSON.stringify(raw,null,2))}</pre>`:''}</details></div>`)
   }
   if(skipped.length)outputs.push(`<p class="not-tested">Not tested: ${skipped.map(esc).join(', ')}.</p>`)
   return outputs.join('')
 }
 const contract = f => {
   const cs=featureCases(f),method=cs.find(c=>c.steps?.length)?.steps[0]?.op
   const files={reverse:'reverse','reverse-range':'reverse',trim:'crop',remove:'remove',pad:'pad',repeat:'repeat',gain:'gain','gain-db':'gain',fade:'fade',mix:'mix',insert:'insert',crossfade:'crossfade',normalize:'normalize',lowpass:'filter',highpass:'filter',bandpass:'filter',notch:'filter',allpass:'filter',eq:'filter',resample:'resample',stretch:'stretch',pitch:'pitch',speed:'speed'}
   const source=f.url||(files[method]?`https://github.com/audiojs/audio/blob/main/fn/${files[method]}.js`:'https://github.com/audiojs/audio')
   return `<details id="${esc(f.id)}" class="contract"><summary>${esc(featureName(f))} <small>${cs.length} tests</small></summary><p>${esc(f.contract)}</p><p class="case-tools"><a href="#features">Back to comparison</a> · <a href="${esc(source)}">audio API</a> · <a href="${repo}src/catalog.js">Case definitions</a> · <a href="${repo}src/oracles.js">Expected results</a></p><p><code>${esc(f.id)}</code> · ${esc(f.class)}</p>${cs.map(c=>{const title=esc(caseCopy(c).title);return `<details id="case-${esc(c.id)}" class="case-result" data-title="${title}"><summary>${title} <small>${c.status==='planned'?'Planned':esc(c.oracle.type)}</small></summary>${caseEvidence(c)}<details class="technical-details"><summary>Test definition</summary><pre>${esc(JSON.stringify(c,null,2))}</pre><pre>node bin/audio-test.js run --adapter audio --tier ${esc(c.tier||'research')} --case ${esc(c.id)}</pre></details></details>`}).join('')}</details>`
 }
 const methodLink = method => {
   const id=['processor','analysis','edit','filter','rate'].map(prefix=>`${prefix}.${method.name}`).find(id=>spec.features.features.some(f=>f.id===id))
   return id?`<a href="#${esc(id)}">${esc(method.name)}</a>`:esc(method.name)
 }
 const pkgRows=spec.ecosystem.packages.map(p=>{
   const methods=spec.ecosystem.methods.filter(m=>m.module.replace(/\/audio$/,'')===p.name)
   return `<li class="package-entry"><details><summary>${esc(p.name)} <small>${esc(p.description)}</small></summary><p><a href="${esc(p.url)}">${esc(p.name)}</a> ${esc(p.version)}</p>${methods.length?`<p>Methods: ${methods.map(methodLink).join(', ')}</p>`:''}<p>Planned tests: ${p.proposedTests.map(esc).join('; ')}</p></details></li>`
 }).join('')
 const inventories=spec.competitorInventory.contenders.map(c=>`<details><summary>${esc(name(c.id))} <small>${c.features.length} ${c.curated?'listed operations':'features'}</small></summary><p><a href="${esc(c.source)}">API / manual</a>${c.curated?'':' · '+esc(c.version||'Version in run details')}</p>${c.blocker?`<p>${esc(c.blocker)}</p>`:''}<ul>${c.features.map(f=>`<li><strong>${esc(f.name)}</strong>${f.proposedTests.length?' — '+f.proposedTests.map(esc).join('; '):''}</li>`).join('')}</ul></details>`).join('')
 const benchResults=bench?.results||[]
 const benchIds=[...new Set(benchResults.map(b=>b.adapter))]
 const benchOrder=[...runs.map(r=>r.adapter).filter(id=>benchIds.includes(id)),...benchIds.filter(id=>!runs.some(r=>r.adapter===id))]
 const benchRuns=benchOrder.map(adapter=>({...benchResults.find(b=>b.adapter===adapter&&b.version)||benchResults.find(b=>b.adapter===adapter)||{adapter}}))
 const environmentIds=new Map()
 const benchEnvironments=new Map(benchRuns.map(run=>{
   const recorded=bench.environments?.[run.adapter],session=bench.sessions?.find(s=>s.adapters?.includes(run.adapter)),host=recorded?.host||session?.host||run.host||bench.host||{}
   const label=recorded?.label||({darwin:'macOS',linux:'Linux',win32:'Windows'})[host.platform]||host.platform||'Recorded host'
   const generatedAt=recorded?.generatedAt||session?.generatedAt||bench.generatedAt
   const fingerprint=JSON.stringify([label,host.platform,host.arch,host.os,host.cpu,host.logicalCpus,host.totalMemoryBytes,host.node,generatedAt])
   const known=host.platform&&host.arch&&host.cpu&&host.cpu!=='unknown'&&generatedAt,key=known?fingerprint:null
   if(key&&!environmentIds.has(key))environmentIds.set(key,`speed-environment-${environmentIds.size}`)
   return [run.adapter,{label,host,generatedAt,fingerprint,key,id:environmentIds.get(key)}]
 }))
 const mixedEnvironments=new Set([...benchEnvironments.values()].map(e=>e.fingerprint)).size>1
 if(mixedEnvironments)for(const run of benchRuns)run.environmentLabel=benchEnvironments.get(run.adapter).label
 const environmentDetails=adapter=>{const environment=benchEnvironments.get(adapter);return mixedEnvironments?[environment.label,environment.host.platform,environment.host.arch,environment.host.cpu].filter(Boolean).join(' · '):''}
 const benchCases=[...new Set(benchResults.map(b=>b.case))].map(id=>{
   const definition=bench.fixtures?.find(f=>f.id===id)||{},clip=definition.fixture||{}
   const profile=definition.profile||'recorded'
   const profileTitle=definition.profileTitle||(clip.frames&&clip.sampleRate?`${clip.frames/clip.sampleRate} s · ${clip.channels===1?'mono':clip.channels===2?'stereo':`${clip.channels} channels`}`:'Recorded clip')
   const title=definition.title||({reverse:'Reverse',gain:'Adjust volume','gain-db':'Adjust volume',lowpass:'Low-pass filter',resample:'Resample'})[definition.steps?.[0]?.op]||id
   return {id,title,profile,profileTitle,group:definition.group||'Operations'}
 })
 const benchGroups=[...new Set(benchCases.map(c=>c.group))]
 const benchRecords=new Map(benchResults.map((b,i)=>[b,`bench-${i}`]))
 const timed=b=>b?.status==='pass'&&Number.isFinite(b.medianMs)&&b.medianMs>0
 const cohorts=new Map(),comparisons=new Map()
 for(const b of benchResults){
   const environment=benchEnvironments.get(b.adapter)
   if(!timed(b)||!environment.key)continue
   const key=JSON.stringify([b.case,environment.key])
   if(!cohorts.has(key))cohorts.set(key,[])
   cohorts.get(key).push(b)
 }
 for(const peers of cohorts.values()){
   const best=Math.min(...peers.map(b=>b.medianMs)),fastest=peers.filter(b=>b.medianMs===best)
   const ranked=peers.length>1&&fastest.length<peers.length
   for(const b of peers)comparisons.set(b,{count:peers.length,fastest,ranked,ratio:b.medianMs/best,hue:120*(1-Math.min(1,Math.max(0,Math.log2(b.medianMs)-Math.log2(best))/4))})
 }
 const comparisonText=b=>{
   if(!timed(b))return ''
   const environment=benchEnvironments.get(b.adapter),comparison=comparisons.get(b)
   if(!environment.key)return 'Host or run details are missing; relative speed is not compared.'
   if(!comparison||comparison.count<2)return `No other passing timing for this clip on ${environment.label} in this run.`
   if(!comparison.ranked)return `All ${comparison.count} passing tools recorded the same median for this clip on ${environment.label}.`
   const context=`${comparison.count} passing tools for this clip on ${environment.label} in this run`
   if(comparison.ratio===1)return `${comparison.fastest.length>1?'Joint fastest':'Fastest'} of ${context}.`
   if(comparison.ratio<1.01)return `Less than 1% longer than the fastest result (${name(comparison.fastest[0].adapter)}). Compared with ${context}.`
   const ratio=Number.isFinite(comparison.ratio)?Number(comparison.ratio.toPrecision(3)).toLocaleString('en-US',{maximumFractionDigits:3}):'over 10³⁰⁸'
   return `Takes ${ratio}× as long as the fastest result (${name(comparison.fastest[0].adapter)}). Compared with ${context}.`
 }
 const benchDetails=b=>{
   const valid=timed(b),comparison=comparisonText(b),fixture=bench.fixtures?.find(test=>test.id===b.case)
   const variability=Number.isFinite(b.p95Ms)&&b.p95Ms>=b.medianMs
   let explanation
   if(valid)explanation=`Typically <strong>${esc(milliseconds(b.medianMs))} ms</strong> per call (median).${variability?` 95% of measured calls finished within <strong>${esc(milliseconds(b.p95Ms))} ms</strong>.`:''}`
   else if(b.status==='skip')explanation=esc(b.reason&&!['No equivalent adapter mapping','adapter has no equivalent mapping'].includes(b.reason)?b.reason:'This operation has not been connected to this tool.')
   else if(b.status==='error')explanation=esc(caseCopy(fixture||{},b).summary)
   else if(b.status==='pass')explanation='No positive timing was recorded.'
   else explanation=esc(fixture?caseCopy(fixture,{status:'fail',metrics:b.validation}).summary:'The output did not pass the accuracy check.')+' Timing is excluded.'
   const scope=valid&&['ffmpeg','sox','rubberband','soundtouch'].includes(b.adapter)?`<p>Includes starting ${esc(name(b.adapter))} and reading/writing audio files.</p>`:''
   const details=[`${name(b.adapter)} · ${shortVersion(b)}`,b.metadata?.mode,environmentDetails(b.adapter),valid&&`Median: ${b.medianMs} ms`,valid&&variability&&`95th percentile: ${b.p95Ms} ms`,valid&&Number.isFinite(b.driverMaxRssMiB)&&`Driver peak memory: ${b.driverMaxRssMiB} MiB`].filter(Boolean)
   const {metadata,host,...technical}=b
   return `<div class="bench-output"><p class="bench-explanation">${explanation}</p>${comparison?`<p class="speed-comparison">${esc(comparison)}</p>`:''}${scope}<details class="technical-details"><summary>Technical details</summary><p>${details.map(esc).join('<br>')}</p><pre>${esc(JSON.stringify(technical,null,2))}</pre><p><a href="benchmarks.json">All samples and measurements</a></p></details></div>`
 }
 const benchCell=(b,adapter)=>{
   const data=`data-tool="${esc(adapter)}"`
   const target=`class="result" data-popover="speed" href="#${b?benchRecords.get(b):'benchmark-method'}"`
   if(!b||b.status==='skip')return `<td class="skip" ${data}><a ${target}${b?'':' data-description="Not measured"'} aria-label="${esc(`${name(adapter)}: not measured`)}">—</a></td>`
   if(!timed(b))return `<td class="error" ${data}><a ${target}>${esc(b.status==='fail'?'Failed check':b.status==='error'?'Error':'No timing')}</a></td>`
   const timing=milliseconds(b.medianMs),comparison=comparisons.get(b),environment=benchEnvironments.get(adapter)
   const heat=comparison?.ranked?` class="speed-ranked" data-speed-ratio="${comparison.ratio}" data-speed-cohort="${environment.id}" style="--speed-hue:${comparison.hue.toFixed(3)}"`:''
   return `<td ${data} data-ms="${b.medianMs}"${heat}><a ${target} aria-label="${esc(`${name(adapter)}: ${timing.replace('<','less than ')} milliseconds. ${comparisonText(b)}`)}">${esc(timing)}</a></td>`
 }
 const benchEvidence=[...benchRecords].map(([b,id])=>{
   const c=benchCases.find(c=>c.id===b.case)
   return `<details id="${id}" class="bench-result"><summary>${esc(name(b.adapter))} · ${esc(c.title)} · ${esc(c.profileTitle)}</summary>${benchDetails(b)}</details>`
 }).join('')
 const overheadHtml=(bench?.overhead||[]).map(run=>{
   const measured=(run.results||[]).filter(result=>result.status==='pass'&&Number.isFinite(result.medianMs)&&(result.id==='version-command'||result.id.startsWith('adapter-identity-')))
   if(!measured.length)return ''
   return `<details class="overhead"><summary>${esc(name(run.adapter))} call overhead</summary><p>Each call starts a process and exchanges WAV files. An unchanged clip measures that round trip.</p><ul>${measured.map(result=>`<li>${esc(result.title)}${result.profileTitle?` · ${esc(result.profileTitle)}`:''}: <strong>${esc(milliseconds(result.medianMs))} ms</strong></li>`).join('')}</ul><p>Separate measurements; nothing is subtracted from the operation timings. <a href="benchmarks.json">Samples and environment</a></p></details>`
 }).join('')
 const rankable=[...comparisons.values()].some(c=>c.ranked)
 const benchHtml=benchCases.length?`<p class="note">Median milliseconds for the whole adapter call; lower is faster.</p><p class="note speed-scale">Green → yellow → red: fastest, 4× as long, 16× or more. Colors compare the same clip, host and run.</p>${mixedEnvironments?'<p class="note environment-note">Runs use different environments; compare timings within one environment.</p>':''}<div class="table-wrap"><table class="matrix speed-matrix" aria-label="Speed comparison" data-rankable="${rankable}" style="--tool-count:${benchRuns.length}">${tableHead('Operation / clip',benchRuns)}<tbody>${benchGroups.map(group=>{
   const groupCases=benchCases.filter(c=>c.group===group)
   const cases=[...new Set(groupCases.map(c=>c.title))].flatMap(title=>groupCases.filter(c=>c.title===title))
   return `<tr class="group-row" data-group="${esc(group)}"><th colspan="${benchRuns.length+1}" scope="rowgroup"><span class="group-label">${esc(group)}</span></th></tr>`+cases.map(c=>{
     const bs=benchRuns.map(r=>benchResults.find(b=>b.case===c.id&&b.adapter===r.adapter))
     return `<tr class="speed-row" data-case="${esc(c.id)}" data-profile="${esc(c.profile)}" data-group="${esc(c.group)}"><th scope="row">${esc(c.title)}<small>${esc(c.profileTitle)}</small></th>${bs.map((b,i)=>benchCell(b,benchRuns[i].adapter)).join('')}</tr>`
   }).join('')
 }).join('')}</tbody></table></div><p class="note">Includes native command launches and WAV I/O where used. <a href="#benchmark-method">How it was measured</a></p>${overheadHtml}`:'<p>No speed measurements yet.</p>'
 const problems=runs.flatMap(r=>r.cases.filter(c=>['fail','error'].includes(c.status)).map(c=>({run:r,result:c})))
 const date=new Date(results.generatedAt)
 const dateLabel=Number.isNaN(date.valueOf())?results.generatedAt:date.toLocaleDateString('en',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})
 const featureCount=runs.length?measured.filter(f=>!isBasic(f)).length:0,basicCount=runs.length?measured.length-featureCount:0
 const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audio tools, compared — @audio/test</title><link rel="stylesheet" href="style.css"></head>
<body><a class="skip-link" href="#features">Skip to comparison</a><main>
<header><div class="masthead"><a class="brand" href="#features">@audio/test</a><nav aria-label="Report links"><a href="results.json">Results JSON</a><a href="https://github.com/audiojs/test">GitHub</a></nav></div><div class="intro"><h1>Audio tools, compared.</h1><p class="run-date">${esc(dateLabel)}</p></div></header>
<nav class="contents" aria-label="On this page"><a href="#features">Features</a><a href="#speed">Speed</a><a href="#basic-checks">Basic checks</a></nav>
<section id="features" class="comparison" tabindex="-1" aria-labelledby="features-title"><h2 id="features-title">Features <small>${featureCount}</small></h2><div id="feature-panel"><p class="legend"><span class="pass-key">✓ Passed / tests</span><span class="partial-key">◐ Partly tested</span><span>! Difference</span><span class="skip-key">— Not compared</span></p><p class="note">— means no comparable result, usually because the adapter has no equivalent mapping. It does not mean a missing feature.</p>${runs.length?`<div class="table-wrap"><table class="matrix" aria-label="Feature comparison" style="--tool-count:${runs.length}">${tableHead()}<tbody id="feature-rows">${featureRows(false)}</tbody></table></div>`:'<p>No tool results in this run.</p>'}</div></section>
<section id="speed" class="comparison" tabindex="-1" aria-labelledby="speed-title"><h2 id="speed-title">Speed <small>${benchCases.length}</small></h2><div id="speed-panel">${benchHtml}</div></section>
<section id="basic-checks" class="comparison" tabindex="-1" aria-labelledby="basic-title"><h2 id="basic-title">Basic checks <small>${basicCount}</small></h2><div id="basic-panel"><p id="basic-note" class="note">Checks for valid output and unchanged input. Effect quality is not tested.</p><p class="legend"><span class="basic-key">○ Basic checks passed / tests</span><span class="partial-key">◐ Partly tested</span><span>! Difference</span><span class="skip-key">— Not compared</span></p>${runs.length?`<div class="table-wrap"><table class="matrix basic-matrix" aria-label="Basic checks comparison" style="--tool-count:${runs.length}">${tableHead()}<tbody id="basic-rows">${featureRows(true)}</tbody></table></div>`:'<p>No tool results in this run.</p>'}</div></section>
<details id="failures" class="archive"><summary>Results to investigate <small>${problems.length}</small></summary><p>A difference can come from precision, the test, the adapter, or the tool.</p><ul>${problems.map(({run:r,result:c})=>`<li class="${esc(c.status)}"><a href="#case-${esc(c.id)}">${esc(name(r.adapter))} · ${esc(c.id)}</a> — ${esc(c.status)}${c.artifact?` · <a href="${esc(c.artifact)}">Reproduce</a>`:''}</li>`).join('')||'<li>No differences in completed tests.</li>'}</ul></details>
<details id="evidence" class="archive"><summary>Test details <small>${active.length} tests</small></summary>${measured.map(contract).join('')}</details>
${benchEvidence?`<details id="speed-evidence" class="archive"><summary>Speed details</summary>${benchEvidence}</details>`:''}
<details id="planned" class="archive"${planned.length?'':' hidden'}><summary>Planned tests <small>${planned.length} features</small></summary>${planned.map(contract).join('')}</details>
<details id="ecosystem" class="archive"><summary>Audio packages <small>${spec.ecosystem.packages.length}</small></summary><p>Local packages and proposed tests. Some packages may be unpublished. <a href="ecosystem.json">Download inventory</a></p><ul id="package-rows">${pkgRows}</ul></details>
<details id="upstream" class="archive"><summary>Other tools’ feature lists</summary><p>From upstream APIs and manuals; these are test ideas, not measured support. <a href="competitors.json">Download inventory</a></p>${inventories}</details>
<details id="methodology" class="archive"><summary>About this run</summary><p>Measured ${esc(results.generatedAt)}. Tests compare output with mathematical expectations or stated tolerances.</p><p>Not measured: ${spec.contenders.contenders.filter(c=>!runs.some(r=>r.adapter===c.id)).map(c=>`<a href="${esc(c.evidence||c.url)}">${esc(c.name)}</a>`).join(', ')||'none'}.</p>${registry?'<p><a href="registry.json">Separate npm-release results</a></p>':''}<dl class="run-info">${runs.map(r=>{const c=r.cases.filter(c=>c.level!=='integrity'),i=r.cases.filter(c=>c.level==='integrity');return `<dt>${esc(name(r.adapter))} · ${esc(shortVersion(r))}</dt><dd>Behavior: ${c.filter(c=>c.status==='pass').length} passed / ${c.filter(c=>c.status!=='skip').length} run. Basic checks: ${i.filter(c=>c.status==='pass').length} passed / ${i.filter(c=>c.status!=='skip').length} run. ${r.summary.skip} not tested.<details><summary>Version and environment</summary><pre>${esc(JSON.stringify({version:r.version,platform:r.platform,runtime:r.runtime,metadata:r.metadata,host:r.host},null,2))}</pre></details></dd>`}).join('')}</dl><p>Spec SHA-256: <code>${esc(results.specSha256)}</code></p><details id="benchmark-method"><summary>Speed and memory measurements</summary>${bench?`<p>${esc(bench.scope)}. ${esc(bench.generatedAt)}. ${esc(bench.repeats)} repetitions.</p>`:''}<p>Driver memory excludes native, Python and browser child processes, so it cannot compare total memory use. Bundle size, install size, hardware playback and real-time safety are not measured.</p>${bench?'<a href="benchmarks.json">All timings, memory measurements and host details</a>':''}</details></details>
<footer><a href="spec.json">Test specification</a><a href="${repo}docs/COVERAGE.md">Test coverage</a><a href="${repo}docs/MODEL.md">Methodology</a><a href="${repo}docs/SOURCES.md">Sources & standards</a></footer>
</main><div id="cell-popover" popover="auto" role="dialog" aria-labelledby="cell-popover-title"><div class="popover-header"><h3 id="cell-popover-title"></h3><button class="popover-close" type="button" aria-label="Close details">×</button></div><div class="popover-body"></div></div><script src="app.js"></script></body></html>`
 await mkdir(join(root,'site'),{recursive:true});await mkdir(join(root,'results'),{recursive:true})
 await Promise.all([writeFile(join(root,'README.md'),readme),writeFile(join(root,'site/index.html'),html),writeFile(join(root,'results/FINDINGS.md'),findings),writeFile(join(root,'site/results.json'),JSON.stringify(results,null,2)+'\n'),writeFile(join(root,'site/spec.json'),JSON.stringify(spec.cases,null,2)+'\n'),writeFile(join(root,'site/ecosystem.json'),JSON.stringify(spec.ecosystem,null,2)+'\n')])
 await writeFile(join(root,'site/competitors.json'),JSON.stringify(spec.competitorInventory,null,2)+'\n')
 if(registry)await writeFile(join(root,'site/registry.json'),JSON.stringify(registry,null,2)+'\n')
 for(const name of ['style.css','app.js'])await cp(new URL(`../site/${name}`,import.meta.url),join(root,'site',name)).catch(e=>{if(e.code!=='ERR_FS_CP_EINVAL')throw e})
 await cp(join(root,'results/artifacts'),join(root,'site/artifacts'),{recursive:true}).catch(e=>{if(e.code!=='ENOENT')throw e})
 if(bench)await writeFile(join(root,'site/benchmarks.json'),JSON.stringify(bench,null,2)+'\n')
 return {readme:join(root,'README.md'),site:join(root,'site/index.html')}
}
