import type { EpName, ErrorCode, Phase, Timings } from '../core/types'

export type InpaintRequest = {
  kind: 'inpaint'
  jobId: string
  width: number
  height: number
  rgba: ArrayBuffer
  mask: ArrayBuffer
  forceWasm: boolean
}
export type ProbeRequest = { kind: 'probe' }
export type JobRequest = InpaintRequest | ProbeRequest

export type ProgressEvent = { kind: 'progress'; jobId: string; phase: Phase; done: number; total: number }
export type ResultEvent = {
  kind: 'result'
  jobId: string
  width: number
  height: number
  rgba: ArrayBuffer
  ep: EpName
  fallbackReason?: string
  adapterInfo?: string
  timings: Timings
}
export type ErrorEvent = { kind: 'error'; jobId: string; code: ErrorCode; message: string }
export type DeviceEvent = {
  kind: 'device'
  webgpu: boolean
  adapter?: string
  threads: number
  crossOriginIsolated: boolean
}
export type JobEvent = ProgressEvent | ResultEvent | ErrorEvent | DeviceEvent
