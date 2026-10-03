import { describe, expect, it } from 'vitest'
import { checkImageBudget, MAX_PIXELS, MAX_SIDE } from '../src/core/budget'

function code(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    return (e as { code: string }).code
  }
  return 'ok'
}

describe('checkImageBudget', () => {
  it('constants', () => {
    expect(MAX_SIDE).toBe(4096)
    expect(MAX_PIXELS).toBe(16_777_216)
  })
  it('accepts 4096x4096 (exactly the pixel limit)', () => {
    expect(4096 * 4096).toBe(MAX_PIXELS)
    expect(code(() => checkImageBudget(4096, 4096))).toBe('ok')
  })
  it.each([
    [4097, 1],
    [1, 4097],
    [4096, 4097],
  ])('rejects %i x %i with TOO_LARGE', (w, h) => {
    expect(code(() => checkImageBudget(w, h))).toBe('TOO_LARGE')
  })
  it.each([
    [0, 10],
    [10.5, 10],
    [NaN, 1],
    [10, -1],
  ])('rejects %s x %s with BAD_INPUT', (w, h) => {
    expect(code(() => checkImageBudget(w, h))).toBe('BAD_INPUT')
  })
})
