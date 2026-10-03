import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as ortNode from 'onnxruntime-node'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { createEngine, type OrtLike } from '../src/core/engine'
import { sha256Hex } from '../src/core/hash'
import { getModel, parseManifest } from '../src/core/manifest'
import type { RGBAImage } from '../src/core/types'
import { makeImage, makeMask } from './helpers/synthetic'

const MODEL = 'public/models/migan.onnx'
const GOLDEN = 'tests/golden/migan-synthetic.png'

const ort = {
  env: { wasm: {} },
  Tensor: ortNode.Tensor,
  InferenceSession: {
    create: (bytes: Uint8Array) =>
      ortNode.InferenceSession.create(bytes, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' }),
  },
} as unknown as OrtLike

function psnr(a: RGBAImage, b: RGBAImage, mask: Uint8Array): number {
  let se = 0
  let n = 0
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    for (let k = 0; k < 3; k++) {
      const d = a.data[i * 4 + k] - b.data[i * 4 + k]
      se += d * d
      n++
    }
  }
  const mse = se / n
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse)
}

describe.skipIf(!existsSync(MODEL))('golden MI-GAN on onnxruntime-node', () => {
  it('preserves unmasked pixels and matches the golden image', async () => {
    const manifest = parseManifest(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')))
    const model = getModel(manifest, 'migan-512')
    const engine = createEngine({
      ort,
      manifest,
      loadModel: async () => {
        const bytes = new Uint8Array(readFileSync(MODEL))
        expect(await sha256Hex(bytes)).toBe(model.sha256)
        return bytes
      },
      gpu: undefined,
      crossOriginIsolated: false,
      hardwareConcurrency: 4,
    })
    const image = makeImage(640, 480, 7)
    const mask = makeMask(640, 480, [{ x: 300, y: 200, w: 120, h: 90 }])
    const t0 = performance.now()
    const r = await engine.inpaint(image, mask, {})
    const elapsed = performance.now() - t0
    await engine.dispose()

    for (let i = 0; i < mask.data.length; i++) {
      if (mask.data[i] === 0) for (let k = 0; k < 4; k++) expect(r.image.data[i * 4 + k]).toBe(image.data[i * 4 + k])
    }
    expect(elapsed).toBeLessThan(20_000)

    if (process.env.UPDATE_GOLDEN === '1') {
      mkdirSync('tests/golden', { recursive: true })
      const png = new PNG({ width: 640, height: 480 })
      png.data = Buffer.from(r.image.data.buffer)
      writeFileSync(GOLDEN, PNG.sync.write(png))
      return
    }
    if (!existsSync(GOLDEN)) throw new Error('golden missing: run UPDATE_GOLDEN=1 pnpm test tests/golden.test.ts')
    const g = PNG.sync.read(readFileSync(GOLDEN))
    const golden: RGBAImage = { data: new Uint8ClampedArray(g.data), width: g.width, height: g.height }
    expect(psnr(r.image, golden, mask.data)).toBeGreaterThanOrEqual(40)
  })
})
