# Handoff

## 2026-10-04, Claude (Opus lead, plan), branch main

- Changed: initialized the repo; wrote the v0.1 spec (`docs/superpowers/specs/2026-10-04-inpaint-web.md`), ADRs 0001-0009
  (`docs/adr/`), the 25-task plan (`docs/superpowers/plans/2026-10-04-inpaint-web.md`), `.gitignore`, and the ledger
  `.superpowers/sdd/2026-10-04-inpaint-web/progress.md` (git-ignored). No application code yet.
- Prototyped (scratch, outside the repo) before planning: MI-GAN and LaMa on onnxruntime-web 1.30.0 in headless host
  Chrome 154 on WebGPU and WASM; the Vite production-build crash and its fix (ADR 0004); container Chromium WASM path;
  Hugging Face CORS; MI-GAN mask convention (255 keep, 0 hole). Findings are in the spec.
- Left: all 25 plan tasks (build by `sonnet-builder`), then Opus review, fixes, verification, DEVDOCS and the board.
- How to verify: read the spec and plan; `git log --oneline` shows the planning commit.

## 2026-10-04, Claude (Sonnet builder), branch main

- Changed: built all 25 plan tasks. Pure core (`src/core`), worker (`src/worker`), React editor (`src/ui`), PWA, bench page and
  runner, library build, Docker image with nginx isolation headers, CI workflow, README, MODELS.md, DEVDOCS. Measured headline in
  `bench/results/latest.json` (43.53x, wasm median 2184.4 ms vs webgpu 50.2 ms, clean tree at commit 3d2db99).
- Verified (real runs, 2026-10-04): `pnpm typecheck` exit 0; `pnpm test` 19 files, 116 tests passed (golden MI-GAN test ran);
  `pnpm build` produced `dist/ort/ort-wasm-simd-threaded.asyncify.{mjs,wasm}`, `dist/sw.js`, `dist/bench.html`; `pnpm e2e` 10
  passed, 1 skipped (the no-WebGPU fallback test skips on a host that has WebGPU); `pnpm build:lib && npm pack --dry-run` lists
  `dist-lib/index.js` and `dist-lib/types/index.d.ts`; `docker compose build app && docker compose --profile e2e run --rm e2e &&
  docker compose down` 11 passed (including the no-WebGPU fallback and offline specs); `actionlint` 1.7.7 exit 0 on the workflow.
- Not verified: the GitHub workflow itself (no remote); WebGPU in the container (none there); phones; the demo GIF (not made).
- Left: Opus review, fix pass, board and DEVDOCS sync. Product backlog: upscale, LaMa option, npm publish, deploy, fp16, WebNN.
- How to verify: `pnpm install && pnpm models:fetch && pnpm typecheck && pnpm test && pnpm e2e`; `pnpm bench` on a clean idle tree.

### Deviations from the plan

- Loader tries the next URL on a sha256 mismatch and throws `HASH_MISMATCH` only if no URL gave good bytes (an SPA fallback can
  answer the missing same-origin mirror with index.html and 200).
- Host e2e uses installed Chrome (`channel: 'chrome'`); CI and the container use bundled Chromium and omit
  `--enable-unsafe-webgpu` (with it the container exposed a software WebGPU adapter and the fallback test skipped).
- Container e2e shares the app's network namespace (`network_mode: service:app`) so the page is `http://localhost:8080`, a secure
  context; service worker, offline and `crossOriginIsolated` specs therefore run in Docker.
- The offline spec asserts no requests to `migan.onnx` or `huggingface.co`, not every `/models/` path (the manifest is read from the
  service worker cache).
- The responsiveness spec counts long tasks that start before the result is handled; post-result paint time is only annotated.
- Dockerfile installs with `--ignore-scripts`. CI uses the latest action majors found with `gh api` and takes the pnpm version
  from `packageManager`. `vite.lib.config.ts` sets `publicDir: false` so the model is not packed.
- The benchmark was run once; the WASM spread is wide because sibling builds loaded the host.
