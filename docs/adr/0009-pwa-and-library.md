# ADR 0009: "Installable" means an offline PWA now and a library build ready to publish

Date: 2026-10-04. Status: accepted.

## Context
The portfolio bar asks for something others install. The design doc puts the npm package and the service worker in v0.2.
This session has no npm credentials and must not push.

## Decision
- v0.1 ships a PWA (`vite-plugin-pwa@1.3.0`, `registerType: 'autoUpdate'`). The app shell and the ORT wasm are precached
  with `maximumFileSizeToCacheInBytes` raised to 40 MB. The model stays in the loader's Cache Storage, not in the precache.
  `e2e/offline.spec.ts` proves that a second visit works offline with zero network requests during inference.
- `src/core/index.ts` is the library surface. `pnpm build:lib` (Vite library mode for the ES module, `tsc` for `.d.ts`) and
  `npm pack --dry-run` run in CI, so publishing as `@sathwik/browser-img-ops` is one command away.

## Consequences
- Users can install the app from the browser and use it offline today.
- What we gave up: a real npm release (and its download count) until the user publishes it.
