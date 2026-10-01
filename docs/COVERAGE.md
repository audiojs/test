# What this comparison covers

The catalogue contains **79 behavior features with 493 cases**, plus **122 basic checks with 604 cases**. All 1,097 cases are executable. That does not make this a complete test of audio software: a finite-output check for a reverb says much less than a measured impulse response.

The report keeps those two kinds of evidence separate. A fully passing feature has passed every active case assigned to it. A partial feature has untested cases, even when every result that exists passes. A skip means this adapter cannot execute the declared contract; it does not prove that the application lacks the general capability.

Specialists should be compared on their work. SoXR and libsamplerate are resamplers; pyloudnorm is a loudness meter. Counting their missing editing or effect operations against them would reward breadth instead of answering which tool does a particular job well.

## Coverage added in this review

| Area | New evidence |
| --- | --- |
| Streaming resampling | audio's public pushed-stream API now runs the same irregular-chunk contract as SoXR and libsamplerate. Separate regressions cover empty and one-frame input, final flush boundaries, repeated A/A/B inputs, and recovery after invalid requests. |
| Peak normalization | FFmpeg now uses its native peak measurement and volume filter with a shared gain across channels; silence remains finite. |
| Derivative and integral | SoX's native FIR and biquad filters now run these cases. Its internal range limit remains visible: outputs above full scale differ from the unrestricted float contract. |
| Neutral effects | Pedalboard now tests native mute, ratio-one compression, dry delay and dry reverb. Requested controls are translated into native API units; unsupported controls still skip. |
| File round trips | Public WAV16 and FLAC16 encode/decode paths now test one-frame, short and block-boundary mono/stereo inputs. audio also tests byte-stream boundaries, including empty writes. These lossless fixtures do not establish lossy-codec quality. |
| Channel independence | Quality checks now inspect every output channel. Regressions deliberately mute, bypass, retune or delay only the right channel. Chunk tests also reject a broken right channel when both batch and streaming output share the same fault. |
| Long convolution | An independent running-sum expectation checks every sample of constant-input convolution, including the complete tail. Dense 1,024- and 48,000-tap benchmark fixtures avoid relying on the contender as its own reference. SoX reads long kernels from a coefficient file. |

The tests preserve actual differences. There is no rescaling of a failed result, replacement of a native algorithm with reference code, or tolerance increase to make a contender pass.

## What audio still needs

