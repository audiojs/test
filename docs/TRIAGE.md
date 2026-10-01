# Discrepancy review

Measured builds and exact hashes are recorded in results/latest.json. Findings describe the tested settings and shared contracts; they are not upstream bug confirmations.

The standalone registry installation initially produced five RNNoise errors because `@audio/neural-denoise` is optional. The contender profile now explicitly locks that plugin at 0.1.0; all five RNNoise integrity cases pass when provisioned. This was a test-environment dependency, not five separate DSP bugs.

## audio source fixes — 2026-09-30

The follow-up [local run](../results/audio-fixes/results.json) has **1,062 pass, 1 fail, 0 errors, 20 skips** against the expanded 1,083-case catalogue. It uses the patched audio working tree and locally installed effect-delay/freeverb source packages, not new registry releases. This evidence is preserved separately from the current multi-contender report and its reviewed regression baseline.

Verification: audio's complete `npm run test:all` passes after review (852 main tests / 3,972 assertions, plus fixes, batch, CLI, streaming, MCP, browser/playback, REPL and memory suites; 20 platform-specific skips across streaming/browser). The separate website suite passes 134 tests; effect passes 135, reverb 16, and the harness 67 with 10 optional integrations skipped. Twenty-three library regression tests were added. Logs are in [results/audio-fixes/verification](../results/audio-fixes/verification/), including the final full run and the intermittent playback failure described below.

- DC, mean-square, K-weighted energy and correlation now weight blocks by their sample counts, including binned queries. Reversing a partial final block recomputes statistics instead of incorrectly reversing cached block records. The joint-level analysis discrepancy is resolved too.
- Empty/EOF statistics queries no longer include the final block, and finalized pushed audio computes missing statistics instead of throwing. Three-argument custom reducers retain their unbound receiver; a fourth argument exposes sample-count context.
- Constant dry delay and Freeverb no longer append silence. Wet tails remain, including mix automation that starts at zero; unknown delay feedback/time reserves a finite conservative tail.
- The documented filter API supports even orders starting at 2. Unsupported orders now reject. The adapter correctly marks all 18 one-pole cases unmapped, rather than counting twelve accidental passes and six failures as support.
- The canonical delay case renders the input span; the adapter now explicitly crops the library's intentional wet tail to that span. The golden samples and tolerance are unchanged.
- `restoration.denoise.reference` still fails: approximately 12 dB tone attenuation and -11.32 dB SNR improvement. Denoising was not changed by these fixes. Its replay artifacts are retained beside the follow-up result.

### Review evidence

Test names below have the `parity: ` prefix. All sample comparisons are against literal input or directly measured rendered PCM, except the K-energy relation and the explicitly stated fresh-instance comparison.

