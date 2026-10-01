"""Persistent workers: library calls own the DSP; adapters translate layouts and units."""
import sys
import json
import importlib
import importlib.metadata
import math
import traceback
import numpy as np

name = sys.argv[1]
module = {'libsamplerate': 'samplerate'}.get(name, name)
lib = importlib.import_module(module)


def spectrum(values, frequencies, frames, window_gain):
    """Convert a library's real DFT to single-sided, linear peak amplitude."""
    magnitudes = np.abs(values) * (2 / window_gain)
    magnitudes[0] *= 0.5
    if frames % 2 == 0:
        magnitudes[-1] *= 0.5
    return {'spectrum': {'frequencies': frequencies.tolist(), 'magnitudes': magnitudes.tolist()}}


def librosa_step(y, sr, s):
    op = s['op']
    if op == 'resample':
        return lib.resample(y, orig_sr=sr, target_sr=s['to'], res_type='soxr_hq'), s['to']
    if op == 'stretch':
        return lib.effects.time_stretch(y, rate=1 / s['factor']), sr
    if op == 'pitch':
        return lib.effects.pitch_shift(y, sr=sr, n_steps=s['semitones']), sr
    if op == 'normalize':
        return lib.util.normalize(y, norm=np.inf, axis=None) * 10 ** (s['db'] / 20), sr
    if op == 'mono':
        return lib.to_mono(y)[None, :], sr
    if op == 'analyze':
        flat = y.reshape(-1)
        if s['name'] == 'rms':
            value = lib.feature.rms(y=flat, frame_length=len(flat), hop_length=len(flat), center=False)[0, 0]
        elif s['name'] == 'zcr':
            value = lib.feature.zero_crossing_rate(y=y, frame_length=y.shape[-1], hop_length=y.shape[-1], center=False).mean()
        else:
            raise ValueError('Unsupported librosa analysis: ' + s['name'])
        return {'scalar': float(value)}
    if op == 'measure':
        mono = lib.to_mono(y)
        feature = s['name']
        if feature == 'spectrum':
            n = s.get('size', len(mono))
            window = s.get('window', 'boxcar')
            values = lib.stft(mono, n_fft=n, hop_length=n, center=False, window=window)[:, 0]
            gain = lib.filters.get_window(window, n, fftbins=True).sum()
            return spectrum(values, lib.fft_frequencies(sr=sr, n_fft=n), n, gain)
        if feature == 'pitch':
            values = lib.yin(mono, sr=sr, fmin=s.get('minFrequency', 50), fmax=s.get('maxFrequency', min(2000, sr / 2)), frame_length=2048)
            return {'scalar': float(np.median(values))}
        if feature == 'onsets':
            return {'events': lib.onset.onset_detect(y=mono, sr=sr, hop_length=128, units='time').tolist()}
        if feature == 'tempo':
            return {'scalar': float(lib.feature.tempo(y=mono, sr=sr, hop_length=256)[0])}
    raise ValueError('Unsupported librosa operation: ' + op)


