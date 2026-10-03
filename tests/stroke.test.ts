import { describe, expect, it } from 'vitest'
import { paintStroke } from '../src/core/stroke'
import { makeMask } from './helpers/synthetic'

const at = (m: { data: Uint8Array; width: number }, x: number, y: number) => m.data[y * m.width + x]

describe('paintStroke', () => {
  it('covers the swept area and nothing beyond radius', () => {
    const m = makeMask(40, 20, [])
    paintStroke(m, { x: 0, y: 0 }, { x: 20, y: 0 }, 2, 1)
    for (let x = 0; x <= 20; x++) for (let y = 0; y <= 2; y++) expect(at(m, x, y)).toBe(1)
    for (let x = 0; x < 40; x++) expect(at(m, x, 3)).toBe(0)
    expect(at(m, 23, 0)).toBe(0)
  })
  it('value 0 erases', () => {
    const m = makeMask(10, 10, [{ x: 0, y: 0, w: 10, h: 10 }])
    paintStroke(m, { x: 5, y: 5 }, { x: 5, y: 5 }, 1, 0)
    expect(at(m, 5, 5)).toBe(0)
    expect(at(m, 9, 9)).toBe(1)
  })
  it('off-canvas strokes do not throw', () => {
    const m = makeMask(10, 10, [])
    expect(() => paintStroke(m, { x: -50, y: -50 }, { x: 500, y: 500 }, 5, 1)).not.toThrow()
    expect(() => paintStroke(m, { x: -50, y: -50 }, { x: -40, y: -40 }, 5, 1)).not.toThrow()
  })
})
