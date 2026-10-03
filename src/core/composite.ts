import type { Mask, Rect, RGBAImage } from './types'

export type CompositeOptions = { feather?: number }

function edgeDistance(mask: Mask, x: number, y: number, feather: number): number {
  const { data, width, height } = mask
  for (let d = 1; d <= feather; d++) {
    for (let yy = Math.max(0, y - d); yy <= Math.min(height - 1, y + d); yy++) {
      const ring = yy === y - d || yy === y + d
      for (let xx = Math.max(0, x - d); xx <= Math.min(width - 1, x + d); xx++) {
        if (!ring && xx !== x - d && xx !== x + d) continue
        if (!data[yy * width + xx]) return d
      }
    }
  }
  return feather + 1
}

export function compositeMasked(
  original: RGBAImage,
  patch: RGBAImage,
  rect: Rect,
  mask: Mask,
  opts: CompositeOptions = {},
): RGBAImage {
  const feather = opts.feather ?? 0
  const out = new Uint8ClampedArray(original.data)
  const W = original.width
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!mask.data[y * W + x]) continue
      const d = feather > 0 ? edgeDistance(mask, x, y, feather) : feather + 1
      const a = d <= feather ? d / (feather + 1) : 1
      const o = (y * W + x) * 4
      const p = ((y - rect.y) * rect.w + (x - rect.x)) * 4
      for (let k = 0; k < 3; k++) {
        out[o + k] = a === 1 ? patch.data[p + k] : Math.round(original.data[o + k] * (1 - a) + patch.data[p + k] * a)
      }
    }
  }
  return { data: out, width: original.width, height: original.height }
}
