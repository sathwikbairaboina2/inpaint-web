export type RGBAImage = { data: Uint8ClampedArray; width: number; height: number }
export type Mask = { data: Uint8Array; width: number; height: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type EpName = 'webgpu' | 'wasm'
export type ErrorCode =
  | 'TOO_LARGE'
  | 'EMPTY_MASK'
  | 'BAD_INPUT'
  | 'HASH_MISMATCH'
  | 'DOWNLOAD_FAILED'
  | 'UNSUPPORTED'
  | 'OOM'
  | 'CANCELLED'
  | 'INTERNAL'

export class InpaintError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'InpaintError'
  }
}

export type Phase = 'download' | 'session' | 'pre' | 'run' | 'post'
export type Progress = { phase: Phase; done: number; total: number }
export type Timings = {
  loadMs: number
  sessionMs: number
  preMs: number
  runMs: number
  postMs: number
  totalMs: number
}
