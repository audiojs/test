import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import ffmpeg from '../adapters/ffmpeg.js'
import { execute } from '../adapters/external.js'
import { makeSignal } from './signals.js'
import { encodeWav,decodeWav } from './wav.js'
import { compareChannels } from './metrics.js'
import { provenance } from './provenance.js'
import { benchmarkProfiles } from './bench-cases.js'

// Diagnostics retain their own timings; they are never subtracted from a
// workload. A version command is a launch baseline, not pure process spawn.
export async function measureFfmpegOverhead(repeats=7,profiles=benchmarkProfiles){
 if(!Number.isInteger(repeats)||repeats<3)throw new Error('At least three benchmark repetitions required')
 const report={adapter:'ffmpeg',generatedAt:new Date().toISOString(),host:await provenance(),repeats,warmups:2,scope:'Separate process and WAV round-trip diagnostics; no overhead subtraction from workload timings',results:[]}
 let directory
 const sample=async(definition,run,validate=()=>{})=>{
  try{
   const samples=[]
   for(let i=0;i<repeats+2;i++){
    const start=performance.now(),output=await run(),ms=performance.now()-start
    await validate(output)
    if(i>=2)samples.push(ms)
   }
   const sorted=[...samples].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2)
   report.results.push({...definition,status:'pass',samplesMs:samples,medianMs:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,p95Ms:sorted[Math.ceil(sorted.length*.95)-1]})
  }catch(error){report.results.push({...definition,status:'error',error:error.message})}
 }
 try{
  if(!await ffmpeg.available())throw new Error('FFmpeg unavailable')
  report.version=await ffmpeg.version();report.metadata=await ffmpeg.metadata?.()
  await sample({id:'version-command',title:'Launch and print version',includes:'FFmpeg process launch, version output and exit'},()=>execute('ffmpeg',['-version'],{timeout:30000}))
  directory=await mkdtemp(join(tmpdir(),'audio-bench-overhead-'))
  for(const profile of profiles){
   const fixture={signal:'sine',frequency:440,amplitude:.1,frames:profile.frames,channels:profile.channels,sampleRate:48000},input=makeSignal(fixture)
   const source=join(directory,`${profile.id}-input.wav`),target=join(directory,`${profile.id}-output.wav`)
   await writeFile(source,encodeWav(input.channels,input.sampleRate))
   const definition={profile:profile.id,profileTitle:profile.title}
   const identity=output=>{
    if(output.sampleRate!==input.sampleRate||!compareChannels(output.channels,input.channels,0).pass)throw new Error('PCM identity check failed')
   }
   await sample({...definition,id:`read-discard-${profile.id}`,title:'Read WAV and discard packets',includes:'Process launch, prewritten WAV read/demux and packet copy to null; no PCM decoding'},()=>execute('ffmpeg',['-nostdin','-v','error','-i',source,'-c:a','copy','-f','null','-'],{timeout:30000}))
   await sample({...definition,id:`pcm-transcode-${profile.id}`,title:'Read and write float WAV',includes:'Process launch, prewritten WAV read, PCM decode/encode and WAV write'},()=>execute('ffmpeg',['-nostdin','-v','error','-y','-i',source,'-c:a','pcm_f32le',target],{timeout:30000}),async()=>identity(decodeWav(await readFile(target))))
   await sample({...definition,id:`adapter-identity-${profile.id}`,title:'Full adapter round trip',includes:'Temporary files, JS WAV packing/unpacking, native process launch, PCM transcode, file I/O and cleanup'},()=>ffmpeg.run({fixture,steps:[]},input.channels,input.sampleRate),identity)
  }
 }catch(error){report.error=error.message}
 finally{if(directory)await rm(directory,{recursive:true,force:true})}
 return report
}
