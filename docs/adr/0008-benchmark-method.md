# ADR 0008: Benchmark method for the headline number

Date: 2026-10-04. Status: accepted.

## Context
The README headline must be measured, never typed. The prototype showed that WASM timings on this shared host swing widely
(medians from 298 ms to 3261 ms across runs), because many other builds run at the same time.

## Decision
- `bench.html` runs the real engine in the real worker on a fixed synthetic 512x512 image with a fixed 128x128 mask. Each EP
  gets a fresh session, 1 warm-up job and 20 timed jobs. The metric is the `run` phase (session.run plus output readback),
  median and p90. Whole-job time is reported too.
- `bench/run.ts` drives headless host Chrome (`channel: 'chrome'`, `--enable-unsafe-webgpu`) with Playwright against
  `vite preview`, records machine info, and writes `bench/results/latest.json` plus a dated copy.
- Headline: `speedup = wasm.run.median / webgpu.run.median`, rounded to 2 decimals in the JSON and rounded down to a whole
  number in the README's first line ("Nx"). The README table shows both medians, both p90s, thread count, GPU, Chrome
  version and date.
- The design doc's "POST results to the dev server" is dropped. The runner reads the result object with `page.evaluate`.

## Consequences
- One command reproduces it on any machine with Chrome and a GPU.
- What we gave up: a noise-free number. We report the median of 20 and keep every run's JSON so a reader can re-run it.
  Phones are not measured in v0.1.