| Test in sibling audio repository | Exact input and operation sequence | Assertion |
| --- | --- | --- |
| `test/parity.js`: `K-energy weights a one-sample final block` | 48 kHz mono, one-frame 0.5 impulse versus 1,025 frames with only the final frame 0.5; scalar and one-bin energy | Long energy equals one-frame energy / 1,025 within 1e-9. |
| `legacy reducers remain unbound and receive optional block context` | Register a three-argument reducer; query scalar and one bin on one frame of 0.25 | Receiver remains undefined, fourth argument reports length 1, both results equal 0.25; registration removed afterward. |
| `empty statistics and zero-work ranges stay finite` | Empty mono/stereo arrays; then one frame of 0.5, queried at 1/48,000 seconds and with duration 0 | DC/MS/energy equal 0; empty bins stay empty; mono/stereo empty correlation follows its existing 1/0 convention. |
| `pushed statistics survive empty writes, final-boundary splits and A/A/B` | Fresh pushed sources for empty, A, A, B; A is one frame 0.5, B is 1,025 frames of 0.125 with final -0.5. Empty push → split at N-1 or N → stop → read/stats twice | Exact PCM, direct DC/MS, zero-frame EOF read. These are finalized sources, not a claim about resuming a stopped source. |
| `sample-weighted DC/MS at … frames, scalar and bins`; `correlation weights the final block by samples` | 1 / 1,023 / 1,024 / 1,025 / 2,065-frame stereo fixtures; scalar, channel selection, bins and block-aligned range. Correlation: 1,025 frames of 0.25, last right frame -0.25 | Direct sample means, MS = RMS², correlation 1,023/1,025 and final-frame correlation -1. |
| `weighted statistics survive gain, crop, reverse and undo`; `reversed partial and whole blocks are measured on the output grid` | Gain(-6) → crop first 1,024 frames → reverse → undo(3); separately reverse 1,041- and 2,048-frame two-level signals | DC/MS match rendered PCM after each edit; reversed bins match the output grid, including max [0.75, 0.125]. |
| `lowpass/highpass rejects unsupported orders`; `lowpass/highpass accepts default and even orders` | Named and unified APIs reject 0, 1, 3, -2, 2.5, NaN, ±Infinity and unsafe integer; undo afterward. Accept undefined/null/default and 2/4/6/8/10 on 0/1/3-frame impulses | Rejection and recovery preserve source; accepted output is finite, exact length, and actually filtered for nonempty input. |
| `test/plugin-ops.js`: `delay/freeverb dry bypass preserves samples, length and source in read/stream` | 16/48/96 kHz × mono/stereo × 0/1/1,024/1,025 frames; clone → mix:0 → read → stream → read original | Sample-exact bypass, no extra frames, untouched original. |
| `delay/freeverb rerenders A/A/B without stale effect state` | 16 kHz, 1,025 frames; A impulse 0.5 at frame 0, B impulse -0.25 at frame 512; wet render A twice → undo → write B → reapply | A repeats exactly; B equals a fresh B effect instance. |
| `delay/freeverb retains wet tails, including mix automation starting dry`; `delay tail remains finite with automated feedback` | 3,200-frame tone with mix 1/function/curve initially 0 then 1; read → stream → undo. Separately three-frame impulse, feedback callback 0.5 | Audible wet tail, exact stream/read match, atomic undo; automated feedback reserves a finite nonzero delayed impulse. |

Sibling review: RMS and normalization DC already use sample-weighted means; extrema and clipping counts intentionally use max/min and sums. Both filter entry points share validation. Aggregation remains proportional to block count; aligned reversals retain cached remapping, while partial-block reversal must recompute to preserve the output grid. No golden tolerances were relaxed. The generated browser bundle was restored to its pre-review state after the full test run.

Reproduce from a fresh sibling audio checkout. Install the lockfile first, then replace only the two effect packages with archives of their local source trees (a general no-save install can refresh unrelated packages):

```sh
npm ci --ignore-scripts
parity_packages=$(mktemp -d)
npm pack --ignore-scripts --pack-destination "$parity_packages" ../@audio/effect/packages/effect-delay ../@audio/reverb/packages/reverb-freeverb
tar -xzf "$parity_packages/audio-effect-delay-1.0.4.tgz" -C node_modules/@audio/effect-delay --strip-components=1
tar -xzf "$parity_packages/audio-reverb-freeverb-1.0.4.tgz" -C node_modules/@audio/reverb-freeverb --strip-components=1
npm run test:all
npm run test:site
cd ../@audio/test
AUDIO_MODULE="$PWD/../../audio/audio.js" node bin/audio-test.js run --adapter audio --tier quality --out results/audio-fixes/results.json
```

`AUDIO_MODULE` is an absolute path in the command above. Both dependency manifests still have version 1.0.4 in these local source trees; this is not a claim about registry 1.0.4. The verified manifest SHA-256 values are `965d0c1f84192eb98aed02c3148dcc6fd2ab7c181a99b678a1bef88e9145bf54` (effect-delay/audio.js) and `f21065d292a3d5d597abd3263fe96f70cd5dbcd65f8b76c4b6d4873df79dd4a4` (reverb-freeverb/audio.js). Publish patch releases, then update audio's dependency minimums and lockfile before treating this as fixed for clean registry installs.

## audio — original run

- `analysis.dc.sine`: arithmetic mean 0.00109286774 versus `stat('dc')` 0.00146132694, for a deterministic 4,800-frame sine. Silence/DC/impulse variants pass. Investigate aggregation/statistic semantics.
- Six one-pole filter cases: `lowpass(freq,1)` / `highpass(freq,1)` produce a response consistent with two poles. At 48 kHz the lowpass attenuates the 4 kHz tone 24.48 dB rather than the bilinear one-pole contract's 12.48 dB. Determine whether order 1 should work or be explicitly rejected/documented.
- Twelve neutral delay/freeverb cases: `mix:0` preserves original samples but delay appends eight seconds of silence, freeverb six. The neutral contract requires unchanged duration, even if a generic tail policy intentionally extends it.