The current run has **1,077 passes, one failure, no errors and 19 skips** for audio across all 1,097 cases. The failure is profiled denoising; the skips are 18 one-pole filter cases and arbitrary-IR convolution. These results describe the tested local source trees, not a registry release. The earlier [source-fix run](../results/audio-fixes/results.json) and [discrepancy review](TRIAGE.md#review-evidence) record the source changes and reproducible checks.

1. **Preserve the wanted signal during denoising.** The profiled synthetic test loses roughly 12 dB of tone level and gets worse waveform SNR. This is a concrete failure of the declared tone-plus-stationary-noise contract. It does not establish performance on speech or music, and passing a finite-output check cannot resolve it.
2. **Preserve the requested delay in frames.** The 5 ms feedback-delay benchmark requests 240 frames at 48 kHz. The public parameter reaches `@audio/effect-delay/delay.js` as Float32: `0.005` becomes `0.004999999888241291`, and `Math.floor(time * fs)` selects 239 frames. An impulse produces echoes at 239, 478, 717 and 956 instead of 240, 480, 720 and 960. This is a measured parameter-precision and frame-conversion defect. The 50 ms correctness case passes, so that case alone does not cover the boundary.
3. **Ship the verified source fixes.** Sample-weighted statistics, reverse/cache behavior and dry effect tails have local regression coverage. The effect packages still use their existing version numbers. Publish patch releases and update dependency locks before claiming clean registry installations contain those fixes.
4. **Expose arbitrary impulse responses through the public audio API.** The installed `@audio/reverb-convolution` component contains direct and FFT convolution, but the tested front end does not expose arbitrary-IR convolution. The current skip is an integration gap, not evidence that no convolution implementation exists.
5. **Keep playback investigations separate from offline edits.** Copy, reverse, undo and stream/read tests check rendered samples and source preservation. The intermittent live-edit playback failure has retained diagnostics but is not established as fixed. Hardware output and scheduling require their own measurements.

The fresh audio benchmark has **six rejected workloads**: delay on short mono, stereo and long stereo inputs (3); denoising on stereo and long stereo inputs (2); and energy measurement on long stereo input (1). Both denoising channels lose about 12 dB of wanted signal. The energy discrepancy is the small relative error discussed below. All six timings are withheld; the one failed correctness case is a separate count.

Replay the three delay workloads from this repository with the same local audio source:

```sh
AUDIO_MODULE="$PWD/../../audio/audio.js" node bin/audio-test.js bench --adapter audio --case delay --repeats 7 --out results/audio-delay-review.local.json
```

The [workload definitions](../src/bench-cases.js) and [benchmark results](../results/benchmarks.json) retain the requested delay, feedback, fixtures and validation errors.

One-pole filters are deliberately unsupported by audio's documented even-order API. Calling order 1 and treating an accidental two-pole response as successful support would make the comparison less useful.

## What failures mean for other tools

Some differences concern a real processing limit; others concern API or output conventions. The failure artifact and declared contract decide which.

- SoX can clip derivative/integral results beyond full scale, and its float transport is not bit-exact in two strict preservation cases.
- FFmpeg's crossfade endpoint convention and stretched output length differ in specific fixtures. Tight energy checks can also expose rounded CLI measurement text in FFmpeg and SoX; that is not evidence of incorrect PCM.
- Pedalboard's limiter adds gain and its convolution normalizes the impulse response. Those behaviors differ from the requested ceiling and unnormalized-kernel contracts.
- SciPy's tested default resampling filter misses the declared 70 dB waveform-SNR target. This is one filter configuration, not a limit on every SciPy design.
- librosa's configured YIN estimator misses the 110 Hz test's 10-cent tolerance. That single synthetic tone cannot rank general pitch tracking.
- Native browser playback resamplers and compressors have their own quality and automatic-gain behavior. An OfflineAudioContext result describes that native path, not every algorithm that could run in a browser.

See [the measured differences](TRIAGE.md#newly-measured-differences) for the original observations. Fresh results identify the exact build and should take precedence over historical counts.

## Current failure review

The reviewed 1,097-case runs across 15 tools contain **88 failures and no adapter errors**. These are retained differences from the declared contracts, not 88 confirmed engine bugs. The regression baseline records these reviewed discrepancies. They remain failures in the report; new discrepancies, adapter errors and lost coverage still fail the gate.

| Tool | Failed cases | Grouped cause or observation |
| --- | ---: | --- |
| audio | 1 | Profiled denoising attenuates the wanted tone. |
| FFmpeg | 22 | Crossfade endpoints (7), integral precision (8), rounded energy measurements (2), one-pole response (1), output duration (3), dither statistics (1). |
| SoX | 18 | Strict float preservation (2), derivative/integral clipping (12), rounded energy measurements (2), one-pole response (1), limiter ceiling (1). |
| librosa | 1 | The configured YIN estimate misses the 110 Hz tolerance. |
| Pedalboard | 2 | Limiter gain and impulse-response normalization differ from the contracts. |
| SciPy | 1 | Default resampling misses the 70 dB SNR threshold on both channels. |
| Chromium / Firefox / WebKit | 9 / 2 / 5 | Chromium pad/repeat boundaries (4); Chromium/WebKit alias rejection (4); SNR (3), compressor behavior (3), feedback-delay timing (2). |
| Audacity | 27 | One-frame exports (14), 17-frame selection reversals (2), fade endpoints (11). |
| SoXR, libsamplerate, pyloudnorm, Rubber Band, SoundTouch | 0 | No failures in their mapped cases; skips remain untested. |

Two observations were missing from the earlier triage notes:

- **FFmpeg dither:** both channels have about −0.5 LSB mean, 0.707 LSB RMS and 50% zero samples. The declared quantized-TPDF silence contract expects approximately zero mean, 0.5 LSB RMS and 75% zeros. The adapter requests native triangular dither and signed 16-bit output. The measured quantization differs; the exact implementation cause remains unconfirmed.
- **SoX limiter:** the native `compand` mapping reaches 0.553898 for a 0.501187 ceiling, about 0.87 dB above the requested limit. Timeline alignment passes. Lookahead and release are supplied, but this transition does not meet the hard-ceiling contract.

FFmpeg's seven crossfade differences include six linear cases and the equal-power case. Its three duration failures are the 1.5× tone stretch (547 frames short), octave pitch shift (1,042 short), and tone-plus-transient stretch (2,026 short). Pitch remains within tolerance in all three; the separated transient also remains within its timing tolerance. The duration failures must not be described as failed pitch estimation.

The earlier long-stereo audio energy benchmark misses an absolute tolerance by **0.0000157359 on a result near 4,800**, a relative difference of approximately **3.28 × 10⁻⁹**. Treat this as a precision-contract limitation. It is not evidence of audible corruption, and its rejected timing remains withheld. Correctness cases and benchmark validation use different fixture sizes; their verdicts should not be conflated.

## Evidence still missing

The loudness and true-peak cases use published synthetic signal definitions and independent calculations. They are not the full official EBU/ITU programme and burst-vector suites. The official asset download was unavailable during this run; no substituted files are described as official vectors.

Speech and music corpora, listening studies, denoising artifacts, stereo image preservation on programme material, automation under live playback, and hardware latency remain outside these bounded tests. WAV16/FLAC16 round trips do not cover every container, bit depth, codec, metadata field or corrupt-file path.

The speed comparison measures complete adapter calls. Native process launches and WAV I/O, Python messages, and browser transfers are included; initial driver/library startup and oracle validation are excluded. Separate FFmpeg overhead measurements help explain short-call costs without subtracting them from workload scores. See [benchmark scope](BENCHMARKS.md).

The current benchmark uses seven timed repetitions after two warmups. Older three-repetition results remain distinguishable by their run metadata. Driver RSS excludes child processes and browsers, so it cannot rank total memory. The comparison still needs process-tree memory, cold startup, long-running allocation/state checks, and real-time deadline measurements before it can support claims about memory efficiency or glitch-free playback. Audacity's Linux container timings remain distinct from the native macOS measurements.
