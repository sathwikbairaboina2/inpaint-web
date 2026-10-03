import { describe, expect, it } from 'vitest'
import { median, percentile, summarize } from '../src/core/stats'

describe('stats', () => {
  it('percentile is nearest-rank', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9)
    expect(percentile([5], 90)).toBe(5)
  })
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('summarize', () => {
    expect(summarize([4, 1, 3, 2])).toEqual({ n: 4, min: 1, median: 2.5, p90: 4, max: 4, mean: 2.5 })
  })
  it('empty input throws BAD_INPUT', () => {
    expect(() => summarize([])).toThrow()
    expect(() => median([])).toThrow()
    try {
      summarize([])
    } catch (e) {
      expect((e as { code: string }).code).toBe('BAD_INPUT')
    }
  })
})
