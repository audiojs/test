import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeWav, encodeWav } from '../src/wav.js'

test('float WAV round-trips channels and rate exactly', () => {
  const channels = [Float32Array.from([0, 0.25, -0.5, 1]), Float32Array.from([1, -0.5, 0.25, 0])]
  const decoded = decodeWav(encodeWav(channels, 44100))
  assert.equal(decoded.sampleRate, 44100)
  assert.deepEqual(decoded.channels.map(channel => [...channel]), channels.map(channel => [...channel]))
})

test('WAV rejects unequal channel lengths', () => {
  assert.throws(() => encodeWav([new Float32Array(1), new Float32Array(2)]), /equal lengths/)
})
