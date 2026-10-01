import { writeFile } from 'node:fs/promises'
import { measureFfmpegOverhead } from '../src/benchmark-overhead.js'

const repeats=Number(process.argv[2]||7),path=process.argv[3]||'results/ffmpeg-overhead.local.json'
const result=await measureFfmpegOverhead(repeats)
await writeFile(path,JSON.stringify(result,null,2)+'\n')
console.log(path)
if(result.error||result.results.some(row=>row.status!=='pass'))process.exitCode=1
