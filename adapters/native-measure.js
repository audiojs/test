import { mkdtemp,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execute } from './external.js'
import { encodeWav } from '../src/wav.js'

export async function nativeMeasure(id,step,input,sr){
 const dir=await mkdtemp(join(tmpdir(),'audio-measure-')),file=join(dir,'input.wav')
 try{
  await writeFile(file,encodeWav(input,sr))
  if(id==='ffmpeg'&&['loudness','true-peak'].includes(step.name)){
   const {stderr}=await execute(id,['-nostdin','-hide_banner','-v','info','-i',file,'-af','ebur128=peak=true','-f','null','-'],{maxBuffer:8*1024*1024,timeout:30000})
   const summary=stderr.slice(stderr.lastIndexOf('Summary:'))
   const value=summary.match(step.name==='loudness'?/\bI:\s*([-+\w.]+)\s+LUFS/:/Peak:\s*([-+\w.]+)\s+dBFS/)?.[1]
   if(value==null)throw new Error('FFmpeg returned no loudness summary')
   return {scalar:value==='-inf'?-Infinity:Number(value)}
  }
  const {stderr}=await execute(id,id==='ffmpeg'?['-nostdin','-hide_banner','-v','info','-i',file,'-af','astats=metadata=0:reset=0','-f','null','-']:[file,'-n','stat'],{maxBuffer:8*1024*1024,timeout:30000})
  return parseNativeStats(id,step.name,stderr,input.length,input[0].length)
 }finally{await rm(dir,{recursive:true,force:true})}
}

export function parseNativeStats(id,name,text,channelCount,frames){
  const get=(label)=>{
   const pattern=label.trim().split(/\s+/).map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+')
   const values=[...text.matchAll(new RegExp(`${pattern}:?\\s+([-+\\d.eEinfa]+)`,'g'))].map(m=>m[1]==='-inf'?-Infinity:Number(m[1]))
   if(!values.length||values.some(Number.isNaN))throw new Error(`${id} returned no valid ${label}`)
   return values
  }
  let values
  if(id==='ffmpeg'){
   const n=channelCount,mins=get('Min level').slice(0,n),maxs=get('Max level').slice(0,n),rms=get('RMS level dB').slice(0,n).map(v=>10**(v/20)),dc=get('DC offset').slice(0,n)
   values={min:Math.min(...mins),max:Math.max(...maxs),peak:Math.max(...mins.map(Math.abs),...maxs.map(Math.abs)),rms:Math.sqrt(rms.reduce((s,v)=>s+v*v,0)/n),dc:dc.reduce((s,v)=>s+v,0)/n}
   if(name==='zcr')values.zcr=get('Zero crossings').slice(0,n).reduce((s,v)=>s+v,0)/(frames*n)
  }else{
   values={min:get('Minimum amplitude')[0],max:get('Maximum amplitude')[0],rms:get('RMS amplitude')[0],dc:get('Mean    amplitude')[0]}
   values.peak=Math.max(Math.abs(values.min),Math.abs(values.max))
  }
  values.energy=values.rms**2*channelCount*frames
  if(name==='levels')return {values:{peak:values.peak,rms:values.rms,dc:values.dc}}
  if(!(name in values))throw new Error(`Unsupported ${id} statistic: ${name}`)
  return {scalar:values[name]}
}
