import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { trackChild } from '../src/children.js'
import { codecSupported, encodedFormat } from './codecs.js'

const filterParams = { derivative: [], integral: ['leak'], emphasis: ['alpha'], deemphasis: ['alpha'], dcblocker: ['R'] }
const pedalboardParams = {
 compressor: ['threshold', 'ratio', 'attack', 'release', 'makeup', 'upRatio', 'knee'],
 limiter: ['ceiling', 'release', 'lookahead'], gate: ['threshold', 'attack', 'release'],
 delay: ['time', 'feedback', 'mix'], chorus: ['rate', 'depth', 'delay'],
 phaser: ['rate', 'depth', 'feedback', 'fc'], distortion: [], bitcrusher: ['bits'],
 freeverb: ['room', 'damp', 'mix'], moog: ['fc', 'resonance', 'drive'], 'pitch-shift': ['semitones']
}
const parametersSupported = (s, params) => s.op === 'processor' && Object.hasOwn(params, s.name) &&
 Object.keys(s.params || {}).every(key => params[s.name].includes(key))
const mappings = {
 librosa: 'librosa resample (soxr_hq), effects (remix without zero-crossing alignment; pre/deemphasis with zero initial state), util.normalize, to_mono, feature, onset, yin and stft',
 pedalboard: 'Pedalboard native effects; BrickwallLimiter for positive lookahead, Limiter for zero lookahead (native makeup retained); LadderFilter LPF24 for Moog; AudioFile WAV/FLAC; step seconds converted to milliseconds, processor units retained; first-order low/high-pass only; Convolution retains native IR normalization',
 scipy: 'scipy.signal butter/sosfilt, iirpeak/iirnotch/lfilter, resample_poly, fftconvolve; scipy.fft.rfft',
 soxr: 'soxr.resample and ResampleStream, HQ quality',
 libsamplerate: 'samplerate.resample and CallbackResampler, sinc_best quality',
 pyloudnorm: 'pyloudnorm BS.1770 Meter and normalize; sample-peak ceiling on normalization'
}
function supported(id, s) {
 if (id === 'librosa') return ['resample', 'stretch', 'pitch', 'normalize', 'mono', 'trim', 'remove', 'repeat', 'derivative', 'integral'].includes(s.op) ||
  (s.name !== 'dcblocker' && parametersSupported(s, { ...filterParams, 'pitch-shift': ['semitones'], 'stretch-pvoc': ['factor'] })) ||
  (s.op === 'analyze' && ['rms', 'zcr'].includes(s.name)) ||
  (s.op === 'measure' && ['pitch', 'spectrum', 'onsets', 'tempo'].includes(s.name))
 if (id === 'scipy') return ['lowpass', 'highpass', 'bandpass', 'notch', 'resample', 'convolve', 'derivative', 'integral'].includes(s.op) || parametersSupported(s, filterParams) ||
  (s.op === 'measure' && s.name === 'spectrum')
 if (id === 'soxr' || id === 'libsamplerate') return s.op === 'resample'
 if (id === 'pyloudnorm') return s.op === 'normalize-loudness' || (s.op === 'measure' && s.name === 'loudness')
 if (id !== 'pedalboard') return false
 if (['gain-db', 'lowshelf', 'highshelf', 'eq', 'pitch', 'stretch', 'delay', 'convolve'].includes(s.op)) return true
 if (s.op === 'gain') return Number.isFinite(s.value)
 if (s.op === 'lowpass' || s.op === 'highpass') return s.order === 1
 if (s.op === 'compressor') return (s.knee ?? 0) === 0
 if (s.op === 'gate') return (s.hold ?? 0) === 0
 if (s.op === 'limiter') return true
 if (!parametersSupported(s, pedalboardParams)) return false
 const params = s.params || {}
 return s.name !== 'compressor' || ((params.upRatio ?? 1) === 1 && (params.knee ?? 0) === 0)
}

export function python(id) {
 let child, pending, stderr = '', queue = Promise.resolve()
 const settle = (error, value) => {
  const p = pending
  pending = null
  if (error) p?.reject(error)
  else p?.resolve(value)
 }
 const send = body => new Promise((resolve, reject) => {
  if (!child) {
   stderr = ''
   const worker = id === 'audacity' ? './audacity.py' : './python.py'
   const proc = spawn(process.env.AUDIO_TEST_PYTHON || 'python3', [fileURLToPath(new URL(worker, import.meta.url)), id], { stdio: ['pipe', 'pipe', 'pipe'] })
   child = proc
   trackChild(proc)
   proc.on('error', error => { if (child === proc) { child = null; settle(error) } })
   proc.on('exit', code => {
    if (child !== proc) return
    child = null
    settle(new Error(`${id} worker exited ${code}: ${stderr.slice(-3000)}`))
   })
   proc.stdin.on('error', error => { if (child === proc) settle(error) })
   proc.stderr.on('data', data => { stderr = (stderr + data).slice(-5000) })
   createInterface({ input: proc.stdout }).on('line', line => {
    if (child !== proc) return
    try {
     const message = JSON.parse(line)
     settle(message.error ? new Error(message.error) : null, message.value)
    } catch (error) { settle(error) }
   })
  }
  pending = { resolve, reject }
  child.stdin.write(JSON.stringify(body) + '\n')
 })
 const request = body => {
  const result = queue.then(() => send(body))
  queue = result.catch(() => {})
  return result
 }
 return {
  id,
  available: async () => { await request({ method: 'version' }); return true },
  version: () => request({ method: 'version' }),
  metadata: async () => ({ mode: 'persistent Python worker; planar float32 PCM', mapping: mappings[id], python: process.env.AUDIO_TEST_PYTHON || 'python3', ...await request({ method: 'metadata' }) }),
  supports: test => test.workflow ? (['soxr', 'libsamplerate'].includes(id) && test.workflow.op === 'resample-chunks') ||
   (id === 'pedalboard' && codecSupported(test) && !test.workflow.split) :
   test.steps.length > 0 && test.steps.every((step, index) => supported(id, step) && (!['analyze', 'measure'].includes(step.op) || index === test.steps.length - 1)),
  run: async (test, input, sampleRate) => {
   const out = await request({ method: 'run', test, input: input.map(channel => Array.from(channel)), sampleRate })
   if (out.channels) out.channels = out.channels.map(channel => Float32Array.from(channel))
   for (const key of ['batch', 'sourceAfter']) if (out.observations?.[key]) out.observations[key] = out.observations[key].map(channel => Float32Array.from(channel))
   if (out.encoded) {
    const bytes = Buffer.from(out.encoded, 'base64')
    Object.assign(out, encodedFormat(bytes, test.workflow.format), { encodedBytes: bytes.length })
    delete out.encoded
   }
   return out
  },
  close: () => {
   const proc = child
   child = null
   settle(new Error(`${id} worker closed`))
   proc?.kill()
  }
 }
}
