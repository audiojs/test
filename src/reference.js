import { cloneChannels,makeSignal } from './signals.js'

const operations = {
  mix:(channels,s)=>{const b=makeSignal(s.other).channels;return channels.map((x,c)=>Float32Array.from(x,(v,i)=>v+(i>=s.at&&i<s.at+b[c].length?b[c][i-s.at]:0)))},
  insert:(channels,s)=>{const b=makeSignal(s.other).channels;return channels.map((x,c)=>Float32Array.from([...x.slice(0,s.at),...b[c],...x.slice(s.at)]))},
  crossfade:(channels,s)=>{const b=makeSignal(s.other).channels;return channels.map((x,c)=>{const start=x.length-s.length,y=new Float32Array(x.length+b[c].length-s.length);y.set(x);for(let i=0;i<b[c].length;i++){const t=i/s.length,a=s.curve==='equal-power'?Math.cos(t*Math.PI/2):1-t,d=s.curve==='equal-power'?Math.sin(t*Math.PI/2):t;y[start+i]=i<s.length?x[start+i]*a+b[c][i]*d:b[c][i]}return y})},
  delay:(channels,s)=>{
    if(!Number.isInteger(s.delayFrames)||s.delayFrames<1)throw new RangeError('Delay must be a positive number of frames')
    return channels.map(x=>{
      const wet=new Float64Array(x.length),out=new Float32Array(x.length)
      for(let i=0;i<x.length;i++){
        if(i>=s.delayFrames)wet[i]=x[i-s.delayFrames]+s.feedback*wet[i-s.delayFrames]
        out[i]=x[i]*(1-s.mix)+wet[i]*s.mix
      }
      return out
    })
  },
  convolve:(channels,s)=>channels.map(x=>{
    const y=new Float32Array(x.length+(s.tail?s.impulse.length-1:0))
    for(let i=0;i<x.length;i++)for(let j=0;j<s.impulse.length&&i+j<y.length;j++)y[i+j]+=x[i]*s.impulse[j]
    return y
  }),
  reverse: channels => channels.map(channel => channel.slice().reverse()),
  'reverse-range': (channels,s) => channels.map(x=>{ const y=x.slice(); y.set(x.slice(s.start,s.start+s.length).reverse(),s.start); return y }),
  trim: (channels, step) => channels.map(channel => channel.slice(step.start, step.start + step.length)),
  remove: (channels,s) => channels.map(x=>Float32Array.from([...x.slice(0,s.start),...x.slice(s.start+s.length)])),
  pad: (channels,s) => channels.map(x=>{const y=new Float32Array(x.length+s.before+s.after); y.set(x,s.before); return y}),
  repeat: (channels,s) => channels.map(x=>{const y=new Float32Array(x.length*s.count); for(let i=0;i<s.count;i++)y.set(x,i*x.length);return y}),
  gain: (channels,s) => channels.map(x=>Float32Array.from(x,v=>v*s.value)),
  fade: (channels,s) => channels.map(x=>Float32Array.from(x,(v,i)=>{
    const start=s.direction==='in'?0:x.length-s.length, pos=i-start
    if(pos<0||pos>=s.length)return v
    const t=s.direction==='in'?pos/s.length:1-pos/s.length
    return v*({linear:t,exp:t*t,log:Math.sqrt(t),cos:(1-Math.cos(Math.PI*t))/2}[s.curve||'linear'])
  })),
  swap: channels=>[channels[1].slice(),channels[0].slice()],
  mono: channels=>[Float32Array.from(channels[0],(_,i)=>channels.reduce((sum,x)=>sum+x[i],0)/channels.length)],
  duplicate: channels=>[channels[0].slice(),channels[0].slice()],
  balance: (channels,s)=>channels.map((x,c)=>Float32Array.from(x,v=>v*(c===0?Math.min(1,1-s.value):Math.min(1,1+s.value)))),
  normalize: (channels,s)=>{const peak=Math.max(...channels.map(x=>x.reduce((p,v)=>Math.max(p,Math.abs(v)),0)));return channels.map(x=>Float32Array.from(x,v=>peak?v*10**(s.db/20)/peak:v))},
  derivative: channels=>channels.map(x=>Float32Array.from(x,(v,i)=>v-(i?x[i-1]:0))),
  integral: channels=>channels.map(x=>{let sum=0;return Float32Array.from(x,v=>sum+=v)}),
  'gain-db': (channels, step) => {
    const gain = 10 ** (step.db / 20)
    return channels.map(channel => Float32Array.from(channel, sample => sample * gain))
  }
}

export function applySteps(input, steps = []) {
  let channels = cloneChannels(input)
  for (const step of steps) {
    const apply = operations[step.op]
    if (!apply) throw new RangeError(`Reference operation not implemented: ${step.op}`)
    channels = apply(channels, step)
  }
  return channels
}

export function statistics(channels) {
  let min=Infinity,max=-Infinity,peak=0,sum=0,energy=0,count=0,crossings=0
  for(const x of channels)for(let i=0;i<x.length;i++){
    const v=x[i]
    min=Math.min(min,v);max=Math.max(max,v);peak=Math.max(peak,Math.abs(v));sum+=v;energy+=v*v;count++
    if(i&&(v<0)!==(x[i-1]<0))crossings++
  }
  return {min,max,peak,rms:Math.sqrt(energy/Math.max(1,count)),dc:sum/Math.max(1,count),energy,zcr:crossings/Math.max(1,count)}
}

export function expected(test, input) {
  if(test.oracle.type==='neutral')return {channels:cloneChannels(input)}
  if (test.oracle.type==='scalar') {
    return {scalar:statistics(input)[test.steps[0].name]}
  }
  if (!['exact','exact-with-source','workflow','seams'].includes(test.oracle.type)) return null
  if (!test.workflow) return { channels: applySteps(input, test.steps) }
  if (test.workflow.op === 'codec-roundtrip') return { channels: cloneChannels(input), observations: { sourceAfter: cloneChannels(input) } }
  if (['clip-reverse','copy-reverse','clone-reverse','undo','undo-redo','stream'].includes(test.workflow.op)) {
    const { start, length } = test.workflow
    const clip = input.map(channel => channel.slice(start, start + length).reverse())
    const op=test.workflow.op
    const channels=op==='clone-reverse'?input.map(x=>x.slice().reverse()):op==='undo'?cloneChannels(input):['stream','undo-redo'].includes(op)?applySteps(input,[{op:'reverse'},{op:'gain',value:.5}]):op==='copy-reverse'?input.map((x,c)=>Float32Array.from([...x,...clip[c]])):clip
    return { channels, observations: { sourceAfter: cloneChannels(input), ...(op==='undo-redo'?{undone:cloneChannels(input)}:{}) } }
  }
  throw new RangeError(`Reference workflow not implemented: ${test.workflow.op}`)
}
