# Existing suites and standards

No universal editor/DSP conformance suite was established in this survey. Standards cover particular measurements; upstream suites depend on their own APIs, semantics and build systems. Own the shared contract and adapters, not another copy of every competitor's tests.

| Source | Valuable scope | Reuse |
|---|---|---|
| [BS.1770](https://www.itu.int/rec/R-REC-BS.1770), [EBU Tech 3341](https://tech.ebu.ch/docs/tech/tech3341.pdf), [EBU loudness test set](https://tech.ebu.ch/publications/ebu_loudness_test_set) | Loudness, weighting, gating, true peak | Executable synthetic definitions for Tech 3341 signals 1–5 and 15–19. Independent 48 kHz mono/stereo loudness oracle. Official WAV downloads returned HTTP 403; no official assets were imported. Programme material, burst signals 20–23 and the complete suite remain untested. These checks do not establish standards certification. |
| [Web Audio specification](https://www.w3.org/TR/webaudio-1.0/), [WPT](https://github.com/web-platform-tests/wpt/tree/master/webaudio) | Automation, filters, routing, rendering | Port neutral assertions; run original WPT against browser implementations. |
| [FFmpeg FATE](https://www.ffmpeg.org/fate.html), [audio filter tests](https://github.com/FFmpeg/FFmpeg/blob/master/tests/fate/filter-audio.mak) | Broad DSP fixtures and references | Reuse signal/parameter definitions; FATE commands/hashes cannot simply accept a different API. |
| [SoX tests](https://github.com/chirlu/sox/tree/master/test), [manual](https://sox.sourceforge.net/sox.html) | Effects, conversion, regressions | Map mathematical effects with explicit tolerances. |
| [Audacity tests](https://github.com/audacity/audacity/tree/master/tests), [editor tests](https://github.com/audacity/audacity/tree/master/src/trackedit/tests), [scripting](https://manual.audacityteam.org/man/scripting_reference.html) | Clip ownership, edits, history, effects | Editor scenarios and isolated script-pipe integration. UI commands are not independent DSP algorithms. |
| [Pedalboard tests](https://github.com/spotify/pedalboard/tree/master/tests), [API](https://spotify.github.io/pedalboard/reference/pedalboard.html) | Effects, buffering, plugins | Preserve order, latency, reset and tail semantics. |
| [librosa tests](https://github.com/librosa/librosa/tree/main/tests), [API](https://librosa.org/doc/0.11.0/) | Analysis, SRC, time/pitch | Public calls and analytical invariants; unmatched analysis functions get proposals. |
| [libsamplerate tests](https://github.com/libsndfile/libsamplerate/tree/master/tests), [Python API](https://python-samplerate.readthedocs.io/en/latest/) | SRC quality, streaming, channels | Batch and callback adapters; explicit end-of-input and converter choice. |
| [SciPy signal](https://docs.scipy.org/doc/scipy/reference/signal.html), [tests](https://github.com/scipy/scipy/tree/main/scipy/signal/tests) | Filter design, filtering, convolution, resampling | Match order, initial state, sample rate and boundary rules. |
| [Python-SoXR API](https://python-soxr.readthedocs.io/en/latest/soxr.html), [libsoxr](https://sourceforge.net/projects/soxr/) | Batch and streaming SRC | Record binding and engine versions, quality setting and flush policy. |
| [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm) | Integrated loudness and normalization | Public Meter API; synthetic checks do not establish complete standards conformance. |
| [Rubber Band](https://breakfastquay.com/rubberband/), [source](https://github.com/breakfastquay/rubberband) | Pitch shift and time stretch | Record engine, offline mode, time ratio and latency/length handling. |
| [SoundTouch](https://www.surina.net/soundtouch/) | Tempo, pitch and playback rate | SoundStretch CLI; record WAV sample format and native latency/output-length behavior. |

No upstream test code or corpus is vendored. Current deterministic fixtures and goldens are original. Imported vectors/code need separate SPDX, provenance and checksum records; the harness MIT license does not relicense upstream assets. Preserve original upstream suites when testing that engine; common fixtures and contracts enable cross-engine comparison.

Package inventories include umbrella packages and atoms; contender inventories include utility functions and desktop commands. Both expose proposed tests, not executed coverage. Sources are linked, not asserted to certify this suite.

The [market survey](MARKET.md) records official automation routes and missing adapters for desktop editors, DAWs and other processing engines. `spec/contenders.json` preserves those unrun entries separately from actual results. Inventory regeneration keeps curated entries instead of dropping every tool that lacks an API scraper.
