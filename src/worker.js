import { parentPort, workerData } from 'node:worker_threads'
import { loadAdapter } from '../adapters/index.js'
import { cloneChannels } from './signals.js'
import { compareChannels } from './metrics.js'
const adapter=await loadAdapter(workerData.name)
parentPort.on('message',async({id,method,args})=>{
 try{const original=method==='run'?cloneChannels(args[1]):null;const value=adapter[method]?await adapter[method](...args):null;if(original)value.inputUnchanged=compareChannels(args[1],original,0).pass;parentPort.postMessage({id,value})}
 catch(e){parentPort.postMessage({id,error:e.stack||e.message})}
})
