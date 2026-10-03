import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { cropRGBA, resizeBilinear } from '../src/core/resize'
import type { RGBAImage } from '../src/core/types'
import { makeImage } from './helpers/synthetic'

const flat = (w: number, h: number, c: number[]): RGBAImage => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(c, i * 4)
  return { data, width: w, height: h }
}

describe('resizeBilinear', () => {
  it('same size returns equal bytes in a new buffer', () => {
    const a = makeImage(13, 9, 3)
    const b = resizeBilinear(a, 13, 9)
    expect(b.data).toEqual(a.data)
    expect(b.data).not.toBe(a.data)
  })
  it('constant image stays constant through 37x23 -> 512 -> 37x23 (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 4, maxLength: 4 }), (c) => {
        const a = flat(37, 23, c)
        const up = resizeBilinear(a, 512, 512)
        expect(up.width).toBe(512)
        expect(up.height).toBe(512)
        const down = resizeBilinear(up, 37, 23)
        expect(down.data).toEqual(a.data)
      }),
    )
  })
  it('black to white is monotonic', () => {
    const a: RGBAImage = { data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), width: 2, height: 1 }
    const b = resizeBilinear(a, 4, 1)
    for (let i = 1; i < 4; i++) expect(b.data[i * 4]).toBeGreaterThanOrEqual(b.data[(i - 1) * 4])
    expect(b.data[0]).toBe(0)
    expect(b.data[12]).toBe(255)
  })
  it('rejects zero target size', () => {
    expect(() => resizeBilinear(makeImage(2, 2, 1), 0, 4)).toThrow()
  })
})

describe('cropRGBA', () => {
  it('copies the right pixels', () => {
    const a = makeImage(10, 8, 5)
    const c = cropRGBA(a, { x: 3, y: 2, w: 4, h: 3 })
    expect(c.width).toBe(4)
    expect(c.height).toBe(3)
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 4; x++)
        for (let k = 0; k < 4; k++) expect(c.data[(y * 4 + x) * 4 + k]).toBe(a.data[((y + 2) * 10 + x + 3) * 4 + k])
  })
  it('rejects rect outside image', () => {
    expect(() => cropRGBA(makeImage(4, 4, 1), { x: 2, y: 2, w: 3, h: 3 })).toThrow()
  })
})
