import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const contenders = ['audio','ffmpeg','sox','librosa','pedalboard','scipy','soxr','libsamplerate','pyloudnorm','rubberband','soundtouch','webaudio','webaudio-firefox','webaudio-webkit']
const builtin = new Set([...contenders,'reference','audacity'])

export async function loadAdapter(name) {
  let url
  if (builtin.has(name)) url = new URL(`./${name}.js`, import.meta.url)
  else if (isAbsolute(name) || name.startsWith('.')) url = pathToFileURL(resolve(name))
  else url = name
  const module = await import(url)
  return module.default || module.adapter
}
