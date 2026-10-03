import { InpaintError } from './types'

export const MAX_SIDE = 4096
export const MAX_PIXELS = 16_777_216

export function checkImageBudget(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new InpaintError('BAD_INPUT', `invalid image size ${width}x${height}`)
  if (Math.max(width, height) > MAX_SIDE || width * height > MAX_PIXELS)
    throw new InpaintError('TOO_LARGE', `image ${width}x${height} exceeds ${MAX_SIDE}px side / ${MAX_PIXELS} pixels`)
}
