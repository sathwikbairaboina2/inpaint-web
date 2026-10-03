import type { Engine } from '../core/engine'
import { JobQueue } from '../core/queue'
import { InpaintError } from '../core/types'
import type { DeviceEvent, InpaintRequest, JobEvent, JobRequest } from './protocol'

export type HandlerDeps = {
  engine: Pick<Engine, 'inpaint'>
  post: (event: JobEvent, transfer?: Transferable[]) => void
  probe: () => Promise<DeviceEvent>
}

export function createHandler({ engine, post, probe }: HandlerDeps) {
  const run = async (req: InpaintRequest): Promise<void> => {
    const image = { data: new Uint8ClampedArray(req.rgba), width: req.width, height: req.height }
    const mask = { data: new Uint8Array(req.mask), width: req.width, height: req.height }
    const result = await engine.inpaint(image, mask, {
      forceWasm: req.forceWasm,
      onProgress: (p) => post({ kind: 'progress', jobId: req.jobId, ...p }),
    })
    const rgba = result.image.data.buffer as ArrayBuffer
    post(
      {
        kind: 'result',
        jobId: req.jobId,
        width: result.image.width,
        height: result.image.height,
        rgba,
        ep: result.ep,
        fallbackReason: result.fallbackReason,
        adapterInfo: result.adapterInfo,
        timings: result.timings,
      },
      [rgba],
    )
  }

  const queue = new JobQueue<InpaintRequest, void>(run)

  const fail = (jobId: string, e: unknown) => {
    const err = e instanceof InpaintError ? e : new InpaintError('INTERNAL', e instanceof Error ? e.message : String(e))
    post({ kind: 'error', jobId, code: err.code, message: err.message })
  }

  return async function onMessage(req: JobRequest): Promise<void> {
    if (req.kind === 'probe') {
      post(await probe())
      return
    }
    try {
      await queue.submit(req.jobId, req)
    } catch (e) {
      fail(req.jobId, e)
    }
  }
}
