# Models and assets

Everything the app downloads or ships, with source, license and checksum. The app refuses to run a model whose sha256
differs from the value below (`src/core/loader.ts`, `public/models/manifest.json`).

## MI-GAN 512 (inpainting)

| Field | Value |
|---|---|
| File | `migan.onnx` |
| License | MIT |
| Code | https://github.com/Picsart-AI-Research/MI-GAN |
| Weights | https://huggingface.co/andraniksargsyan/migan |
| Pinned revision | `406830d0fa60666da0071c342ad2fbc8f30c5c64` |
| Size | 29,546,882 bytes |
| sha256 | `593eba0b7e04730f1b61c0a3cbca68d97d8d6a7ff5c6a44a7b9d7fcd880fc5ae` |
| Input `image` | uint8 `[1,3,512,512]`, RGB, 0..255 |
| Input `mask` | uint8 `[1,1,512,512]`, **255 = keep, 0 = hole** |
| Output `result` | uint8 `[1,3,512,512]`, RGB |

Delivery order (ADR 0006): the same-origin `/models/migan.onnx` first, then the pinned Hugging Face URL. Hugging Face
serves it with `access-control-allow-origin: *`, so a cross-origin-isolated page can fetch it. `pnpm models:fetch`
downloads it into `public/models/` and verifies the hash. The file is git-ignored.

## Sample photo

| Field | Value |
|---|---|
| File | `public/samples/aldrin.jpg` (committed) |
| Source | https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Aldrin_Apollo_11_original.jpg/960px-Aldrin_Apollo_11_original.jpg |
| Original | NASA AS11-40-5903, Apollo 11 |
| License | Public domain (NASA), per Wikimedia Commons |
| Size | 280,403 bytes, 960x966 JPEG |
| sha256 | `7ea66a1e0632c564bd1beb4733abe5ef26d70de0561d5fd000b8f7bb92e6bd38` |

`pnpm exec node scripts/sample-fetch.mjs` re-downloads and verifies it.

## Why not other models

- LaMa: 208 MB and a 32 s WebGPU session create in the prototype. See [ADR 0002](docs/adr/0002-migan-not-lama.md).
- Real-ESRGAN (upscale): the only ready ONNX export found is in a GPL-3.0 repository, and the Qualcomm URLs return 404.
  Upscale is deferred to v0.2. See [ADR 0003](docs/adr/0003-upscale-deferred.md).
