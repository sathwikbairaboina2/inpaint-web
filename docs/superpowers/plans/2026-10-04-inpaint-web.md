# inpaint-web v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Use superpowers:test-driven-development for every task that adds behaviour: write the test, run it, **see it fail**,
> implement, see it pass, commit.

**Goal:** Ship v0.1 of an in-browser object remover: MI-GAN on onnxruntime-web, WebGPU with a WASM fallback, a
deterministic core that never changes unmasked pixels, an offline PWA, a measured WebGPU-vs-WASM headline number, Docker,
CI, README and DEVDOCS.

**Architecture:** React UI on the main thread. A module Web Worker owns a single-job queue and the engine. The engine
composes pure `src/core/*` modules (budget, mask, crop, resize, tensor, composite, loader, ep, queue) around an injected
ORT-like runtime, so the whole pipeline runs in Node tests (fake model, or real model via onnxruntime-node) and in the
browser (onnxruntime-web).

**Tech stack:** TypeScript 7.0.2, React 19.3.0, Vite 8.3.2, onnxruntime-web 1.30.0, Vitest 5.0.3 + fast-check 4.10.2,
Playwright 1.63.0, vite-plugin-pwa 1.3.0, nginx 1.29-alpine, pnpm 9.12.0 on Node 24.18.0 (host).

**Spec:** `docs/superpowers/specs/2026-10-04-inpaint-web.md` (contracts, manifest, protocol, invariants, prototype findings).
**Decisions:** `docs/adr/0001`-`0009`. **Ledger:** `.superpowers/sdd/2026-10-04-inpaint-web/progress.md`.

## Global constraints

- Repo root: `C:\Users\sathwik\projects\taskarinchu\inpaint-web` (its own git repo, branch `main`). Never edit sibling
  directories under `taskarinchu\`. You may read `..\co-author` as a style reference (same stack).
- Commands below are run from the repo root in Git Bash or PowerShell (both work for `pnpm`).
- Host ports: **5420** (vite dev), **5421** (vite preview, Playwright e2e and bench), **5422** (Docker app). No others.
  Docker names start with `inpaint-web-`. Stop every container you start (`docker compose down`).
- Exact dependency versions only (no `^`/`~`). Do not add dependencies beyond the spec list without a `Ruling:` line.
- Commits: allowed, local only. Never push or add remotes. One conventional commit per task (subject given per task), body
  ends with a blank line then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Stage paths explicitly; run
  `git status --short` first. Never commit `.env*`, keys, `node_modules`, `dist`, `public/models/*.onnx`, `.superpowers/`.
  If a permission check blocks `git commit`, do not work around it: write a `Ruling:` line and continue.
- Numbers: never type a benchmark number into README/DEVDOCS by hand. Quote `bench/results/latest.json` only.
- After each task append one line to the ledger: `Task N: complete (tests: <command> -> <result>; red seen: <yes/how>)`.
  Decisions you make go in the ledger as `Ruling: <decision> - <why> - <cost>`.
- Pipe noisy output through `tail`/`grep`. TypeScript 7 is strict about `Uint8Array<ArrayBufferLike>` vs `BufferSource`
  (co-author hit this): pass `bytes.buffer as ArrayBuffer` or copy into a fresh `Uint8Array` when an API wants `BufferSource`.
- Style: small files, named exports, no default exports except React components' files may export one component, no
  comments that restate code, 2-space indent, single quotes, no semicolons (match `..\co-author`).

## Gates (all must pass before the plan is DONE)

```bash
pnpm typecheck                         # exit 0
pnpm test                              # all Vitest files pass (golden test runs: model present after models:fetch)
pnpm build                             # dist/ with dist/ort/*.wasm, dist/sw.js, dist/bench.html
pnpm e2e                               # Playwright (host), all specs pass
pnpm build:lib && npm pack --dry-run   # lib builds, tarball listing printed
docker compose build app && docker compose --profile e2e run --rm e2e && docker compose down   # container WASM e2e passes
pnpm bench                             # last: writes bench/results/latest.json with webgpu + wasm + speedup (Task 25)
```

## Review focus (for the Opus review)

1. Invariant 1 holds end to end: `e2e/inpaint-preserve.spec.ts` compares the real app's output to the decoded input byte
   for byte outside the mask. No test may "pass" by comparing an image to itself.
2. `TOO_LARGE` and `HASH_MISMATCH` paths never allocate tensors or create sessions (spies in `tests/engine.test.ts`).
3. Fallback reasons are real: `selectProvider` reports `forced`, `no-webgpu-api`, `no-adapter`, `limits`,
   `session-error: ...`, and the badge shows the reason.
4. COOP/COEP on every response in dev, preview, nginx and `_headers` (`crossOriginIsolated === true` asserted in e2e on
   localhost), and ORT glue served from `/ort/` (ADR 0004).
5. README numbers match `bench/results/latest.json` exactly.

## File structure

```
inpaint-web/
  package.json  pnpm-lock.yaml  tsconfig.json  tsconfig.lib.json
  vite.config.ts  vite.lib.config.ts  vitest.config.ts  playwright.config.ts
  vite/ort-assets.ts                     dev middleware + build emit for /ort/ (ADR 0004)
  index.html  bench.html
  .gitignore  .gitattributes  .dockerignore
  public/models/manifest.json            committed; *.onnx git-ignored
  public/samples/aldrin.jpg              public domain (NASA), committed
  public/icon.svg  public/_headers
  scripts/models-fetch.mjs               download + sha256 verify into public/models/
  scripts/sample-fetch.mjs               download + sha256 verify the sample image
  src/core/  types.ts manifest.ts budget.ts mask.ts crop.ts resize.ts tensor.ts composite.ts hash.ts
             loader.ts ep.ts queue.ts stroke.ts stats.ts engine.ts index.ts
  src/worker/ protocol.ts handler.ts browser.ts inference.worker.ts client.ts
  src/ui/     App.tsx Editor.tsx MaskCanvas.tsx CompareSlider.tsx DeviceBadge.tsx ProgressBar.tsx image.ts styles.css
  src/main.tsx  src/bench/main.ts  src/vite-env.d.ts
  tests/      *.test.ts, tests/helpers/fake-ort.ts, tests/helpers/synthetic.ts, tests/golden/migan-synthetic.png
  e2e/        inpaint-preserve.spec.ts fallback.spec.ts responsiveness.spec.ts offline.spec.ts ui.spec.ts helpers.ts
  bench/run.ts  bench/results/latest.json (+ dated copies)
  scripts/demo-shots.ts                  README hero images (+ optional GIF via Docker ffmpeg)
  Dockerfile  deploy/nginx.conf  docker-compose.yml  .github/workflows/ci.yml
  README.md  MODELS.md  docs/DEVDOCS.md  docs/handoff.md  docs/adr/  docs/superpowers/
```

---

## Task 1: Scaffold the project, ORT asset plugin and headers

**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `vite/ort-assets.ts`, `vitest.config.ts`, `index.html`,
`src/main.tsx`, `src/vite-env.d.ts`, `.gitattributes`, `tests/ort-assets.test.ts`.

- [ ] `package.json` (exact versions, from the spec):

```json
{
  "name": "inpaint-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "vite --port 5420 --strictPort",
    "build": "pnpm typecheck && vite build",
    "preview": "vite preview --port 5421 --strictPort",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "e2e": "playwright test",
    "models:fetch": "node scripts/models-fetch.mjs",
    "bench": "tsx bench/run.ts"
  },
  "dependencies": {
    "onnxruntime-web": "1.30.0",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@types/node": "26.6.4",
    "@types/pngjs": "6.0.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "@webgpu/types": "0.1.74",
    "fast-check": "4.10.2",
    "onnxruntime-node": "1.30.0",
    "pngjs": "7.0.0",
    "tsx": "4.23.15",
    "typescript": "7.0.2",
    "vite": "8.3.2",
    "vitest": "5.0.3"
  }
}
```

- [ ] `tsconfig.json`: copy `..\co-author\tsconfig.json`, add `"@webgpu/types"` to `types`, and include
  `src tests bench e2e scripts vite *.config.ts`.
- [ ] `vite/ort-assets.ts` (proven in the prototype; keep the logic, type it):

```ts
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'

export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const

export const ORT_FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'] as const

export function ortDistDir(): string {
  const require = createRequire(import.meta.url)
  return join(dirname(require.resolve('onnxruntime-web/package.json')), 'dist')
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
```

  If `require.resolve('onnxruntime-web/package.json')` is blocked by the package `exports`, resolve
  `require.resolve('onnxruntime-web')` and walk up to the folder named `onnxruntime-web` (Ruling line).
- [ ] `vite.config.ts`:

```ts
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
```

  `bench.html` is added as a second input in Task 21 (`build.rollupOptions.input`).
- [ ] `vitest.config.ts`: `include: ['tests/**/*.test.ts']`, `environment: 'node'`, `testTimeout: 30_000`.
- [ ] `index.html` (title "Inpaint Web", `<div id="root">`, module script `/src/main.tsx`), `src/main.tsx` renders `<h1>Inpaint Web</h1>` for now.
- [ ] `.gitignore` already exists (written during planning, includes `.superpowers/` and `public/models/*.onnx`); keep it
  and add entries only if needed.
