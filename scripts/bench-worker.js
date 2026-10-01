import { loadAdapter } from '../adapters/index.js'
import { makeSignal,cloneChannels } from '../src/signals.js'
import { performance } from 'node:perf_hooks'
import { judge } from '../src/oracles.js'
import { expected } from '../src/reference.js'
import { compareChannels } from '../src/metrics.js'
import { readFileSync } from 'node:fs'

const test=JSON.parse(process.argv[3]==='-'?readFileSync(0,'utf8'):process.argv[3]),adapter=await loadAdapter(process.argv[2]),repeats=Number(process.argv[4]||7)
async function measure(){
 if(!await adapter.supports(test))return {status:'skip',reason:'No equivalent adapter mapping'}
 if(!await adapter.available())throw new Error('Contender unavailable')
 const provenance={version:await adapter.version(),metadata:await adapter.metadata?.()}
 const input=makeSignal(test.fixture),golden=expected(test,input.channels),samples=[]
 let validation
 for(let i=0;i<repeats+2;i++){
  const pcm=cloneChannels(input.channels),start=performance.now(),out=await adapter.run(test,pcm,input.sampleRate),ms=performance.now()-start
  validation=judge(test,out,golden,input.channels,input.sampleRate)
  validation.inputUnchanged=out.inputUnchanged!==false&&compareChannels(pcm,input.channels,0).pass
  validation.pass&&=validation.inputUnchanged
  if(!validation.pass||!validation.inputUnchanged)return {status:'fail',...provenance,validation}
  if(i>=2)samples.push(ms)
 }
 const sorted=[...samples].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2)
 return {status:'pass',...provenance,samplesMs:samples,medianMs:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],driverMaxRssMiB:process.resourceUsage().maxRSS/1024,validation}
}
try{console.log(JSON.stringify(await measure()))}
catch(e){console.log(JSON.stringify({status:'error',error:e.message}))}
finally{await adapter.close?.()}
