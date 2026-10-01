# Adapter contract

Planar float32 PCM crosses the boundary. Frame indices are integers; rate is Hz. Adapters convert units and explicit parameters; they must not reimplement the tested operation and attribute it to the contender.

```js
export default {
  id: 'my-engine',
  async available() { return true },
  async version() { return 'exact installed version' },
  supports(test) { return !test.workflow && test.steps.every(s => s.op === 'reverse') },
  async run(test, channels, sampleRate) {
    return { channels: await engine.reverse(channels), sampleRate }
  },
  async metadata() { return { mode: 'in-process' } },
  async close() {}
}
```

`supports` may be asynchronous. Missing mappings are `skip`, never evidence of absent features. Missing executables, bridge failures, crashes and timeouts are errors. The runner isolates adapters in workers, enforces per-call deadlines and checks input mutation inside the worker before structured cloning.

Exact cases return `{channels}`, statistics `{scalar}`, rate-changing cases `{sampleRate}` too. Editor cases return observed `sourceAfter`, and `stream` when requested. Copy/clone cases read the actual source object after transformation. The stream case compares read/stream rendering; it does not claim arbitrary chunk partition testing.

| Adapter | Boundary | Scope |
|---|---|---|
| audio | JS API | Explicit `AUDIO_MODULE` or installed package. Fixture cloned before transferring ownership. |
| FFmpeg / SoX | CLI, float32 WAV | No hidden normalization; temp files cleaned. |
| librosa | Persistent Python, JSON PCM | Public library calls, not NumPy editing substitutes; soxr_hq SRC. |
| Pedalboard | Persistent Python, JSON PCM | Low/highpass map to one-pole contracts. Its Resample effect is not a true output-rate converter. |
| Audacity | mod-script-pipe, float WAV | Experimental, disposable Linux session only. |
| reference | Array algebra/statistics | Harness control; not a DSP quality contender. |

## Audacity safety

`scripts/audacity-ci.js` creates separate XDG directories and Xvfb on a fresh Linux CI runner. It rejects an existing legacy profile or pipe, starts its own editor, and terminates its own process group. Float32 export is configured and verified; wrong export format is an error.

For a separately provisioned disposable session, set `AUDIO_TEST_AUDACITY_ISOLATED=1`, `AUDIO_TEST_AUDACITY_TO`, `AUDIO_TEST_AUDACITY_FROM`, `AUDIO_TEST_AUDACITY_VERSION`. **The adapter clears all tracks between cases. Never point it at an editor holding work.** Commands/preferences vary by release; failures are reported, not skipped.

## Reproduction

`--case` matches case-ID substrings. Each failure's `case.json` stores fixture parameters, steps, oracle and metrics. Sibling WAVs contain input, actual and exact expected PCM; `diff.wav` exists only when shapes match. Full run JSON contains source/environment identity. Close adapters after direct programmatic use; the CLI handles this.

## Expanded engines

`--adapter all` runs audio, FFmpeg, SoX, librosa, Pedalboard, SciPy, SoXR, libsamplerate, pyloudnorm, Rubber Band, SoundTouch and Web Audio in Chromium, Firefox and WebKit. Provision Python with `contenders/requirements.txt`; set `AUDIO_TEST_PYTHON` to its interpreter. Install browser engines with `npx playwright install chromium firefox webkit`. Audacity needs its separate isolated launcher. The [market inventory](MARKET.md) distinguishes callable engines from DAWs that still need project/render automation.

- SciPy calls `scipy.signal` filters, resample_poly and FFT convolution, plus `scipy.fft`; it supplies no synthetic editing implementation.
- SoXR and libsamplerate exercise both batch conversion and native streaming state, including final drain.
- pyloudnorm supplies integrated loudness and normalization. Its normalization ceiling checks sample peaks; the independent oracle also checks reconstructed peaks.
- Rubber Band uses the native R3 offline CLI for stretch and pitch. SoundTouch uses SoundStretch for tempo, pitch and playback rate with its default music/anti-alias settings.
- Browser adapters render native `OfflineAudioContext` graphs. Gain automation, filters, resampling, delay and convolution are performed by the browser. PCM copies only cross the automation boundary. Native compressor makeup and feedback-cycle latency can differ from the shared contract.
- Pedalboard convolution retains its own impulse-response normalization. Its limiter, compressor and gate only claim settings the API exposes.
- audio undo/redo composes the public `undo()` and `run()` edit-list APIs; it does not invent a `redo()` method.

Analysis results can return `{values:{peak,rms,dc}}`, `{spectrum:{frequencies,magnitudes}}` or `{events:[seconds]}`. Spectrum magnitudes use linear peak amplitude after Hann coherent-gain correction. Chunked resampling returns `{channels,sampleRate,observations:{batch}}`. Undo/redo records the intermediate `undone` PCM as well as final output and untouched source.

Run optional integration checks with `AUDIO_TEST_PYTHON=/path/to/python AUDIO_TEST_BROWSERS=1 AUDIO_TEST_NATIVE=1 npm test`. Set `AUDIO_MODULE` to include the audio API checks. The full comparison always reports selected unavailable engines as errors, even when optional unit checks are disabled.