- [ ] `.gitattributes`: `* text=auto eol=lf`, `*.png binary`, `*.jpg binary`, `*.onnx binary`, `*.wasm binary`.
- [ ] `tests/ort-assets.test.ts` (ADR 0004 names it): imports `ORT_FILES`, `ortDistDir` from `../vite/ort-assets` and
  asserts each file exists (`existsSync(join(ortDistDir(), f))`).
- [ ] Run: `pnpm install` → lockfile created. `pnpm typecheck` → exit 0. `pnpm test` → `1 passed`.
  `pnpm build` → `dist/ort/ort-wasm-simd-threaded.asyncify.wasm` exists (`ls dist/ort`).
- [ ] Headers check: `pnpm preview &` then `curl -sI http://localhost:5421/ | grep -i cross-origin` → both headers;
  `curl -sI http://localhost:5421/ort/ort-wasm-simd-threaded.asyncify.wasm | grep -i -E "content-type|cross-origin"`.
  Stop the preview process.
- [ ] Commit: `chore: scaffold vite react ts project with ort asset plugin and isolation headers`
  (`package.json pnpm-lock.yaml tsconfig.json vite.config.ts vite/ vitest.config.ts index.html src/ tests/ .gitignore .gitattributes`).

## Task 2: Core types, errors and the model manifest

**Files:** `src/core/types.ts`, `src/core/manifest.ts`, `public/models/manifest.json`, `tests/manifest.test.ts`.

- [ ] `types.ts` exactly as the spec's "Core contracts" block (`InpaintError` sets `this.name = 'InpaintError'`).
- [ ] `manifest.ts`: `type ModelEntry` mirrors the spec JSON; `parseManifest(json: unknown): Manifest`;
  `getModel(manifest, id): ModelEntry` (unknown id → `InpaintError('BAD_INPUT')`).
- [ ] `public/models/manifest.json`: copy the spec's manifest verbatim.
- [ ] Tests (red first): the committed manifest parses and `getModel(m, 'migan-512').sha256` equals the spec hash;
  each of these is rejected with code `BAD_INPUT`: `version: 2`, sha256 of 63 chars, sha256 with `g`, `urls: []`,
  `size: 500`, `size: 0`, missing `io`, unknown model id.
- [ ] `pnpm test tests/manifest.test.ts` → fail (module missing) → pass.
- [ ] Commit: `feat(core): types, error codes and validated model manifest`.

## Task 3: Budget (invariant 2, unit part)

**Files:** `src/core/budget.ts`, `tests/budget.test.ts`.

- [ ] Tests: `checkImageBudget(4096, 4096)` ok; `(4097, 1)` and `(1, 4097)` → `TOO_LARGE`; `(4096, 4096)` is exactly
  16,777,216 px → ok; a hypothetical `(4096, 4097)` → `TOO_LARGE`; `(0, 10)`, `(10.5, 10)`, `(NaN, 1)` → `BAD_INPUT`.
  Assert `err.code`, not message text.
- [ ] Red → green. Commit: `feat(core): image size budget rejects oversized inputs`.

## Task 4: Mask operations

