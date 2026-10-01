# Test model

`@audio/test` distinguishes feature availability from correctness, signal quality, resource cost and platform reach. A contender may support an operation without satisfying the shared contract; it may also implement deliberately different semantics.

## Feature classes

- `standard` — governed by a published specification or test set.
- `canonical` — basic operation with a mathematical or stable behavioral definition.
- `editor` — state and ownership behavior expected from an audio editor.
- `specialized` — algorithm-dependent processing evaluated through declared metrics.

## Oracle order

Use the first applicable oracle:

1. Published standard and official vectors.
2. Exact mathematical output.
3. Metamorphic invariant, such as reversing twice.
4. Objective metric with a declared threshold.
5. Differential comparison.

No implementation is a universal golden reference. Differential results expose disagreements; they do not decide which result is correct.

## Support values

- `native` — first-class operation.
- `composed` — expressible from ordinary primitives.
- `partial` — only part of the shared contract is available.
- `absent` — not provided.
- `unknown` — not yet verified.
- `n/a` — outside the contender's scope.

Legacy availability hypotheses in `spec/features.json` are not verified capability claims and do not score the webpage. Measured mappings come from adapter probes. The ecosystem/competitor inventories propose tests, not implemented adapters. Unmapped must never mean absent.

## Tiers

- `smoke` — deterministic, fast, exact cases.
- `core` — editor integrity, boundaries and common operations.
- `quality` — sweeps, standards, longer signals and metric thresholds.
- `research` — corpora, perceptual studies and non-deterministic models.

Higher tiers include lower tiers. Standalone parity runs through research. The current catalog has no placeholder cases: every listed case has an executable oracle. Synthetic pitch, rhythm, noise reduction and transient tests have deliberately bounded claims; real-performance corpora and perceptual listening studies remain outside this run.

## Performance

Correctness runs may record wall time for diagnosis, but they are not benchmarks. Benchmarks require warmups, repetitions, process-start policy, fixture identity, peak-memory measurement and pinned hardware. Their results belong beside conformance results, never inside the correctness verdict.

## Reverse and seams

Exact reversal and click suppression are different contracts. Reversal may introduce a discontinuity where the range meets surrounding audio. The seam case verifies exact output and reports both boundary jumps; it does not promise automatic smoothing. Separate streaming SRC cases compare irregular chunks, including the final flush, with the same engine's batch result and independently check rate, length and tone frequency.

## Standards and remaining scope

Loudness cases synthesize EBU Tech 3341 table 1 signals 1–5 with their specified durations. True-peak cases synthesize signals 15–19, including an above-full-scale signal. These are independently generated defined vectors, not the complete EBU/ITU programme suite. Loudness normalization is checked by an independent 48 kHz BS.1770 filter/gating implementation and windowed-sinc peak reconstruction.

The official EBU archive could not be fetched in the recorded environment (HTTP 403). Its licence also forbids redistribution of the recordings; public failure artifacts must not contain them. Programme recordings, remaining true-peak burst vectors, perceptual restoration quality, polyphonic/voicing accuracy, and full editor/DAW project workflows are still coverage gaps. An active synthetic test does not close those broader claims.
