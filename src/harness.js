import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { expected } from './reference.js'
import { makeSignal, cloneChannels } from './signals.js'
import { loadCases } from './spec.js'
import { compareChannels } from './metrics.js'
import { judge } from './oracles.js'
import { encodeWav } from './wav.js'
const ranks={smoke:0,core:1,quality:2,research:3}
export const summarize=cases=>Object.fromEntries(['pass','fail','error','skip'].map(s=>[s,cases.filter(c=>c.status===s).length]))
export async function runSuite(adapter,options={}){
 const tier=options.tier||'core'
 if(!(tier in ranks))throw new Error(`Unknown tier: ${tier}`)
 const all=options.cases||await loadCases(),selected=all.filter(t=>t.status==='active'&&ranks[t.tier]<=ranks[tier]&&(!options.match||t.id.includes(options.match)))
 if(!selected.length)throw new Error('No active cases selected')
 const run={adapter:adapter.id,available:false,version:'unknown',platform:`${process.platform}-${process.arch}`,runtime:`node ${process.versions.node}`,tier,cases:[]}
 try{run.available=await adapter.available();if(!run.available)throw new Error('Contender is not installed');run.version=await adapter.version();run.metadata=await adapter.metadata?.()}
 catch(e){run.error=e.message;run.cases=selected.map(t=>({id:t.id,feature:t.feature,oracle:t.oracle.type,level:t.level||'conformance',status:'error',error:`Unavailable contender: ${e.message}`}));return {...run,summary:summarize(run.cases)}}
 for(const t of selected){
   const base={id:t.id,feature:t.feature,oracle:t.oracle.type,level:t.level||'conformance'}
   try{if(!await adapter.supports(t)){run.cases.push({...base,status:'skip',reason:'adapter has no equivalent mapping'});continue}}
   catch(e){run.cases.push({...base,status:'error',error:`Adapter mapping probe failed: ${e.message}`});continue}
   const fixture=makeSignal(t.fixture),original=cloneChannels(fixture.channels),start=performance.now()
   let actual,wanted,result
   try{
     wanted=expected(t,original)
     actual=await adapter.run(t,fixture.channels,fixture.sampleRate)
     const metrics=judge(t,actual,wanted,original,fixture.sampleRate)
     const immutable=actual.inputUnchanged!==false&&compareChannels(fixture.channels,original,0).pass
     metrics.inputUnchanged=immutable;metrics.pass&&=immutable
     result={...base,status:metrics.pass?'pass':'fail',durationMs:performance.now()-start,metrics}
   }catch(e){result={...base,status:'error',durationMs:performance.now()-start,error:e.message}}
   if(options.artifacts&&['fail','error'].includes(result.status)){
     const safe=createHash('sha256').update(JSON.stringify([adapter.id,run.version,run.metadata,t])).digest('hex').slice(0,16),dir=join(options.artifacts,safe)
     await mkdir(dir,{recursive:true})
     await writeFile(join(dir,'case.json'),JSON.stringify({adapter:adapter.id,version:run.version,metadata:run.metadata,test:t,result},null,2))
     await writeFile(join(dir,'input.wav'),encodeWav(original,fixture.sampleRate))
     if(wanted?.channels)await writeFile(join(dir,'expected.wav'),encodeWav(wanted.channels,fixture.sampleRate))
     if(actual?.channels?.length&&actual.channels.every(ch=>ch.length===actual.channels[0].length))await writeFile(join(dir,'actual.wav'),encodeWav(actual.channels,actual.sampleRate||fixture.sampleRate))
     if(actual?.channels&&wanted?.channels&&actual.channels.length===wanted.channels.length&&actual.channels.every((ch,c)=>ch.length===wanted.channels[c].length))await writeFile(join(dir,'diff.wav'),encodeWav(actual.channels.map((ch,c)=>Float32Array.from(ch,(v,i)=>v-wanted.channels[c][i])),fixture.sampleRate))
     result.artifact=`artifacts/${safe}/case.json`
   }
   run.cases.push(result)
   options.progress?.(result,run.cases.length,selected.length)
 }
 run.summary=summarize(run.cases)
 return run
}
