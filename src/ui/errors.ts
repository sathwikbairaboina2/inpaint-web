import { MAX_PIXELS, MAX_SIDE } from '../core/budget'
import { InpaintError } from '../core/types'

const SENTENCES: Record<string, string> = {
  TOO_LARGE: `This image is larger than ${MAX_SIDE}px on its long side or ${MAX_PIXELS.toLocaleString('en-US')} pixels.`,
  BAD_INPUT: 'This file could not be read as an image.',
  HASH_MISMATCH: 'The downloaded model did not match its checksum, so it was not used.',
  DOWNLOAD_FAILED: 'The model could not be downloaded. Check your connection and try again.',
  UNSUPPORTED: 'This browser cannot run the model on WebGPU or WASM.',
  OOM: 'The device ran out of memory. Try a smaller image or a smaller selection.',
  CANCELLED: 'This job was replaced by a newer one.',
  EMPTY_MASK: 'Paint over the object you want to remove first.',
  INTERNAL: 'Something went wrong while running the model.',
}

export function describeError(e: unknown): { code: string; text: string } {
  const code = e instanceof InpaintError ? e.code : 'INTERNAL'
  const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
  return { code, text: `${SENTENCES[code] ?? SENTENCES.INTERNAL}${code === 'INTERNAL' || code === 'DOWNLOAD_FAILED' ? detail : ''}` }
}

