import * as ort from 'onnxruntime-web/webgpu'
import { createEngine, type OrtLike } from '../core/engine'
import { loadModel } from '../core/loader'
import { parseManifest } from '../core/manifest'
import { cacheStorageModelCache, probeDevice } from './browser'
import { createHandler } from './handler'
import type { JobRequest } from './protocol'

// ADR 0004: glue + wasm are served at /ort/ by vite/ort-assets.ts (dev) and dist/ort (build)
ort.env.wasm.wasmPaths = '/ort/'

const cache = cacheStorageModelCache()

const manifest = fetch('/models/manifest.json').then(async (res) => {
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`)
  return parseManifest(await res.json())
})

const engine = manifest.then((m) =>
  createEngine({
    ort: ort as unknown as OrtLike,
    manifest: m,
    loadModel: (model, onProgress) => loadModel(model, { fetch: (u) => fetch(u), cache, onProgress }),
    gpu: navigator.gpu,
    crossOriginIsolated: self.crossOriginIsolated,
    hardwareConcurrency: navigator.hardwareConcurrency,
  }),
)

const handler = engine.then((e) =>
  createHandler({
    engine: e,
    post: (event, transfer) => self.postMessage(event, { transfer: transfer ?? [] }),
    probe: probeDevice,
  }),
)

self.onmessage = (ev: MessageEvent<JobRequest>) => {
  void handler.then(
    (h) => h(ev.data),
    (err) => {
      if (ev.data.kind === 'inpaint') {
        self.postMessage({ kind: 'error', jobId: ev.data.jobId, code: 'INTERNAL', message: String(err) })
      }
    },
  )
}
