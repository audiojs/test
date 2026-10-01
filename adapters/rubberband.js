import { defineAdapter } from '../src/adapter.js'
import { execute,wavProcess } from './external.js'

export default defineAdapter({
 id:'rubberband',
 async available(){await execute('rubberband',['--version'],{timeout:5000});return true},
 async version(){const {stdout,stderr}=await execute('rubberband',['--version']);return (stdout+stderr).trim()},
 async metadata(){return {mode:'Rubber Band R3 offline CLI with float WAV I/O',source:'https://breakfastquay.com/rubberband/'}},
 supports(test){return !test.workflow&&test.steps.length===1&&['stretch','pitch'].includes(test.steps[0].op)},
 async run(test,input,sr){const s=test.steps[0];return wavProcess('rubberband',(source,target)=>['--quiet','--fine','--no-threads',...(s.op==='stretch'?['--time',String(s.factor)]:['--pitch',String(s.semitones)]),source,target],input,sr)}
})
