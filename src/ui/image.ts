import { MAX_SIDE } from '../core/budget'
import type { RGBAImage } from '../core/types'

export function fitWithinBudget(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= MAX_SIDE) return { width, height }
  const k = MAX_SIDE / long
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

// Reads width/height from the file header (PNG, JPEG, WebP) so an oversized photo can be refused before any pixel is decoded.
export function sniffImageSize(b: Uint8Array): { width: number; height: number } | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1]
  const u32be = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
  const ascii = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0))
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 'PNG') && ascii(12, 'IHDR')) return { width: u32be(16), height: u32be(20) }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      if (marker === 0xff) {
        i++
        continue
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2
        continue
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return { height: u16be(i + 5), width: u16be(i + 7) }
      i += 2 + u16be(i + 2)
    }
    return null
  }
  if (b.length >= 30 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    if (ascii(12, 'VP8X')) return { width: u24le(24) + 1, height: u24le(27) + 1 }
    if (ascii(12, 'VP8L')) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (ascii(12, 'VP8 ')) return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff }
  }
  return null
}

export async function sniffBlobSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  // JPEG headers can carry large EXIF/ICC segments before the frame header, so read a generous prefix
  return sniffImageSize(new Uint8Array(await blob.slice(0, 1 << 20).arrayBuffer()))
}

const DECODE_OPTS = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' } as const

export function decodeBitmap(blob: Blob, size?: { width: number; height: number }): Promise<ImageBitmap> {
  return createImageBitmap(
    blob,
    size ? { ...DECODE_OPTS, resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' } : DECODE_OPTS,
  )
}

export function bitmapToRGBA(bitmap: ImageBitmap): RGBAImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  const d = ctx.getImageData(0, 0, bitmap.width, bitmap.height, { colorSpace: 'srgb' })
  return { data: d.data, width: d.width, height: d.height }
}

export function paintRGBA(canvas: HTMLCanvasElement, img: RGBAImage): void {
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, 0)
}

export async function rgbaToPngBlob(img: RGBAImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height)
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
}
