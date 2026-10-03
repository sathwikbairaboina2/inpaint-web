import type { OrtLike } from '../../src/core/engine'

export type FakeOrtOptions = { failWebgpu?: boolean; runError?: string; seed?: number }

export function makeFakeOrt(opts: FakeOrtOptions = {}) {
  const stats = { tensors: 0, creates: [] as string[], threadsAtCreate: [] as (number | undefined)[], runs: 0, released: 0 }
  let rng = opts.seed ?? 12345
  const next = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
    return rng
  }

  class FakeTensor {
    dims: readonly number[]
    constructor(
      public type: string,
      public data: ArrayLike<number>,
      dims: readonly number[],
    ) {
      stats.tensors++
      this.dims = dims
    }
    async getData() {
      return this.data
    }
  }

  const ort = {
    env: { wasm: { numThreads: undefined as number | undefined, wasmPaths: undefined as string | undefined } },
    Tensor: FakeTensor,
    InferenceSession: {
      async create(_bytes: Uint8Array, o: { executionProviders: string[] }) {
        const ep = o.executionProviders[0]
        stats.creates.push(ep)
        stats.threadsAtCreate.push(ort.env.wasm.numThreads)
        if (ep === 'webgpu' && opts.failWebgpu) throw new Error('webgpu create failed')
        return {
          async run(feeds: Record<string, FakeTensor>) {
            stats.runs++
            if (opts.runError) throw new Error(opts.runError)
            const dims = feeds.image.dims
            const n = dims.reduce((a, b) => a * b, 1)
            const out = new Uint8Array(n)
            for (let i = 0; i < n; i++) out[i] = next() & 255
            return { result: new FakeTensor('uint8', out, dims) }
          },
          async release() {
            stats.released++
          },
        }
      },
    },
  }
  return { ort: ort as unknown as OrtLike, stats, env: ort.env }
}
