# Contract discrepancies

Run: 2026-10-01T17:17:58.023Z. No engine fixes are made by this repository.

Replay a case with its recorded contender version and source hash. WAV files are float32; differences below export quantization are not necessarily DSP bugs.

## audio: restoration.denoise.reference

Status: fail.

`node bin/audio-test.js run --adapter audio --tier quality --case restoration.denoise.reference`

[Reproduction and metrics](artifacts/a08dfc072c9c03e7/case.json)

```json
{
  "pass": false,
  "before": 13.807797857042917,
  "after": 2.490927818440853,
  "improvement": -11.316870038602065,
  "gainDb": -12.004001227841549,
  "noiseReduction": 11.999990082741096,
  "perChannel": [
    {
      "pass": false,
      "before": 13.807797857042917,
      "after": 2.490927818440853,
      "improvement": -11.316870038602065,
      "gainDb": -12.004001227841549,
      "noiseReduction": 11.999990082741096
    }
  ],
  "scope": "Seeded stationary noise plus one tone; no perceptual-quality claim",
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.17.1.end

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.crossfade.17.1.end`

[Reproduction and metrics](artifacts/9f3008eb52e582ed/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.04876059293746948,
  "rmsError": 0.026906591954289728,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.17.2.end

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.crossfade.17.2.end`

[Reproduction and metrics](artifacts/20c43c8745747941/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.04876059293746948,
  "rmsError": 0.019098612122623714,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.1025.1.end

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.crossfade.1025.1.end`

[Reproduction and metrics](artifacts/2c4a41aafdce0ec1/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.024995476007461548,
  "rmsError": 0.0021762776455522227,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.1025.2.end

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.crossfade.1025.2.end`

[Reproduction and metrics](artifacts/9b9f457ace8409b3/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.06925821304321289,
  "rmsError": 0.004559393686031678,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.65537.1.end

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.crossfade.65537.1.end`

[Reproduction and metrics](artifacts/688d52cca96e24d1/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.02532963454723358,
  "rmsError": 0.0002770305413125683,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.65537.2.end

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.crossfade.65537.2.end`

[Reproduction and metrics](artifacts/fb70d2963bd91fa8/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.06959238648414612,
  "rmsError": 0.0005759970311409241,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.1023f.1ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.1023f.1ch`

[Reproduction and metrics](artifacts/615c39ee872c2c5e/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000011623875123414685,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.1023f.2ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.1023f.2ch`

[Reproduction and metrics](artifacts/57050598d28987ad/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.00006103515625,
  "rmsError": 0.000009476242507681022,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.1024f.1ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.1024f.1ch`

[Reproduction and metrics](artifacts/949707009812569a/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000011627979137956666,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.1024f.2ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.1024f.2ch`

[Reproduction and metrics](artifacts/c358219eecd3bb22/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.00006103515625,
  "rmsError": 0.000009501574172157984,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.1025f.1ch`

[Reproduction and metrics](artifacts/6d052b0b3bc8b2f4/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.00001164427234279302,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.1025f.2ch`

[Reproduction and metrics](artifacts/aa404e4e5b355540/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.00006103515625,
  "rmsError": 0.00000953423742675169,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.65537f.1ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.65537f.1ch`

[Reproduction and metrics](artifacts/d62b22bfd12837b9/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.00018310546875,
  "rmsError": 0.00007593247278824595,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: edit.integral.65537f.2ch

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case edit.integral.65537f.2ch`

[Reproduction and metrics](artifacts/666b9d3e3fa72966/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000213623046875,
  "rmsError": 0.0000846314185709727,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: analysis.energy.dc

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case analysis.energy.dc`

[Reproduction and metrics](artifacts/e1cc2752e26055e5/case.json)

```json
{
  "pass": false,
  "actual": 299.9999880191375,
  "expected": 300,
  "absoluteError": 0.000011980862495875044,
  "inputUnchanged": true
}
```

## ffmpeg: analysis.energy.sine

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier core --case analysis.energy.sine`

[Reproduction and metrics](artifacts/bb3542150330f0cf/case.json)

```json
{
  "pass": false,
  "actual": 599.607059478081,
  "expected": 599.6070450799074,
  "absoluteError": 0.000014398173675544967,
  "inputUnchanged": true
}
```

## ffmpeg: filter.lowpass1.16000.4

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier quality --case filter.lowpass1.16000.4`

[Reproduction and metrics](artifacts/11948bbf37a6b9df/case.json)

```json
{
  "pass": false,
  "gainDb": -11.399962510251328,
  "perChannel": [
    {
      "pass": false,
      "gainDb": -11.399962510251328
    }
  ],
  "min": -14.495285488505608,
  "max": -13.895285488505607,
  "inputUnchanged": true
}
```

## ffmpeg: rate.stretch.1.5

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier quality --case rate.stretch.1.5`

[Reproduction and metrics](artifacts/ae6821bb4bb49488/case.json)

```json
{
  "pass": false,
  "frequency": 440.01524116775073,
  "pitchError": 0.00003463901761535659,
  "perChannel": [
    {
      "pass": true,
      "frequency": 440.01524116775073,
      "pitchError": 0.00003463901761535659
    }
  ],
  "lengthError": -547,
  "expectedFrequency": 440,
  "inputUnchanged": true
}
```

## ffmpeg: edit.crossfade.equal-power

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier quality --case edit.crossfade.equal-power`

[Reproduction and metrics](artifacts/52b5a27587fe0b1f/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.012266919016838074,
  "rmsError": 0.005009456260496754,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## ffmpeg: rate.pitch.frequency-duration

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier quality --case rate.pitch.frequency-duration`

[Reproduction and metrics](artifacts/d263a31139b954f5/case.json)

```json
{
  "pass": false,
  "frequency": 880.1425521315576,
  "pitchError": 0.00016199105858816232,
  "perChannel": [
    {
      "pass": true,
      "frequency": 880.1425521315576,
      "pitchError": 0.00016199105858816232
    }
  ],
  "lengthError": -1042,
  "expectedFrequency": 880,
  "inputUnchanged": true
}
```

## ffmpeg: rate.stretch.duration-pitch-transient

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier quality --case rate.stretch.duration-pitch-transient`

[Reproduction and metrics](artifacts/226ae8fa8940f1b2/case.json)

```json
{
  "pass": false,
  "frequency": 440.0080041097984,
  "timeError": -0.014854166666666835,
  "perChannel": [
    {
      "pass": true,
      "frequency": 440.0080041097984,
      "timeError": -0.014854166666666835
    }
  ],
  "lengthError": -2026,
  "inputUnchanged": true
}
```

## ffmpeg: restoration.dither.statistics

Status: fail.

`node bin/audio-test.js run --adapter ffmpeg --tier quality --case restoration.dither.statistics`

[Reproduction and metrics](artifacts/b9e9a1894ad29243/case.json)

```json
{
  "pass": false,
  "quantum": 0.000030517578125,
  "perChannel": [
    {
      "mean": -0.4984283447265625,
      "rms": 0.7059945783974283,
      "zero": 0.5015716552734375,
      "lag": 0.4968620848002449,
      "gridError": 0,
      "peak": 1
    },
    {
      "mean": -0.501190185546875,
      "rms": 0.7079478692297019,
      "zero": 0.498809814453125,
      "lag": 0.5042623150459721,
      "gridError": 0,
      "peak": 1
    }
  ],
  "scope": "TPDF followed by quantization, digital silence",
  "inputUnchanged": true
}
```

## sox: edit.trim.half-open

Status: fail.

`node bin/audio-test.js run --adapter sox --tier smoke --case edit.trim.half-open`

[Reproduction and metrics](artifacts/0432cdb2d7eb05ea/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 2.9802322387695312e-8,
  "rmsError": 2.1223002813209712e-8,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.reverse.sample-exact

Status: fail.

`node bin/audio-test.js run --adapter sox --tier smoke --case edit.reverse.sample-exact`

[Reproduction and metrics](artifacts/87073d89278a8da2/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 2.9802322387695312e-8,
  "rmsError": 2.1554248651253552e-8,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.derivative.65537f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.derivative.65537f.1ch`

[Reproduction and metrics](artifacts/78bf89fee85aeab1/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.4994187355041504,
  "rmsError": 0.009754197666347287,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.derivative.65537f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.derivative.65537f.2ch`

[Reproduction and metrics](artifacts/6360022290181d37/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.4994187355041504,
  "rmsError": 0.009754197619780589,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.17f.1ch`

[Reproduction and metrics](artifacts/ea2f721f8ba525f7/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 5.641323566436768,
  "rmsError": 3.1676487845346344,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.17f.2ch`

[Reproduction and metrics](artifacts/5a513ee5f50144c2/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 5.641323566436768,
  "rmsError": 2.239865935961765,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.1023f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.1023f.1ch`

[Reproduction and metrics](artifacts/af53001c13dda21a/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 133.60984802246094,
  "rmsError": 106.54705043965816,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.1023f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.1023f.2ch`

[Reproduction and metrics](artifacts/d65cb765312d3094/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 260.7286071777344,
  "rmsError": 109.25836524372465,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.1024f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.1024f.1ch`

[Reproduction and metrics](artifacts/327a8a59a09900f6/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 133.60984802246094,
  "rmsError": 106.54023038629242,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.1024f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.1024f.2ch`

[Reproduction and metrics](artifacts/2ff9c7aa4b39120c/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 261.2820739746094,
  "rmsError": 109.37953820910418,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.1025f.1ch`

[Reproduction and metrics](artifacts/fb46303b1b8d4698/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 133.60984802246094,
  "rmsError": 106.5332415183294,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.1025f.2ch`

[Reproduction and metrics](artifacts/cd91f9e60fb5357d/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 261.8361511230469,
  "rmsError": 109.50089826931486,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.65537f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.65537f.1ch`

[Reproduction and metrics](artifacts/2bae23f0ec9371b4/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 349.39117431640625,
  "rmsError": 145.44272784741244,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: edit.integral.65537f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case edit.integral.65537f.2ch`

[Reproduction and metrics](artifacts/3b5033966048d913/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 482.7430419921875,
  "rmsError": 182.8835878039647,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## sox: analysis.energy.sine

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case analysis.energy.sine`

[Reproduction and metrics](artifacts/c84be66b2836a0a7/case.json)

```json
{
  "pass": false,
  "actual": 599.6084152512,
  "expected": 599.6070450799074,
  "absoluteError": 0.0013701712925922038,
  "inputUnchanged": true
}
```

## sox: analysis.energy.impulse

Status: fail.

`node bin/audio-test.js run --adapter sox --tier core --case analysis.energy.impulse`

[Reproduction and metrics](artifacts/7b2c46d7480ddaf7/case.json)

```json
{
  "pass": false,
  "actual": 0.5624669999999999,
  "expected": 0.5625,
  "absoluteError": 0.00003300000000006076,
  "inputUnchanged": true
}
```

## sox: filter.lowpass1.16000.4

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case filter.lowpass1.16000.4`

[Reproduction and metrics](artifacts/27a314a918ae2eb3/case.json)

```json
{
  "pass": false,
  "gainDb": -11.399962491049347,
  "perChannel": [
    {
      "pass": false,
      "gainDb": -11.399962491049347
    }
  ],
  "min": -14.495285488505608,
  "max": -13.895285488505607,
  "inputUnchanged": true
}
```

## sox: codec.wav.32bit.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case codec.wav.32bit.1f.1ch`

[Reproduction and metrics](artifacts/0b9b65f45d872cd8/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 2.2351741790771484e-8,
  "rmsError": 2.2351741790771484e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 62,
  "bitDepth": 32,
  "sampleFormat": "float",
  "inputUnchanged": true
}
```

## sox: codec.wav.32bit.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case codec.wav.32bit.1f.2ch`

[Reproduction and metrics](artifacts/e055832edcd8c8ed/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 2.2351741790771484e-8,
  "rmsError": 1.580506819158526e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 66,
  "bitDepth": 32,
  "sampleFormat": "float",
  "inputUnchanged": true
}
```

## sox: codec.wav.32bit.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case codec.wav.32bit.17f.1ch`

[Reproduction and metrics](artifacts/0171353195043611/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.25,
  "rmsError": 0.09587062360592177,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 126,
  "bitDepth": 32,
  "sampleFormat": "float",
  "inputUnchanged": true
}
```

## sox: codec.wav.32bit.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case codec.wav.32bit.17f.2ch`

[Reproduction and metrics](artifacts/5a3f19128a155b9b/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.25,
  "rmsError": 0.09587062360592169,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 194,
  "bitDepth": 32,
  "sampleFormat": "float",
  "inputUnchanged": true
}
```

## sox: codec.wav.32bit.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case codec.wav.32bit.1025f.1ch`

[Reproduction and metrics](artifacts/1bad088bd994f26b/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.25,
  "rmsError": 0.09877295966495929,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 4158,
  "bitDepth": 32,
  "sampleFormat": "float",
  "inputUnchanged": true
}
```

## sox: codec.wav.32bit.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case codec.wav.32bit.1025f.2ch`

[Reproduction and metrics](artifacts/945aa188f49c2eff/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.25,
  "rmsError": 0.09877295966495912,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 8258,
  "bitDepth": 32,
  "sampleFormat": "float",
  "inputUnchanged": true
}
```

## sox: dynamics.limiter.ceiling-latency

Status: fail.

`node bin/audio-test.js run --adapter sox --tier quality --case dynamics.limiter.ceiling-latency`

[Reproduction and metrics](artifacts/6abc890c99ba6d80/case.json)

```json
{
  "pass": false,
  "peak": 0.5538975596427917,
  "inputPeak": 0.800000011920929,
  "latencyFrames": 0,
  "perChannel": [
    {
      "pass": false,
      "peak": 0.5538975596427917,
      "inputPeak": 0.800000011920929,
      "latencyFrames": 0
    }
  ],
  "ceiling": 0.5011872336272722,
  "inputUnchanged": true
}
```

## librosa: analysis.pitch.tone-110

Status: fail.

`node bin/audio-test.js run --adapter librosa --tier quality --case analysis.pitch.tone-110`

[Reproduction and metrics](artifacts/29e02866469436d0/case.json)

```json
{
  "pass": false,
  "actual": 110.7222578078669,
  "min": 109.3664466199302,
  "max": 110.63722351746388,
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.1f.1ch`

[Reproduction and metrics](artifacts/63c26be5a13b181c/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000030517578125,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 106,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.1f.2ch`

[Reproduction and metrics](artifacts/89150f090666119a/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000021579186437577746,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 108,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.17f.1ch`

[Reproduction and metrics](artifacts/e70d9003b4cc0195/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000017554435480529958,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 138,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.17f.2ch`

[Reproduction and metrics](artifacts/94ef9e2fa0094097/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000016756084405678495,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 172,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.1025f.1ch`

[Reproduction and metrics](artifacts/ac75d91fc16406a9/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000016427306383203866,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 2154,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.1025f.2ch`

[Reproduction and metrics](artifacts/05abf3af126c7793/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000016413472859596656,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 4204,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.24bit.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.24bit.1f.1ch`

[Reproduction and metrics](artifacts/4108fd4212087af3/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 1.1920928955078125e-7,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 108,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.24bit.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.24bit.1f.2ch`

[Reproduction and metrics](artifacts/6343a9f0b1c02efd/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 8.429369702178807e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 110,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.24bit.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.24bit.17f.1ch`

[Reproduction and metrics](artifacts/5d38bcc17bce8c67/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.857201357311376e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 156,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.24bit.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.24bit.17f.2ch`

[Reproduction and metrics](artifacts/bc93dc36056be12b/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.545345468589339e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 206,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.24bit.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.24bit.1025f.1ch`

[Reproduction and metrics](artifacts/8d08eaf3a3a1ba96/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.416916553363417e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 3180,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.wav.24bit.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.wav.24bit.1025f.2ch`

[Reproduction and metrics](artifacts/ec559bee53294aba/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.411512833202172e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 6254,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.1f.1ch`

[Reproduction and metrics](artifacts/419cec91e932bd38/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000030517578125,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 120,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.1f.2ch`

[Reproduction and metrics](artifacts/7bae6d1132263cf5/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000021579186437577746,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 123,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.17f.1ch`

[Reproduction and metrics](artifacts/67fbe60be84b3da2/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000017554435480529958,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 152,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.17f.2ch`

[Reproduction and metrics](artifacts/1ecb91c0dd180292/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000016756084405678495,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 187,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.1025f.1ch`

[Reproduction and metrics](artifacts/1bfcdd7621764ca0/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000016427306383203866,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 1683,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.1025f.2ch`

[Reproduction and metrics](artifacts/6446bdd7a068c677/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.000030517578125,
  "rmsError": 0.000016413472859596656,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 3112,
  "bitDepth": 16,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.24bit.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.24bit.1f.1ch`

[Reproduction and metrics](artifacts/8ad9ae17183b9c76/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 1.1920928955078125e-7,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 121,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.24bit.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.24bit.1f.2ch`

[Reproduction and metrics](artifacts/6c6e85a4c100e462/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 8.429369702178807e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 8000,
  "encodedBytes": 125,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.24bit.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.24bit.17f.1ch`

[Reproduction and metrics](artifacts/5f28faaeebc2e013/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.857201357311376e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 169,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.24bit.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.24bit.17f.2ch`

[Reproduction and metrics](artifacts/d37825823988e353/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.545345468589339e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 44100,
  "encodedBytes": 221,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.24bit.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.24bit.1025f.1ch`

[Reproduction and metrics](artifacts/dccb7af1756f891e/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.416916553363417e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 2713,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: codec.flac.24bit.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case codec.flac.24bit.1025f.2ch`

[Reproduction and metrics](artifacts/8f6e9f39ae942089/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.1920928955078125e-7,
  "rmsError": 6.411512833202172e-8,
  "pass": false,
  "reason": "samples",
  "sourceUnchanged": true,
  "sourceMaxAbsError": 0,
  "sampleRate": 48000,
  "encodedBytes": 5167,
  "bitDepth": 24,
  "sampleFormat": "integer",
  "inputUnchanged": true
}
```

## pedalboard: dynamics.limiter.zero-lookahead

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier quality --case dynamics.limiter.zero-lookahead`

[Reproduction and metrics](artifacts/cb8ddd2e50d7446a/case.json)

```json
{
  "pass": false,
  "peak": 1,
  "inputPeak": 0.800000011920929,
  "latencyFrames": 0,
  "perChannel": [
    {
      "pass": false,
      "peak": 1,
      "inputPeak": 0.800000011920929,
      "latencyFrames": 0
    }
  ],
  "ceiling": 0.5011872336272722,
  "inputUnchanged": true
}
```

## pedalboard: effect.convolution.impulse

Status: fail.

`node bin/audio-test.js run --adapter pedalboard --tier core --case effect.convolution.impulse`

[Reproduction and metrics](artifacts/ac5a6ca2448da9ee/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.8908910602331161,
  "rmsError": 0.46585808601166784,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## scipy: rate.resample.snr-bandwidth

Status: fail.

`node bin/audio-test.js run --adapter scipy --tier quality --case rate.resample.snr-bandwidth`

[Reproduction and metrics](artifacts/90d3862c4f13e2b0/case.json)

```json
{
  "snrDb": 61.16428435990095,
  "pass": false,
  "perChannel": [
    {
      "snrDb": 61.16428435990095,
      "pass": false
    },
    {
      "snrDb": 61.16428435990095,
      "pass": false
    }
  ],
  "minSnr": 70,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio: edit.pad.1023f.1ch

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier core --case edit.pad.1023f.1ch`

[Reproduction and metrics](artifacts/fe20c8b0f6ac06bb/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.1988011598587036,
  "rmsError": 0.006155690268822947,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: edit.pad.1023f.2ch

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier core --case edit.pad.1023f.2ch`

[Reproduction and metrics](artifacts/56930cef992f32f1/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.5529031157493591,
  "rmsError": 0.012864508106563295,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: edit.repeat.1023f.1ch

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier core --case edit.repeat.1023f.1ch`

[Reproduction and metrics](artifacts/b4187e00c5df4bd9/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.5946992039680481,
  "rmsError": 0.015174054771679477,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: edit.repeat.1023f.2ch

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier core --case edit.repeat.1023f.2ch`

[Reproduction and metrics](artifacts/2b8b492a70fcad56/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.5946992039680481,
  "rmsError": 0.015174054629030754,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: neutral.compressor.16000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case neutral.compressor.16000.1`

[Reproduction and metrics](artifacts/26f8e012d01624c0/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.443507730960846,
  "rmsError": 0.23767107149358557,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: neutral.compressor.16000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case neutral.compressor.16000.2`

[Reproduction and metrics](artifacts/3e67eecf2df840a4/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.4436084628105164,
  "rmsError": 0.2817864739778227,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: neutral.compressor.48000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case neutral.compressor.48000.1`

[Reproduction and metrics](artifacts/99a0598ed06e129e/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.1341201663017273,
  "rmsError": 0.3562156753191757,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: neutral.compressor.48000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case neutral.compressor.48000.2`

[Reproduction and metrics](artifacts/4d4d3599ad951366/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.2980850338935852,
  "rmsError": 0.3923594740017142,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: neutral.compressor.96000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case neutral.compressor.96000.1`

[Reproduction and metrics](artifacts/effdf8b5022031af/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.9160852134227753,
  "rmsError": 0.4180861531876369,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: neutral.compressor.96000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case neutral.compressor.96000.2`

[Reproduction and metrics](artifacts/3ef242c10797765e/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.0218661725521088,
  "rmsError": 0.44137818113765437,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio: rate.resample.48000-16000.alias

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case rate.resample.48000-16000.alias`

[Reproduction and metrics](artifacts/8ecf859b37ec6def/case.json)

```json
{
  "pass": false,
  "gainDb": 9.567909335476364e-8,
  "frequency": 4799.945854902194,
  "perChannel": [
    {
      "pass": false,
      "gainDb": 9.567909335476364e-8,
      "frequency": 4799.945854902194
    }
  ],
  "sampleRate": 16000,
  "expectedRate": 16000,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio: rate.resample.96000-44100.alias

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case rate.resample.96000-44100.alias`

[Reproduction and metrics](artifacts/8ea5a75484abdb1a/case.json)

```json
{
  "pass": false,
  "gainDb": -2.8248908772557915,
  "frequency": 13230.037327226195,
  "perChannel": [
    {
      "pass": false,
      "gainDb": -2.8248908772557915,
      "frequency": 13230.037327226195
    }
  ],
  "sampleRate": 44100,
  "expectedRate": 44100,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio: rate.resample.snr-bandwidth

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case rate.resample.snr-bandwidth`

[Reproduction and metrics](artifacts/655f8759b3fc389b/case.json)

```json
{
  "snrDb": 56.44983577816113,
  "pass": false,
  "perChannel": [
    {
      "snrDb": 56.44983577816113,
      "pass": false
    },
    {
      "snrDb": 56.44983577816113,
      "pass": false
    }
  ],
  "minSnr": 70,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio: dynamics.compressor.envelope

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier quality --case dynamics.compressor.envelope`

[Reproduction and metrics](artifacts/979fdacf599d3b83/case.json)

```json
{
  "pass": false,
  "windows": [
    {
      "start": 0.3,
      "end": 0.45,
      "minDb": -0.1,
      "maxDb": 0.1,
      "gainDb": 8.099868178153084,
      "pass": false
    },
    {
      "start": 0.501,
      "end": 0.503,
      "minDb": -8,
      "maxDb": 0,
      "gainDb": -17.466542619842727,
      "pass": false
    },
    {
      "start": 0.9,
      "end": 1.3,
      "minDb": -9.2,
      "maxDb": -8.7,
      "gainDb": -0.8845160221234201,
      "pass": false
    },
    {
      "start": 1.501,
      "end": 1.505,
      "minDb": -10,
      "maxDb": -2,
      "gainDb": 23.732232730122924,
      "pass": false
    },
    {
      "start": 1.9,
      "end": 1.99,
      "minDb": -0.5,
      "maxDb": 0.1,
      "gainDb": 8.099868178153137,
      "pass": false
    }
  ],
  "perChannel": [
    {
      "pass": false,
      "windows": [
        {
          "start": 0.3,
          "end": 0.45,
          "minDb": -0.1,
          "maxDb": 0.1,
          "gainDb": 8.099868178153084,
          "pass": false
        },
        {
          "start": 0.501,
          "end": 0.503,
          "minDb": -8,
          "maxDb": 0,
          "gainDb": -17.466542619842727,
          "pass": false
        },
        {
          "start": 0.9,
          "end": 1.3,
          "minDb": -9.2,
          "maxDb": -8.7,
          "gainDb": -0.8845160221234201,
          "pass": false
        },
        {
          "start": 1.501,
          "end": 1.505,
          "minDb": -10,
          "maxDb": -2,
          "gainDb": 23.732232730122924,
          "pass": false
        },
        {
          "start": 1.9,
          "end": 1.99,
          "minDb": -0.5,
          "maxDb": 0.1,
          "gainDb": 8.099868178153137,
          "pass": false
        }
      ]
    }
  ],
  "inputUnchanged": true
}
```

## webaudio: effect.delay.impulse

Status: fail.

`node bin/audio-test.js run --adapter webaudio --tier core --case effect.delay.impulse`

[Reproduction and metrics](artifacts/7680ff8d50d1adf4/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.25,
  "rmsError": 0.004034357652299392,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: neutral.compressor.16000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case neutral.compressor.16000.1`

[Reproduction and metrics](artifacts/c24ca65bb4a05265/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.4435074925422668,
  "rmsError": 0.2376817408770067,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: neutral.compressor.16000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case neutral.compressor.16000.2`

[Reproduction and metrics](artifacts/233004a7dcd4072c/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.4436094164848328,
  "rmsError": 0.281793242338463,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: neutral.compressor.48000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case neutral.compressor.48000.1`

[Reproduction and metrics](artifacts/5bc0973cdac0dd8e/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.133644014596939,
  "rmsError": 0.35615358821841625,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: neutral.compressor.48000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case neutral.compressor.48000.2`

[Reproduction and metrics](artifacts/f3572db1e7980948/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.297917127609253,
  "rmsError": 0.39230331298136684,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: neutral.compressor.96000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case neutral.compressor.96000.1`

[Reproduction and metrics](artifacts/eb1ae6d3336cafe1/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.9156634956598282,
  "rmsError": 0.41792872109198465,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: neutral.compressor.96000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case neutral.compressor.96000.2`

[Reproduction and metrics](artifacts/0b4ba0a2d790349a/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.0215203762054443,
  "rmsError": 0.4412403448850513,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-firefox: rate.resample.snr-bandwidth

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case rate.resample.snr-bandwidth`

[Reproduction and metrics](artifacts/82ed4e692f16f444/case.json)

```json
{
  "snrDb": 66.59054413407128,
  "pass": false,
  "perChannel": [
    {
      "snrDb": 66.59054413407128,
      "pass": false
    },
    {
      "snrDb": 66.59054413407128,
      "pass": false
    }
  ],
  "minSnr": 70,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio-firefox: dynamics.compressor.envelope

Status: fail.

`node bin/audio-test.js run --adapter webaudio-firefox --tier quality --case dynamics.compressor.envelope`

[Reproduction and metrics](artifacts/a7253796f941c27c/case.json)

```json
{
  "pass": false,
  "windows": [
    {
      "start": 0.3,
      "end": 0.45,
      "minDb": -0.1,
      "maxDb": 0.1,
      "gainDb": 8.099871574011765,
      "pass": false
    },
    {
      "start": 0.501,
      "end": 0.503,
      "minDb": -8,
      "maxDb": 0,
      "gainDb": -17.805474657566585,
      "pass": false
    },
    {
      "start": 0.9,
      "end": 1.3,
      "minDb": -9.2,
      "maxDb": -8.7,
      "gainDb": -0.8844036720228097,
      "pass": false
    },
    {
      "start": 1.501,
      "end": 1.505,
      "minDb": -10,
      "maxDb": -2,
      "gainDb": 22.910325189532543,
      "pass": false
    },
    {
      "start": 1.9,
      "end": 1.99,
      "minDb": -0.5,
      "maxDb": 0.1,
      "gainDb": 8.099867329188573,
      "pass": false
    }
  ],
  "perChannel": [
    {
      "pass": false,
      "windows": [
        {
          "start": 0.3,
          "end": 0.45,
          "minDb": -0.1,
          "maxDb": 0.1,
          "gainDb": 8.099871574011765,
          "pass": false
        },
        {
          "start": 0.501,
          "end": 0.503,
          "minDb": -8,
          "maxDb": 0,
          "gainDb": -17.805474657566585,
          "pass": false
        },
        {
          "start": 0.9,
          "end": 1.3,
          "minDb": -9.2,
          "maxDb": -8.7,
          "gainDb": -0.8844036720228097,
          "pass": false
        },
        {
          "start": 1.501,
          "end": 1.505,
          "minDb": -10,
          "maxDb": -2,
          "gainDb": 22.910325189532543,
          "pass": false
        },
        {
          "start": 1.9,
          "end": 1.99,
          "minDb": -0.5,
          "maxDb": 0.1,
          "gainDb": 8.099867329188573,
          "pass": false
        }
      ]
    }
  ],
  "inputUnchanged": true
}
```

## webaudio-webkit: neutral.compressor.16000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case neutral.compressor.16000.1`

[Reproduction and metrics](artifacts/3ae65b234bb0d776/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.443507730960846,
  "rmsError": 0.23767107148875496,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-webkit: neutral.compressor.16000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case neutral.compressor.16000.2`

[Reproduction and metrics](artifacts/a8c437393784d46e/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.4436084628105164,
  "rmsError": 0.2817864739765587,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-webkit: neutral.compressor.48000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case neutral.compressor.48000.1`

[Reproduction and metrics](artifacts/aafb32cc37b12521/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 1.134120225906372,
  "rmsError": 0.35621567550568234,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-webkit: neutral.compressor.48000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case neutral.compressor.48000.2`

[Reproduction and metrics](artifacts/aa69e774f9fbba45/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.2980850338935852,
  "rmsError": 0.3923594739262376,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-webkit: neutral.compressor.96000.1

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case neutral.compressor.96000.1`

[Reproduction and metrics](artifacts/c0b592a225a41a88/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.9160852432250977,
  "rmsError": 0.4180861594440418,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-webkit: neutral.compressor.96000.2

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case neutral.compressor.96000.2`

[Reproduction and metrics](artifacts/e32782a5c1e62cab/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 1.0218662321567535,
  "rmsError": 0.4413781873491349,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## webaudio-webkit: rate.resample.48000-16000.alias

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case rate.resample.48000-16000.alias`

[Reproduction and metrics](artifacts/08f7a001a861ffa9/case.json)

```json
{
  "pass": false,
  "gainDb": 9.567909335476364e-8,
  "frequency": 4799.945854902194,
  "perChannel": [
    {
      "pass": false,
      "gainDb": 9.567909335476364e-8,
      "frequency": 4799.945854902194
    }
  ],
  "sampleRate": 16000,
  "expectedRate": 16000,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio-webkit: rate.resample.96000-44100.alias

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case rate.resample.96000-44100.alias`

[Reproduction and metrics](artifacts/c0aad26f1c1f35ac/case.json)

```json
{
  "pass": false,
  "gainDb": -2.8248908909423283,
  "frequency": 13230.037327226222,
  "perChannel": [
    {
      "pass": false,
      "gainDb": -2.8248908909423283,
      "frequency": 13230.037327226222
    }
  ],
  "sampleRate": 44100,
  "expectedRate": 44100,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio-webkit: rate.resample.snr-bandwidth

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case rate.resample.snr-bandwidth`

[Reproduction and metrics](artifacts/80302fea96a54745/case.json)

```json
{
  "snrDb": 56.44983579824328,
  "pass": false,
  "perChannel": [
    {
      "snrDb": 56.44983579824328,
      "pass": false
    },
    {
      "snrDb": 56.44983579824328,
      "pass": false
    }
  ],
  "minSnr": 70,
  "lengthError": 0,
  "inputUnchanged": true
}
```

## webaudio-webkit: dynamics.compressor.envelope

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier quality --case dynamics.compressor.envelope`

[Reproduction and metrics](artifacts/11649b8868fae737/case.json)

```json
{
  "pass": false,
  "windows": [
    {
      "start": 0.3,
      "end": 0.45,
      "minDb": -0.1,
      "maxDb": 0.1,
      "gainDb": 8.099868178153084,
      "pass": false
    },
    {
      "start": 0.501,
      "end": 0.503,
      "minDb": -8,
      "maxDb": 0,
      "gainDb": -17.466542619842727,
      "pass": false
    },
    {
      "start": 0.9,
      "end": 1.3,
      "minDb": -9.2,
      "maxDb": -8.7,
      "gainDb": -0.8845160221234201,
      "pass": false
    },
    {
      "start": 1.501,
      "end": 1.505,
      "minDb": -10,
      "maxDb": -2,
      "gainDb": 23.732232762236364,
      "pass": false
    },
    {
      "start": 1.9,
      "end": 1.99,
      "minDb": -0.5,
      "maxDb": 0.1,
      "gainDb": 8.099868178153137,
      "pass": false
    }
  ],
  "perChannel": [
    {
      "pass": false,
      "windows": [
        {
          "start": 0.3,
          "end": 0.45,
          "minDb": -0.1,
          "maxDb": 0.1,
          "gainDb": 8.099868178153084,
          "pass": false
        },
        {
          "start": 0.501,
          "end": 0.503,
          "minDb": -8,
          "maxDb": 0,
          "gainDb": -17.466542619842727,
          "pass": false
        },
        {
          "start": 0.9,
          "end": 1.3,
          "minDb": -9.2,
          "maxDb": -8.7,
          "gainDb": -0.8845160221234201,
          "pass": false
        },
        {
          "start": 1.501,
          "end": 1.505,
          "minDb": -10,
          "maxDb": -2,
          "gainDb": 23.732232762236364,
          "pass": false
        },
        {
          "start": 1.9,
          "end": 1.99,
          "minDb": -0.5,
          "maxDb": 0.1,
          "gainDb": 8.099868178153137,
          "pass": false
        }
      ]
    }
  ],
  "inputUnchanged": true
}
```

## webaudio-webkit: effect.delay.impulse

Status: fail.

`node bin/audio-test.js run --adapter webaudio-webkit --tier core --case effect.delay.impulse`

[Reproduction and metrics](artifacts/590af3139c34d120/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.25,
  "rmsError": 0.004034198962473008,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.reverse.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.reverse.1f.1ch`

[Reproduction and metrics](artifacts/6bc273df44b461b0/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.reverse.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.reverse.1f.2ch`

[Reproduction and metrics](artifacts/67dd886e312b115f/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.reverse-range.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.reverse-range.1f.1ch`

[Reproduction and metrics](artifacts/9c480fb7898f4733/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.reverse-range.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.reverse-range.1f.2ch`

[Reproduction and metrics](artifacts/d8e855f080aab258/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.reverse-range.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.reverse-range.17f.1ch`

[Reproduction and metrics](artifacts/03ab89e4ea60d5b2/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.reverse-range.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.reverse-range.17f.2ch`

[Reproduction and metrics](artifacts/815e670b59d25137/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.repeat.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.repeat.1f.1ch`

[Reproduction and metrics](artifacts/46aea3ca397e9972/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -3
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.repeat.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.repeat.1f.2ch`

[Reproduction and metrics](artifacts/c6d7b4b366d76cbb/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -3,
    -3
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.invert.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.invert.1f.1ch`

[Reproduction and metrics](artifacts/16b9e48d2dc62901/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.invert.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.invert.1f.2ch`

[Reproduction and metrics](artifacts/4d9e4df0f43c4bb8/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.mute.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.mute.1f.1ch`

[Reproduction and metrics](artifacts/563d410c7f297588/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.mute.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.mute.1f.2ch`

[Reproduction and metrics](artifacts/b4f766a023b9fe9a/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.gain.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.gain.1f.1ch`

[Reproduction and metrics](artifacts/36f3aafe114b7c77/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.gain.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.gain.1f.2ch`

[Reproduction and metrics](artifacts/5aba966046d5b3c5/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.gain-db.1f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.gain-db.1f.1ch`

[Reproduction and metrics](artifacts/e3dfb3b72930bd6c/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.gain-db.1f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.gain-db.1f.2ch`

[Reproduction and metrics](artifacts/3750e165223ac78f/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    -1,
    -1
  ],
  "maxAbsError": 0,
  "rmsError": 0,
  "pass": false,
  "reason": "length",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.17f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.17f.1ch`

[Reproduction and metrics](artifacts/f2c5ef5a588fa785/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.024670958518981934,
  "rmsError": 0.023670542990028208,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.17f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.17f.2ch`

[Reproduction and metrics](artifacts/dfd34364e8b4503c/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.024670958518981934,
  "rmsError": 0.016810091804247477,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.1023f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.1023f.1ch`

[Reproduction and metrics](artifacts/247674c8b0ae9051/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.012425072491168976,
  "rmsError": 0.00151995852497485,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.1023f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.1023f.2ch`

[Reproduction and metrics](artifacts/c0910978c8bfdea1/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.034556444734334946,
  "rmsError": 0.0032166843690809824,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.1024f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.1024f.1ch`

[Reproduction and metrics](artifacts/5235801d176d016c/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.012461405247449875,
  "rmsError": 0.0015237573530998557,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.1024f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.1024f.2ch`

[Reproduction and metrics](artifacts/a64ac484b0de769e/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.034592777490615845,
  "rmsError": 0.0032192138237839758,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.1025f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.1025f.1ch`

[Reproduction and metrics](artifacts/8016fb85d45ba618/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.012497738935053349,
  "rmsError": 0.0015275527774667322,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.1025f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.1025f.2ch`

[Reproduction and metrics](artifacts/551db2ce323d2c32/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.034629110246896744,
  "rmsError": 0.003221742397499792,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.65537f.1ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.65537f.1ch`

[Reproduction and metrics](artifacts/9dbe3fa6e5ff3a6a/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.012664818204939365,
  "rmsError": 0.00019364621405148786,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade-out.65537f.2ch

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade-out.65537f.2ch`

[Reproduction and metrics](artifacts/874de5a4dd9bb2dd/case.json)

```json
{
  "channels": 2,
  "expectedChannels": 2,
  "lengthDelta": [
    0,
    0
  ],
  "maxAbsError": 0.03479618951678276,
  "rmsError": 0.0004052708355321588,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```

## audacity: edit.fade.linear.out

Status: fail.

`node bin/audio-test.js run --adapter audacity --tier core --case edit.fade.linear.out`

[Reproduction and metrics](artifacts/52ba2522b88d3954/case.json)

```json
{
  "channels": 1,
  "expectedChannels": 1,
  "lengthDelta": [
    0
  ],
  "maxAbsError": 0.00012205541133880615,
  "rmsError": 0.00012204051745208983,
  "pass": false,
  "reason": "samples",
  "inputUnchanged": true
}
```
