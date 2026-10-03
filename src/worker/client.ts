import { InpaintError, type Mask, type Progress, type RGBAImage } from '../core/types'
import type { DeviceEvent, JobEvent, ResultEvent } from './protocol'

export type ClientResult = Omit<ResultEvent, 'kind' | 'rgba' | 'width' | 'height' | 'jobId'> & { image: RGBAImage }

export type InpaintClient = {
  probe(): Promise<DeviceEvent>
  inpaint(
    image: RGBAImage,
    mask: Mask,
    opts?: { forceWasm?: boolean; onProgress?: (p: Progress) => void },
  ): Promise<ClientResult>
  terminate(): void
}

export function createInpaintClient(): InpaintClient {
  const worker = new Worker(new URL('./inference.worker.ts', import.meta.url), { type: 'module' })
  const jobs = new Map<
    string,
    { resolve: (r: ClientResult) => void; reject: (e: unknown) => void; onProgress?: (p: Progress) => void }
  >()
  let probes: ((d: DeviceEvent) => void)[] = []
  let seq = 0

  worker.onmessage = (ev: MessageEvent<JobEvent>) => {
    const e = ev.data
    if (e.kind === 'device') {
      const waiting = probes
      probes = []
      waiting.forEach((r) => r(e))
      return
    }
    const job = jobs.get(e.jobId)
    if (!job) return
    if (e.kind === 'progress') {
      job.onProgress?.({ phase: e.phase, done: e.done, total: e.total })
      return
    }
    jobs.delete(e.jobId)
    if (e.kind === 'error') {
      job.reject(new InpaintError(e.code, e.message))
      return
    }
    job.resolve({
      image: { data: new Uint8ClampedArray(e.rgba), width: e.width, height: e.height },
      ep: e.ep,
      fallbackReason: e.fallbackReason,
      adapterInfo: e.adapterInfo,
      timings: e.timings,
    })
  }

  worker.onerror = (ev) => {
    const err = new InpaintError('INTERNAL', ev.message || 'worker crashed')
    for (const j of jobs.values()) j.reject(err)
    jobs.clear()
  }

  return {
    probe() {
      return new Promise((resolve) => {
        probes.push(resolve)
        worker.postMessage({ kind: 'probe' })
      })
    },
    inpaint(image, mask, opts = {}) {
      const jobId = `job-${++seq}`
      const rgba = image.data.slice().buffer as ArrayBuffer
      const maskBuf = mask.data.slice().buffer as ArrayBuffer
      return new Promise<ClientResult>((resolve, reject) => {
        jobs.set(jobId, { resolve, reject, onProgress: opts.onProgress })
        worker.postMessage(
          { kind: 'inpaint', jobId, width: image.width, height: image.height, rgba, mask: maskBuf, forceWasm: opts.forceWasm ?? false },
          [rgba, maskBuf],
        )
      })
    },
    terminate() {
      worker.terminate()
    },
  }
}
