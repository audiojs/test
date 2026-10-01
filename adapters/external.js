import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { trackChild } from '../src/children.js'
import { decodeWav, encodeWav } from '../src/wav.js'

export const execute=(command,args,options={})=>new Promise((resolve,reject)=>{
 trackChild(execFile(command,args,options,(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr})))
})

export async function exists(command) {
  try { await execute(command, ['-version'], { timeout: 5000 }); return true } catch (error) { return error?.code !== 'ENOENT' }
}

export async function wavProcess(command, args, input, sampleRate, other) {
  const directory = await mkdtemp(join(tmpdir(), 'audio-test-'))
  const source = join(directory, 'input.wav'), target = join(directory, 'output.wav')
  try {
    await writeFile(source, encodeWav(input, sampleRate))
    const secondary=join(directory,'secondary.wav')
    if(other)await writeFile(secondary,encodeWav(other,sampleRate))
    await execute(command, args(source, target,secondary), { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })
    const result = decodeWav(await readFile(target))
    return { channels: result.channels, sampleRate: result.sampleRate }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
