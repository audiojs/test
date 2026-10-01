# Audio comparison landscape

Reviewed 2026-09-30. This is a bounded survey of editors, DAWs and processing libraries, not a complete list of every music application or plugin. A documented feature earns a place in the inventory; only an executed fixture earns a result in the comparison.

## Editors and DAWs

| Tool | Useful comparison | Route and current gap |
|---|---|---|
| [Audacity 3](https://manual.audacityteam.org/man/scripting_reference.html) | Destructive edits, copy isolation, levels, fades, resampling, speed, stretch and pitch | Audacity 3.4.2 (`3.4.2+dfsg-1build4`) measured through `mod-script-pipe` in a disposable Linux container. The installed macOS Audacity 4 session is not used. |
| [Audacity 4](https://www.audacityteam.org/manual/) | Current editor behavior | Installed 4.0.0 bundle inspected; no `mod-script-pipe` module found. No 4.x result is implied by a 3.x run. |
| [REAPER](https://www.reaper.fm/sdk/reascript/reascript.php) | Clip edits, fades, routing, stock effects and rendering | ReaScript can invoke actions and most extension API functions. A disposable project/profile adapter is still needed; not run. |
| [Ardour](https://manual.ardour.org/lua-scripting/) | Regions, mixing, automation, export and DSP | Lua exposes session and engine objects. Needs a pinned installation and session/export bridge; not run. |
| [LMMS](https://github.com/LMMS/lmms/blob/master/src/core/main.cpp) | Sample playback, effects and project rendering | Official source provides `render`/`rendertracks`, float output and sample-rate options. Needs generated project fixtures and explicit render-length semantics; not run. |
| [Waveform Free / Pro](https://www.tracktion.com/products/waveform-free) | Clip editing, mixing and native effects | Desktop app not installed or run. Tracktion Engine has a separate callable render API; an engine result would not establish Waveform UI behavior. |
| [Pro Tools](https://developer.avid.com/scripting/) | Session edits, clip operations and export | Official scripting SDK exists. SDK download requires an account and acceptance of its terms; no SDK or editor adapter installed. |
| [Ableton Live](https://help.ableton.com/hc/en-us/articles/5402681764242-Controlling-Live-using-Max-for-Live) | Warp, clip playback, automation and effects | Live Object Model is exposed through Max for Live. Requires a suitable licensed installation and a verified export workflow; not run. |
| [Logic Pro](https://support.apple.com/guide/logicpro/use-scripter-lgce728c68f6/mac) | Edits, Flex time/pitch and stock processing | Scripter processes MIDI; it is not an audio render API. Needs a licensed Mac installation and an independently verified project/export route; not run. |
| [FL Studio](https://www.image-line.com/fl-studio-learning-content/fl-studio-online-manual/html/midi_scripting.htm) | Sample edits, mixer effects and rendering | Its documented Python interface targets MIDI controllers. A reliable audio fixture/export adapter remains unverified; not run. |
| [Cubase / Nuendo](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/export_audio_mixdown/export_audio_mixdown_r.html) | Audio edits, processing and mixdown | Audio mixdown is documented. Needs the installed/licensed product and repeatable project setup/export; no adapter run. |
| [Fender Studio Pro / Studio One](https://www.fender.com/products/fender-studio-pro) | Clip edits, time/pitch, stock effects and mixing | Fender Studio Pro continues the Studio One platform. A licensed application and verified automation route are missing; not run. |
| [Bitwig Studio](https://www.bitwig.com/userguide/latest/exporting_audio/) | Clip processing, modulation and offline bounce | Export supports selected tracks, ranges and sample rates. Controller support alone does not establish a batch DSP adapter; not run. |
| [Adobe Audition](https://helpx.adobe.com/archive/en/audition/cc/2015/audition_reference.pdf) | Waveform edits, favorites and batch processing | Official documentation describes saved processing and batch export. Requires a current installed application and verified automation; not run. |
| [WaveLab](https://www.steinberg.net/wavelab/) | Mastering, restoration and batch processing | Requires a licensed installation and an automated fixture/export route; not run. |
| [ocenaudio](https://www.ocenaudio.com/features) | Selection edits, gain, filtering and analysis | Documented desktop features; no verified external command bridge in this survey. Not run. |

For desktop tests, preserve the exact application version, project, input, export format, dither, pan law, plugin settings and rendered output. A vendor's feature list cannot settle sample accuracy or the behavior of an edit history.

## Callable processing engines

These are easier to compare because a fixture can call a public API or CLI directly. Their scope is narrower than a DAW's. Installed adapters and recorded results are listed in `spec/contenders.json` and `results/`; an inventory entry alone is not measured coverage.

| Tool | Relevant scope | Interface / remaining work |
|---|---|---|
| [FFmpeg](https://ffmpeg.org/ffmpeg-filters.html) | Editing, conversion, filters, dynamics and analysis | CLI filter graphs; existing adapter. |
| [SoX](https://sox.sourceforge.net/sox.html) | Edits, levels, filters, rate and time | CLI effect chains; existing adapter. |
| [Pedalboard](https://spotify.github.io/pedalboard/reference/pedalboard.html) | Effects, time/pitch and plugin hosting | Python API; existing adapter. Hosted third-party plugins are separate contenders. |
| [librosa](https://librosa.org/doc/latest/) | Analysis, resampling, time/pitch | Python API; existing adapter. |
| [Web Audio](https://www.w3.org/TR/webaudio-1.0/) | Gain, filters, routing, convolution and scheduled processing | `OfflineAudioContext`; test browser implementations separately. A browser result is not a Node or native-library result. |
| [SciPy signal](https://docs.scipy.org/doc/scipy/reference/signal.html) | Filtering, convolution, FFT and resampling | Python functions; parameters and boundary handling must match the shared contract. |
| [libsoxr / Python-SoXR](https://python-soxr.readthedocs.io/en/latest/) | Sample-rate conversion | Batch and streaming APIs; record library version, quality mode and flush policy. |
| [libsamplerate](https://libsndfile.github.io/libsamplerate/) | Sample-rate conversion | C API / Python binding; record converter and end-of-input handling. |
| [Rubber Band](https://breakfastquay.com/rubberband/) | Time stretch and pitch shift | CLI / C++ API; distinguish engines, offline mode, latency and output length. |
| [SoundTouch](https://www.surina.net/soundtouch/) | Tempo, pitch and playback rate | SoundStretch CLI adapter; installed 2.4.1 tested against the shared fixtures. |
| [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm) | Integrated loudness and normalization | Python API; analytical checks do not replace official BS.1770/EBU vectors. |
| [aubio](https://aubio.org/) | Pitch, onsets, tempo and spectral analysis | C / Python API; define windows, hop size and tolerances before scoring. |
| [Essentia](https://essentia.upf.edu/algorithms_reference.html) | Music and audio analysis | C++ / Python algorithms; build and per-algorithm mapping still needed. |
| [JUCE DSP](https://docs.juce.com/master/group__juce__dsp.html) | Filters, convolution, oscillators and processing graphs | Compile a small harness; JUCE is not a single DAW or a claim about every JUCE plugin. |
| [miniaudio](https://miniaud.io/docs/manual/index.html) | Mixing, filters and conversion | C API; offline harness still needed. Device I/O tests need a separate contract. |
| [Tracktion Engine](https://tracktion.github.io/tracktion_engine/structengine_1_1Renderer_1_1Parameters.html) | Clip edits, effects and offline project rendering | C++ render API; build a harness with explicit dither, normalization and tail settings. |
| [Tone.js](https://tonejs.github.io/examples/offline) | Effects, synthesis and scheduling | Offline browser rendering; pin Tone.js and browser separately. Adapter still needed. |
| [SuperCollider](https://doc.sccode.org/Guides/Non-Realtime-Synthesis.html) | Synthesis, filtering and processing graphs | Non-realtime score rendering; adapter and graph definitions still needed. |
| [Faust](https://faustdoc.grame.fr/manual/quick-start/) | Compiled DSP algorithms | Compile specific processors into a harness; record algorithm and compiler/backend rather than score the language as one effect. |

## Where comparison stops being fair

- Use the same input and a named operation. Match gain units, channel policy, frame range, filter slope and tail policy before comparing numbers.
- Test editor state in the editor. Calling a shared underlying DSP library does not prove its host's copy, undo, trim or routing behavior.
- Measure each algorithm separately. A stock compressor, third-party plugin and DAW host are different units of comparison.
- Do not rank heterogeneous timing runs together. Containers, browser processes, native CLIs and in-process calls need declared startup/I/O boundaries and the same host for a speed comparison.
- Preserve failures and skips. A missing adapter is an automation gap; it does not establish a missing product feature.

## Running Audacity without a desktop session

`node scripts/audacity-container.js` builds an Ubuntu 24.04 image and runs the editor under Xvfb with a fresh profile. The repository is mounted read-only; only `results/` is writable. The running container has no network and cannot access the host's Audacity pipes or projects. The image's package version is recorded in the result.

Add `--bench` to measure the workload matrix after correctness finishes without adapter errors. This writes `results/audacity-benchmarks.json` using seven repetitions by default; `AUDACITY_BENCH_REPEATS=3` selects the three repetitions used in the recorded local run. Keep its Linux container host metadata with those timings; they do not share the native macOS run's execution environment.

The native Linux launcher, `scripts/audacity-ci.js`, is restricted to a disposable CI runner. It rejects an existing profile or pipe before starting the editor. It first builds the plugin registry with scripting disabled, then enables scripting and restarts. Otherwise, Audacity's first-run validator process can replace the main editor's pipes. Neither launcher attaches to the installed Audacity 4 application.

The measured boundary and fade differences are recorded in [failure notes](TRIAGE.md). Project-rate export performs resampling; the interactive Resample menu is not automated.
