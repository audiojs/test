import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,writeFile,rm,readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSuite } from '../src/harness.js'
import { isolated } from '../src/isolate.js'
import { makeSignal } from '../src/signals.js'
const fixture={signal:'sample-id',frames:17,channels:1,sampleRate:48000}
const cases=[{id:'test.reverse',feature:'edit.reverse',status:'active',tier:'core',fixture,steps:[{op:'reverse'}],oracle:{type:'exact',atol:0}}]
const adapter={id:'test',available:async()=>true,version:async()=>'1',supports:()=>true,run:async(t,input)=>({channels:input.map(x=>x.slice().reverse())})}
test('unavailable tools are errors, never successful skips',async()=>{
 const r=await runSuite({...adapter,available:async()=>false},{cases});assert.equal(r.summary.error,1);assert.equal(r.available,false)
})
test('an empty selection fails closed',async()=>{await assert.rejects(runSuite(adapter,{cases,match:'missing'}),/No active/);await assert.rejects(runSuite(adapter,{cases,tier:'wat'}),/Unknown tier/)})
test('missing adapter modules fail promptly and close without hanging',async()=>{
 const a=isolated('/nonexistent/audio-test-adapter.mjs',1000)
 try{await assert.rejects(a.available(),/Cannot find|not found/)}finally{await a.close()}
 assert.throws(()=>isolated('reference',NaN),/positive/)
})
test('async mapping probes and mapping errors are accounted for',async()=>{
 assert.equal((await runSuite({...adapter,supports:async()=>false},{cases})).summary.skip,1)
 assert.equal((await runSuite({...adapter,supports:()=>{throw Error('mapping')}},{cases})).summary.error,1)
})
test('input mutation is detected even when output matches',async()=>{
 const r=await runSuite({...adapter,run:async(t,x)=>{const channels=x.map(ch=>ch.slice().reverse());x[0][0]=0;return {channels}}},{cases});assert.equal(r.summary.fail,1);assert.equal(r.cases[0].metrics.inputUnchanged,false)
})
test('failures include replay case, input, actual, expected and diff WAVs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-test-self-'))
 try{const r=await runSuite({...adapter,run:async(t,x)=>({channels:x})},{cases,artifacts:join(dir,'artifacts')});assert.equal(r.summary.fail,1);const path=join(dir,r.cases[0].artifact);assert.equal(JSON.parse(await readFile(path)).test.id,cases[0].id);for(const name of ['input','actual','expected','diff'])assert((await readFile(path.replace('case.json',name+'.wav'))).length>44)}finally{await rm(dir,{recursive:true,force:true})}
})
test('worker detects input mutation across structured clone boundary',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-test-worker-')),path=join(dir,'adapter.mjs')
 await writeFile(path,"export default {id:'bad',available:async()=>true,version:async()=>'1',supports:()=>true,run:async(t,x)=>{const channels=x.map(c=>c.slice().reverse());x[0][0]=0;return {channels}}}")
 const a=isolated(path,2000)
 try{const r=await runSuite(a,{cases});assert.equal(r.summary.fail,1)}finally{await a.close();await rm(dir,{recursive:true,force:true})}
})
test('synchronous hangs time out and a fresh worker can probe again',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-test-timeout-')),path=join(dir,'adapter.mjs')
 await writeFile(path,"export default {id:'hang',available:async()=>true,version:async()=>'1',supports:()=>true,run:()=>{while(true){}}}")
 const a=isolated(path,500)
 try{await a.available();await assert.rejects(a.run(cases[0],makeSignal(fixture).channels,48000),/Timeout/);assert.equal(await a.available(),true)}finally{await a.close();await rm(dir,{recursive:true,force:true})}
})