## Other engines: precision and semantics

- SoX: two zero-tolerance float-preservation cases differ by at most 2.98e-8. Internal representation/transport is not float-bit-exact; this is not an audible-click claim. Tolerant editing tests pass.
- FFmpeg integral: double-state goldens differ by approximately 3e-5–2.2e-4. Accumulator precision needs a declared contract, not an automatic bug label.
- FFmpeg linear crossfade: its endpoint convention differs from the chosen complementary i/N weights. Keep this semantic difference visible.
- FFmpeg 1.5× time stretch: 547 fewer output frames than requested, outside the 480-frame tolerance, with retained pitch. Check documented boundary behavior before filing a bug.
- FFmpeg/SoX one-pole lowpass at 16 kHz/4 kHz differs about 2.8 dB from the bilinear definition. Likely a different one-pole design, not necessarily faulty DSP.

## Reported reverse/playback issue

A follow-up browser run observed an intermittent `live edit: heard within 100 ms at the same place, crossfaded` failure: the recorded second difference reached 0.50. It passed both an earlier run and an isolated rerun. The failure log is retained in `results/audio-fixes/verification/browser-live-edit-failure.log`; the isolated rerun is beside it. Playback was not changed, and this is not established as the original reverse/source-corruption bug. The assertion now records nearby samples and scheduling diagnostics if it recurs; its tolerance is unchanged.

Copy→paste→reverse, clip→reverse, clone→reverse, undo and stream/read workflows pass at 17, 1,025 and 65,537 frames, including stereo source observations. The original browser click/source-corruption report is **not reproduced**. Exact reversal can create endpoint discontinuities without wrong samples. Smooth reversal and the Web Audio playback path need distinct tests; this result does not mean that bug is fixed or disproven.

The expanded run adds native browser rendering, synthetic EBU calibration/gating and true-peak signals, and native streaming SRC. Programme recordings, hardware playback, codecs beyond the tested WAV16/FLAC16 paths, perceptual studies and total process-tree resource measurements remain gaps. The expanded baseline is reviewed in [COVERAGE.md](COVERAGE.md#current-failure-review); acknowledged discrepancies remain failed in the report.

## Newly measured differences

- audio joint level analysis repeats the signed-mean discrepancy. Its profiled denoiser attenuates the test tone by roughly 12 dB instead of retaining it; the SNR/level checks reject that output. The impulse delay also retains the engine’s eight-second tail.
- librosa YIN estimates the 110 Hz synthetic tone at 110.722 Hz, just outside the declared 10-cent tolerance. This is one configured estimator on one tone, not a general pitch ranking.
- Pedalboard’s native limiter adds level gain, producing a peak of 1 for the requested −6 dB ceiling. Its convolution normalizes the impulse response, so it differs from literal unnormalized convolution.
- SciPy’s default resample_poly gives about 61.16 dB waveform SNR on the declared 997 Hz conversion, below the 70 dB threshold. Other converter/quality settings are separate comparisons.
- Web Audio native compressors apply automatic makeup gain, unlike the zero-makeup contract. Chromium/WebKit feedback cycles add a render-block delay; Firefox matches the requested echo spacing in the tested case.
- Chromium/WebKit buffer playback resampling does not meet the declared 40 dB alias-rejection cases. All three browsers miss the stricter 70 dB waveform-SNR case at their native settings. These results concern OfflineAudioContext buffer playback, not every resampler available to a browser application.
- Chromium differs at a 1023-frame buffer edge in pad/repeat. Preserve the failing PCM before deciding whether the cause is source scheduling or the engine’s loop boundary.
- Native CLI analysis text rounds RMS. Derived energy can therefore miss a tight absolute tolerance even when the underlying statistic is close; adapter metadata records this precision limit.
- Audacity 3.4.2's scripting/export path loses the sole frame in the one-frame edit fixtures and one frame in the 17-frame selection-reverse fixtures. Its fade-out samples also differ from the shared i/N contract. These are measured edit/export differences; the report preserves the actual WAVs instead of padding or reshaping them to pass.
