import type { Mask, Rect, RGBAImage } from '../core/types'

export function syntheticImage(w: number, h: number, seed = 1): RGBAImage {
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

export function rectMask(w: number, h: number, r: Rect): Mask {
  const data = new Uint8Array(w * h)
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) data[y * w + x] = 1
  return { data, width: w, height: h }
}
