# ADR 0003: 4x upscale moves to v0.2

Date: 2026-10-04. Status: accepted.

## Context
The design doc pairs object removal with Real-ESRGAN 4x upscaling. While planning:
- The only ready Real-ESRGAN ONNX found is `lxfater/inpaint-web/realesrgan-x4.onnx` (67 MB). That Hugging Face repo is
  licensed GPL-3.0, and we will not redistribute it inside this project.
- The `qualcomm/Real-ESRGAN-x4plus` and `qualcomm/Real-ESRGAN-General-x4v3` ONNX URLs return 404.
- A clean path is our own export from the BSD-3 Real-ESRGAN weights (PyTorch in Docker), plus tiling and seam blending
  (design invariants 3 and 4). That is a project of its own.

## Decision
v0.1 ships inpainting only, done properly (deterministic core, fallback, offline, bench, CI). Upscale, `core/tiling.ts`
and their property and blend tests are the first v0.2 item.

## Consequences
- v0.1 has one model, one headline number and a smaller surface to review.
- What we gave up: the second "wow" (a sharper 4x image) and the tiling showcase, until v0.2.
