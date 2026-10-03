import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { cropMask, dilateMask, maskBBox, resizeMaskAny } from '../src/core/mask'
import { makeMask, randomMask } from './helpers/synthetic'

describe('maskBBox', () => {
  it('empty mask is null', () => expect(maskBBox(makeMask(10, 10, []))).toBeNull())
  it('single pixel', () => expect(maskBBox(makeMask(10, 10, [{ x: 5, y: 7, w: 1, h: 1 }]))).toEqual({ x: 5, y: 7, w: 1, h: 1 }))
  it('union of two rects', () => {
    const m = makeMask(50, 50, [
      { x: 2, y: 3, w: 4, h: 4 },
      { x: 20, y: 30, w: 5, h: 2 },
    ])
    expect(maskBBox(m)).toEqual({ x: 2, y: 3, w: 23, h: 29 })
  })
})

describe('dilateMask', () => {
  it('single pixel becomes 3x3 with r=1', () => {
    const d = dilateMask(makeMask(9, 9, [{ x: 4, y: 4, w: 1, h: 1 }]), 1)
    expect(maskBBox(d)).toEqual({ x: 3, y: 3, w: 3, h: 3 })
    expect(d.data.reduce((a, b) => a + b, 0)).toBe(9)
  })
  it('clips at borders', () => {
    const d = dilateMask(makeMask(9, 9, [{ x: 0, y: 0, w: 1, h: 1 }]), 1)
    expect(d.data.reduce((a, b) => a + b, 0)).toBe(4)
  })
  it('r=0 is a copy', () => {
    const m = makeMask(5, 5, [{ x: 1, y: 1, w: 2, h: 2 }])
    const d = dilateMask(m, 0)
    expect(d.data).toEqual(m.data)
    expect(d.data).not.toBe(m.data)
  })
})

describe('cropMask', () => {
  it('returns the sub-mask', () => {
    const m = makeMask(10, 10, [{ x: 4, y: 4, w: 2, h: 2 }])
    const c = cropMask(m, { x: 3, y: 3, w: 4, h: 4 })
    expect(c.width).toBe(4)
    expect(c.height).toBe(4)
    expect(maskBBox(c)).toEqual({ x: 1, y: 1, w: 2, h: 2 })
  })
})

describe('resizeMaskAny', () => {
  it('thin strokes survive downscale', () => {
    const m = makeMask(64, 64, [{ x: 31, y: 0, w: 1, h: 64 }])
    const r = resizeMaskAny(m, 16, 16)
    for (let y = 0; y < 16; y++) {
      let any = 0
      for (let x = 0; x < 16; x++) any += r.data[y * 16 + x]
      expect(any).toBeGreaterThan(0)
    }
  })
  it('all-zero stays all-zero with exact dims', () => {
    const r = resizeMaskAny(makeMask(30, 20, []), 7, 9)
    expect(r.width).toBe(7)
    expect(r.height).toBe(9)
    expect(r.data.every((v) => v === 0)).toBe(true)
  })
  it('upscale keeps coverage', () => {
    const r = resizeMaskAny(makeMask(4, 4, [{ x: 1, y: 1, w: 1, h: 1 }]), 16, 16)
    expect(maskBBox(r)).toEqual({ x: 4, y: 4, w: 4, h: 4 })
  })
  it('same size is identity (property)', () => {
    fc.assert(
      fc.property(randomMask, (m) => {
        expect(resizeMaskAny(m, m.width, m.height).data).toEqual(m.data)
      }),
    )
  })
})
