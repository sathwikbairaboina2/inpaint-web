import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { maskToNCHW, nchwToRGBA, rgbaToNCHW } from '../src/core/tensor'
import type { RGBAImage } from '../src/core/types'
import { makeMask, randomImage } from './helpers/synthetic'

describe('tensor', () => {
  it('uint8 round trip restores RGB, alpha from alphaFrom or 255 (property)', () => {
    fc.assert(
      fc.property(randomImage, (img) => {
        const t = rgbaToNCHW(img, 'uint8', 1)
        expect(t).toBeInstanceOf(Uint8Array)
        expect(t.length).toBe(3 * img.width * img.height)
        const back = nchwToRGBA(t, img.width, img.height, 1, img)
        expect(back.data).toEqual(img.data)
        const noAlpha = nchwToRGBA(t, img.width, img.height, 1)
        for (let i = 0; i < img.width * img.height; i++) {
          expect(noAlpha.data[i * 4 + 3]).toBe(255)
          expect(noAlpha.data[i * 4]).toBe(img.data[i * 4])
        }
      }),
    )
  })
  it('float32 with scale 1/255 round trips exactly', () => {
    fc.assert(
      fc.property(randomImage, (img) => {
        const t = rgbaToNCHW(img, 'float32', 1 / 255)
        expect(t).toBeInstanceOf(Float32Array)
        const back = nchwToRGBA(t, img.width, img.height, 1 / 255, img)
        expect(back.data).toEqual(img.data)
      }),
    )
  })
  it('plane order', () => {
    const img: RGBAImage = { data: new Uint8ClampedArray([0, 0, 0, 255, 10, 20, 30, 255]), width: 2, height: 1 }
    const t = rgbaToNCHW(img, 'uint8', 1)
    expect(t[1]).toBe(10)
    expect(t[2 + 1]).toBe(20)
    expect(t[4 + 1]).toBe(30)
  })
  it('clamps out of range floats', () => {
    const out = nchwToRGBA(new Float32Array([-3, 300, 0.4, 0, 0, 0]), 2, 1, 1)
    expect(Array.from(out.data.slice(0, 4))).toEqual([0, 0, 0, 255])
    expect(Array.from(out.data.slice(4, 8))).toEqual([255, 0, 0, 255])
  })
  it('maskToNCHW maps 1 -> hole, 0 -> keep', () => {
    const m = makeMask(2, 1, [{ x: 0, y: 0, w: 1, h: 1 }])
    expect(Array.from(maskToNCHW(m, 'uint8', 255, 0))).toEqual([0, 255])
  })
})