def pedalboard_step(y, sr, s):
    op = s['op']
    if op == 'gain-db':
        effect = lib.Gain(gain_db=s['db'])
    elif op == 'gain':
        effects = [lib.Gain(gain_db=float(20 * np.log10(abs(s['value']))) if s['value'] else float('-inf'))]
        if s['value'] < 0:
            effects.append(lib.Invert())
        effect = lib.Pedalboard(effects)
    elif op == 'lowpass':
        effect = lib.LowpassFilter(cutoff_frequency_hz=s['freq'])
    elif op == 'highpass':
        effect = lib.HighpassFilter(cutoff_frequency_hz=s['freq'])
    elif op in ['lowshelf', 'highshelf', 'eq']:
        constructor = {'lowshelf': lib.LowShelfFilter, 'highshelf': lib.HighShelfFilter, 'eq': lib.PeakFilter}[op]
        effect = constructor(cutoff_frequency_hz=s['freq'], gain_db=s['gain'], q=s['Q'])
    elif op == 'pitch':
        effect = lib.PitchShift(semitones=s['semitones'])
    elif op == 'stretch':
        return lib.time_stretch(y, sr, stretch_factor=1 / s['factor']), sr
    elif op == 'compressor':
        effect = lib.Pedalboard([lib.Compressor(threshold_db=s['threshold'], ratio=s['ratio'], attack_ms=s['attack'] * 1000, release_ms=s['release'] * 1000), lib.Gain(gain_db=s.get('makeup', 0))])
    elif op == 'limiter':
        effect = lib.Limiter(threshold_db=s['ceiling'], release_ms=s['release'] * 1000)
    elif op == 'gate':
        effect = lib.NoiseGate(threshold_db=s['threshold'], ratio=100, attack_ms=s['attack'] * 1000, release_ms=s['release'] * 1000)
    elif op == 'delay':
        effect = lib.Delay(delay_seconds=s['delayFrames'] / sr, feedback=s['feedback'], mix=s['mix'])
    elif op == 'convolve':
        effect = lib.Convolution(np.asarray(s['impulse'], dtype=np.float32), mix=1, sample_rate=sr)
        if s.get('tail', True):
            y = np.pad(y, ((0, 0), (0, len(s['impulse']) - 1)))
    elif op == 'processor':
        params = s.get('params', {})
        constructors = {'compressor': lib.Compressor, 'limiter': lib.Limiter, 'gate': lib.NoiseGate,
                        'delay': lib.Delay, 'chorus': lib.Chorus, 'phaser': lib.Phaser,
                        'distortion': lib.Distortion, 'bitcrusher': lib.Bitcrush, 'freeverb': lib.Reverb}
        if s['name'] == 'compressor' and params:
            effect = lib.Pedalboard([lib.Compressor(ratio=params.get('ratio', 1)), lib.Gain(gain_db=params.get('makeup', 0))])
        elif s['name'] == 'delay' and params:
            effect = lib.Delay(mix=params['mix'])
        elif s['name'] == 'freeverb' and params:
            # JUCE Reverb::setParameters scales wetLevel by 3 and dryLevel by 2.
            # Translate linear wet/dry weights, rather than doubling dry audio.
            effect = lib.Reverb(wet_level=params['mix'] / 3, dry_level=(1 - params['mix']) / 2)
        else:
            effect = constructors[s['name']]()
    else:
        raise ValueError('Unsupported Pedalboard operation: ' + op)
    return effect(y, sr), sr


