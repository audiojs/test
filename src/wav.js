const RIFF = 12

const fourcc = (view, offset) => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))
const writeFourcc = (view, offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))

export function encodeWav(channels, sampleRate = 48000) {
  if (!channels.length) throw new RangeError('WAV needs at least one channel')
  const frames = channels[0].length
  if (!channels.every(channel => channel.length === frames)) throw new RangeError('WAV channels must have equal lengths')
  const bytesPerSample = 4, blockAlign = channels.length * bytesPerSample, dataLength = frames * blockAlign
  const buffer = Buffer.alloc(44 + dataLength), view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  writeFourcc(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeFourcc(view, 8, 'WAVE')
  writeFourcc(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 3, true)
  view.setUint16(22, channels.length, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 32, true)
  writeFourcc(view, 36, 'data')
  view.setUint32(40, dataLength, true)
  let offset = 44
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels.length; channel++, offset += 4) view.setFloat32(offset, channels[channel][frame], true)
  return buffer
}

export function decodeWav(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  if (buffer.length < RIFF || fourcc(view, 0) !== 'RIFF' || fourcc(view, 8) !== 'WAVE') throw new TypeError('Not a RIFF/WAVE file')

  let format, channels, sampleRate, bits, dataOffset, dataLength
  for (let offset = RIFF; offset + 8 <= buffer.length;) {
    const id = fourcc(view, offset), size = view.getUint32(offset + 4, true), body = offset + 8
    if (body + size > buffer.length) throw new RangeError(`Invalid WAV ${id} chunk`)
    if (id === 'fmt ') {
      format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
      if (format === 0xfffe && size >= 40) format = view.getUint16(body + 24, true)
    } else if (id === 'data') {
      dataOffset = body
      dataLength = size
    }
    offset = body + size + (size & 1)
  }
  if (!format || !channels || !sampleRate || dataOffset == null) throw new TypeError('Incomplete WAV file')
  const bytesPerSample = bits / 8, frames = Math.floor(dataLength / (channels * bytesPerSample))
  const output = Array.from({ length: channels }, () => new Float32Array(frames))
  const read = format === 3 && bits === 32
    ? offset => view.getFloat32(offset, true)
    : format === 1 && bits === 16
      ? offset => view.getInt16(offset, true) / 32768
      : format === 1 && bits === 24
        ? offset => {
            const value = view.getUint8(offset) | view.getUint8(offset + 1) << 8 | view.getUint8(offset + 2) << 16
            return (value & 0x800000 ? value - 0x1000000 : value) / 8388608
          }
        : format === 1 && bits === 32
          ? offset => view.getInt32(offset, true) / 2147483648
          : null
  if (!read) throw new RangeError(`Unsupported WAV format ${format}/${bits}`)
  let offset = dataOffset
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++, offset += bytesPerSample) output[channel][frame] = read(offset)
  return { channels: output, sampleRate }
}
