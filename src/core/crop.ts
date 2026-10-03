import type { Rect } from './types'

export type CropOptions = { margin?: number; minSide?: number }

function axis(start: number, len: number, S: number, size: number): [number, number] {
  if (S >= size) return [0, size]
  const s = Math.floor(start + len / 2 - S / 2)
  return [Math.min(Math.max(s, 0), size - S), S]
}

export function planCrop(bbox: Rect, imgW: number, imgH: number, opts: CropOptions = {}): Rect {
  const margin = opts.margin ?? 64
  const minSide = opts.minSide ?? 256
  const S = Math.max(Math.max(bbox.w, bbox.h) + 2 * margin, minSide)
  const [x, w] = axis(bbox.x, bbox.w, S, imgW)
  const [y, h] = axis(bbox.y, bbox.h, S, imgH)
  return { x, y, w, h }
}
