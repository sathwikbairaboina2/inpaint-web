import { describe, expect, it } from 'vitest'
import { fitWithinBudget, sniffImageSize } from '../src/ui/image'

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

function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, w)
  new DataView(b.buffer).setUint32(20, h)
  return b
}

describe('sniffImageSize', () => {
  it('reads PNG IHDR', () => expect(sniffImageSize(png(8000, 6000))).toEqual({ width: 8000, height: 6000 }))
  it('reads JPEG SOF0 after an APP0 segment', () => {
    const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x17, 0x70, 0x1f, 0x40, 3])
    expect(sniffImageSize(b)).toEqual({ width: 8000, height: 6000 })
  })
  it('reads WebP VP8X (24-bit minus-one sizes)', () => {
    const b = new Uint8Array(30)
    b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58])
    b.set([0x3f, 0x1f, 0], 24)
    b.set([0x6f, 0x17, 0], 27)
    expect(sniffImageSize(b)).toEqual({ width: 8000, height: 6000 })
  })
  it('returns null for unknown bytes', () => expect(sniffImageSize(new Uint8Array(40))).toBeNull())
})
