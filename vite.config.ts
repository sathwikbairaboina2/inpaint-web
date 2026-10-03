import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ISOLATION_HEADERS, ortAssets } from './vite/ort-assets'

export default defineConfig({
  plugins: [react(), ortAssets()],
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm'] },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  server: { port: 5420, strictPort: true, headers: ISOLATION_HEADERS },
  preview: { port: 5421, strictPort: true, headers: ISOLATION_HEADERS },
  build: { target: 'es2022' },
})
