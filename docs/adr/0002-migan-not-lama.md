# ADR 0002: MI-GAN 512 is the v0.1 inpaint model, not LaMa

Date: 2026-10-04. Status: accepted. Deviates from the design doc, which picked LaMa and listed MI-GAN for v0.2.

## Context
The 30-second wow needs a fast first load on a phone. Prototype on 2026-10-04 (headless host Chrome 154, RTX 4090,
onnxruntime-web 1.30.0, 512x512 input, scratch prototype; details in the spec):

| Model | Size | WebGPU session create | WebGPU run (median) | WASM 16-thread run (median) |
|---|---|---|---|---|
| MI-GAN `migan.onnx` (MIT) | 29.5 MB | 0.9-2.6 s | 26-48 ms | 298-3261 ms (noisy host) |
| LaMa `lama_fp32.onnx` (Carve, Apache-2.0) | 208 MB | 32.1 s | 169 ms | 3181 ms |

Both models ran on both EPs. LaMa's graph has 7,054 Constant, 216 Einsum and 144 Cos/Sin nodes (its FFT is rewritten as
matmuls), which is why its WebGPU session takes 32 s to compile.

## Decision
Ship `migan.onnx` from `andraniksargsyan/migan` at revision `406830d0fa60666da0071c342ad2fbc8f30c5c64`
(sha256 `593eba0b7e04730f1b61c0a3cbca68d97d8d6a7ff5c6a44a7b9d7fcd880fc5ae`, 29,546,882 bytes) as the only v0.1 model.
Its IO is uint8 NCHW with mask 255 = keep and 0 = hole (verified). We crop and resize to 512 ourselves (ADR 0005) instead
of using `migan_pipeline_v2.onnx`, which crops inside the graph with NonZero/ScatterND and hides those steps from our tests.

## Consequences
- First load is 29.5 MB instead of 208 MB, and the WebGPU session is ready in about a second.
- The manifest and engine are model-agnostic (`io.dtype`, scales, mask values), so LaMa can return as an opt-in
  "high quality" model in v0.2.
- What we gave up: LaMa's better results on very large holes and repeated textures. MI-GAN blurs big holes on big photos.
