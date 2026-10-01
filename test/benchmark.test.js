import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,writeFile,readFile,rm,chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { benchmarkCases } from '../src/bench-cases.js'
import { benchmark } from '../src/benchmark.js'
import { expected } from '../src/reference.js'
import { makeSignal } from '../src/signals.js'
import { judge } from '../src/oracles.js'
const exec=promisify(execFile)

test('benchmark workloads span sizes, channels and operation families with independent exact goldens',()=>{
 const cases=benchmarkCases()
 assert(cases.length>=100)
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length)
 assert.deepEqual([...new Set(cases.map(c=>c.fixture.frames))],[4800,48000,480000])
 for(const group of ['Editing','Channels','Filters','Analysis','Time & pitch'])assert(cases.some(c=>c.group===group))
 for(const c of cases.filter(c=>['exact','scalar'].includes(c.oracle.type))){
  const {channels,sampleRate}=makeSignal(c.fixture),gold=expected(c,channels)
  assert(judge(c,gold,gold,channels,sampleRate).pass,c.id)
 }
})

test('benchmark rejects empty selections and invalid repetitions',async()=>{
 await assert.rejects(benchmark([],3),/adapter/)
 await assert.rejects(benchmark(['reference'],2),/repetitions/)
 await assert.rejects(benchmark(['reference'],3,{match:'missing-case'}),/No benchmark/)
 await assert.rejects(benchmark(['reference','reference'],3),/distinct/)
 await assert.rejects(benchmark(['reference'],3,{timeout:0}),/timeout/)
})

test('benchmark adds dense long convolutions, growing FFTs and learned-noise workloads',()=>{
 const cases=benchmarkCases(),convolutions=cases.filter(c=>c.oracle.type==='convolution-dc')
 assert.equal(cases.length,143)
 assert.equal(convolutions.length,6)
 for(const c of convolutions){
  const impulse=c.steps[0].impulse
  assert([1024,48000].includes(impulse.length));assert(impulse.every(x=>Number.isFinite(x)&&x!==0&&Math.fround(x)===x))
  assert.equal(c.steps[0].tail,true);assert.equal(c.fixture.signal,'dc');assert.equal(c.fixture.value,.125)
  assert.equal(expected(c,makeSignal(c.fixture).channels),null,'long convolution avoids a quadratic reference computation')
 }
 assert.deepEqual(convolutions.map(c=>c.steps[0].impulse),benchmarkCases().filter(c=>c.oracle.type==='convolution-dc').map(c=>c.steps[0].impulse),'kernels are repeatable')
 assert.deepEqual(cases.filter(c=>c.id.startsWith('spectrum-')).map(c=>c.steps[0].size),[4096,32768,262144])
 assert.deepEqual(cases.filter(c=>c.id.startsWith('denoise-')).map(c=>c.profile),['stereo','long-stereo'])
})

test('benchmark passes long kernels over stdin without OS argument-size limits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-bench-input-')),adapter=join(dir,'adapter.mjs')
 try{
  await writeFile(adapter,`export default {id:'fake',supports(t){if(t.steps[0].impulse.length!==48000)throw Error('Missing kernel');return false}}`)
  const out=await benchmark([adapter],3,{match:'convolve-48000-short-mono'})
  assert.equal(out.results.length,1);assert.equal(out.results[0].status,'skip')
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('benchmark timeout terminates a hanging driver and its child/grandchild tree',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-bench-timeout-')),adapter=join(dir,'adapter.mjs'),worker=join(dir,'child.cjs')
 const driverPid=join(dir,'driver.pid'),childPid=join(dir,'child.pid'),grandchildPid=join(dir,'grandchild.pid')
 const live=pid=>{try{process.kill(pid,0);return true}catch(error){if(error.code==='ESRCH')return false;throw error}}
 let pids=[]
 try{
  const grandchild=`require('node:fs').writeFileSync(${JSON.stringify(grandchildPid)},String(process.pid));setInterval(()=>{},1000)`
  await writeFile(worker,`require('node:fs').writeFileSync(${JSON.stringify(childPid)},String(process.pid));require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},1000)`)
  await writeFile(adapter,`import {spawn} from 'node:child_process';import {existsSync,writeFileSync} from 'node:fs';import {setTimeout as delay} from 'node:timers/promises';export default {id:'hang',supports:()=>true,async available(){writeFileSync(${JSON.stringify(driverPid)},String(process.pid));spawn(process.execPath,[${JSON.stringify(worker)}],{stdio:'ignore'});while(!existsSync(${JSON.stringify(grandchildPid)}))await delay(10);return true},version:()=> '1',run(){while(true){}}}`)
  const result=await benchmark([adapter],3,{match:'gain-short-mono',timeout:3000})
  assert.equal(result.results[0].status,'error');assert.match(result.results[0].error,/timed out/)
  assert.equal(result.results[0].medianMs,undefined)
  pids=await Promise.all([driverPid,childPid,grandchildPid].map(async path=>Number(await readFile(path,'utf8'))))
  assert(pids.every(pid=>Number.isSafeInteger(pid)&&pid>1),'all fixture processes recorded their own PID')
  for(let i=0;i<100&&pids.some(live);i++)await delay(20)
  assert.deepEqual(pids.filter(live),[],'timed-out processes cannot contaminate the next measurement')
 }finally{
  for(const path of [grandchildPid,childPid,driverPid]){
   try{const pid=Number(await readFile(path,'utf8'));if(Number.isSafeInteger(pid)&&pid>1&&live(pid))process.kill(pid,'SIGKILL')}catch(error){if(!['ENOENT','ESRCH'].includes(error.code))throw error}
  }
  await rm(dir,{recursive:true,force:true})
 }
})

