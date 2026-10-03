# ADR 0005: The deterministic core owns every pixel the model must not touch

Date: 2026-10-04. Status: accepted.

## Context
Model output differs between EPs and runtimes (prototype: sampled checksums 100310 on WebGPU, 100357 on browser WASM,
100251 on onnxruntime-node). Users need a hard promise that only the brushed area changes.

## Decision
- Pure functions in `src/core/` do budget checks, crop planning, resizing, tensor conversion and compositing. The model only
  proposes pixels for a 512x512 crop.
- `compositeMasked` starts from a byte copy of the original and writes only `mask = 1` pixels. Feathering ramps the patch in
  from the mask edge **inward**, never outward, and alpha always comes from the original. So invariant 1 is "every
  `mask = 0` pixel is byte-identical", with no feather-band exception. This is stricter than the design doc.
- The worker protocol moves raw RGBA `ArrayBuffer`s (transferred), not `ImageBitmap`s, so e2e tests can compare exact pixels
  and the same core runs in Node.
- Cross-runtime model output is compared by PSNR only. Deterministic regions are compared byte for byte.

## Consequences
- Property tests (fast-check) prove preservation over random images, masks, rects and feather widths.
- What we gave up: a feather band outside the mask (slightly smoother edges) and the zero-copy ImageBitmap display path
  (we pay one `putImageData` per result).
