const TAU = 2 * Math.PI

const value = (frame, channel) => {
  const raw = (Math.imul(frame + 1, 1664525) + Math.imul(channel + 1, 1013904223)) >>> 0
  return (raw / 4294967296 - .5) * 1.5
}

export function makeSignal(fixture) {
  const { signal, frames, channels = 1, sampleRate = 48000 } = fixture
  if (!Number.isInteger(frames) || frames < 0) throw new RangeError('Fixture frames must be a non-negative integer')
  if (!Number.isInteger(channels) || channels < 1) throw new RangeError('Fixture channels must be a positive integer')

  const output = Array.from({ length: channels }, (_, channel) => {
    if (signal === 'array') {
      const values = fixture.samples?.[channel] || fixture.values || []
      if (values.length !== frames) throw new RangeError('Array fixture length must match frames')
      return Float32Array.from(values)
    }
    if (signal === 'segments') {
      const data = new Float32Array(frames)
      let offset = 0
      for (const part of fixture.segments) {
        const piece = makeSignal({ ...fixture, ...part, channels, segments: undefined }).channels[channel]
        if (offset + piece.length > frames) throw new RangeError('Segments exceed fixture frames')
        data.set(piece, offset); offset += piece.length
      }
      if (offset !== frames) throw new RangeError('Segments must fill fixture frames')
      return data
    }
    if (signal === 'impulse') {
      const data = new Float32Array(frames)
      if (frames) data[Math.min(frames - 1, fixture.at ?? channel * 3)] = fixture.amplitude ?? (channel % 2 ? -0.5 : 0.75)
      return data
    }
    if (signal === 'sample-id') return Float32Array.from({ length: frames }, (_, frame) => value(frame, channel))
    if (signal === 'sine') {
      const frequency = fixture.frequency ?? 997
      const amplitude = fixture.amplitudes?.[channel] ?? fixture.amplitude ?? 0.5
      const phase = fixture.phase ?? channel * 0.37
      return Float32Array.from({ length: frames }, (_, frame) => {
        const fade = fixture.fadeFrames ? Math.min(1, frame / fixture.fadeFrames, (frames - 1 - frame) / fixture.fadeFrames) : 1
        return amplitude * fade * Math.sin(TAU * frequency * frame / sampleRate + phase)
      })
    }
    if (signal === 'noise' || signal === 'tone-noise') {
      let seed = ((fixture.seed ?? 123456789) + channel * 2654435761) >>> 0
      return Float32Array.from({ length: frames }, (_, frame) => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
        const noise = (seed >>> 0) / 4294967296 * 2 - 1
        const tone = signal === 'tone-noise' && frame >= (fixture.startFrames ?? 0) ? (fixture.amplitude ?? .2) * Math.sin(TAU * (fixture.frequency ?? 997) * frame / sampleRate) : 0
        return tone + noise * (fixture.noiseAmplitude ?? .05)
      })
    }
    if (signal === 'clicks') {
      const data = new Float32Array(frames), length = Math.round(.02 * sampleRate)
      for (const time of fixture.events) {
        const start = Math.round(time * sampleRate)
        for (let i = 0; i < length && start + i < frames; i++) data[start + i] += (fixture.amplitude ?? .8) * Math.exp(-i / (.002 * sampleRate)) * Math.cos(TAU * 1000 * i / sampleRate)
      }
      return data
    }
    if (signal === 'silence') return new Float32Array(frames)
    if (signal === 'dc') return new Float32Array(frames).fill(fixture.value ?? .25)
    throw new RangeError(`Unknown signal: ${signal}`)
  })

  return { channels: output, sampleRate }
}

export const cloneChannels = channels => channels.map(channel => channel.slice())