**Files:** `src/core/mask.ts`, `tests/helpers/synthetic.ts`, `tests/mask.test.ts`.

- [ ] `tests/helpers/synthetic.ts`: `makeImage(w, h, seed)` (deterministic RGBA pattern, alpha 255),
  `makeMask(w, h, rects: Rect[])`, `randomImage/randomMask` fast-check arbitraries (w, h in 1..64).
- [ ] Tests: `maskBBox` of an empty mask is `null`; of one pixel at (5,7) is `{x:5,y:7,w:1,h:1}`; of two rects is their
  union. `dilateMask(r=1)` on a single pixel gives a 3x3 block, clipped at image borders. `cropMask` returns the sub-mask.
  `resizeMaskAny`: a 1-px-wide vertical line in a 64x64 mask still has at least one set pixel per row after resizing to
  16x16 (thin strokes survive); an all-zero mask stays all zero; dims exact. Property: `resizeMaskAny` to the same size is identity.
- [ ] Red → green. Commit: `feat(core): mask bbox, dilation, crop and any-pixel resize`.

## Task 5: Crop planning (invariant 8)

**Files:** `src/core/crop.ts`, `tests/crop.test.ts`.

- [ ] Rule from the spec: `S = max(max(bw, bh) + 2*margin, minSide)`. Per axis: if `S >= imgSize` the crop is the whole
  axis (`0`, `imgSize`); else `start = floor(bboxStart + bboxLen / 2 - S / 2)` clamped to `[0, imgSize - S]`, length `S`.
  Defaults `margin = 64`, `minSide = 256`.
- [ ] Tests (expected rects computed by hand from the rule):
  - bbox `{x:500,y:500,w:100,h:50}` in 2000x2000: S = max(228, 256) = 256, centre (550, 525) → `{x:422,y:397,w:256,h:256}`.
  - bbox `{x:0,y:0,w:10,h:10}` in 1000x1000: start -123 clamps to 0 → `{x:0,y:0,w:256,h:256}`.
  - bbox `{x:50,y:50,w:20,h:20}` in 200x300: x axis S >= 200 → `x:0,w:200`; y start floor(60 - 128) = -68 → 0 → `{x:0,y:0,w:200,h:256}`.
  - bbox `{x:100,y:100,w:1000,h:600}` in 4000x3000: S = 1128, x start 600 - 564 = 36, y start 400 - 564 → 0 → `{x:36,y:0,w:1128,h:1128}`.
  - bbox touching the bottom-right of 1000x800 `{x:990,y:790,w:10,h:10}` → `{x:744,y:544,w:256,h:256}`.
  - Property (fast-check, w,h in 1..4096, random bbox inside): result contains the bbox, lies inside the image, and
    `w === min(S, imgW)`, `h === min(S, imgH)`.
- [ ] Red → green. Commit: `feat(core): crop planning around the mask with margin and minimum side`.

## Task 6: RGBA crop and bilinear resize

**Files:** `src/core/resize.ts`, `tests/resize.test.ts`.

- [ ] `cropRGBA(img, rect)` and `resizeBilinear(img, w, h)` (half-pixel centres: `sx = (x + 0.5) * srcW / w - 0.5`, clamp
  at edges, round to nearest). Throw `BAD_INPUT` on a rect outside the image or a zero target size.
- [ ] Tests: same-size resize returns equal bytes and a new buffer; a constant-colour image stays exactly constant after
  resizing 37x23 → 512x512 → 37x23 (property over random colours); output dims exact; a 2x1 image [black, white] resized to
  4x1 is monotonic non-decreasing in R; `cropRGBA` copies the right pixels.
- [ ] Red → green. Commit: `feat(core): rgba crop and bilinear resize`.

## Task 7: Tensor conversion

**Files:** `src/core/tensor.ts`, `tests/tensor.test.ts`.

- [ ] `rgbaToNCHW(img, 'uint8' | 'float32', scale)` returns `Uint8Array | Float32Array` of length `3*w*h`, planes R, G, B;
  `nchwToRGBA(data, w, h, scale, alphaFrom?)` (multiplies by `1/scale`, clamps 0..255, rounds); `maskToNCHW(mask, dtype, keep, hole)`.
- [ ] Tests: uint8 round trip of a random image restores RGB exactly and alpha from `alphaFrom` (or 255);
  float32 with scale `1/255` round trip exact; plane order (pixel (1,0) red lands at index 1, green at `w*h + 1`);
  float values -3 and 300 clamp to 0 and 255; `maskToNCHW` with keep 255 / hole 0 maps 1 → 0 and 0 → 255.
- [ ] Red → green. Commit: `feat(core): rgba to nchw tensor conversion and back`.

## Task 8: Compositor (invariant 1, unit part)

**Files:** `src/core/composite.ts`, `tests/composite.test.ts`.

- [ ] `compositeMasked(original, patch, rect, mask, { feather = 0 })` per the spec: copy original, write only `mask = 1`
  pixels inside `rect`, alpha from the original, inward feather `alpha = d / (feather + 1)` for Chebyshev distance
  `d` in 1..feather to the nearest `mask = 0` pixel. Image borders are not edges: only real `mask = 0` pixels define the
  distance. Mask pixels outside `rect` stay original.
- [ ] Tests: property (fast-check, 200 runs): random image, random mask, random rect inside, random noise patch of rect
  size, feather 0..4 → every `mask = 0` pixel is byte-identical, and every alpha byte equals the original's. Example: with
  feather 0 every `mask = 1` pixel inside rect equals the patch. With feather 2 on a 9x9 square hole, the centre pixel equals
  the patch and a pixel at distance 1 is the 1/3 blend (expected value computed in the test). Input buffers are not mutated.
- [ ] Red → green. Commit: `feat(core): mask compositor that never touches unmasked pixels`.

## Task 9: Hashing and the model loader (invariant 3, unit part)

**Files:** `src/core/hash.ts`, `src/core/loader.ts`, `tests/loader.test.ts`, `tests/helpers/fake-fetch.ts`.

- [ ] `ModelCache` interface: `get(key): Promise<Uint8Array | undefined>`, `put(key, bytes)`, `keys(): Promise<string[]>`,
  `delete(key)`. Add `memoryCache()` in `loader.ts` (used by tests and as a fallback when `caches` is missing).
