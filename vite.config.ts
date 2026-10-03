import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { ISOLATION_HEADERS, ortAssets } from './vite/ort-assets'

export default defineConfig({
  plugins: [
    react(),
    ortAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Inpaint Web',
        short_name: 'Inpaint',
        theme_color: '#fbfbfa',
        background_color: '#fbfbfa',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,mjs,wasm,json,jpg}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm'] },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  server: { port: 5420, strictPort: true, headers: ISOLATION_HEADERS },
  preview: { port: 5421, strictPort: true, headers: ISOLATION_HEADERS },
  build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', bench: 'bench.html' } } },
})
