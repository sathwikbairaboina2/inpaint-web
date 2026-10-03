import { MAX_SIDE } from '../core/budget'
import type { RGBAImage } from '../core/types'

export function fitWithinBudget(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= MAX_SIDE) return { width, height }
  const k = MAX_SIDE / long
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
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
