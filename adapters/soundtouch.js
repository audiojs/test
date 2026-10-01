import { defineAdapter } from '../src/adapter.js'
import { execute,wavProcess } from './external.js'

async function version(){
 let output
 try{const {stdout,stderr}=await execute('soundstretch',['-license'],{timeout:5000});output=stdout+stderr}
 catch(error){if(error.code!==255)throw error;output=error.message}
 const value=output.match(/SoundStretch v([\d.]+)/)?.[1]
 if(!value)throw new Error('SoundStretch returned no version')
 return value
}

export default defineAdapter({
 id:'soundtouch',
 async available(){await version();return true},
 version,
 async metadata(){return {mode:'SoundStretch CLI; default music settings and anti-alias filter; WAV I/O',source:'https://www.surina.net/soundtouch/README.html'}},
 supports(test){return !test.workflow&&test.steps.length===1&&['stretch','pitch','speed'].includes(test.steps[0].op)},
 async run(test,input,sr){
  const s=test.steps[0],arg=s.op==='pitch'?`-pitch=${s.semitones}`:s.op==='stretch'?`-tempo=${(1/s.factor-1)*100}`:`-rate=${(s.factor-1)*100}`
  return wavProcess('soundstretch',(source,target)=>[source,target,arg],input,sr)
 }
})
