import { describe, expect, it } from 'vitest'
import { fitWithinBudget } from '../src/ui/image'

describe('fitWithinBudget', () => {
  it('downscales the long side to 4096', () => {
    expect(fitWithinBudget(5000, 2500)).toEqual({ width: 4096, height: 2048 })
    expect(fitWithinBudget(2500, 5000)).toEqual({ width: 2048, height: 4096 })
  })
  it('leaves in-budget sizes unchanged', () => {
    expect(fitWithinBudget(4096, 4096)).toEqual({ width: 4096, height: 4096 })
    expect(fitWithinBudget(100, 100)).toEqual({ width: 100, height: 100 })
  })
})
