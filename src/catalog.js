// Case expansion is deterministic. Each variant is a full, independently reproducible case.
export function catalog(ecosystem) {
  const features = [], cases = []
  const feature = (id, title, category, contract, source = 'canonical') => {
    if (!features.some(f => f.id === id)) features.push({ id, title, category, class: source, contract, sources: [], support: {} })
    return id
  }
  const add = (id, feat, fixture, steps, oracle, extra = {}) => cases.push({ id, feature: feat, title: id.replaceAll('.', ' · '), status: 'active', tier: 'core', fixture: { sampleRate: 48000, channels: 1, frames: 4097, signal: 'sample-id', ...fixture }, steps, oracle, ...extra })
  const exact = { type: 'exact', atol: 1e-6 }
  for(const op of ['mix','insert','crossfade'])for(const frames of [17,1025,65537])for(const channels of [1,2])for(const position of ['start','middle','end']){
    if(op==='crossfade'&&position!=='end')continue
    const other={signal:'dc',value:.125,frames:17,channels,sampleRate:48000},at=position==='start'?0:position==='end'?frames:Math.floor(frames/2)
    add(`edit.${op}.${frames}.${channels}.${position}`,feature(`edit.${op}`,op,'Editing',op==='mix'?'Sum at an explicit offset without normalization or extending the destination.':op==='insert'?'Insert independent PCM at the frame offset; preserve all original samples.':'Overlap the destination tail and source head with complementary linear weights i/N; duration is A+B−N.'),{frames,channels},[{op,other,at,length:8,curve:'linear'}],exact)
  }
  const edits = {
    reverse: [{ op: 'reverse' }],
    'reverse-range': [{ op: 'reverse-range', start: 1, length: 15 }],
    trim: [{ op: 'trim', start: 1, length: 15 }],
    remove: [{ op: 'remove', start: 1, length: 15 }],
    pad: [{ op: 'pad', before: 7, after: 13 }],
    repeat: [{ op: 'repeat', count: 3 }],
    invert: [{ op: 'gain', value: -1 }],
    mute: [{ op: 'gain', value: 0 }],
    gain: [{ op: 'gain', value: 0.25 }],
    'gain-db': [{ op: 'gain-db', db: -6 }],
    'fade-in': [{ op: 'fade', direction: 'in', length: 16 }],
    'fade-out': [{ op: 'fade', direction: 'out', length: 16 }],
    derivative: [{ op: 'derivative' }],
    integral: [{ op: 'integral' }]
  }
  for (const [name, steps] of Object.entries(edits)) {
    const f = feature(`edit.${name}`, name, 'Editing', 'Explicit frame coordinates; the reference uses direct array algebra. Float roundoff ≤ 1e-6; no normalization.')
    for (const frames of [1, 17, 1023, 1024, 1025, 65537]) for (const channels of [1, 2]) {
      if (frames === 1 && ['fade-in','fade-out'].includes(name)) continue
      const mapped = steps.map(s => ({ ...s, ...(s.start != null ? { start: Math.min(s.start, frames - 1), length: Math.min(s.length, frames - Math.min(s.start,frames-1)) } : {}), ...(s.op === 'fade' ? { length: Math.min(s.length, frames) } : {}) }))
      add(`${f}.${frames}f.${channels}ch`, f, { frames, channels }, mapped, exact)
    }
  }
  for (const db of [-60,-12,0,6]) for (const rate of [8000,44100,96000]) add(`level.gain.${db}db.${rate}`, feature('level.gain', 'Gain', 'Level', 'Scale by 10^(dB/20).'), { sampleRate: rate, signal: 'sine', amplitude: .125 }, [{ op: 'gain-db', db }], exact)
  for (const curve of ['linear','exp','log','cos']) for (const direction of ['in','out']) add(`edit.fade.${curve}.${direction}`, feature('edit.fade', 'Fade curves', 'Editing', 'N-frame fade samples t=i/N; curves t, t², √t and (1−cos πt)/2.'), { signal:'dc', value:.5 }, [{op:'fade',direction,length:4097,curve}], exact)
  for (const name of ['swap','mono','duplicate']) {
    const f = feature(`channels.${name}`, name, 'Channels', 'Explicit channel map; stereo downmix is the arithmetic mean.')
    for (const frames of [17,1025,65537]) add(`${f}.${frames}`,f,{frames,channels:name==='duplicate'?1:2},[{op:name}],exact)
  }
  for (const value of [-1,-.5,0,.5,1]) add(`channels.balance.${value}`,feature('channels.balance','Stereo balance','Channels','Linear attenuation of one stereo channel; neither channel is boosted.'),{channels:2},[{op:'balance',value}],exact)
  for (const db of [-12,-3,0]) for(const signal of ['sine','sample-id','silence']) add(`level.normalize.${db}.${signal}`,feature('level.peak-normalize','Peak normalization','Level','One linked gain, DC retained; silent input remains silent.'),{signal,channels:2},[{op:'normalize',db}],exact)
  for (const name of ['min','max','peak','rms','dc','energy','zcr']) for (const signal of ['dc','sine','impulse','silence']) {
    const f=feature(`analysis.${name}`,name,'Analysis','Independent mathematical statistic over all input samples; ZCR ignores the initial sample.')
    add(`${f}.${signal}`,f,{signal,frames:4800},[{op:'analyze',name}],{type:'scalar',atol:name==='zcr'?.001:1e-5})
  }
  for(const name of ['lowpass','highpass','bandpass','notch','allpass','lowshelf','highshelf','eq']) {
    const f=feature(`filter.${name}`,name,'Filters','Second-order biquad, Q=1/√2. Steady-state sinusoidal response; declared gain bands after discarding the first half-second.')
    for(const sampleRate of [16000,48000,96000]) for(const ratio of [.1,1,4]) {
      const frequency=1000*ratio, gain=6, q=.7071067811865476
      let target, tolerance
      if(name==='lowpass') target=ratio===1?-3.0103:ratio<1?0:-24.1
      if(name==='highpass') target=ratio===1?-3.0103:ratio<1?-40:0
      if(name==='bandpass') target=ratio===1?0:ratio<1?-17:-9
      if(name==='notch') target=ratio===1?-80:0
      if(name==='allpass') target=0
      if(name==='lowshelf') target=ratio===1?3:ratio<1?6:0
      if(name==='highshelf') target=ratio===1?3:ratio<1?0:6
      if(name==='eq') target=ratio===1?6:ratio<1?0:.45
      tolerance=name==='notch'&&ratio===1?null:(['bandpass'].includes(name)?4:(ratio===4?4:1))
      add(`${f}.${sampleRate}.${ratio}`,f,{signal:'sine',frequency,frames:sampleRate,sampleRate,amplitude:.1},[{op:name,freq:1000,Q:q,gain}],{type:'response',min: tolerance==null?-400:target-tolerance,max:tolerance==null?-35:target+tolerance},{tier:'quality'})
    }
  }
  for(const op of ['lowpass','highpass'])for(const sampleRate of [16000,48000,96000])for(const ratio of [.1,1,4]){
    const w=Math.tan(Math.PI*1000*ratio/sampleRate)/Math.tan(Math.PI*1000/sampleRate)
    const gain=20*Math.log10((op==='highpass'?w:1)/Math.sqrt(1+w*w))
    add(`filter.${op}1.${sampleRate}.${ratio}`,feature(`filter.${op}1`,`${op} (one pole)`,'Filters','First-order bilinear low/highpass response, ±0.3 dB.'),{signal:'sine',frequency:1000*ratio,frames:sampleRate,sampleRate,amplitude:.1},[{op,freq:1000,order:1,Q:.7071067811865476}],{type:'response',min:gain-.3,max:gain+.3},{tier:'quality'})
  }
  for(const [name,params] of Object.entries({compressor:{ratio:1,upRatio:1,makeup:0},tremolo:{depth:0},delay:{mix:0},freeverb:{mix:0},distortion:{mix:0}}))for(const sampleRate of [16000,48000,96000])for(const channels of [1,2]){
    add(`neutral.${name}.${sampleRate}.${channels}`,feature(`neutral.${name}`,`${name}: neutral settings`,'DSP invariants','Declared bypass settings preserve every input sample and frame.'),{signal:'sample-id',frames:4097,sampleRate,channels},[{op:'processor',name,params}],{type:'neutral',atol:1e-6},{tier:'quality'})
  }
  for(const [from,to] of [[44100,48000],[48000,16000],[16000,48000],[96000,44100]]) {
    const f=feature('rate.resample','Resampling','Time and rate','Duration and pitch preserved; steady passband gain within 0.25 dB, rejection at 0.7×input rate Nyquist ≥40 dB when downsampling.')
    add(`${f}.${from}-${to}.passband`,f,{signal:'sine',frequency:997,sampleRate:from,frames:from},[{op:'resample',to}],{type:'resample',to,min:-.25,max:.25,frequency:997},{tier:'quality'})
    if(to<from) add(`${f}.${from}-${to}.alias`,f,{signal:'sine',frequency:Math.min(from*.4,to*.7),sampleRate:from,frames:from},[{op:'resample',to}],{type:'resample',to,min:-200,max:-40},{tier:'quality'})
  }
  for(const factor of [.75,1,1.5]) {
    add(`rate.stretch.${factor}`,feature('rate.stretch','Time stretch','Time and rate','Duration ratio ±1%; fundamental retained within 2%.'),{signal:'sine',frequency:440,frames:48000},[{op:'stretch',factor}],{type:'tone',lengthFactor:factor,frequency:440},{tier:'quality'})
    add(`rate.speed.${factor}`,feature('rate.varispeed','Varispeed','Time and rate','Duration reciprocal to rate, fundamental multiplied by rate.'),{signal:'sine',frequency:440,frames:48000},[{op:'speed',factor}],{type:'tone',lengthFactor:1/factor,frequency:440*factor},{tier:'quality'})
  }
  for(const semitones of [-7,0,7]) add(`rate.pitch.${semitones}`,feature('rate.pitch','Pitch shift','Time and rate','Duration preserved; fundamental follows equal temperament within 2%.'),{signal:'sine',frequency:440,frames:48000},[{op:'pitch',semitones}],{type:'tone',lengthFactor:1,frequency:440*2**(semitones/12)},{tier:'quality'})
  for(const op of ['copy-reverse','clip-reverse','clone-reverse','undo','stream']) for(const frames of [17,1025,65537]) {
    const f=feature(`editor.${op}`,op,'Editor integrity','Exact edited samples and source/stream/history observations must match independently constructed results.','editor')
    add(`${f}.${frames}`,f,{frames,channels:2},[],{type:'workflow',atol:0},{workflow:{op,start:1,length:Math.floor(frames/2)}})
  }
  for(const count of [1,3,11]) add(`composition.reverse-gain.${count}`,feature('execution.composition','Ordered composition','Execution','Repeated editing and gain compose in order without changing source ownership.'),{channels:2},Array.from({length:count},()=>[{op:'reverse'},{op:'gain',value:.5}]).flat(),exact)

  // Synthetic behavioral contracts. Published signal definitions are generated here;
  // no restricted programme recordings or contender output become golden data.
  const quality=(id,f,title,fixture,steps,oracle,extra={})=>add(id,f,fixture,steps,oracle,{tier:'quality',title,...extra})
  const ebu='https://tech.ebu.ch/docs/tech/tech3341.pdf'
  // Fixed 10^(dB/20) constants keep the serialized fixtures identical across
  // JS runtimes whose exponentiation differs in the last floating-point bit.
  const ebuAmplitude={'-72':0.00025118864315095795,'-36':0.015848931924611134,'-33':0.0223872113856834,'-26':0.05011872336272722,'-23':0.0707945784384138,'-20':0.1}
  const itu='https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf'
  const scalar=(value,tolerance)=>({type:'scalar-range',min:value-tolerance,max:value+tolerance})

  const pcm16=[-1,-32767/32768,-1/32768,0,1/32768,32767/32768,.5,-.25]
  for(const format of ['wav','flac']){
    const f=feature(`codec.${format}`,`${format.toUpperCase()} lossless roundtrip`,'Codecs','Encode nonempty 16-bit PCM, decode it, and preserve every sample, channel and sample rate. Includes a byte stream split after the first byte and before the last byte. Metadata, lossy formats and corrupted files are separate coverage.','standard')
    for(const [frames,sampleRate] of [[1,8000],[17,44100],[1025,48000]])for(const channels of [1,2]){
      const fixture={signal:'array',frames,channels,sampleRate,samples:Array.from({length:channels},(_,c)=>Array.from({length:frames},(_,i)=>pcm16[(i+c*3)%pcm16.length]))}
      quality(`codec.${format}.${frames}f.${channels}ch`,f,`${format.toUpperCase()}: ${frames} frames, ${channels} channels`,fixture,[],{type:'exact',atol:0},{workflow:{op:'codec-roundtrip',format}})
      if(frames===1025&&channels===2)quality(`codec.${format}.byte-boundaries`,f,`${format.toUpperCase()}: first and final byte boundaries`,fixture,[],{type:'exact',atol:0},{workflow:{op:'codec-roundtrip',format,split:true}})
    }
  }

  quality('editor.copy-reverse-source-isolation','editor.fragment-isolation','Copy and reverse preserve the original',{frames:1025,channels:2},[],{type:'workflow',atol:0},{tier:'core',workflow:{op:'copy-reverse',start:127,length:769}})
  quality('editor.undo-redo.roundtrip',feature('editor.undo-redo','Undo and redo','Editor integrity','Undo restores input samples; redo restores the edited result. Clipboard persistence is a separate unmeasured behavior.','editor'),'Undo and redo restore original and edited samples',{frames:1025,channels:2},[],{type:'workflow',atol:0},{tier:'core',workflow:{op:'undo-redo'},limitations:['Clipboard history is not exercised by this audio-buffer roundtrip.']})
  quality('editor.seams.reverse-boundaries',feature('editor.seams','Reverse boundary jumps','Editor integrity','Measure both jumps introduced by exact range reversal. Click suppression would change the samples and requires a separate smoothing operation.','editor'),'Exact reverse and its two boundary discontinuities',{frames:1025,channels:2},[{op:'reverse-range',start:127,length:769}],{type:'seams',atol:1e-6,boundaries:[127,896]},{limitations:['This measures exact reversal; it does not claim automatic click suppression.']})
  quality('edit.mix.impulses','edit.mix','Mix impulses at an explicit offset',{signal:'impulse',frames:65,at:17,amplitude:.5},[{op:'mix',at:17,other:{signal:'impulse',frames:17,channels:1,sampleRate:48000,at:0,amplitude:.25}}],exact,{tier:'core'})
  quality('edit.fade.linear','edit.fade','Linear fade at explicit sample coordinates',{signal:'dc',value:.5,frames:17},[{op:'fade',direction:'in',length:17,curve:'linear'}],exact,{tier:'core'})
  quality('edit.crossfade.equal-power','edit.crossfade','Equal-power weights, including the correlated midpoint gain',{signal:'dc',value:.25,frames:64},[{op:'crossfade',length:32,curve:'equal-power',other:{signal:'dc',value:.25,frames:64,channels:1,sampleRate:48000}}],exact,{limitations:['Equal-power preserves power for uncorrelated inputs; identical inputs gain 3.01 dB at the midpoint. It cannot preserve both correlated and uncorrelated level.']})
  features.find(f=>f.id==='edit.crossfade').contract='Linear complementary weights and sine/cosine equal-power weights at i/N. Duration is A+B−N; correlated equal-power inputs rise at the midpoint.'
  quality('level.peak-normalize.target','level.peak-normalize','Peak target and linked-channel shape',{signal:'sine',frames:4800,channels:2,amplitude:.17},[{op:'normalize',db:-3}],exact,{tier:'core'})
  const loudnessFeature=feature('analysis.loudness','Integrated loudness','Analysis','Synthesized EBU Tech 3341 table 1 signals test stereo calibration and gating. These results are not the complete EBU/BS.2217 compliance suite.','standard')
  for(const [index,level] of [[1,-23],[2,-33]])quality(index===1?'analysis.loudness.ebu':`analysis.loudness.ebu-${index}`,loudnessFeature,`EBU signal ${index}: in-phase stereo 1 kHz at ${level} dBFS`,{signal:'sine',frequency:1000,amplitude:ebuAmplitude[level],phase:0,frames:960000,channels:2},[{op:'measure',name:'loudness'}],scalar(level,.1),{source:{url:ebu,section:`Table 1, signal ${index}`,kind:'independently synthesized specified signal'},limitations:['Integrated loudness only; momentary, short-term and programme recordings are not covered by this case.']})
  // Preserve the specified durations: shortening these would silently change gating tests.
  for(const [index,segments] of [[3,[[10,-36],[60,-23],[10,-36]]],[4,[[10,-72],[10,-36],[60,-23],[10,-36],[10,-72]]],[5,[[20,-26],[20.1,-20],[20,-26]]]]){
    const parts=segments.map(([seconds,level])=>({signal:'sine',frames:Math.round(seconds*48000),frequency:1000,amplitude:ebuAmplitude[level],phase:0}))
    quality(`analysis.loudness.ebu-${index}`,loudnessFeature,`EBU signal ${index}: integrated loudness gating`,{signal:'segments',frames:parts.reduce((n,p)=>n+p.frames,0),channels:2,segments:parts},[{op:'measure',name:'loudness'}],scalar(-23,.1),{source:{url:ebu,section:`Table 1, signal ${index}`,kind:'independently synthesized specified signal'}})
  }
  const truePeakFeature=feature('analysis.true-peak','True peak','Analysis','Synthesized EBU Tech 3341 table 1 signals 15–19 include intersample and above-full-scale peaks. Programme and burst signals remain separate coverage.','standard')
  for(const [index,divisor,phase,amplitude,target] of [[15,4,0,.5,-6],[16,4,Math.PI/4,.5,-6],[17,6,Math.PI/3,.5,-6],[18,8,3*Math.PI/8,.5,-6],[19,4,Math.PI/4,1.41,3]])quality(index===15?'analysis.true-peak.bs1770':`analysis.true-peak.ebu-${index}`,truePeakFeature,`EBU signal ${index}: true peak ${target} dBTP`,{signal:'sine',frequency:48000/divisor,phase,amplitude,frames:48000,channels:2,fadeFrames:480},[{op:'measure',name:'true-peak'}],{type:'scalar-range',min:target-.4,max:target+.2},{source:{url:ebu,section:`Table 1, signal ${index}`,kind:'independently synthesized specified signal'},limitations:['Signals 20–23 and the ITU BS.2217 programme suite are not included.']})
  quality('level.loudness-normalize.target',feature('level.loudness-normalize','Loudness normalization','Level','Reach a synthetic stereo tone target, checked with independent BS.1770 K-weighting and a reconstructed peak ceiling. Full programme normalization remains outside this test.','standard'),'Normalize stereo tone to −23 LUFS with −1 dBTP ceiling',{signal:'sine',frequency:1000,amplitude:.5,phase:0,frames:144000,channels:2},[{op:'normalize-loudness',target:-23,ceiling:-1}],{type:'loudness-target',target:-23,tolerance:.2,ceiling:-1},{source:{url:itu,section:'Annex 1',kind:'independent 48 kHz implementation'}})

  quality('rate.resample.snr-bandwidth','rate.resample','Resampling a 997 Hz tone: ≥70 dB waveform SNR',{signal:'sine',frequency:997,amplitude:.25,phase:0,frames:48000,channels:2},[{op:'resample',to:32000}],{type:'resample-snr',to:32000,minSnr:70},{limitations:['SNR is measured on the interior of one passband tone. Separate catalog cases test passband and alias rejection.']})
  quality('rate.resample.chunk-invariance',feature('execution.block-invariance','Chunk boundaries','Execution','Streaming resampling must agree with the same native engine processing one batch, including the final flush; reversed samples also cross an engine-sized boundary.'),'Stateful resampling matches batch across irregular chunks',{signal:'sine',frequency:997,amplitude:.25,phase:0,frames:48001,channels:2},[],{type:'chunk-equivalence',atol:1e-5},{workflow:{op:'resample-chunks',to:32000,chunks:[1,17,1024,31,4096]}})
  quality('rate.varispeed.duration-pitch','rate.varispeed','Speed 1.25× changes duration and pitch',{signal:'sine',frequency:440,frames:48000},[{op:'speed',factor:1.25}],{type:'tone',lengthFactor:.8,frequency:550})
  quality('rate.pitch.frequency-duration','rate.pitch','One octave changes pitch without changing duration',{signal:'sine',frequency:440,frames:48000},[{op:'pitch',semitones:12}],{type:'tone',lengthFactor:1,frequency:880})
  quality('rate.stretch.duration-pitch-transient','rate.stretch','Stretch a tone and a separated transient',{signal:'segments',frames:144000,segments:[{signal:'sine',frequency:440,amplitude:.1,frames:48000},{signal:'silence',frames:24000},{signal:'impulse',at:0,amplitude:1,frames:72000}]},[{op:'stretch',factor:1.5}],{type:'stretch-transient',factor:1.5,toneSeconds:.8,frequency:440,searchStart:1.2,transientTime:1.5,timeTolerance:.04})
  quality('filter.biquad.response',feature('filter.biquad','Biquad cutoff','Filters','Second-order Butterworth low-pass at its cutoff must have −3.01 dB steady-state gain; the separate filter sweeps exercise other frequencies.'),'Second-order low-pass cutoff is −3.01 dB',{signal:'sine',frequency:1000,frames:48000,amplitude:.1},[{op:'lowpass',freq:1000,Q:Math.SQRT1_2}],{type:'response',min:-3.11,max:-2.91})
  quality('filter.eq.response','filter.eq','Parametric EQ reaches its +6 dB center gain',{signal:'sine',frequency:1000,frames:48000,amplitude:.1},[{op:'eq',freq:1000,Q:Math.SQRT1_2,gain:6}],{type:'response',min:5.9,max:6.1})

  const dynamicsFixture={signal:'segments',frames:96000,segments:[{signal:'dc',value:.03,frames:24000},{signal:'dc',value:.5,frames:48000},{signal:'dc',value:.03,frames:24000}]}
  quality('dynamics.compressor.envelope',feature('dynamics.compressor','Compressor','Dynamics','Stepped DC checks the settled 4:1 transfer above threshold and gain recovery. Timing windows test settling, not equivalence of vendor-specific attack definitions.'),'Compressor transfer, attack settling and release recovery',dynamicsFixture,[{op:'compressor',threshold:-18,ratio:4,knee:0,attack:.01,release:.1,makeup:0}],{type:'dynamics',windows:[{start:.3,end:.45,minDb:-.1,maxDb:.1},{start:.501,end:.503,minDb:-8,maxDb:0},{start:.9,end:1.3,minDb:-9.2,maxDb:-8.7},{start:1.501,end:1.505,minDb:-10,maxDb:-2},{start:1.9,end:1.99,minDb:-.5,maxDb:.1}]})
  const limiterFeature=feature('dynamics.limiter','Limiter','Dynamics','Check a sample-peak ceiling and output timeline alignment on a low probe followed by an overload. Internal latency reporting and intersample brickwall limiting are separate contracts.')
  for(const lookahead of [.005,0])quality(lookahead?'dynamics.limiter.ceiling-latency':'dynamics.limiter.zero-lookahead',limiterFeature,`Limiter ceiling and timeline alignment (${lookahead*1000} ms lookahead)`,{signal:'segments',frames:48000,segments:[{signal:'silence',frames:4800},{signal:'impulse',amplitude:.1,at:0,frames:4800},{signal:'dc',value:.8,frames:28800},{signal:'silence',frames:9600}]},[{op:'limiter',ceiling:-6,lookahead,release:.05}],{type:'limiter',ceiling:-6,atol:1e-5,probeThreshold:.05,latencyTolerance:1},{limitations:['Measured latency is effective output alignment, not a claim about internal algorithm latency metadata.']})
  const gateFeature=feature('dynamics.gate','Noise gate','Dynamics','Stepped DC checks closed/open levels, post-threshold hold and release settling. Does not claim identical vendor envelope curves.')
  for(const hold of [.02,0])quality(hold?'dynamics.gate.envelope':'dynamics.gate.zero-hold',gateFeature,`Gate opens, holds and settles (${hold*1000} ms hold)`,{signal:'segments',frames:96000,segments:[{signal:'dc',value:.001,frames:24000},{signal:'dc',value:.5,frames:24000},{signal:'dc',value:.001,frames:48000}]},[{op:'gate',threshold:-30,attack:.005,hold,release:.05}],{type:'dynamics',windows:[{start:.3,end:.45,minDb:-600,maxDb:-35},{start:.8,end:.95,minDb:-.2,maxDb:.2},...(hold?[{start:1.002,end:1.01,minDb:-.5,maxDb:.2}]:[]),{start:1.8,end:1.99,minDb:-600,maxDb:-35}]})
  quality('effect.delay.impulse',feature('effect.delay','Delay and echo','Effects','A wet delay copies each impulse after an exact frame offset. Feedback echoes use declared geometric gains.'),'Delay places three decaying impulse copies',{signal:'impulse',frames:9600,at:0,amplitude:.5},[{op:'delay',delayFrames:2400,feedback:.5,mix:1}],exact,{tier:'core'})
  quality('effect.convolution.impulse',feature('effect.convolution','Convolution','Effects','Direct linear convolution with a declared short impulse response preserves the full N+M−1 tail.'),'Convolution yields a literal impulse response and full tail',{signal:'array',frames:4,values:[1,0,0,.5]},[{op:'convolve',impulse:[1,.5,-.25],tail:true}],exact,{tier:'core'})
  quality('restoration.dither.statistics',feature('restoration.dither','Dither','Restoration','On digital silence, non-subtractive TPDF plus quantization gives the expected zero/±1 LSB probabilities, unbiased mean and uncorrelated successive samples.'),'16-bit TPDF quantization statistics on silence',{signal:'silence',frames:65536,channels:2},[{op:'dither',bits:16,distribution:'tpdf'}],{type:'dither',bits:16},{limitations:['No noise-shaping or perceptual claim; tolerances test a finite statistical sample.']})
  quality('restoration.denoise.reference',feature('restoration.denoise','Noise reduction','Restoration','A seeded stationary-noise prefix is followed by a clean-reference tone plus the same noise. Measure SNR improvement, signal gain and noise-only suppression.'),'Profiled denoise improves a tone in stationary noise',{signal:'tone-noise',frames:144000,startFrames:24000,frequency:997,amplitude:.2,noiseAmplitude:.05,seed:5731},[{op:'denoise',noiseFrames:24000,reduction:12}],{type:'denoise',minImprovement:3,maxSignalLoss:1,minNoiseReduction:6},{limitations:['Synthetic stationary noise only; speech/music corpora and perceptual listening studies are not covered.']})
  quality('analysis.level.analytic',feature('analysis.level','Peak, RMS and DC','Analysis','Joint linear peak, RMS and signed mean are checked by independent streaming reductions over all samples.'),'Joint levels of a deterministic stereo signal',{signal:'sample-id',frames:48000,channels:2},[{op:'measure',name:'levels'}],{type:'levels',atol:1e-5})
  quality('analysis.spectrum.analytic',feature('analysis.spectrum','Spectrum','Analysis','A bin-centered sine must produce the correct dominant FFT frequency and coherent-gain-corrected amplitude with a Hann window.'),'Hann-window FFT frequency and amplitude',{signal:'sine',frames:4096,frequency:1500,amplitude:.25,phase:0},[{op:'measure',name:'spectrum',size:4096,window:'hann'}],{type:'spectrum',hzTolerance:48000/4096,amplitudeTolerance:.01})
  const pitchFeature=feature('analysis.pitch','Fundamental pitch','Analysis','Synthetic isolated tones at several pitches and levels test frequency estimates. Polyphony, voicing and licensed real-performance corpora remain separate coverage.')
  for(const frequency of [110,440,1760])quality(frequency===440?'analysis.pitch.synthetic-corpus':`analysis.pitch.tone-${frequency}`,pitchFeature,`Pitch of a ${frequency} Hz synthetic tone`,{signal:'sine',frequency,frames:96000,amplitude:.2,phase:0},[{op:'measure',name:'pitch',minFrequency:50,maxFrequency:2000}],{type:'scalar-range',min:frequency*2**(-10/1200),max:frequency*2**(10/1200)},{limitations:['Single voiced tone only; real performance and unvoiced classification are not measured.']})
  const rhythmFeature=feature('analysis.onset-tempo','Onsets and tempo','Analysis','Known isolated clicks test onset matching and tempo without octave equivalence; a wrong half/double tempo fails.')
  const rhythm={signal:'clicks',frames:384000,events:Array.from({length:15},(_,i)=>(i+1)*.5),amplitude:.8}
  quality('analysis.onset-tempo.synthetic',rhythmFeature,'Onset times of fifteen isolated clicks',rhythm,[{op:'measure',name:'onsets'}],{type:'events',tolerance:.05,minFscore:.95})
  quality('analysis.onset-tempo.tempo',rhythmFeature,'Tempo of a 120 BPM click track',rhythm,[{op:'measure',name:'tempo'}],scalar(120,3.6))

  // Processor integrity is a distinct result class; it never claims algorithm quality.
  for(const method of ecosystem.methods.filter(m=>m.kind==='processor')) {
    const f=feature(`processor.${method.name}`,method.name,'Processor integrity',`Public ${method.name} method: output must be nonempty, rectangular and finite, and input PCM must remain unchanged. Algorithm quality requires its own metric contract.`,'specialized')
    const meta=features.find(x=>x.id===f)
    meta.package=method.module.replace(/\/audio$/,'')
    meta.url=`https://github.com/audiojs/audio/blob/main/audio.js`
    for(const [signal,frames,channels] of [['silence',1025,1],['impulse',4097,2],['sine',4800,1]]) add(`${f}.${signal}.${frames}.${channels}`,f,{signal,frames,channels,amplitude:.2},[{op:'processor',name:method.name,params:{}}],{type:'integrity'},{tier:'quality',level:'integrity'})
    // Probe a meaningful non-default continuous parameter; avoid arbitrary invalid shapes or user assets.
    const entry=Object.entries(method.params||{}).find(([k,p])=>p.type==='number'&&Number.isFinite(p.min)&&Number.isFinite(p.max)&&p.max>p.min&&!['seed','duration','length','size','fftSize'].includes(k))
    if(entry){const [key,p]=entry; for(const value of [p.min,p.max]) add(`${f}.${key}.${value}`,f,{signal:'sine',frames:4800,amplitude:.1},[{op:'processor',name:method.name,params:{[key]:value}}],{type:'integrity'},{tier:'quality',level:'integrity'})}
  }
  return {features,cases}
}
