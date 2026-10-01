export type Channels = Float32Array[]

export interface AudioCase {
  id: string
  feature: string
  title: string
  status: 'active' | 'planned'
  tier: 'smoke' | 'core' | 'quality' | 'research'
  fixture?: Record<string, unknown>
  steps?: Array<Record<string, unknown>>
  workflow?: Record<string, unknown>
  oracle: Record<string, unknown>
  level?: 'conformance' | 'integrity'
  adapters?: string[]
}

export interface AdapterResult {
  channels?: Channels
  scalar?: number
  values?: { peak: number, rms: number, dc: number }
  spectrum?: { frequencies: number[], magnitudes: number[] }
  events?: number[]
  sampleRate?: number
  encodedBytes?: number
  bitDepth?: number
  sampleFormat?: 'integer' | 'float'
  inputUnchanged?: boolean
  observations?: Record<string, Channels>
}

export interface Adapter {
  id: string
  available(): Promise<boolean>
  version(): Promise<string>
  supports(test: AudioCase): boolean | Promise<boolean>
  run(test: AudioCase, input: Channels, sampleRate: number): Promise<AdapterResult>
  metadata?(): Promise<Record<string, unknown>>
  close?(): unknown
}

export function defineAdapter(adapter: Adapter): Adapter
export function runSuite(adapter: Adapter, options?: Record<string, unknown>): Promise<Record<string, unknown>>
export function loadCases(): Promise<AudioCase[]>
export function loadContenders(): Promise<Record<string, unknown>>
export function loadFacets(): Promise<Record<string, unknown>>
export function loadFeatures(): Promise<Record<string, unknown>>
export function encodeWav(channels: Channels, sampleRate?: number): Buffer
export function decodeWav(bytes: Uint8Array): { channels: Channels, sampleRate: number }