- [ ] `loadModel(model, { fetch, cache, onProgress })` exactly per the spec table (ordered URLs, streaming progress via
  `response.body.getReader()`, sha256, put + evict others under `models/<id>/`, cached re-hash, `HASH_MISMATCH`,
  `DOWNLOAD_FAILED`).
- [ ] Tests with a fake fetch that serves bytes in 3 chunks: good bytes → returned, cached under
  `models/migan-512/<sha>`, progress events end with `done === total`; first URL 404, second good → returned; tampered bytes
  → `HASH_MISMATCH`, cache keys empty; all URLs fail → `DOWNLOAD_FAILED`; a stale key `models/migan-512/<oldsha>` is deleted
  after a good load; a corrupted cache entry is deleted and refetched; a second call is served from cache (fetch count unchanged).
  Use a small fake manifest entry whose sha256 is computed in the test from the fake bytes.
- [ ] Red → green. Commit: `feat(core): model loader with ordered urls, sha256 check and cache eviction`.

## Task 10: Execution provider selection (invariant 4, unit part)

**Files:** `src/core/ep.ts`, `tests/ep.test.ts`.

- [ ] `wasmThreads(coi, hc)` and `selectProvider({ gpu, forceWasm, minBufferBytes, createSession })` where
  `createSession(ep: EpName): Promise<S>`. Return `{ ep, session, reason? }` and `adapterInfo?: string`
  (`vendor architecture` from `adapter.info` when present).
- [ ] Tests: `wasmThreads(false, 24) === 1`, `(true, 24) === 16`, `(true, 4) === 4`, `(true, 0) === 1`.
  Fallback cases each assert `ep === 'wasm'`, the exact `reason`, and which EPs `createSession` was called with:
  forced; `gpu` undefined → `no-webgpu-api`; `requestAdapter` resolves null → `no-adapter`; rejects → `no-adapter`;
  `maxBufferSize` 1024 → `limits`; webgpu create throws `Error('boom')` → `session-error: boom` and then wasm is created.
  Success → `ep === 'webgpu'`, no reason, wasm never created. Both creates throw → `UNSUPPORTED`.
- [ ] Red → green. Commit: `feat(core): webgpu probe with wasm fallback and recorded reason`.

## Task 11: Single-job queue (invariant 5)

**Files:** `src/core/queue.ts`, `tests/queue.test.ts`.

- [ ] `new JobQueue(run: (job) => Promise<R>)`, `submit(id, job): Promise<R>`, `get running(): string | null`,
  `get pending(): string | null`.
- [ ] Tests with deferred promises: A runs; B pending; C submitted → B rejects with `CANCELLED`, A still running and later
  resolves, then C runs; a job that throws does not block the next; `running` is null when idle; A's run function is called
  exactly once.
- [ ] Red → green. Commit: `feat(core): single running job queue that cancels only the pending job`.

## Task 12: Stroke painting and stats helpers

**Files:** `src/core/stroke.ts`, `src/core/stats.ts`, `tests/stroke.test.ts`, `tests/stats.test.ts`.

- [ ] `paintStroke(mask, from, to, radius, value)` stamps filled discs every `max(1, radius / 2)` px along the segment,
  clipped to the mask. `median`, `percentile(xs, p)` (nearest-rank: `xs_sorted[ceil(p/100 * n) - 1]`), `summarize(xs)` →
  `{ n, min, median, p90, max, mean }`; empty input throws `BAD_INPUT`.
- [ ] Tests: a stroke from (0,0) to (20,0) radius 2 sets every pixel with x in 0..20 and y in 0..2 and nothing at y = 3+;
  value 0 erases; strokes off-canvas do not throw. `percentile([1..10], 90) === 9`, `median([3,1,2]) === 2`,
  `median([1,2,3,4]) === 2.5`.
- [ ] Red → green. Commit: `feat(core): brush stroke rasterizer and benchmark stats`.

## Task 13: Engine with injected runtime (invariants 1-3 at engine level)

**Files:** `src/core/engine.ts`, `src/core/index.ts`, `tests/helpers/fake-ort.ts`, `tests/engine.test.ts`.

- [ ] `OrtLike` interface (subset used): `env.wasm.numThreads`, `env.wasm.wasmPaths`, `Tensor` constructor
  `(type, data, dims)`, `InferenceSession.create(bytes: Uint8Array, opts: { executionProviders: string[];
  graphOptimizationLevel: 'all' })` returning `{ run(feeds): Promise<Record<string, { getData(): Promise<ArrayLike<number>>;
  dims: readonly number[] }>>; release(): Promise<void> }`. Write `createEngine` per the spec "Engine" section; time each
  phase with the injected `now()`.
- [ ] `tests/helpers/fake-ort.ts`: a fake runtime whose session returns uint8 noise (seeded) of the input shape, counting
  `Tensor` constructions and `create` calls, with switchable failures (webgpu create throws, run throws "out of memory").
- [ ] Tests: 300x200 image + 40x30 hole → result dims 300x200, every `mask = 0` pixel byte-identical, at least one masked
  pixel changed, `timings` keys all present and >= 0, `ep === 'webgpu'` with a fake gpu; `TOO_LARGE` for 5000x10 with
  `Tensor` and `loadModel` call counts 0; `EMPTY_MASK`; mask dims mismatch → `BAD_INPUT`; `loadModel` rejecting with
  `HASH_MISMATCH` → error propagates and `InferenceSession.create` count 0; `forceWasm` → `ep === 'wasm'`,
  `fallbackReason === 'forced'`; session reused across two jobs (create count 1); run throwing "out of memory" → `OOM`;
  `numThreads` set from `wasmThreads` before the first create.
- [ ] `src/core/index.ts` re-exports `createEngine`, types, `InpaintError`, `parseManifest`, `loadModel`, `memoryCache`,
  `selectProvider`, `wasmThreads`, `compositeMasked`, `planCrop`, `checkImageBudget`, `summarize`.
- [ ] Red → green. Commit: `feat(core): inpaint engine composing budget, crop, model, ep and compositor`.

## Task 14: Model fetch script and the real-model golden test

