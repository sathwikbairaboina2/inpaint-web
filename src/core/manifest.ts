import { InpaintError } from './types'

export type ModelIO = {
  dtype: 'uint8' | 'float32'
  imageScale: number
  outputScale: number
  maskKeep: number
  maskHole: number
  inputs: { image: string; mask: string }
  output: string
}

export type ModelEntry = {
  id: string
  task: string
  file: string
  urls: string[]
  sha256: string
  bytes: number
  size: number
  minBufferBytes: number
  io: ModelIO
  license: string
  source: string
  weights: string
}

export type Manifest = { version: 1; models: ModelEntry[] }

const bad = (msg: string): never => {
  throw new InpaintError('BAD_INPUT', `manifest: ${msg}`)
}

function str(o: Record<string, unknown>, k: string): string {
  const v = o[k]
  if (typeof v !== 'string' || v === '') bad(`${k} must be a non-empty string`)
  return v as string
}

function num(o: Record<string, unknown>, k: string): number {
  const v = o[k]
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(`${k} must be a number`)
  return v as number
}

function rec(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) bad(`${what} must be an object`)
  return v as Record<string, unknown>
}

function parseIO(v: unknown): ModelIO {
  const io = rec(v, 'io')
  const dtype = io.dtype
  if (dtype !== 'uint8' && dtype !== 'float32') bad('io.dtype must be uint8 or float32')
  const inputs = rec(io.inputs, 'io.inputs')
  return {
    dtype: dtype as ModelIO['dtype'],
    imageScale: num(io, 'imageScale'),
    outputScale: num(io, 'outputScale'),
    maskKeep: num(io, 'maskKeep'),
    maskHole: num(io, 'maskHole'),
    inputs: { image: str(inputs, 'image'), mask: str(inputs, 'mask') },
    output: str(io, 'output'),
  }
}

function parseModel(v: unknown): ModelEntry {
  const m = rec(v, 'model')
  const sha256 = str(m, 'sha256')
  if (!/^[0-9a-f]{64}$/.test(sha256)) bad('sha256 must be 64 lowercase hex characters')
  const urls = m.urls
  if (!Array.isArray(urls) || urls.length === 0 || urls.some((u) => typeof u !== 'string' || u === ''))
    bad('urls must be a non-empty string array')
  const size = num(m, 'size')
  if (!Number.isInteger(size) || size <= 0 || size % 8 !== 0) bad('size must be a positive multiple of 8')
  const bytes = num(m, 'bytes')
  if (!Number.isInteger(bytes) || bytes <= 0) bad('bytes must be a positive integer')
  return {
    id: str(m, 'id'),
    task: str(m, 'task'),
    file: str(m, 'file'),
    urls: urls as string[],
    sha256,
    bytes,
    size,
    minBufferBytes: num(m, 'minBufferBytes'),
    io: parseIO(m.io),
    license: str(m, 'license'),
    source: str(m, 'source'),
    weights: str(m, 'weights'),
  }
}

export function parseManifest(json: unknown): Manifest {
  const root = rec(json, 'root')
  if (root.version !== 1) bad('version must be 1')
  if (!Array.isArray(root.models)) bad('models must be an array')
  return { version: 1, models: (root.models as unknown[]).map(parseModel) }
}

export function getModel(manifest: Manifest, id: string): ModelEntry {
  const m = manifest.models.find((x) => x.id === id)
  if (!m) throw new InpaintError('BAD_INPUT', `unknown model id: ${id}`)
  return m
}
