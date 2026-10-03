import type { Mask, Rect } from './types'

export function maskBBox(mask: Mask): Rect | null {
  const { data, width, height } = mask
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export function dilateMask(mask: Mask, r: number): Mask {
  const { data, width, height } = mask
  if (r <= 0) return { data: data.slice(), width, height }
  const tmp = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[y * width + x]) continue
      const a = Math.max(0, x - r)
      const b = Math.min(width - 1, x + r)
      for (let xx = a; xx <= b; xx++) tmp[y * width + xx] = 1
    }
  }
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!tmp[y * width + x]) continue
      const a = Math.max(0, y - r)
      const b = Math.min(height - 1, y + r)
      for (let yy = a; yy <= b; yy++) out[yy * width + x] = 1
    }
  }
  return { data: out, width, height }
}

export function cropMask(mask: Mask, rect: Rect): Mask {
  const out = new Uint8Array(rect.w * rect.h)
  for (let y = 0; y < rect.h; y++) {
    const src = (rect.y + y) * mask.width + rect.x
    out.set(mask.data.subarray(src, src + rect.w), y * rect.w)
  }
  return { data: out, width: rect.w, height: rect.h }
}

export function resizeMaskAny(mask: Mask, w: number, h: number): Mask {
  const out = new Uint8Array(w * h)
  const sx = mask.width / w
  const sy = mask.height / h
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.min(mask.height, Math.ceil((y + 1) * sy)))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.min(mask.width, Math.ceil((x + 1) * sx)))
      let hit = 0
      for (let yy = y0; yy < y1 && !hit; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          if (mask.data[yy * mask.width + xx]) {
            hit = 1
            break
          }
        }
      }
      out[y * w + x] = hit
    }
  }
  return { data: out, width: w, height: h }
}
