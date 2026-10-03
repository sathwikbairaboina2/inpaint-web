import { memoryCache, type ModelCache } from '../core/loader'
import { wasmThreads } from '../core/ep'
import type { DeviceEvent } from './protocol'

const keyUrl = (key: string) => `https://cache.local/${key}`

export function cacheStorageModelCache(name = 'inpaint-web-models'): ModelCache {
  if (typeof caches === 'undefined') return memoryCache()
  const open = () => caches.open(name)
  return {
    async get(key) {
      const res = await (await open()).match(keyUrl(key))
      return res ? new Uint8Array(await res.arrayBuffer()) : undefined
    },
    async put(key, bytes) {
      await (await open()).put(keyUrl(key), new Response(new Uint8Array(bytes)))
    },
    async keys() {
      const reqs = await (await open()).keys()
      return reqs.map((r) => r.url.replace('https://cache.local/', ''))
    },
    async delete(key) {
      await (await open()).delete(keyUrl(key))
    },
  }
}

export async function probeDevice(): Promise<DeviceEvent> {
  const coi = self.crossOriginIsolated
  const threads = wasmThreads(coi, navigator.hardwareConcurrency)
  let adapterName: string | undefined
  let webgpu = false
  try {
    const adapter = await navigator.gpu?.requestAdapter()
    if (adapter) {
      webgpu = true
      const info = adapter.info
      adapterName = [info?.vendor, info?.architecture].filter(Boolean).join(' ') || info?.description || undefined
    }
  } catch {
    webgpu = false
  }
  return { kind: 'device', webgpu, adapter: adapterName, threads, crossOriginIsolated: coi }
}
