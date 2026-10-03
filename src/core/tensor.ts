import type { Mask, RGBAImage } from './types'

export function rgbaToNCHW(img: RGBAImage, dtype: 'uint8', scale: number): Uint8Array
export function rgbaToNCHW(img: RGBAImage, dtype: 'float32', scale: number): Float32Array
export function rgbaToNCHW(img: RGBAImage, dtype: 'uint8' | 'float32', scale: number): Uint8Array | Float32Array
export function rgbaToNCHW(img: RGBAImage, dtype: 'uint8' | 'float32', scale: number): Uint8Array | Float32Array {
  const n = img.width * img.height
  const out = dtype === 'uint8' ? new Uint8Array(3 * n) : new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const v = img.data[i * 4 + c]
      out[c * n + i] = dtype === 'uint8' ? v : v * scale
    }
  }
  return out
}

export function nchwToRGBA(
  data: ArrayLike<number>,
  w: number,
  h: number,
  scale: number,
  alphaFrom?: RGBAImage,
): RGBAImage {
  const n = w * h
  const inv = 1 / scale
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const v = Math.round(data[c * n + i] * inv)
      out[i * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : v
    }
    out[i * 4 + 3] = alphaFrom ? alphaFrom.data[i * 4 + 3] : 255
  }
  return { data: out, width: w, height: h }
}

export function maskToNCHW(mask: Mask, dtype: 'uint8', keep: number, hole: number): Uint8Array
export function maskToNCHW(mask: Mask, dtype: 'float32', keep: number, hole: number): Float32Array
export function maskToNCHW(mask: Mask, dtype: 'uint8' | 'float32', keep: number, hole: number): Uint8Array | Float32Array
export function maskToNCHW(mask: Mask, dtype: 'uint8' | 'float32', keep: number, hole: number): Uint8Array | Float32Array {
  const out = dtype === 'uint8' ? new Uint8Array(mask.data.length) : new Float32Array(mask.data.length)
  for (let i = 0; i < mask.data.length; i++) out[i] = mask.data[i] ? hole : keep
  return out
}
