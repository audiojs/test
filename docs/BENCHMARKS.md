# Benchmarks

`npm run bench` measures 143 workloads: editing, channels, filters, analysis, time/pitch, dynamics and effects. Most operations run on three inputs: 0.1-second mono, 1-second stereo and 10-second stereo, all at 48 kHz. Integrated loudness and noise removal use the longer stereo inputs.

Each contender/case gets a fresh Node driver, two warmups and seven timed repetitions. Every output is checked against the declared oracle; failed checks receive no timing score. `results/benchmarks.json` contains the fixture, individual durations, median, p95, validation and build identity. `--repeats 3` is the minimum; `--case resample` and `--profile long-stereo` select smaller runs.

Each driver has a three-minute deadline. A timeout terminates its process group on POSIX or its process tree on Windows, including ordinary native/Python descendants. Detached browser sessions can escape the POSIX group, and Audacity's separate editor is outside the driver tree. After any timeout, stop the run, restart the affected engine or disposable editor, and discard subsequent timings before retrying.

`--adapter all` covers the registered command-line, Python and browser adapters. Audacity runs separately in a disposable editor; pass `--adapter audacity` in that session. An unmapped operation is skipped. An unavailable selected engine is an error.

The timer wraps each complete `adapter.run` call. It includes JavaScript processing, persistent Python JSON, browser PCM transfer, and each native command launch plus WAV packing, file I/O and cleanup. A fresh FFmpeg process starts inside every timed call. Only the outer Node driver, initial library/browser startup, fixture preparation and output validation are excluded. The two warmups also finish before timing samples are recorded.

These are whole-call integration costs. They do not isolate the DSP algorithm from its binding or transport. Run contenders sequentially on an otherwise idle machine; the recorded developer host is not a dedicated benchmark runner.

Runs that include FFmpeg also record separate overhead diagnostics in `benchmarks.json`: launching the version command, reading a prewritten WAV to a null sink, transcoding that WAV, and passing unchanged audio through the full adapter. Audio diagnostics use the same three clip sizes and verify exact PCM after each transcode. The version command measures launch, version output and exit; it is not a pure process-spawn measurement. Workload scores retain their full measured time. To repeat the diagnostics alone, run `node scripts/bench-overhead.js 7 results/ffmpeg-overhead.local.json`.

The workloads include 3-, 1,024- and 48,000-tap convolution responses, FFTs of 4,096/32,768/262,144 samples, and noise removal after learning a half-second noise region. Long convolution uses dense, deterministic Float32 responses and a constant input: a prefix-sum oracle checks every output sample and the full tail without performing another expensive convolution. FFTs use a bin-centered tone and check peak frequency and amplitude. Noise removal checks output length, noise reduction, signal preservation and SNR improvement. These synthetic fixtures expose processing cost and selected errors; they do not establish performance on every recording.

Other correctness gates use exact PCM, analytic statistics, steady-state filter/dynamics response, or output rate/duration/pitch. Passing one timed workload does not replace the broader correctness suite.

Driver high-water RSS comes from `process.resourceUsage().maxRSS`. It includes fixtures and validation but excludes child-process/browser memory. It cannot rank total memory consumption. Process-tree peak memory, leaks, cold startup, compressed browser bundles and installed dependency size remain unmeasured.

Conformance `durationMs` includes validation and is diagnostic only. Performance budgets require the same engine/build, boundary, fixture and host.

The recorded comparison uses seven repetitions across 15 engines. Audacity ran in a Linux container; the other engines ran natively on macOS. The report labels both environments and does not select an overall fastest engine across them. CI runs Audacity in its own job, preserves each job's host details, and uses seven repetitions outside pull requests.