**Files:** `scripts/models-fetch.mjs`, `tests/golden.test.ts`, `tests/golden/migan-synthetic.png`, `package.json` (script exists).

- [ ] `scripts/models-fetch.mjs`: reads `public/models/manifest.json`; for each model, if `public/models/<file>` exists with
  the right sha256, prints `ok <id> (cached)`; else downloads the **https** URL from `urls` (skip relative URLs) with
  `fetch`, writes to a temp file, verifies sha256 (`node:crypto`), renames into place, prints `ok <id> <bytes> bytes`.
  Mismatch → delete temp, print the expected and actual hash, exit 1.
- [ ] Run `pnpm models:fetch` → `ok migan-512 29546882 bytes`; run again → `ok migan-512 (cached)`.
- [ ] `tests/golden.test.ts` (`describe.skipIf(!existsSync('public/models/migan.onnx'))`): builds the engine with
  `onnxruntime-node` as `ort` (it matches `OrtLike`; `InferenceSession.create` accepts a `Uint8Array`), `gpu: undefined`,
  `loadModel` reading the file and checking sha256. Input: `makeImage(640, 480, 7)` with a 120x90 hole at (300, 200).
  Assert: every unmasked pixel byte-identical; result PSNR vs `tests/golden/migan-synthetic.png` >= 40 dB over the masked
  pixels (PSNR helper in the test; identical → Infinity passes). When `UPDATE_GOLDEN=1` the test writes the PNG with
  `pngjs` instead and passes; commit the generated PNG. Also assert the run took < 20 s.
- [ ] Generate: `UPDATE_GOLDEN=1 pnpm test tests/golden.test.ts`, then `pnpm test tests/golden.test.ts` → passes without the env var.
  Red step: before generating, the test fails with "golden missing" (write that branch explicitly).
- [ ] Commit: `test: real MI-GAN golden test on onnxruntime-node and model fetch script`.

## Task 15: Worker protocol, handler and browser wiring

**Files:** `src/worker/protocol.ts`, `src/worker/handler.ts`, `src/worker/browser.ts`, `src/worker/inference.worker.ts`,
`src/worker/client.ts`, `tests/handler.test.ts`.

- [ ] `protocol.ts`: types from the spec plus `{ kind: 'probe' }` request that answers with a `device` event.
- [ ] `handler.ts`: `createHandler({ engine, queue, post, probe })` returns `onMessage(req)`. Inpaint requests go through
  `JobQueue`; progress, result (`rgba` buffer listed as transfer) and error events are posted with the jobId; any
  non-`InpaintError` becomes `INTERNAL`.
- [ ] `browser.ts`: `cacheStorageModelCache(name = 'inpaint-web-models')` implementing `ModelCache` on Cache Storage
  (`new Response(bytes)` / `arrayBuffer()`, keys mapped to `https://cache.local/<key>` URLs), falling back to `memoryCache()`
  when `caches` is undefined; `probeDevice()` → `device` event (`adapter.info.vendor/architecture/description`).
- [ ] `inference.worker.ts`:

```ts
import * as ort from 'onnxruntime-web/webgpu'
// ADR 0004: glue + wasm are served at /ort/ by vite/ort-assets.ts (dev) and dist/ort (build)
ort.env.wasm.wasmPaths = '/ort/'
```

  then fetch `/models/manifest.json`, build the engine with `ort`, `navigator.gpu`, `self.crossOriginIsolated`,
  `navigator.hardwareConcurrency`, and `loadModel` bound to `fetch` + the Cache Storage cache; wire `self.onmessage`.
