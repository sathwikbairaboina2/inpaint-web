import { sha256Hex } from './hash'
import type { ModelEntry } from './manifest'
import { InpaintError, type Progress } from './types'

export interface ModelCache {
  get(key: string): Promise<Uint8Array | undefined>
  put(key: string, bytes: Uint8Array): Promise<void>
  keys(): Promise<string[]>
  delete(key: string): Promise<void>
}

export type LoadDeps = {
  fetch: (url: string) => Promise<Response>
  cache: ModelCache
  onProgress?: (p: Progress) => void
}

export function memoryCache(): ModelCache {
  const store = new Map<string, Uint8Array>()
  return {
    get: async (k) => store.get(k),
    put: async (k, b) => void store.set(k, b),
    keys: async () => [...store.keys()],
    delete: async (k) => void store.delete(k),
  }
}

async function readAll(res: Response, fallbackTotal: number, onProgress?: (p: Progress) => void): Promise<Uint8Array> {
  const header = Number(res.headers.get('content-length'))
  const total = Number.isFinite(header) && header > 0 ? header : fallbackTotal
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer())
    onProgress?.({ phase: 'download', done: all.length, total: all.length })
    return all
  }
  const chunks: Uint8Array[] = []
  let done = 0
  const reader = res.body.getReader()
  for (;;) {
    const { value, done: end } = await reader.read()
    if (end) break
    chunks.push(value)
    done += value.length
    onProgress?.({ phase: 'download', done, total: Math.max(total, done) })
  }
  const out = new Uint8Array(done)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  onProgress?.({ phase: 'download', done, total: done })
  return out
}

export async function loadModel(model: ModelEntry, deps: LoadDeps): Promise<Uint8Array> {
  const prefix = `models/${model.id}/`
  const key = `${prefix}${model.sha256}`

  const cached = await deps.cache.get(key)
  if (cached) {
    if ((await sha256Hex(cached)) === model.sha256) {
      deps.onProgress?.({ phase: 'download', done: cached.length, total: cached.length })
      return cached
    }
    await deps.cache.delete(key)
  }

  let mismatch = false
  const failures: string[] = []
  for (const url of model.urls) {
    try {
      const res = await deps.fetch(url)
      if (!res.ok) {
        failures.push(`${url}: HTTP ${res.status}`)
        continue
      }
      const bytes = await readAll(res, model.bytes, deps.onProgress)
      if ((await sha256Hex(bytes)) !== model.sha256) {
        mismatch = true
        failures.push(`${url}: sha256 mismatch`)
        continue
      }
      await deps.cache.put(key, bytes)
      for (const k of await deps.cache.keys()) if (k.startsWith(prefix) && k !== key) await deps.cache.delete(k)
      return bytes
    } catch (e) {
      failures.push(`${url}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (mismatch) throw new InpaintError('HASH_MISMATCH', `model bytes do not match the pinned sha256 (${failures.join('; ')})`)
  throw new InpaintError('DOWNLOAD_FAILED', `could not download ${model.id} (${failures.join('; ')})`)
}
