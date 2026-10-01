import os from 'node:os'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec=promisify(execFile)
export const hash=x=>createHash('sha256').update(x).digest('hex')
export async function provenance(root=process.cwd()){
 let revision=null,dirty=null,lockSha256=null
 try{revision=(await exec('git',['rev-parse','HEAD'],{cwd:root})).stdout.trim();dirty=!!(await exec('git',['status','--porcelain'],{cwd:root})).stdout}catch{}
 try{lockSha256=hash(await readFile(`${root}/package-lock.json`))}catch{}
 return {platform:process.platform,arch:process.arch,os:os.release(),node:process.version,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem(),revision,dirty,lockSha256}
}
