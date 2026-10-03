# ADR 0001: onnxruntime-web as the only inference runtime

Date: 2026-10-04. Status: accepted.

## Context
The app runs image-to-image ONNX models fully in the tab. It needs a WebGPU path for speed and a WASM path for every other
device, with the same model file on both.

## Decision
Use `onnxruntime-web@1.30.0` (import `onnxruntime-web/webgpu`, which carries both the `webgpu` and `wasm` execution providers).
Tests that need a real model use `onnxruntime-node@1.30.0` behind the same small `OrtLike` interface the engine is written against.

## Alternatives
- **transformers.js**: good pipelines for the tasks it supports, but it adds a pipeline layer we do not need for raw
  image-to-image tensors, and it still runs ORT underneath.
- **TensorFlow.js**: these models are PyTorch exports. The TF conversion path is worse and op coverage differs.
- **WebNN**: limited browser availability today. Kept as a stretch EP.

## Consequences
- One runtime, two EPs, one model file. EP choice is a session option (ADR 0004 covers how its wasm assets are served).
- What we gave up: transformers.js's model hub helpers and caching (we write our own loader, ADR 0006), and the larger
  community of ready-made pipelines.
