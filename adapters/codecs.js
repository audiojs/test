import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execute } from './external.js'
import { encodeWav, decodeWav } from '../src/wav.js'

const copy = channels => channels.map(channel => channel.slice())
export const codecSupported = test => test.workflow?.op === 'codec-roundtrip' && ['wav', 'flac'].includes(test.workflow.format)

export function encodedBitDepth(bytes, format) {
 const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 if (format === 'flac') {
  // RFC 9639 §8.2: STREAMINFO is the first block; bits/sample is a 5-bit field minus one.
  // https://www.rfc-editor.org/rfc/rfc9639.html#section-8.2
  if (data.length < 42 || data.toString('ascii', 0, 4) !== 'fLaC' || (data[4] & 127) !== 0 || data.readUIntBE(5, 3) !== 34)
   throw new Error('Invalid or truncated FLAC STREAMINFO')
  const depth = ((data[20] & 1) << 4 | data[21] >> 4) + 1
  if (depth < 4) throw new Error('Invalid FLAC bit depth')
  return depth
 }
 if (format !== 'wav' || data.length < 12 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE')
  throw new Error('Invalid or truncated RIFF/WAVE header')
 const end = data.readUInt32LE(4) + 8
 if (end > data.length) throw new Error('Truncated RIFF/WAVE file')
 for (let offset = 12; offset + 8 <= end;) {
  const size = data.readUInt32LE(offset + 4), body = offset + 8
  if (body + size > end) throw new Error('Truncated RIFF/WAVE chunk')
  if (data.toString('ascii', offset, body - 4) === 'fmt ') {
   // WAVEFORMATEX.wBitsPerSample, relative to the fmt payload (not a fixed file offset).
   // https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex
   if (size < 16) throw new Error('Truncated RIFF/WAVE fmt chunk')
   const depth = data.readUInt16LE(body + 14)
   if (!depth) throw new Error('Invalid WAV bit depth')
   return depth
  }
  offset = body + size + (size & 1)
 }
 throw new Error('Missing RIFF/WAVE fmt chunk')
}

export async function audioCodec(audio, source, test) {
 const { format, split } = test.workflow
 const bytes = await source.encode(format, { bitDepth: 16 })
 const bitDepth = encodedBitDepth(bytes, format)
 async function* chunks() {
  yield new Uint8Array()
  yield bytes.subarray(0, 1)
  yield bytes.subarray(1, bytes.length - 1)
  yield bytes.subarray(bytes.length - 1)
  yield new Uint8Array()
 }
 const decoded = audio(split ? chunks() : bytes)
 try {
  const channels = copy(await decoded.read())
  return { channels, sampleRate: decoded.sampleRate, observations: { sourceAfter: copy(await source.read()) }, encodedBytes: bytes.length, bitDepth }
 } finally { decoded.dispose() }
}

export async function nativeCodec(id, test, input, sampleRate) {
 const directory = await mkdtemp(join(tmpdir(), 'audio-test-codec-'))
 const source = join(directory, 'source.wav'), encoded = join(directory, `encoded.${test.workflow.format}`), target = join(directory, 'decoded.wav')
 try {
  await writeFile(source, encodeWav(input, sampleRate))
  if (id === 'ffmpeg') {
   const codec = test.workflow.format === 'flac' ? 'flac' : 'pcm_s16le'
   await execute(id, ['-nostdin', '-v', 'error', '-y', '-i', source, '-c:a', codec, '-sample_fmt', 's16', encoded])
   await execute(id, ['-nostdin', '-v', 'error', '-y', '-i', encoded, '-c:a', 'pcm_f32le', target])
  } else {
   await execute(id, ['-D', source, '-b', '16', encoded])
   await execute(id, ['-D', encoded, '-e', 'floating-point', '-b', '32', target])
  }
  const bytes = await readFile(encoded)
  const bitDepth = encodedBitDepth(bytes, test.workflow.format)
  const output = decodeWav(await readFile(target))
  return { channels: output.channels, sampleRate: output.sampleRate, observations: { sourceAfter: decodeWav(await readFile(source)).channels }, encodedBytes: bytes.length, bitDepth }
 } finally { await rm(directory, { recursive: true, force: true }) }
}
