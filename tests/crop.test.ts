import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { planCrop } from '../src/core/crop'

describe('planCrop', () => {
  it.each([
    [{ x: 500, y: 500, w: 100, h: 50 }, 2000, 2000, { x: 422, y: 397, w: 256, h: 256 }],
    [{ x: 0, y: 0, w: 10, h: 10 }, 1000, 1000, { x: 0, y: 0, w: 256, h: 256 }],
    [{ x: 50, y: 50, w: 20, h: 20 }, 200, 300, { x: 0, y: 0, w: 200, h: 256 }],
    [{ x: 100, y: 100, w: 1000, h: 600 }, 4000, 3000, { x: 36, y: 0, w: 1128, h: 1128 }],
    [{ x: 990, y: 790, w: 10, h: 10 }, 1000, 800, { x: 744, y: 544, w: 256, h: 256 }],
  ])('bbox %j in %ix%i', (bbox, w, h, expected) => {
    expect(planCrop(bbox, w, h)).toEqual(expected)
  })

  it('contains bbox, lies inside image, has the expected size (property)', () => {
    const arb = fc
      .tuple(fc.integer({ min: 1, max: 4096 }), fc.integer({ min: 1, max: 4096 }))
      .chain(([iw, ih]) =>
        fc
          .tuple(fc.integer({ min: 0, max: iw - 1 }), fc.integer({ min: 0, max: ih - 1 }))
          .chain(([x, y]) =>
            fc
              .tuple(fc.integer({ min: 1, max: iw - x }), fc.integer({ min: 1, max: ih - y }))
              .map(([w, h]) => ({ iw, ih, bbox: { x, y, w, h } })),
          ),
      )
    fc.assert(
      fc.property(arb, ({ iw, ih, bbox }) => {
        const c = planCrop(bbox, iw, ih)
        const S = Math.max(Math.max(bbox.w, bbox.h) + 128, 256)
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(iw)
        expect(c.y + c.h).toBeLessThanOrEqual(ih)
        expect(c.x).toBeLessThanOrEqual(bbox.x)
        expect(c.y).toBeLessThanOrEqual(bbox.y)
        expect(c.x + c.w).toBeGreaterThanOrEqual(bbox.x + bbox.w)
        expect(c.y + c.h).toBeGreaterThanOrEqual(bbox.y + bbox.h)
        expect(c.w).toBe(Math.min(S, iw))
        expect(c.h).toBe(Math.min(S, ih))
      }),
    )
  })
})
