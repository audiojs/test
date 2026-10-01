# @audio/test

Compare audio tools by feature, check the output, and measure the work. [Open the report](https://audiojs.dev/test/).

This is a conformance workbench, **not industry certification or complete DSP coverage**. Finite-output checks do not establish correct processing or perceptual quality.

## Run

```sh
npm ci
npm test
npm run test:smoke
npm ci --prefix contenders/npm --ignore-scripts
python3 -m venv .venv
.venv/bin/pip install -r contenders/requirements.txt
# Install ffmpeg, sox, rubberband-cli and soundstretch with your system package manager.
npx playwright install chromium firefox webkit
export AUDIO_MODULE="$PWD/contenders/npm/node_modules/audio/audio.js"
export AUDIO_TEST_PYTHON="$PWD/.venv/bin/python"
npm run parity # --adapter all --tier research
npm run bench
npm run report
```

Open [site/index.html](site/index.html), or serve `site/` using any static server. The [JSON](results/latest.json), [findings](results/FINDINGS.md), webpage and README tables derive from one specification and measured results. Failed cases preserve input/actual/expected/difference WAVs where applicable, metrics and expanded definitions.

Large generated WAVs are gitignored. They remain in local reports and CI artifacts; replay the case to regenerate them after a fresh clone. Definitions and metrics are versioned.

```sh
node bin/audio-test.js run --adapter audio --tier quality --case editor.copy-reverse
node bin/audio-test.js run --adapter sox --tier quality --case rate.resample
node bin/audio-test.js run --adapter ./my-adapter.js --tier quality
```

`AUDIO_MODULE` can point to a local `audio.js`. Results record source hash, revision/dirty state, runtime, host and lockfile hash. The checked-in local working-tree result is not necessarily the registry release bearing the same version. The numerical reference adapter is a harness control, not a contender.

## Results

<!-- results:start -->
201 features, 523 behavior tests, 604 basic checks, 362 packages

Measured 2026-10-01T17:17:58.023Z. Spec SHA-256: `58ef5b42b8f0b62eaf868f76584c6b7ef3902e2c3948d5f383695a43943a65de`.

| Contender | Version | Conformance pass / run | Integrity pass / run | Fail | Error | Unmapped |
|---|---|---:|---:|---:|---:|---:|
| audio | 2.9.0 | 503 / 504 | 604 / 604 | 1 | 0 | 19 |
| ffmpeg | ffmpeg version 8.0.1 Copyright (c) 2000-2025 the FFmpeg developers | 450 / 472 | 47 / 47 | 22 | 0 | 608 |
| sox | SoX 14.4.2_6 (Homebrew package) | 423 / 447 | 38 / 38 | 24 | 0 | 642 |
| librosa | 0.11.0 | 102 / 103 | 28 / 28 | 1 | 0 | 996 |
| pedalboard | 0.9.25 | 143 / 169 | 53 / 53 | 26 | 0 | 905 |
| scipy | 1.17.0 | 87 / 88 | 23 / 23 | 1 | 0 | 1016 |
| soxr | 1.0.0 | 8 / 8 | 0 / 0 | 0 | 0 | 1119 |
| libsamplerate | 0.2.3 | 8 / 8 | 0 / 0 | 0 | 0 | 1119 |
| pyloudnorm | 0.1.1 | 6 / 6 | 0 / 0 | 0 | 0 | 1121 |
| rubberband | 4.0.0 | 8 / 8 | 0 / 0 | 0 | 0 | 1119 |
| soundtouch | 2.4.1 | 12 / 12 | 0 / 0 | 0 | 0 | 1115 |
| webaudio | chromium 153.0.8010.12 | 286 / 301 | 38 / 38 | 15 | 0 | 788 |
| webaudio-firefox | firefox 155.0 | 293 / 301 | 38 / 38 | 8 | 0 | 788 |
| webaudio-webkit | webkit 26.6 | 290 / 301 | 38 / 38 | 11 | 0 | 788 |
| audacity | 3.4.2+dfsg-1build4 | 160 / 187 | 0 / 0 | 27 | 0 | 940 |

Failures are contract discrepancies pending triage, not automatically engine bugs. Unmapped is not unsupported. See [findings](results/FINDINGS.md) and [full report](site/index.html).
<!-- results:end -->

## Coverage

<!-- features:start -->
| Family | Features | Behavior tests | Basic checks |
|---|---:|---:|---:|
| Processing | 4 | 7 | 0 |
| Editor behavior | 8 | 19 | 0 |
| Editing | 18 | 220 | 0 |
| Volume | 3 | 24 | 0 |
| Channels | 4 | 14 | 0 |
| Analysis | 13 | 45 | 0 |
| Filters | 11 | 101 | 0 |
| Bypass behavior | 5 | 30 | 0 |
| Time & pitch | 4 | 19 | 0 |
| Codecs | 2 | 35 | 0 |
| Dynamics | 3 | 5 | 0 |
| Effects | 2 | 2 | 0 |
| Restoration | 2 | 2 | 0 |
| Basic checks | 122 | 0 | 604 |
<!-- features:end -->

- **Conformance:** editing goldens, statistics, filter response, alias rejection, pitch/duration, neutral-setting invariants, copy/history and stream/read observations.
- **Integrity only:** every discovered processor receives silence, impulse, sine and a declared parameter's extrema when suitable. Passing means nonempty finite PCM and unchanged input—not correct DSP.
- **DSP checks:** standards-based synthesized loudness and true-peak signals, compressor/gate/limiter response, delay and convolution, noise reduction, spectrum, onsets, tempo and streaming resampling. These exercise stated tolerances; they do not establish perceptual quality.
- **Still unmeasured:** the complete official conformance vector sets, codecs beyond the tested integer/float WAV and integer FLAC paths, corrupt files, perceptual quality, real-time safety, total process-tree memory and delivery size. See the [coverage assessment](docs/COVERAGE.md).
- **Inventory:** `spec/ecosystem.json` covers local umbrella/atom packages and proposed tests. `spec/competitors.json` inventories CLI/API/manual features. Neither count is test coverage. Both are exposed in the webpage.

Refresh the local inventory deliberately: `node scripts/inventory.js /path/to/audio /path/to/@audio`. `node scripts/contenders.js` inventories installed tools and fetches Audacity's official scripting manual. The package scan excludes dependency trees.

## Independent CI

- `ci.yml`: harness tests on Linux/macOS/Windows, Node 22/24.
- `parity.yml`: research-tier checks across all callable engines and a separate benchmark run, plus isolated Audacity/Xvfb; PR/main/weekly/manual triggers. npm/Python direct versions are pinned; system tool versions are recorded.
- Failures still produce artifacts. A final job merges Audacity results when available and regenerates the combined webpage, JSON and README. Benchmarks run outside PR checks.
- `pages.yml`: publish the checked-in measurements to [GitHub Pages](https://audiojs.dev/test/) after a report build and browser checks. The separate parity workflow keeps fresh measurements as artifacts; set `ENABLE_PAGES=true` to publish those automatically too.

`--report-only` collects numerical discrepancies but missing tools and adapter errors still fail. `npm run gate` rejects new discrepancies, missing contenders and lost adapter coverage against `results/baseline.json`. Baseline acknowledgements never change displayed failures to passes. CI tests pinned registry packages; local source fixes can still fail there until released. Review [triage](docs/TRIAGE.md), then deliberately update using `node scripts/baseline.js --accept "reason"`; never automatically in CI.

Audacity runs separately in an explicitly disposable session and refuses ordinary desktop profiles. It appears in the comparison only when a measured run is merged. [Adapter instructions](docs/ADAPTERS.md).

With Docker running, `node scripts/audacity-container.js --bench` runs Audacity's checks and timings in an isolated Linux desktop. Its timings retain their own host details. The [market survey](docs/MARKET.md) lists other editors and DAWs, their automation routes and what remains unmeasured.

## Extend

Add contracts in `src/catalog.js`, provenance-backed vectors in `spec/cases.json`, or an external adapter implementing `available`, `version`, `supports`, `run`. Do not assume different engines have equivalent defaults. The proposed specification must mature through independent implementations and published vectors; no engine is a universal golden reference.

[Model](docs/MODEL.md) · [upstream suites and standards](docs/SOURCES.md) · [benchmark scope](docs/BENCHMARKS.md) · [coverage and remaining work](docs/COVERAGE.md).
