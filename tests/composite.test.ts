import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compositeMasked } from '../src/core/composite'
import type { Rect, RGBAImage } from '../src/core/types'
import { makeImage, makeMask, randomImage } from './helpers/synthetic'

const noise = (w: number, h: number, bytes: number[]): RGBAImage => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i++) data[i] = bytes[i % bytes.length]
  return { data, width: w, height: h }
}

describe('compositeMasked', () => {
  it('never touches mask=0 pixels or any alpha byte (property)', () => {
    const arb = randomImage.chain((img) =>
      fc
        .tuple(
          fc.array(fc.integer({ min: 0, max: 1 }), { minLength: img.width * img.height, maxLength: img.width * img.height }),
          fc.integer({ min: 0, max: img.width - 1 }),
          fc.integer({ min: 0, max: img.height - 1 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 4, maxLength: 64 }),
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 0, max: 1000 }),
        )
        .map(([m, x, y, bytes, feather, rw, rh]) => {
          const w = 1 + (rw % (img.width - x))
          const h = 1 + (rh % (img.height - y))
          return { img, mask: { data: Uint8Array.from(m), width: img.width, height: img.height }, rect: { x, y, w, h }, bytes, feather }
        }),
    )
    fc.assert(
      fc.property(arb, ({ img, mask, rect, bytes, feather }) => {
        const before = img.data.slice()
        const patch = noise(rect.w, rect.h, bytes)
        const out = compositeMasked(img, patch, rect, mask, { feather })
        expect(img.data).toEqual(before)
        for (let i = 0; i < mask.data.length; i++) {
          if (mask.data[i] === 0) for (let k = 0; k < 4; k++) expect(out.data[i * 4 + k]).toBe(img.data[i * 4 + k])
          expect(out.data[i * 4 + 3]).toBe(img.data[i * 4 + 3])
        }
      }),
      { numRuns: 200 },
    )
  })

  it('feather 0 writes patch on every masked pixel inside rect, leaves masked pixels outside rect', () => {
    const img = makeImage(10, 10, 1)
    const rect: Rect = { x: 2, y: 2, w: 4, h: 4 }
    const mask = makeMask(10, 10, [{ x: 0, y: 0, w: 10, h: 10 }])
    const patch = noise(4, 4, [200, 100, 50, 7])
    const out = compositeMasked(img, patch, rect, mask, { feather: 0 })
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 10; x++) {
        const i = (y * 10 + x) * 4
        const inside = x >= 2 && x < 6 && y >= 2 && y < 6
        if (inside) expect(Array.from(out.data.slice(i, i + 3))).toEqual([200, 100, 50])
        else expect(Array.from(out.data.slice(i, i + 3))).toEqual(Array.from(img.data.slice(i, i + 3)))
        expect(out.data[i + 3]).toBe(img.data[i + 3])
      }
  })

  it('feather 2 on a 9x9 hole blends 1/3 at distance 1 and full at the centre', () => {
    const W = 15
    const img = makeImage(W, W, 2)
    const mask = makeMask(W, W, [{ x: 3, y: 3, w: 9, h: 9 }])
    const rect: Rect = { x: 0, y: 0, w: W, h: W }
    const patch = noise(W, W, [240, 10, 130, 255])
    const out = compositeMasked(img, patch, rect, mask, { feather: 2 })
    const c = (7 * W + 7) * 4
    expect(Array.from(out.data.slice(c, c + 3))).toEqual([240, 10, 130])
    const e = (3 * W + 7) * 4
    for (let k = 0; k < 3; k++) {
      const expected = Math.round(img.data[e + k] * (1 - 1 / 3) + patch.data[e + k] * (1 / 3))
      expect(out.data[e + k]).toBe(expected)
    }
    const e2 = (4 * W + 7) * 4
    for (let k = 0; k < 3; k++) {
      const expected = Math.round(img.data[e2 + k] * (1 - 2 / 3) + patch.data[e2 + k] * (2 / 3))
      expect(out.data[e2 + k]).toBe(expected)
    }
  })

  it('image borders are not edges', () => {
    const img = makeImage(6, 6, 3)
    const mask = makeMask(6, 6, [{ x: 0, y: 0, w: 3, h: 3 }])
    const patch = noise(6, 6, [250, 250, 250, 255])
    const out = compositeMasked(img, patch, { x: 0, y: 0, w: 6, h: 6 }, mask, { feather: 2 })
    expect(Array.from(out.data.slice(0, 3))).toEqual([250, 250, 250])
  })
})
