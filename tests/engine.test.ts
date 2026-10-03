import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/core/engine'
import { parseManifest } from '../src/core/manifest'
import { InpaintError } from '../src/core/types'
import { makeFakeOrt, type FakeOrtOptions } from './helpers/fake-ort'
import { makeImage, makeMask } from './helpers/synthetic'

const manifest = parseManifest(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')))
const goodGpu = { requestAdapter: async () => ({ limits: { maxBufferSize: 4294967296 }, info: { vendor: 'fake', architecture: 'gpu' } }) }

function setup(o: FakeOrtOptions & { gpu?: typeof goodGpu | undefined; loadModel?: () => Promise<Uint8Array> } = {}) {
  const fake = makeFakeOrt(o)
  let loads = 0
  let t = 0
  const engine = createEngine({
    ort: fake.ort,
    manifest,
    loadModel: o.loadModel ?? (async () => (loads++, new Uint8Array([1, 2, 3]))),
    gpu: 'gpu' in o ? o.gpu : goodGpu,
    crossOriginIsolated: true,
    hardwareConcurrency: 24,
    now: () => (t += 1),
  })
  return { ...fake, engine, loads: () => loads }
}

const img = makeImage(300, 200, 4)
const mask = makeMask(300, 200, [{ x: 100, y: 80, w: 40, h: 30 }])

describe('engine', () => {
  it('inpaints, preserves unmasked pixels, reports timings and ep', async () => {
    const { engine } = setup()
    const r = await engine.inpaint(img, mask, {})
    expect([r.image.width, r.image.height]).toEqual([300, 200])
    let changedMasked = 0
    for (let i = 0; i < mask.data.length; i++) {
      if (mask.data[i] === 0) for (let k = 0; k < 4; k++) expect(r.image.data[i * 4 + k]).toBe(img.data[i * 4 + k])
      else if (r.image.data[i * 4] !== img.data[i * 4]) changedMasked++
    }
    expect(changedMasked).toBeGreaterThan(0)
    for (const k of ['loadMs', 'sessionMs', 'preMs', 'runMs', 'postMs', 'totalMs'] as const) {
      expect(r.timings[k]).toBeGreaterThanOrEqual(0)
    }
    expect(r.ep).toBe('webgpu')
    expect(r.fallbackReason).toBeUndefined()
  })

  it('TOO_LARGE allocates no tensors and loads no model', async () => {
    const s = setup()
    await expect(s.engine.inpaint(makeImage(5000, 10, 1), makeMask(5000, 10, [{ x: 1, y: 1, w: 3, h: 3 }]), {})).rejects.toMatchObject({
      code: 'TOO_LARGE',
    })
    expect(s.stats.tensors).toBe(0)
    expect(s.loads()).toBe(0)
    expect(s.stats.creates).toEqual([])
  })

  it('EMPTY_MASK and mismatched mask dims', async () => {
    const { engine } = setup()
    await expect(engine.inpaint(img, makeMask(300, 200, []), {})).rejects.toMatchObject({ code: 'EMPTY_MASK' })
    await expect(engine.inpaint(img, makeMask(10, 10, [{ x: 0, y: 0, w: 2, h: 2 }]), {})).rejects.toMatchObject({ code: 'BAD_INPUT' })
  })

  it('HASH_MISMATCH propagates and no session is created', async () => {
    const s = setup({ loadModel: async () => Promise.reject(new InpaintError('HASH_MISMATCH', 'bad')) })
    await expect(s.engine.inpaint(img, mask, {})).rejects.toMatchObject({ code: 'HASH_MISMATCH' })
    expect(s.stats.creates).toEqual([])
  })

  it('forceWasm uses wasm with reason forced', async () => {
    const s = setup()
    const r = await s.engine.inpaint(img, mask, { forceWasm: true })
    expect([r.ep, r.fallbackReason]).toEqual(['wasm', 'forced'])
    expect(s.stats.creates).toEqual(['wasm'])
  })

  it('webgpu create failure falls back to wasm with a session-error reason', async () => {
    const s = setup({ failWebgpu: true })
    const r = await s.engine.inpaint(img, mask, {})
    expect(r.ep).toBe('wasm')
    expect(r.fallbackReason).toBe('session-error: webgpu create failed')
  })

  it('no gpu -> wasm with no-webgpu-api', async () => {
    const r = await setup({ gpu: undefined }).engine.inpaint(img, mask, {})
    expect([r.ep, r.fallbackReason]).toEqual(['wasm', 'no-webgpu-api'])
  })

  it('reuses the session across jobs and loads bytes once', async () => {
    const s = setup()
    await s.engine.inpaint(img, mask, {})
    await s.engine.inpaint(img, mask, {})
    expect(s.stats.creates.length).toBe(1)
    expect(s.loads()).toBe(1)
  })

  it('out of memory during run -> OOM', async () => {
    const { engine } = setup({ runError: 'Failed to allocate: out of memory' })
    await expect(engine.inpaint(img, mask, {})).rejects.toMatchObject({ code: 'OOM' })
  })

  it('other errors -> INTERNAL', async () => {
    const { engine } = setup({ runError: 'something odd' })
    await expect(engine.inpaint(img, mask, {})).rejects.toMatchObject({ code: 'INTERNAL' })
  })

  it('sets wasm numThreads before the first create', async () => {
    const s = setup()
    await s.engine.inpaint(img, mask, { forceWasm: true })
    expect(s.stats.threadsAtCreate).toEqual([16])
  })

  it('dispose releases sessions', async () => {
    const s = setup()
    await s.engine.inpaint(img, mask, {})
    await s.engine.dispose()
    expect(s.stats.released).toBe(1)
  })

  it('reports progress phases', async () => {
    const { engine } = setup()
    const phases: string[] = []
    await engine.inpaint(img, mask, { onProgress: (p) => phases.push(p.phase) })
    expect(phases).toEqual(expect.arrayContaining(['session', 'pre', 'run', 'post']))
  })
})
