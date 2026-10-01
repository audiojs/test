import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
const exec=promisify(execFile),cli=fileURLToPath(new URL('../bin/audio-test.js',import.meta.url))
const run=args=>exec(process.execPath,[cli,...args],{timeout:10000})
test('CLI rejects empty selections instead of emitting a green report',async()=>{
 await assert.rejects(run(['run','--adapter','reference','--case','no-such-case']),/No active cases/)
})
test('CLI records unavailable adapters and fails even with report-only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-test-cli-')),out=join(dir,'result.json')
 try{await assert.rejects(run(['run','--adapter','/nonexistent/audio-test.mjs','--case','edit.reverse.involution','--report-only','--out',out]));const r=JSON.parse(await readFile(out));assert.equal(r.runs[0].summary.error,1);assert.equal(r.runs[0].summary.pass,0)}finally{await rm(dir,{recursive:true,force:true})}
})
test('merge rejects different specs and duplicate contenders',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-test-merge-')),a=join(dir,'a.json'),b=join(dir,'b.json'),out=join(dir,'out.json')
 try{await writeFile(a,JSON.stringify({specSha256:'a',tier:'quality',runs:[{adapter:'x'}]}));await writeFile(b,JSON.stringify({specSha256:'b',tier:'quality',runs:[]}));await assert.rejects(run(['merge',a,b,'--out',out]),/different specifications/);await assert.rejects(run(['merge',a,a,'--out',out]),/Duplicate contenders/)}finally{await rm(dir,{recursive:true,force:true})}
})
test('regression gate catches missing contenders, mapping loss and new failures',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-test-gate-')),input=join(dir,'result.json'),baseline=join(dir,'baseline.json')
 try{
  await writeFile(baseline,JSON.stringify({specSha256:'a',coverage:{x:['one']},expected:{}}))
  for(const runs of [[],[{adapter:'x',available:true,cases:[{id:'one',status:'skip'}]}],[{adapter:'x',available:true,cases:[{id:'one',status:'fail'}]}]]){await writeFile(input,JSON.stringify({specSha256:'a',runs}));await assert.rejects(run(['gate','--input',input,'--baseline',baseline]))}
  await writeFile(input,JSON.stringify({specSha256:'a',runs:[{adapter:'x',available:true,cases:[{id:'one',status:'pass'}]}]}));assert.match((await run(['gate','--input',input,'--baseline',baseline])).stdout,/No new/)
 }finally{await rm(dir,{recursive:true,force:true})}
})
