import { InpaintError } from './types'

export type Summary = { n: number; min: number; median: number; p90: number; max: number; mean: number }

function sorted(xs: number[]): number[] {
  if (xs.length === 0) throw new InpaintError('BAD_INPUT', 'stats of an empty sample')
  return [...xs].sort((a, b) => a - b)
}

export function percentile(xs: number[], p: number): number {
  const s = sorted(xs)
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)]
}

export function median(xs: number[]): number {
  const s = sorted(xs)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function summarize(xs: number[]): Summary {
  const s = sorted(xs)
  return {
    n: s.length,
    min: s[0],
    median: median(s),
    p90: percentile(s, 90),
    max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
  }
}
