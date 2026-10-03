# ADR 0007: Host Node for dev, tests and the WebGPU bench; Docker for the image and container e2e

Date: 2026-10-04. Status: accepted.

## Context
The design doc ran Node only in containers. But the headline number needs WebGPU on the host GPU, and container Chromium
has no WebGPU (verified: `navigator.gpu` is undefined in `mcr.microsoft.com/playwright:v1.63.0-noble`). Host Node v24.18.0
and pnpm 9.12.0 are installed, and the sibling co-author repo already uses host pnpm. This session may only use host ports
5420-5429.

## Decision
- `pnpm` runs on the host (repo-local `node_modules`) for dev, unit tests, host e2e and the bench.
- Docker builds the production image (`node:24-alpine` build stage, `nginx:1.29-alpine` serve stage). A compose `e2e`
  profile runs the Playwright suite in `mcr.microsoft.com/playwright:v1.63.0-noble` against the app container (WASM path).
- Ports: Vite dev 5420, Vite preview 5421, Docker app 5422. Compose project `inpaint-web`, containers `inpaint-web-*`.

## Consequences
- The bench measures the real GPU. CI and container e2e prove the WASM fallback.
- What we gave up: "only Docker on the host". A contributor needs Node 24 and pnpm, or uses the Docker image only.
