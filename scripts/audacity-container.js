// Keep the desktop editor, display, profile and scripting pipes inside a disposable container.
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root=fileURLToPath(new URL('../',import.meta.url)),image='audio-test-audacity:ubuntu24.04'
const run=args=>new Promise((resolve,reject)=>{
 const child=spawn('docker',args,{stdio:'inherit'})
 child.once('error',reject)
 child.once('exit',code=>code===0?resolve():reject(new Error(`docker ${args[0]} exited ${code}`)))
})
await mkdir(join(root,'results'),{recursive:true})
await run(['build','--tag',image,'--file',join(root,'scripts/audacity.Dockerfile'),join(root,'scripts')])
await run(['run','--rm','--init','--network','none',
 '--env',`AUDACITY_BENCH_REPEATS=${process.env.AUDACITY_BENCH_REPEATS||'7'}`,
 '--mount',`type=bind,source=${root},target=/workspace,readonly`,
 '--mount',`type=bind,source=${join(root,'results')},target=/workspace/results`,
 image,'node','scripts/audacity-ci.js',...process.argv.slice(2)])
