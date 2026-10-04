import { describe, expect, it } from 'vitest'
import { pickHeadline } from '../src/bench/headline'

const r = (gpu: number, wasm: number) => ({ webgpu: { run: { median: gpu } }, wasm: { run: { median: wasm } } })

describe('pickHeadline', () => {
  it('takes the median of the per-round speedups, not the best or the last', () => {
    const h = pickHeadline([r(50, 2184), r(45, 760), r(46, 900)])
    expect(h.perRound).toEqual([43.68, 16.89, 19.57])
    expect(h.index).toBe(2)
    expect(h.speedup).toBe(19.57)
  })
  it('uses the lower median for an even count', () => {
    expect(pickHeadline([r(10, 100), r(10, 200), r(10, 300), r(10, 400)]).speedup).toBe(20)
  })
  it('is null when webgpu never ran', () => {
    expect(pickHeadline([{ webgpu: null, wasm: { run: { median: 5 } } }]).speedup).toBeNull()
  })
})
