import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: { entry: 'src/core/index.ts', formats: ['es'], fileName: 'index' },
  },
})