test('benchmark worker closes skipped adapters and rejects input mutation before recording timings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-bench-worker-')),adapter=join(dir,'adapter.mjs'),closed=join(dir,'closed')
 const c=benchmarkCases().find(c=>c.id==='gain-short-mono')
 try{
  await writeFile(adapter,`import {writeFile} from 'node:fs/promises';export default {id:'fake',available:async()=>true,version:async()=>'1.0',supports:()=>false,run(){throw Error('must not run')},close:()=>writeFile(${JSON.stringify(closed)},'closed')}`)
  let out=await exec(process.execPath,['scripts/bench-worker.js',adapter,JSON.stringify(c),'3'])
  assert.equal(JSON.parse(out.stdout).status,'skip');assert.equal(await readFile(closed,'utf8'),'closed')
  await writeFile(adapter,`export default {id:'fake',available:async()=>true,version:async()=>'1.0',supports:()=>true,run(t,input){const channels=input.map(ch=>Float32Array.from(ch,v=>v*10**(-6/20)));input[0][0]=42;return {channels}},close(){}}`)
  out=await exec(process.execPath,['scripts/bench-worker.js',adapter,JSON.stringify(c),'3'])
  const result=JSON.parse(out.stdout)
  assert.equal(result.status,'fail');assert.equal(result.validation.inputUnchanged,false);assert.equal(result.validation.pass,false);assert.equal(result.medianMs,undefined)
  await writeFile(adapter,`import {writeFile} from 'node:fs/promises';let calls=0;export default {id:'fake',available:async()=>true,version:async()=>'1.0',supports:()=>true,run(t,input){calls++;return {channels:input.map(ch=>Float32Array.from(ch,v=>v*10**(-6/20)))}},close:()=>writeFile(${JSON.stringify(closed)},String(calls))}`)
  out=await exec(process.execPath,['scripts/bench-worker.js',adapter,JSON.stringify(c),'3'])
  const success=JSON.parse(out.stdout)
  assert.equal(success.status,'pass');assert.equal(success.samplesMs.length,3);assert.equal(await readFile(closed,'utf8'),'5','two warmups plus three measured calls')
  const sorted=[...success.samplesMs].sort((a,b)=>a-b)
  assert.equal(success.medianMs,sorted[1]);assert.equal(success.p95Ms,sorted[2])
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('overhead diagnostics validate PCM separately and omit timings for corrupt round trips',{skip:process.platform==='win32'&&'POSIX executable fixture'},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-overhead-test-')),command=join(dir,'ffmpeg')
 try{
  await writeFile(command,`#!${process.execPath}\nconst fs=require('node:fs'),args=process.argv.slice(2);if(args.includes('-version'))console.log('ffmpeg version fake');else if(args.at(-1)!=='-'){const source=args[args.indexOf('-i')+1];if(process.env.CORRUPT_PCM)fs.writeFileSync(args.at(-1),'invalid');else fs.copyFileSync(source,args.at(-1))}`)
  await chmod(command,0o755)
  const code=`import {measureFfmpegOverhead} from './src/benchmark-overhead.js';console.log(JSON.stringify(await measureFfmpegOverhead(3,[{id:'short-mono',title:'0.1 s · mono',frames:4800,channels:1}])));`
  const env={...process.env,PATH:`${dir}:${process.env.PATH}`}
  let result=JSON.parse((await exec(process.execPath,['--input-type=module','-e',code],{env})).stdout)
  assert.equal(result.results.length,4);assert(result.results.every(r=>r.status==='pass'&&r.samplesMs.length===3))
  assert.equal(result.results[3].id,'adapter-identity-short-mono')
  result=JSON.parse((await exec(process.execPath,['--input-type=module','-e',code],{env:{...env,CORRUPT_PCM:'1'}})).stdout)
  assert.deepEqual(result.results.map(r=>r.status),['pass','pass','error','error'])
  assert(result.results.slice(2).every(r=>r.medianMs===undefined&&r.samplesMs===undefined))
 }finally{await rm(dir,{recursive:true,force:true})}
})
