import { InpaintError, type Rect, type RGBAImage } from './types'

export function cropRGBA(img: RGBAImage, rect: Rect): RGBAImage {
  const { x, y, w, h } = rect
  if (w < 1 || h < 1 || x < 0 || y < 0 || x + w > img.width || y + h > img.height)
    throw new InpaintError('BAD_INPUT', `crop rect ${x},${y},${w},${h} outside ${img.width}x${img.height}`)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < h; row++) {
    const s = ((y + row) * img.width + x) * 4
    data.set(img.data.subarray(s, s + w * 4), row * w * 4)
  }
  return { data, width: w, height: h }
}

export function resizeBilinear(img: RGBAImage, w: number, h: number): RGBAImage {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1)
    throw new InpaintError('BAD_INPUT', `invalid target size ${w}x${h}`)
  const { width: sw, height: sh, data: src } = img
  const out = new Uint8ClampedArray(w * h * 4)
  const rx = sw / w
  const ry = sh / h
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max((y + 0.5) * ry - 0.5, 0), sh - 1)
    const y0 = Math.floor(fy)
    const y1 = Math.min(y0 + 1, sh - 1)
    const wy = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max((x + 0.5) * rx - 0.5, 0), sw - 1)
      const x0 = Math.floor(fx)
      const x1 = Math.min(x0 + 1, sw - 1)
      const wx = fx - x0
      const o = (y * w + x) * 4
      for (let k = 0; k < 4; k++) {
        const top = src[(y0 * sw + x0) * 4 + k] * (1 - wx) + src[(y0 * sw + x1) * 4 + k] * wx
        const bot = src[(y1 * sw + x0) * 4 + k] * (1 - wx) + src[(y1 * sw + x1) * 4 + k] * wx
        out[o + k] = Math.round(top * (1 - wy) + bot * wy)
      }
    }
  }
  return { data: out, width: w, height: h }
}
