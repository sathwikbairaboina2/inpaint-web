import { describe, expect, it } from 'vitest'
import { selectProvider, wasmThreads, type GpuLike } from '../src/core/ep'
import type { EpName } from '../src/core/types'

const MIN = 268435456

function gpuWith(adapter: unknown): GpuLike {
  return { requestAdapter: async () => adapter as never }
}

const goodAdapter = { limits: { maxBufferSize: 4294967296 }, info: { vendor: 'nvidia', architecture: 'ada' } }

function sessions(failWebgpu?: Error, failWasm?: Error) {
  const created: EpName[] = []
  return {
    created,
    createSession: async (ep: EpName) => {
      created.push(ep)
      if (ep === 'webgpu' && failWebgpu) throw failWebgpu
      if (ep === 'wasm' && failWasm) throw failWasm
      return `session-${ep}`
    },
  }
}

describe('wasmThreads', () => {
  it.each([
    [false, 24, 1],
    [true, 24, 16],
    [true, 4, 4],
    [true, 0, 1],
  ])('coi=%s hc=%i -> %i', (coi, hc, n) => {
    expect(wasmThreads(coi, hc)).toBe(n)
  })
})

describe('selectProvider', () => {
  it('forced', async () => {
    const s = sessions()
    const r = await selectProvider({ gpu: gpuWith(goodAdapter), forceWasm: true, minBufferBytes: MIN, createSession: s.createSession })
    expect(r.ep).toBe('wasm')
    expect(r.reason).toBe('forced')
    expect(s.created).toEqual(['wasm'])
  })

  it('no gpu api', async () => {
    const s = sessions()
    const r = await selectProvider({ gpu: undefined, forceWasm: false, minBufferBytes: MIN, createSession: s.createSession })
    expect([r.ep, r.reason, s.created]).toEqual(['wasm', 'no-webgpu-api', ['wasm']])
  })

  it('adapter null', async () => {
    const s = sessions()
    const r = await selectProvider({ gpu: gpuWith(null), forceWasm: false, minBufferBytes: MIN, createSession: s.createSession })
    expect([r.ep, r.reason, s.created]).toEqual(['wasm', 'no-adapter', ['wasm']])
  })

  it('adapter request rejects', async () => {
    const s = sessions()
    const gpu: GpuLike = { requestAdapter: async () => Promise.reject(new Error('x')) }
    const r = await selectProvider({ gpu, forceWasm: false, minBufferBytes: MIN, createSession: s.createSession })
    expect([r.ep, r.reason, s.created]).toEqual(['wasm', 'no-adapter', ['wasm']])
  })

  it('limits too small', async () => {
    const s = sessions()
    const gpu = gpuWith({ limits: { maxBufferSize: 1024 } })
    const r = await selectProvider({ gpu, forceWasm: false, minBufferBytes: MIN, createSession: s.createSession })
    expect([r.ep, r.reason, s.created]).toEqual(['wasm', 'limits', ['wasm']])
  })

  it('webgpu session create throws', async () => {
    const s = sessions(new Error('boom'))
    const r = await selectProvider({ gpu: gpuWith(goodAdapter), forceWasm: false, minBufferBytes: MIN, createSession: s.createSession })
    expect([r.ep, r.reason, s.created]).toEqual(['wasm', 'session-error: boom', ['webgpu', 'wasm']])
  })

  it('success on webgpu never creates wasm, reports adapter', async () => {
    const s = sessions()
    const r = await selectProvider({ gpu: gpuWith(goodAdapter), forceWasm: false, minBufferBytes: MIN, createSession: s.createSession })
    expect(r.ep).toBe('webgpu')
    expect(r.reason).toBeUndefined()
    expect(r.adapterInfo).toBe('nvidia ada')
    expect(s.created).toEqual(['webgpu'])
  })

  it('both fail -> UNSUPPORTED', async () => {
    const s = sessions(new Error('a'), new Error('b'))
    await expect(
      selectProvider({ gpu: gpuWith(goodAdapter), forceWasm: false, minBufferBytes: MIN, createSession: s.createSession }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' })
  })
})