def scipy_step(y, sr, s):
    from scipy import signal, fft
    op = s['op']
    if op in ['lowpass', 'highpass']:
        sos = signal.butter(s.get('order', 2), s['freq'], btype=op, fs=sr, output='sos')
        return signal.sosfilt(sos, y, axis=-1), sr
    if op in ['bandpass', 'notch']:
        design = signal.iirpeak if op == 'bandpass' else signal.iirnotch
        b, a = design(s['freq'], s['Q'], fs=sr)
        return signal.lfilter(b, a, y, axis=-1), sr
    if op == 'resample':
        divisor = math.gcd(int(sr), int(s['to']))
        return signal.resample_poly(y, int(s['to']) // divisor, int(sr) // divisor, axis=-1), s['to']
    if op == 'convolve':
        result = signal.fftconvolve(y, np.asarray(s['impulse'])[None, :], mode='full', axes=-1)
        return result if s.get('tail', True) else result[:, :y.shape[-1]], sr
    if op == 'derivative':
        return signal.lfilter([1, -1], [1], y, axis=-1), sr
    if op == 'integral':
        return signal.lfilter([1], [1, -1], y, axis=-1), sr
    if op == 'measure' and s['name'] == 'spectrum':
        n = s.get('size', y.shape[-1])
        window = signal.get_window(s.get('window', 'boxcar'), n, fftbins=True)
        return spectrum(fft.rfft(y[0, :n] * window), fft.rfftfreq(n, 1 / sr), n, window.sum())
    raise ValueError('Unsupported SciPy operation: ' + op)


def resample(y, sr, target):
    # A one-frame transpose can be C-contiguous while retaining ambiguous
    # (itemsize, itemsize) strides. SoXR dispatches on strides, so own the layout.
    frames = y.T.copy(order='C')
    if name == 'soxr':
        return lib.resample(frames, sr, target, quality='HQ').T
    return lib.resample(frames, target / sr, converter_type='sinc_best').T


def stream_resample(y, sr, workflow):
    target = workflow['to']
    sizes = workflow['chunks']
    if not sizes or any(not isinstance(size, int) or isinstance(size, bool) or size <= 0 for size in sizes):
        raise ValueError('Resampling chunks must have positive integer sizes')
    if not y.shape[-1]:
        # Empty transport has no DSP work, but must preserve every channel.
        channels = y.tolist()
        return {'channels': channels, 'sampleRate': target, 'observations': {'batch': channels}}
    pos, index = 0, 0
    def next_chunk():
        nonlocal pos, index
        if pos >= y.shape[-1]:
            return None
        end = min(pos + sizes[index % len(sizes)], y.shape[-1])
        chunk = y[:, pos:end].T.copy()
        pos, index = end, index + 1
        return chunk
    chunks = []
    if name == 'soxr':
        converter = lib.ResampleStream(sr, target, y.shape[0], dtype='float32', quality='HQ')
        while pos < y.shape[-1]:
            chunk = next_chunk()
            chunks.append(converter.resample_chunk(chunk, last=pos == y.shape[-1]))
    else:
        # CallbackResampler drains the filter tail; Resampler.process sizes its
        # output buffer from each input block and cannot drain an empty block.
        converter = lib.CallbackResampler(next_chunk, target / sr, converter_type='sinc_best', channels=y.shape[0])
        while True:
            chunk = converter.read(8192)
            if not len(chunk):
                break
            chunks.append(chunk)
    # A native downsampler may emit zero frames for a nonempty tiny input.
    channels = np.concatenate(chunks, axis=0).T if chunks else np.empty((y.shape[0], 0), dtype=np.float32)
    return {'channels': channels.tolist(), 'sampleRate': target, 'observations': {'batch': resample(y, sr, target).tolist()}}


def run(request):
    test, sr = request['test'], request['sampleRate']
    y = np.asarray(request['input'], dtype=np.float32)
    if test.get('workflow'):
        return stream_resample(y, sr, test['workflow'])
    for step in test['steps']:
        if name == 'librosa':
            result = librosa_step(y, sr, step)
        elif name == 'pedalboard':
            result = pedalboard_step(y, sr, step)
        elif name == 'scipy':
            result = scipy_step(y, sr, step)
        elif name in ['soxr', 'libsamplerate']:
            result = resample(y, sr, step['to']), step['to']
        elif name == 'pyloudnorm':
            meter = lib.Meter(sr)
            loudness = meter.integrated_loudness(y.T)
            if step['op'] == 'measure':
                result = {'scalar': float(loudness)}
            else:
                value = lib.normalize.loudness(y.T, loudness, step['target'])
                ceiling = step.get('ceiling')
                if ceiling is not None and np.max(np.abs(value)) > 10 ** (ceiling / 20):
                    value = lib.normalize.peak(value, ceiling)
                result = value.T, sr
        else:
            raise ValueError('Unsupported library: ' + name)
        if isinstance(result, dict):
            return result
        y, sr = result
    return {'channels': y.tolist(), 'sampleRate': sr}


for line in sys.stdin:
    try:
        request = json.loads(line)
        if request['method'] == 'metadata':
            value = {'pythonVersion': sys.version, 'packages': {d.metadata['Name']: d.version for d in importlib.metadata.distributions()}}
            if name == 'soxr':
                value['nativeVersion'] = getattr(lib, '__libsoxr_version__', None)
            if name == 'libsamplerate':
                value['nativeVersion'] = getattr(lib, '__libsamplerate_version__', None)
        elif request['method'] == 'version':
            value = importlib.metadata.version(module)
        else:
            value = run(request)
        print(json.dumps({'value': value}, allow_nan=False), flush=True)
    except Exception:
        print(json.dumps({'error': traceback.format_exc()}), flush=True)
