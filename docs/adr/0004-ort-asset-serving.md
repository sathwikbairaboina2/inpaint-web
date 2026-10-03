# ADR 0004: Serve ORT's wasm glue from /ort/ with the extern-wasm build

Date: 2026-10-04. Status: accepted.

## Context
Prototype findings with `onnxruntime-web@1.30.0` and Vite 8.3.2:
- The default `onnxruntime-web/webgpu` entry is a "bundle" build that inlines the Emscripten glue. It worked in `vite dev`.
  After `vite build`, under `vite preview` with `numThreads > 1`, the page renderer crashed ("Target crashed") for both the
  `webgpu` and `wasm` EPs. `numThreads = 1` did not crash. Threaded WASM is the point of the fallback, so 1 thread is not
  acceptable.
- Copying the glue into `public/ort/` fixes the build but breaks dev: Vite refuses to serve a `public/` file to a dynamic
  `import()` ("should not be imported from source code").
- Serving the glue from a dev middleware without COOP/COEP headers also crashed. With the headers it worked.

## Decision
- `vite.config.ts`: `resolve.conditions: ['onnxruntime-web-use-extern-wasm']` (this selects `ort.webgpu.min.mjs`, which
  loads its glue at runtime), `worker.format: 'es'`, `optimizeDeps.exclude: ['onnxruntime-web']`.
- A local Vite plugin, `vite/ort-assets.ts`, serves `ort-wasm-simd-threaded.asyncify.mjs` and `.wasm` from
  `node_modules/onnxruntime-web/dist/` at `/ort/` in dev (with COOP, COEP and correct content types) and emits them to
  `dist/ort/` on build.
- The worker sets `ort.env.wasm.wasmPaths = '/ort/'` before it creates any session.
- nginx and `public/_headers` send COOP/COEP on every response, including `/ort/*` and `*.wasm`.

## Consequences
- The same code path runs in dev, preview, Docker and CI, and threads work in every secure context. Verified in the
  prototype: dev and preview both ran WebGPU and 16-thread WASM.
- What we gave up: we depend on ORT's internal file names (`ort-wasm-simd-threaded.asyncify.*`). The test
  `tests/ort-assets.test.ts` fails if those files disappear on an ORT upgrade.
