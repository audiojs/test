import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const root = resolve(process.argv[2] || process.env.AUDIO_ROOT || '../../audio')
const ecosystem = resolve(process.argv[3] || join(root, '../@audio'))
const source = await readFile(join(root, 'audio.js'), 'utf8')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const packages = []
async function collect(dir) {
  try {
    const p = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    if (!p.name?.startsWith('@audio/') || p.name === '@audio/test') return
    const repo = typeof p.repository === 'string' ? p.repository : p.repository?.url
    const family = p.name.slice(7).split('-')[0]
    const suggestions = {
      synth: ['frequency and amplitude accuracy', 'Nyquist alias energy', 'seeded repeatability and envelope endpoints'],
      filter: ['impulse and frequency response', 'stability at parameter limits', 'chunk partition and channel isolation'],
      eq: ['band-center gain and Q', 'unity-gain identity', 'multi-band composition'],
      resample: ['output length and rate', 'passband SNR and alias rejection', 'stream flush and chunk partition'],
      stretch: ['duration ratio and pitch retention', 'transient location and smearing', 'identity and channel coherence'],
      shift: ['pitch ratio and duration', 'formant or transient retention', 'identity and channel coherence'],
      dynamics: ['static transfer curve', 'attack release and lookahead', 'silence and stereo linking'],
      denoise: ['noise reduction and desired-signal loss', 'clean-signal preservation', 'boundary continuity'],
      decode: ['reference PCM and frame count', 'truncated input and errors', 'chunked decode and channel layout'],
      encode: ['lossless roundtrip or codec quality', 'metadata and delay padding', 'stream finalization'],
      reverb: ['impulse tail and decay', 'wet dry identity', 'stability and channel routing'],
      spectral: ['analytic sine impulse and DC', 'window normalization', 'frame and channel independence'],
      loudness: ['analytic levels and silence', 'EBU/BS.1770 official vectors where applicable', 'gating and channel weighting'],
      spatial: ['channel routing and polarity', 'mono compatibility', 'energy and inter-channel delay']
    }
    packages.push({ name: p.name, version: p.version, family, description: p.description || '', url: p.homepage || (repo || '').replace(/^git\+/, '').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/'), private: !!p.private, proposedTests: suggestions[family] || ['defined input/output contract', 'boundary and invalid-input behavior', 'determinism and resource lifecycle'] })
  } catch (e) { if (e.code !== 'ENOENT') throw e }
}
for (const entry of await readdir(ecosystem, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue
  const dir = join(ecosystem, entry.name)
  await collect(dir)
  try { for (const child of await readdir(join(dir, 'packages'), { withFileTypes: true })) if (child.isDirectory()) await collect(join(dir, 'packages', child.name)) } catch (e) { if (e.code !== 'ENOENT') throw e }
}
const methods = []
for (const [kind, end] of [['OPS', '// ── Stat plugins'], ['STATS', 'audio.plugins =']]) {
  const block = source.slice(source.indexOf(`const ${kind} = {`), source.indexOf(end))
  for (const match of block.matchAll(/^\s*['"]?([\w-]+)['"]?:\s*'(@audio\/[^']+)'/gm)) {
    const [, name, module] = match
    const path = join(root, 'node_modules', module.replace(/\/audio$/, ''), 'audio.js')
    let manifest = {}, error
    try {
      const exports = await import(pathToFileURL(path))
      const processor = exports[name] || exports.default || Object.values(exports).find(value => typeof value === 'function' && value.params)
      manifest = { params: processor?.params || {}, channels: processor?.channels, tail: processor?.tail, latency: processor?.latency, streaming: processor?.streaming }
    } catch (e) { error = e.message.split('\n')[0] }
    methods.push({ name, module, kind: kind === 'OPS' ? 'processor' : 'analysis', ...manifest, ...(error ? { manifestError: error } : {}) })
  }
}
const result = { schema: 1, audioVersion: pkg.version, sourceSha256: createHash('sha256').update(source).digest('hex'), sources: ['https://github.com/audiojs/audio/blob/main/audio.js', 'https://github.com/audiojs'], packages: packages.sort((a,b) => a.name.localeCompare(b.name)), methods }
await writeFile(new URL('../spec/ecosystem.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(`${packages.length} packages, ${methods.length} registered methods`)
