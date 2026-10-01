import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const files=(await readdir(new URL('../test/',import.meta.url))).filter(n=>n.endsWith('.test.js')).sort().map(n=>`test/${n}`)
const child=spawn(process.execPath,['--test',...files],{stdio:'inherit'})
child.on('error',error=>{console.error(error);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
