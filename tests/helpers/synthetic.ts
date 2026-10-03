import fc from 'fast-check'
import type { Mask, Rect, RGBAImage } from '../../src/core/types'

export function makeImage(w: number, h: number, seed: number): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data[i] = (x * 7 + seed * 13) & 255
      data[i + 1] = (y * 5 + seed * 29 + (x ^ y)) & 255
      data[i + 2] = ((x + y) * 3 + seed * 41) & 255
      data[i + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

export function makeMask(w: number, h: number, rects: Rect[]): Mask {
  const data = new Uint8Array(w * h)
  for (const r of rects) {
    for (let y = Math.max(0, r.y); y < Math.min(h, r.y + r.h); y++) {
      for (let x = Math.max(0, r.x); x < Math.min(w, r.x + r.w); x++) data[y * w + x] = 1
    }
  }
  return { data, width: w, height: h }
}

export const randomImage: fc.Arbitrary<RGBAImage> = fc
  .tuple(fc.integer({ min: 1, max: 64 }), fc.integer({ min: 1, max: 64 }))
  .chain(([w, h]) =>
    fc.uint8Array({ minLength: w * h * 4, maxLength: w * h * 4 }).map((d) => ({
      data: new Uint8ClampedArray(d),
      width: w,
      height: h,
    })),
  )

export const randomMask: fc.Arbitrary<Mask> = fc
  .tuple(fc.integer({ min: 1, max: 64 }), fc.integer({ min: 1, max: 64 }))
  .chain(([w, h]) =>
    fc
      .array(fc.integer({ min: 0, max: 1 }), { minLength: w * h, maxLength: w * h })
      .map((d) => ({ data: Uint8Array.from(d), width: w, height: h })),
  )
