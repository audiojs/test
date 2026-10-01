// Benchmarks use the same operation/oracle contract as correctness tests.
export const benchmarkProfiles=[
 {id:'short-mono',title:'0.1 s · mono',frames:4800,channels:1},
 {id:'stereo',title:'1 s · stereo',frames:48000,channels:2},
 {id:'long-stereo',title:'10 s · stereo',frames:480000,channels:2}
]
function impulse(length){
 let state=5731
 return Array.from({length},(_,i)=>{
  state^=state<<13;state^=state>>>17;state^=state<<5
  return Math.fround(i===0?.5:((state>>>0)/4294967296*2-1)*.01*(length-i)/length)
 })
}
export function benchmarkCases(){
 const cases=[]
 const impulses=[1024,48000].map(length=>impulse(length))
 for(const profile of benchmarkProfiles){
  const {frames,channels}=profile,fixture={signal:'sine',frequency:440,amplitude:.1,frames,channels,sampleRate:48000}
  const add=(id,title,group,steps,oracle={type:'exact',atol:1e-6},extra={})=>cases.push({id:`${id}-${profile.id}`,title,group,profile:profile.id,profileTitle:profile.title,fixture:{...fixture,...extra},steps,oracle})
  const n=Math.floor(frames/4),other={...fixture,frames:n,frequency:997}
  for(const [id,title,step] of [
   ['reverse','Reverse',{op:'reverse'}],['reverse-range','Reverse selection',{op:'reverse-range',start:n,length:2*n}],
   ['trim','Trim',{op:'trim',start:n,length:2*n}],['remove','Remove selection',{op:'remove',start:n,length:n}],
   ['pad','Add silence',{op:'pad',before:n,after:n}],['repeat','Repeat',{op:'repeat',count:2}],
   ['gain','Adjust volume',{op:'gain-db',db:-6}],['fade-in','Fade in',{op:'fade',direction:'in',length:frames,curve:'linear'}],
   ['fade-out','Fade out',{op:'fade',direction:'out',length:frames,curve:'linear'}],
   ['normalize','Normalize peaks',{op:'normalize',db:-3}],['mix','Mix',{op:'mix',at:n,other}],
   ['insert','Insert',{op:'insert',at:n,other}],['crossfade','Crossfade',{op:'crossfade',length:n,curve:'linear',other}],
   ['derivative','Derivative',{op:'derivative'}],['integral','Integral',{op:'integral'}]
  ])add(id,title,'Editing',[step])
  add('chain','Reverse → gain → fade','Editing',[{op:'reverse'},{op:'gain-db',db:-6},{op:'fade',direction:'out',length:frames,curve:'linear'}])
  if(channels===2)for(const [op,title] of [['swap','Swap channels'],['mono','Mix to mono'],['balance','Stereo balance']])add(op,title,'Channels',[{op,value:.5}])
  else add('duplicate','Mono to stereo','Channels',[{op:'duplicate'}])
  for(const [op,title,min,max] of [
   ['lowpass','Low-pass',-2,.1],['highpass','High-pass',-17,-12],['bandpass','Band-pass',-6,-1],
   ['notch','Notch',-4,-.1],['allpass','All-pass',-.1,.1],['lowshelf','Low shelf',4,7],
   ['highshelf','High shelf',-.1,2],['eq','Equalizer',0,3]
  ])add(op,title,'Filters',[{op,freq:1000,Q:Math.SQRT1_2,gain:6}],{type:'response',min,max})
  for(const name of ['min','max','peak','rms','dc','energy','zcr'])add(`analysis-${name}`,({min:'Lowest sample',max:'Highest sample',peak:'Peak level',rms:'RMS level',dc:'DC offset',energy:'Signal energy',zcr:'Zero-crossing rate'})[name],'Analysis',[{op:'analyze',name}],{type:'scalar',atol:name==='zcr'?.001:1e-5})
  const size=2**Math.floor(Math.log2(frames))
  add('spectrum',`FFT · ${size.toLocaleString('en-US')} samples`,'Analysis',[{op:'measure',name:'spectrum',size,window:'hann'}],{type:'spectrum',hzTolerance:48000/size,amplitudeTolerance:.01},{frequency:1500,phase:0})
  add('resample','Resample 48 → 16 kHz','Time & pitch',[{op:'resample',to:16000}],{type:'resample',to:16000,min:-.25,max:.25,frequency:440})
  add('resample-up','Resample 48 → 96 kHz','Time & pitch',[{op:'resample',to:96000}],{type:'resample',to:96000,min:-.25,max:.25,frequency:440})
  add('stretch','Stretch to 1.5×','Time & pitch',[{op:'stretch',factor:1.5}],{type:'tone',lengthFactor:1.5,frequency:440})
  add('pitch','Pitch up 7 semitones','Time & pitch',[{op:'pitch',semitones:7}],{type:'tone',lengthFactor:1,frequency:440*2**(7/12)})
  add('speed','Playback at 1.5×','Time & pitch',[{op:'speed',factor:1.5}],{type:'tone',lengthFactor:1/1.5,frequency:660})
  add('delay','Delay with feedback','Effects',[{op:'delay',delayFrames:240,feedback:.5,mix:1}])
  add('convolve','Convolve with 3-tap response','Effects',[{op:'convolve',impulse:[1,.5,-.25],tail:true}])
  for(const response of impulses)add(`convolve-${response.length}`,`Convolve · ${response.length.toLocaleString('en-US')} taps`,'Effects',[{op:'convolve',impulse:response,tail:true}],{type:'convolution-dc',atol:2e-5},{signal:'dc',value:.125})
  if(frames>=48000)add('denoise','Remove background noise','Effects',[{op:'denoise',noiseFrames:24000,reduction:12}],{type:'denoise',minImprovement:3,maxSignalLoss:1,minNoiseReduction:6},{signal:'tone-noise',frequency:997,amplitude:.2,noiseAmplitude:.05,seed:5731,startFrames:24000})
  add('compressor','Compress 4:1','Dynamics',[{op:'compressor',threshold:-18,ratio:4,knee:0,attack:.001,release:.01,makeup:0}],{type:'response',min:-9.3,max:-8.7},{signal:'dc',value:.5})
  add('limiter','Limit at −6 dB','Dynamics',[{op:'limiter',ceiling:-6,lookahead:0,release:.01}],{type:'response',min:-4.3,max:-3.8},{signal:'dc',value:.8})
  add('gate','Open noise gate','Dynamics',[{op:'gate',threshold:-30,attack:.001,hold:0,release:.01}],{type:'response',min:-.1,max:.1},{signal:'dc',value:.5})
  if(frames>=48000)add('loudness','Integrated loudness','Analysis',[{op:'measure',name:'loudness'}],{type:'scalar-range',min:-23.1,max:-22.9},{frequency:1000,phase:0,amplitude:10**(-23/20)})
 }
 return cases
}
