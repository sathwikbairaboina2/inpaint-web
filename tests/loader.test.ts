import { describe, expect, it } from 'vitest'
import { sha256Hex } from '../src/core/hash'
import { loadModel, memoryCache } from '../src/core/loader'
import type { ModelEntry } from '../src/core/manifest'
import { fakeFetch } from './helpers/fake-fetch'

const good = new Uint8Array(Array.from({ length: 1000 }, (_, i) => (i * 31) & 255))

async function entry(urls: string[], bytes = good): Promise<ModelEntry> {
  return {
    id: 'migan-512',
    task: 'inpaint',
    file: 'm.onnx',
    urls,
    sha256: await sha256Hex(bytes),
    bytes: bytes.length,
    size: 512,
    minBufferBytes: 1,
    io: { dtype: 'uint8', imageScale: 1, outputScale: 1, maskKeep: 255, maskHole: 0, inputs: { image: 'image', mask: 'mask' }, output: 'result' },
    license: 'MIT',
    source: 's',
    weights: 'w',
  }
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as { code: string }).code
  }
  return 'none'
}

describe('loadModel', () => {
  it('returns good bytes, caches under models/<id>/<sha>, reports progress to done === total', async () => {
    const m = await entry(['/a'])
    const f = fakeFetch({ '/a': { bytes: good } })
    const cache = memoryCache()
    const events: { done: number; total: number }[] = []
    const out = await loadModel(m, { fetch: f.fetch, cache, onProgress: (p) => events.push(p) })
    expect(Array.from(out)).toEqual(Array.from(good))
    expect(await cache.keys()).toEqual([`models/migan-512/${m.sha256}`])
    const last = events.at(-1)!
    expect(last.done).toBe(last.total)
    expect(last.total).toBe(good.length)
    expect(events.length).toBeGreaterThan(1)
  })

  it('falls through to the second url on 404', async () => {
    const m = await entry(['/a', '/b'])
    const f = fakeFetch({ '/a': { status: 404 }, '/b': { bytes: good } })
    const out = await loadModel(m, { fetch: f.fetch, cache: memoryCache() })
    expect(out.length).toBe(good.length)
    expect(f.calls).toEqual(['/a', '/b'])
  })

  it('uses manifest bytes as total when content-length is absent', async () => {
    const m = await entry(['/a'])
    const f = fakeFetch({ '/a': { bytes: good, contentLength: false } })
    const events: { total: number }[] = []
    await loadModel(m, { fetch: f.fetch, cache: memoryCache(), onProgress: (p) => events.push(p) })
    expect(events.every((e) => e.total === good.length)).toBe(true)
  })

  it('tampered bytes -> HASH_MISMATCH and nothing cached', async () => {
    const m = await entry(['/a'])
    const bad = good.slice()
    bad[10] ^= 1
    const cache = memoryCache()
    expect(await code(loadModel(m, { fetch: fakeFetch({ '/a': { bytes: bad } }).fetch, cache }))).toBe('HASH_MISMATCH')
    expect(await cache.keys()).toEqual([])
  })

  it('a url serving wrong bytes does not stop a later good url', async () => {
    const m = await entry(['/a', '/b'])
    const f = fakeFetch({ '/a': { bytes: new Uint8Array(1000) }, '/b': { bytes: good } })
    const out = await loadModel(m, { fetch: f.fetch, cache: memoryCache() })
    expect(Array.from(out)).toEqual(Array.from(good))
  })

  it('all urls fail -> DOWNLOAD_FAILED', async () => {
    const m = await entry(['/a', '/b'])
    const f = fakeFetch({ '/a': { status: 500 }, '/b': { throws: true } })
    expect(await code(loadModel(m, { fetch: f.fetch, cache: memoryCache() }))).toBe('DOWNLOAD_FAILED')
  })

  it('evicts stale versions after a good load', async () => {
    const m = await entry(['/a'])
    const cache = memoryCache()
    await cache.put('models/migan-512/oldsha', new Uint8Array([1]))
    await cache.put('models/other/keepme', new Uint8Array([2]))
    await loadModel(m, { fetch: fakeFetch({ '/a': { bytes: good } }).fetch, cache })
    expect((await cache.keys()).sort()).toEqual([`models/migan-512/${m.sha256}`, 'models/other/keepme'].sort())
  })

  it('deletes a corrupted cache entry and refetches', async () => {
    const m = await entry(['/a'])
    const cache = memoryCache()
    await cache.put(`models/migan-512/${m.sha256}`, new Uint8Array([9, 9, 9]))
    const f = fakeFetch({ '/a': { bytes: good } })
    const out = await loadModel(m, { fetch: f.fetch, cache })
    expect(Array.from(out)).toEqual(Array.from(good))
    expect(f.calls.length).toBe(1)
  })

  it('second call is served from cache', async () => {
    const m = await entry(['/a'])
    const cache = memoryCache()
    const f = fakeFetch({ '/a': { bytes: good } })
    await loadModel(m, { fetch: f.fetch, cache })
    await loadModel(m, { fetch: f.fetch, cache })
    expect(f.calls.length).toBe(1)
  })

  it('a cache whose get and put reject still returns the verified bytes from the first url', async () => {
    const m = await entry(['/a'])
    const f = fakeFetch({ '/a': { bytes: good } })
    const broken = {
      get: async () => Promise.reject(new Error('storage blocked')),
      put: async () => Promise.reject(new Error('QuotaExceededError')),
      keys: async () => Promise.reject(new Error('storage blocked')),
      delete: async () => Promise.reject(new Error('storage blocked')),
    }
    const out = await loadModel(m, { fetch: f.fetch, cache: broken })
    expect(Array.from(out)).toEqual(Array.from(good))
    expect(f.calls).toEqual(['/a'])
  })
})
