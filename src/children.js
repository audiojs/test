import { parentPort } from 'node:worker_threads'
export function trackChild(child){
 child.once('spawn',()=>parentPort?.postMessage({childPid:child.pid,alive:true}))
 child.once('exit',()=>parentPort?.postMessage({childPid:child.pid,alive:false}))
 return child
}
