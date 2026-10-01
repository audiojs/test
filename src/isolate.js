import { Worker } from 'node:worker_threads'
// Hard deadlines include synchronous DSP loops. A timeout destroys the worker and its state.
export function isolated(name,timeout=30000){
 if(!Number.isFinite(timeout)||timeout<=0)throw new Error('Timeout must be positive milliseconds')
 let worker,pending,id=0
 const children=new Set()
 function terminate(){const old=worker;worker=null;for(const pid of children){try{process.kill(pid,'SIGTERM')}catch{}}children.clear();return old?.terminate()}
 async function close(){if(worker){try{await call('close')}finally{await terminate()}}}
 async function call(method,...args){
   if(!worker){worker=new Worker(new URL('./worker.js',import.meta.url),{workerData:{name}});worker.on('message',m=>{if(m.childPid){m.alive?children.add(m.childPid):children.delete(m.childPid);return}if(m.id!==pending?.id)return;m.error?pending.reject(new Error(m.error)):pending.resolve(m.value)})
     const current=worker
     worker.on('error',e=>{if(current===worker){pending?.reject(e);terminate()}});worker.on('exit',code=>{if(current===worker){pending?.reject(new Error(`Adapter worker exited ${code}`));terminate()}})}
   return new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{pending=null;terminate();reject(new Error(`Timeout: ${method} exceeded ${timeout} ms`))},timeout)
     const finish=fn=>v=>{clearTimeout(timer);pending=null;fn(v)}
     pending={id:++id,resolve:finish(resolve),reject:finish(reject)};worker.postMessage({id,method,args})
   })
 }
 return {id:name,available:()=>call('available'),version:()=>call('version'),metadata:()=>call('metadata'),supports:t=>call('supports',t),run:(...args)=>call('run',...args),close}
}
