import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import type { Plugin } from 'vite'

export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const

export const ORT_FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'] as const

export function ortDistDir(): string {
  const require = createRequire(import.meta.url)
  let dir = dirname(require.resolve('onnxruntime-web'))
  while (basename(dir) !== 'onnxruntime-web') dir = dirname(dir)
  return join(dir, 'dist')
}

export function ortAssets(): Plugin {
  const dist = ortDistDir()
  return {
    name: 'inpaint-web:ort-assets',
    configureServer(server) {
      server.middlewares.use('/ort/', (req, res, next) => {
        const file = (req.url ?? '').split('?')[0].replace(/^\//, '')
        if (!(ORT_FILES as readonly string[]).includes(file)) return next()
        for (const [k, v] of Object.entries(ISOLATION_HEADERS)) res.setHeader(k, v)
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        res.end(readFileSync(join(dist, file)))
      })
    },
    generateBundle() {
      for (const file of ORT_FILES) {
        this.emitFile({ type: 'asset', fileName: `ort/${file}`, source: readFileSync(join(dist, file)) })
      }
    },
  }
}
