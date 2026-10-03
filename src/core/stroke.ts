import type { Mask } from './types'

export type Point = { x: number; y: number }

function stamp(mask: Mask, cx: number, cy: number, radius: number, value: number): void {
  const x0 = Math.max(0, Math.floor(cx - radius))
  const x1 = Math.min(mask.width - 1, Math.ceil(cx + radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const y1 = Math.min(mask.height - 1, Math.ceil(cy + radius))
  const r2 = radius * radius
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) mask.data[y * mask.width + x] = value
    }
  }
}

export function paintStroke(mask: Mask, from: Point, to: Point, radius: number, value: 0 | 1): void {
  const step = Math.max(1, radius / 2)
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const n = Math.max(1, Math.ceil(dist / step))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    stamp(mask, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius, value)
  }
}