- [ ] `client.ts`: `createInpaintClient()` creates `new Worker(new URL('./inference.worker.ts', import.meta.url), { type: 'module' })`
  and exposes `probe(): Promise<DeviceEvent>` and `inpaint(image, mask, { forceWasm, onProgress }): Promise<ResultEvent>`
  (rejects with `InpaintError(code)` on an error event), transferring buffers (copy the caller's buffers first so the UI keeps its originals).
- [ ] Tests (`handler.test.ts`, fake engine): result event carries the same jobId and a transfer list containing the
  result buffer; engine throwing `InpaintError('TOO_LARGE')` → error event with that code; plain `Error` → `INTERNAL`;
  second job while first runs and third arrives → second gets `CANCELLED`; probe → device event.
- [ ] Red → green, then `pnpm build` still passes (worker bundles, `dist/assets/inference.worker-*.js` exists).
- [ ] Commit: `feat(worker): inference worker with job queue, progress events and cache storage`.

## Task 16: Editor UI, part 1: shell, image input, device badge

Load the `minimalist-ui` skill first (warm monochrome, one accent, no gradients, generous spacing).

**Files:** `src/ui/App.tsx`, `src/ui/Editor.tsx`, `src/ui/DeviceBadge.tsx`, `src/ui/image.ts`, `src/ui/styles.css`,
`src/main.tsx`, `scripts/sample-fetch.mjs`, `public/samples/aldrin.jpg`, `public/icon.svg`, `tests/image.test.ts`.

- [ ] `scripts/sample-fetch.mjs`: download the spec's Wikimedia URL with header
  `User-Agent: inpaint-web/0.1 (https://github.com/sathwikbairaboina2/inpaint-web)` to `public/samples/aldrin.jpg` and verify
  sha256 `7ea66a1e0632c564bd1beb4733abe5ef26d70de0561d5fd000b8f7bb92e6bd38`. Run it; commit the JPEG (280,403 bytes).
- [ ] `image.ts`: `decodeToRGBA(blob)` via `createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })`
  + `OffscreenCanvas` `getImageData`; `fitWithinBudget(w, h)` returns the size to downscale to when over budget (long side
  4096) so the UI offers "Downscale to WxH" instead of only failing; `rgbaToPngBlob(img)`.
  Unit-test `fitWithinBudget` only (pure): 5000x2500 → 4096x2048; 4096x4096 unchanged; 100x100 unchanged.
- [ ] UI: header with app name and `DeviceBadge` (`data-testid="device-badge"`: "WebGPU · <adapter>" or
  "WASM · n threads" or "WASM · 1 thread (not isolated)", plus the fallback reason as a tooltip and visible small text after
  a run), `drop-zone` accepting drop, paste (Ctrl+V on window) and `file-input` (PNG/JPEG/WebP), `sample-button`
  ("Try sample photo"), `?sample=1` auto-loads the sample. Show the image on a canvas scaled to fit the viewport.
  Errors in a `data-testid="error"` region with the code and a plain sentence.
- [ ] Check in the browser: `pnpm dev`, open `http://localhost:5420/?sample=1` with Playwright (or the claude-in-chrome
  tools) and take a screenshot at 1280 and 375 widths; no horizontal scroll at 375.
- [ ] Commit: `feat(ui): editor shell with image input, sample photo and device badge`.

## Task 17: Editor UI, part 2: mask painting and running a job

**Files:** `src/ui/MaskCanvas.tsx`, `src/ui/ProgressBar.tsx`, `src/ui/Editor.tsx`, `src/ui/App.tsx`.

- [ ] `MaskCanvas` (`data-testid="mask-canvas"`): overlay canvas, pointer events (mouse, pen, touch;
  `touch-action: none`), brush and eraser (`tool-brush`, `tool-eraser`), `brush-size` range 4..128 (default 32, in image
  pixels), `undo` (stack of mask snapshots per stroke, max 20), `clear-mask`. Uses `paintStroke` on a full-resolution
  `Mask`; renders the mask as a translucent accent overlay.
- [ ] `remove-button` ("Remove object", disabled with an empty mask or while running) calls the client;
  `progress` shows phase labels ("Downloading model 12/29 MB", "Preparing", "Running", "Finishing").
- [ ] Test hook on `window.__inpaint` exactly as the spec (`setMask(rects)`, `run()`, `getOriginal()`, `getResult()`).
  `run()` resolves with `{ ep, fallbackReason, timings }`.
- [ ] Check in the browser with the sample: paint, remove, see the result; screenshot.
- [ ] Commit: `feat(ui): brush and eraser mask painting with undo and remove object`.

## Task 18: Editor UI, part 3: compare slider, download, force WASM

**Files:** `src/ui/CompareSlider.tsx`, `src/ui/Editor.tsx`, `src/ui/App.tsx`.

- [ ] `CompareSlider` (`data-testid="compare-slider"`): before/after with a draggable divider, `role="slider"`,
  `aria-valuenow` 0..100, arrow keys move 5. `download` saves `inpaint-<timestamp>.png` via `rgbaToPngBlob`.
  "Apply" keeps editing on the result (the result becomes the new original, mask cleared).
- [ ] `force-wasm` toggle (also set by `?ep=wasm`); toggling recreates nothing until the next run (engine picks EP per job).
- [ ] Commit: `feat(ui): before and after slider, png download and force wasm toggle`.

## Task 19: Playwright e2e on the real model (invariants 1, 4, 7)

**Files:** `playwright.config.ts`, `e2e/helpers.ts`, `e2e/inpaint-preserve.spec.ts`, `e2e/fallback.spec.ts`,
`e2e/responsiveness.spec.ts`, `e2e/ui.spec.ts`.

- [ ] `playwright.config.ts`: `testDir: 'e2e'`, `timeout: 120_000`, `use.baseURL: process.env.BASE_URL ?? 'http://localhost:5421'`,
  `webServer` only when `BASE_URL` is unset: `{ command: 'pnpm build && pnpm preview', url: 'http://localhost:5421', reuseExistingServer: !process.env.CI, timeout: 180_000 }`,
  one project `chromium` (`devices['Desktop Chrome']`). Requires `public/models/migan.onnx` (preflight in `e2e/helpers.ts`
  fails fast with "run pnpm models:fetch").
- [ ] `inpaint-preserve.spec.ts`: open `/?sample=1&ep=wasm`, `__inpaint.setMask([{x:400,y:300,w:120,h:120}])`, `run()`,
  then in the page compare `getOriginal()` and `getResult()`: count of changed bytes outside the mask must be 0 and
  changed pixels inside > 0. Also assert `crossOriginIsolated === true`.
- [ ] `fallback.spec.ts`: (a) `/?sample=1&ep=wasm` → after a run the badge contains `WASM` and the reason `forced`.
  (b) `/?sample=1` without `ep`: read the probe result from the badge; if the probe reports no WebGPU (container and most
  CI runners), a run completes and the badge reason is `no-webgpu-api` or `no-adapter`; if WebGPU exists, `test.skip`
  with the reason "host has WebGPU" (unit tests in `tests/ep.test.ts` cover every reason). `page.addInitScript` cannot
  remove `navigator.gpu` inside the worker, so do not try.
- [ ] `responsiveness.spec.ts`: register a `PerformanceObserver({ type: 'longtask', buffered: true })` before the run,
  run on WASM, assert no long task > 100 ms between run start and end (allow tasks before the run starts, e.g. decoding).
- [ ] `ui.spec.ts`: drawing with the mouse on `mask-canvas` enables `remove-button`; `undo` disables it again; `clear-mask`
  works; `download` triggers a download event named `inpaint-*.png`; at 375x812 the page has no horizontal scroll.
- [ ] Run `pnpm e2e` → all pass. If WebGPU exists in host headless Chromium, the preserve test still uses `ep=wasm` for
  determinism, and a separate test in `inpaint-preserve.spec.ts` runs without `ep=wasm` and asserts the same invariant on
  whatever EP was chosen (record which one in the test title output via `test.info().annotations`).
- [ ] Commit: `test(e2e): real-model inpaint preserve, fallback, responsiveness and ui flows`.

## Task 20: PWA offline shell (invariant 6)

**Files:** `vite.config.ts`, `package.json` (`vite-plugin-pwa 1.3.0`, `workbox-window 7.4.1` as devDependencies),
`src/main.tsx`, `e2e/offline.spec.ts`.

- [ ] `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Inpaint Web', short_name: 'Inpaint', theme_color, background_color, display: 'standalone', start_url: '/', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,mjs,wasm,json,jpg}'], maximumFileSizeToCacheInBytes: 40 * 1024 * 1024, navigateFallback: '/index.html' } })`.
  `models/*.onnx` must not be precached (it lives in the loader cache). Register in `main.tsx` via `virtual:pwa-register`.
  co-author needed `workbox-window` installed explicitly; do the same.
- [ ] `offline.spec.ts`: visit `/?sample=1&ep=wasm`, run once (model downloads and caches), wait for
  `navigator.serviceWorker.ready`, `context.setOffline(true)`, reload, record every request with `page.on('request')`
  **and** `context.on('request')` (worker fetches) during a second run; assert the run succeeds, invariant 1 holds, and no
  request reached the network (`request.failure()`-free and either served by the service worker or none at all: assert
  zero requests to `/models/` and to `huggingface.co`).
  Also check that the reloaded page is still `crossOriginIsolated` (precached responses must keep COOP/COEP). If it is not,
  add `workbox` `runtimeCaching`/header handling or a custom `sw.ts` that re-adds the headers (Ruling line), and re-test.
- [ ] `pnpm build && pnpm e2e` → all pass, `dist/sw.js` and `dist/manifest.webmanifest` exist.
- [ ] Commit: `feat(pwa): offline app shell with service worker and offline e2e`.

## Task 21: Bench page and runner (smoke run only)

**Files:** `bench.html`, `src/bench/main.ts`, `bench/run.ts`, `vite.config.ts` (multi-page input), `tests/bench-shape.test.ts`.

- [ ] `vite.config.ts`: `build.rollupOptions.input = { main: 'index.html', bench: 'bench.html' }`.
- [ ] `src/bench/main.ts` (uses the real `createInpaintClient`): reads `runs` (default 20) from the query; synthetic
  512x512 image (`makeImage`-style pattern, implemented in `src/bench/synthetic.ts` and reused by the test helper) and a
  128x128 hole at (192,192); for `ep` in `webgpu`, `wasm`: new worker, `probe`, 1 warm-up + `runs` jobs with
  `forceWasm = ep === 'wasm'`; skip `webgpu` if the probe says no WebGPU or the first result's `ep` is not `webgpu`.
  Collect `sessionMs` (from the warm-up), `run` and `total` arrays → `summarize`. Sets `window.__benchResult` and renders a table.
- [ ] `bench/run.ts` (flags `--runs N` default 20, `--out <path>` default `bench/results/latest.json`): always run
  `pnpm build` first so the measured code matches HEAD; start `vite preview` on 5421 (`spawn('pnpm', ['preview'], { shell: true })`
  on Windows, wait for the URL, kill the process tree in `finally`: `taskkill /PID <pid> /T /F` on win32);
  `chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] })`;
  open `/bench.html?runs=N`; wait for `window.__benchResult` (timeout 15 min); add machine info and `gitSha`
  (`git rev-parse --short HEAD`), `date`, `chrome` (`browser.version()`), `dirty` (`git status --porcelain` non-empty);
  compute `speedup = round2(wasm.run.median / webgpu.run.median)`; write `--out`, and when `--out` is the default also
  `bench/results/<YYYY-MM-DD>-<sha>.json`; print one summary line. Exit 2 when WebGPU was unavailable (still write the file
  with `webgpu: null`, `speedup: null`).
- [ ] `tests/bench-shape.test.ts`: if `bench/results/latest.json` exists, it has `webgpu.run.median`, `wasm.run.median`,
  `speedup` equal to `round2(wasm.run.median / webgpu.run.median)`, `runs >= 20`, and machine fields (guards against
  hand-edited numbers); otherwise `it.skip` with "no measured results yet".
- [ ] Smoke run: `pnpm bench --runs 3 --out bench/results/smoke.json` (add `bench/results/smoke.json` to `.gitignore`).
  Expected: a summary line with real values for both EPs. Do **not** write `latest.json` yet; Task 25 does the real run.
- [ ] Commit: `feat(bench): webgpu vs wasm benchmark page and runner`.

## Task 22: Library build (installable core)

**Files:** `vite.lib.config.ts`, `tsconfig.lib.json`, `package.json`.

- [ ] Vite library mode: entry `src/core/index.ts`, formats `['es']`, outDir `dist-lib`, `fileName: 'index'`; externalize
  nothing (core has no deps). `tsconfig.lib.json` emits declarations only for `src/core` into `dist-lib/types`.
- [ ] `package.json`: script `"build:lib": "vite build -c vite.lib.config.ts && tsc -p tsconfig.lib.json"`, and
  `"exports": { "./core": { "types": "./dist-lib/types/index.d.ts", "import": "./dist-lib/index.js" } }`,
  `"files": ["dist-lib", "README.md", "MODELS.md", "LICENSE"]`. Keep `"private": true` (no accidental publish); the README
  explains publishing as `@sathwik/browser-img-ops` is a rename + `npm publish`.
- [ ] Add `LICENSE` (MIT, "Copyright (c) 2026 Sathwik Bairaboina").
- [ ] Run `pnpm build:lib && npm pack --dry-run` → lists `dist-lib/index.js` and `dist-lib/types/index.d.ts`.
  `tests/lib-exports.test.ts`: imports `../src/core/index` and asserts the spec's export names exist.
- [ ] Commit: `build: library build of the deterministic core with types`.

## Task 23: Docker image, nginx headers and container e2e

**Files:** `Dockerfile`, `.dockerignore`, `deploy/nginx.conf`, `public/_headers`, `docker-compose.yml`.

- [ ] `Dockerfile`: stage `build` from `node:24-alpine`: `corepack enable`, copy manifests, `pnpm install --frozen-lockfile`
  (onnxruntime-node's postinstall may download binaries; if it fails on Alpine, set `ONNXRUNTIME_NODE_INSTALL=skip` or
  move `onnxruntime-node` to an optional install, Ruling line), copy source, `pnpm models:fetch` (verifies sha256),
  `pnpm exec vite build` (skip typecheck in the image; CI does it). Stage 2 `nginx:1.29-alpine`: copy `deploy/nginx.conf`
  to `/etc/nginx/conf.d/default.conf`, copy `dist`, `EXPOSE 8080`.
- [ ] `deploy/nginx.conf` (prototype-proven):

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;
  include /etc/nginx/mime.types;
  types { application/wasm wasm; text/javascript mjs; application/octet-stream onnx; }
  add_header Cross-Origin-Opener-Policy same-origin always;
  add_header Cross-Origin-Embedder-Policy require-corp always;
  add_header Cross-Origin-Resource-Policy same-origin always;
  location / { try_files $uri $uri/ /index.html; }
}
```

  Note: an `add_header` inside a `location` would drop the server-level headers; keep all headers at server level.
- [ ] `public/_headers` (Netlify/Cloudflare): `/*` with the three headers above.
- [ ] `docker-compose.yml`: `name: inpaint-web`; service `app` (`build: .`, `container_name: inpaint-web-app`,
  `ports: ["5422:8080"]`); service `e2e` (`profiles: [e2e]`, `container_name: inpaint-web-e2e`,
  `image: mcr.microsoft.com/playwright:v1.63.0-noble`, `working_dir: /work`, volumes `.:/work` and a named volume
  `inpaint-web-e2e-node-modules:/work/node_modules`, `environment: { BASE_URL: http://app:8080, CI: '1' }`,
  `depends_on: [app]`, command `sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm exec playwright test"`).
  In the container the page is not a secure context (`http://app:8080`), so `crossOriginIsolated` is false and WASM is
  single-threaded: the preserve spec asserts `crossOriginIsolated === true` only when the base URL host is `localhost`.
- [ ] Run: `docker compose build app`; `docker compose up -d app`; `curl -sI http://localhost:5422/ | grep -i cross-origin`
  (3 headers); `curl -sI http://localhost:5422/ort/ort-wasm-simd-threaded.asyncify.wasm | grep -i content-type`
  → `application/wasm`; `docker compose --profile e2e run --rm e2e` → all specs pass (WebGPU-only assertions skip);
  `docker compose --profile e2e down`.
- [ ] Commit: `build(docker): nginx image with isolation headers and container e2e on the wasm path`.

## Task 24: CI workflow

**Files:** `.github/workflows/ci.yml`.

- [ ] Jobs on `ubuntu-24.04`, Node 24, `pnpm/action-setup` with version 9.12.0, `actions/setup-node` cache pnpm.
  Steps: `pnpm install --frozen-lockfile`; `pnpm typecheck`; cache `public/models` keyed on
  `hashFiles('public/models/manifest.json')`; `pnpm models:fetch`; `pnpm test` (golden test runs); `pnpm build`;
  `pnpm build:lib && npm pack --dry-run`; `pnpm exec playwright install --with-deps chromium`; `pnpm e2e`
  (`CI=1`; specs that need `crossOriginIsolated` run because preview is on localhost); upload `playwright-report` on failure.
  Pin actions to major versions that exist (`actions/checkout@v5`, `actions/setup-node@v5`, `pnpm/action-setup@v4`,
  `actions/cache@v4`, `actions/upload-artifact@v4`); if unsure a major exists, check with `gh api repos/<owner>/<repo>/releases/latest`
  or keep the older major (Ruling line).
- [ ] Validate syntax locally: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color` (if that tag is
  missing, use `rhysd/actionlint:latest` and record the digest). Expected: no output, exit 0.
- [ ] Commit: `ci: typecheck, unit, golden, build, lib pack and e2e on the wasm path`.

## Task 25: Gates, headline benchmark, README, MODELS.md, DEVDOCS and handoff

**Files:** `bench/results/*.json`, `README.md`, `MODELS.md`, `scripts/demo-shots.ts`, `docs/media/*`, `docs/DEVDOCS.md`,
`docs/handoff.md`.

- [ ] Run every gate in "Gates" above except `pnpm bench`; fix anything red first (each fix its own commit).
- [ ] Headline run on a clean tree (`git status --short` empty): `pnpm bench`. It writes `bench/results/latest.json` and a
  dated copy with `dirty: false`. If the WASM median looks disturbed by other load on the host, you may run it again; keep
  every JSON and quote `latest.json` (do not pick a favourite run by hand; Ruling line if you re-run). Commit:
  `bench: measured webgpu vs wasm results`.

- [ ] `scripts/demo-shots.ts` (tsx + Playwright, host Chrome, preview on 5421): open `/?sample=1`, set a mask over a
  clear object in the sample photo (choose rects by looking at the image; record them in the script), run, save
  `docs/media/before.png`, `docs/media/after.png` (the canvas, 720 px wide) and a full-UI screenshot `docs/media/ui.png`
  at 1280x800. Optional GIF: record a Playwright video, convert with
  `docker run --rm -v "$PWD:/w" -w /w jrottenberg/ffmpeg:7.1-alpine -i demo-video/x.webm -vf "fps=12,scale=720:-1" docs/media/demo.gif`.
- [ ] `MODELS.md`: MI-GAN (MIT, GitHub + HF links, revision, sha256, bytes, IO convention), sample image (NASA public
  domain, Wikimedia URL, sha256), why not LaMa / Real-ESRGAN (link ADR 0002/0003).
- [ ] `README.md`: first line exactly `Remove objects from photos in your browser, Nx faster on WebGPU than WASM, zero uploads.`
  with N = `floor(speedup)` from `bench/results/latest.json`; hero before/after images; 30-second quickstart
  (`pnpm install && pnpm models:fetch && pnpm dev` → http://localhost:5420/?sample=1, or `docker compose up -d app` →
  http://localhost:5422); a results table generated from the JSON (EP, threads, run median, p90, session ms, GPU, Chrome,
  date, commit); mermaid architecture; invariants table with test names; "Install as an app" + library note; known
  limits; What's next (upscale, LaMa option, npm publish, deploy). Every number must appear in a committed JSON file:
  check with `grep -o '[0-9.]\+ ms' README.md` against the JSON.
- [ ] `pnpm test` again (the bench-shape test now validates `latest.json`); paste real pass counts into the ledger.
- [ ] `docs/DEVDOCS.md` in the brief's 7-section order (what + headline number, 5-minute quickstart, architecture with one
  mermaid diagram, layout table, run/test/bench commands, decisions with ADR links and what they gave up, known limits).
- [ ] `docs/handoff.md`: append `## 2026-10-04, Claude (Sonnet builder), branch main` with changed / verified (real
  command outputs) / not verified / left / how to verify, plus a "Deviations from the plan" list.
- [ ] Commit: `docs: readme with measured headline, models, devdocs and handoff`.
- [ ] Ledger: `FINAL: <gates with counts>`.
