import { execFile,spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { provenance } from './provenance.js'
import { benchmarkCases,benchmarkProfiles } from './bench-cases.js'
import { measureFfmpegOverhead } from './benchmark-overhead.js'
export const benchmarkScope='48 kHz float PCM; two warmups, repeated adapter-call wall time; includes per-call native process startup, IPC and PCM/WAV I/O; excludes fresh driver/import/initial engine startup, fixture preparation and validation'

function runWorker(adapter,test,repeats,timeout){
 return new Promise((resolve,reject)=>{
  // This process group belongs only to this measurement. Native/Python children
  // inherit it, allowing a deadline to stop synchronous work outside Node too.
  const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/bench-worker.js',import.meta.url)),adapter,'-',String(repeats)],{detached:process.platform!=='win32',windowsHide:true,stdio:['pipe','pipe','pipe']})
  let stdout='',stderr='',failure,cleanup,timer
  const stop=error=>{
   if(failure)return
   failure=error
   if(!child.pid)return
   if(process.platform==='win32')cleanup=new Promise(done=>{
    execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{timeout:5000,windowsHide:true},error=>{
     if(error){child.kill('SIGKILL');failure.message+=`; process-tree cleanup failed: ${error.message}`}
     done()
    })
   })
   else try{process.kill(-child.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH'){child.kill('SIGKILL');failure.message+=`; process-group cleanup failed: ${error.message}`}}
  }
  timer=setTimeout(()=>stop(new Error(`Benchmark worker timed out after ${timeout} ms`)),timeout)
  child.once('error',error=>{clearTimeout(timer);reject(error)})
  for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]]){
   let bytes=0
   stream.setEncoding('utf8')
   stream.on('data',chunk=>{
    bytes+=Buffer.byteLength(chunk)
    if(bytes>4*1024*1024){stop(new Error(`Benchmark worker ${name} exceeded 4 MiB`));return}
    if(name==='stdout')stdout+=chunk;else stderr+=chunk
   })
  }
  child.once('exit',(code,signal)=>{if(code!==0)stop(new Error(`Benchmark worker exited ${signal||code}: ${stderr.trim()}`))})
  child.once('close',async()=>{
   clearTimeout(timer);await cleanup
   if(failure)reject(failure);else resolve(stdout)
  })
  // Long impulse responses exceed OS argument limits. Fixture transfer finishes
  // before the worker starts either warmups or timed calls.
  child.stdin.on('error',()=>{})
  child.stdin.end(JSON.stringify(test))
 })
}

export async function benchmark(names,repeats=7,options={}){
 if(!Number.isInteger(repeats)||repeats<3)throw new Error('At least three benchmark repetitions required')
 if(!names.length||names.some(n=>!n)||new Set(names).size!==names.length)throw new Error('Select distinct nonempty adapter names')
 const timeout=options.timeout??180000
 if(!Number.isFinite(timeout)||timeout<=0)throw new Error('Benchmark timeout must be positive milliseconds')
 const cases=benchmarkCases().filter(c=>(!options.match||c.id.includes(options.match))&&(!options.profile||c.profile===options.profile))
 if(!cases.length)throw new Error('No benchmark cases selected')
 const results=[]
 for(const adapter of names)for(const test of cases){
   let result
   try{result=JSON.parse((await runWorker(adapter,test,repeats,timeout)).trim())}
   catch(e){result={status:'error',error:e.message}}
   results.push({adapter,case:test.id,...result});console.error(`${adapter}: ${test.id} ${result.status}`)
 }
 const overhead=names.includes('ffmpeg')?[await measureFfmpegOverhead(repeats,benchmarkProfiles.filter(p=>cases.some(c=>c.profile===p.id)))]:[]
 return {schema:1,generatedAt:new Date().toISOString(),host:await provenance(),scope:benchmarkScope,profiles:benchmarkProfiles,repeats,fixtures:cases,results,overhead}
}
