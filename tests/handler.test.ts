import { describe, expect, it } from 'vitest'
import type { InpaintResult } from '../src/core/engine'
import { InpaintError } from '../src/core/types'
import { createHandler } from '../src/worker/handler'
import type { InpaintRequest, JobEvent } from '../src/worker/protocol'

const timings = { loadMs: 0, sessionMs: 0, preMs: 0, runMs: 0, postMs: 0, totalMs: 0 }

function req(jobId: string): InpaintRequest {
  return { kind: 'inpaint', jobId, width: 2, height: 1, rgba: new Uint8Array(8).buffer, mask: new Uint8Array([1, 0]).buffer, forceWasm: false }
}

function setup(inpaint: (n: number) => Promise<InpaintResult> | InpaintResult) {
  const events: { event: JobEvent; transfer?: Transferable[] }[] = []
  let n = 0
  const handler = createHandler({
    engine: { inpaint: async () => inpaint(++n) },
    post: (event, transfer) => events.push({ event, transfer }),
    probe: async () => ({ kind: 'device', webgpu: false, threads: 1, crossOriginIsolated: false }),
  })
  return { events, handler }
}

const okResult = (): InpaintResult => ({
  image: { data: new Uint8ClampedArray(8), width: 2, height: 1 },
  ep: 'wasm',
  fallbackReason: 'forced',
  timings,
})

describe('handler', () => {
  it('result event carries the jobId and lists the result buffer as transferable', async () => {
    const { events, handler } = setup(okResult)
    await handler(req('j1'))
    const r = events.find((e) => e.event.kind === 'result')!
    expect(r.event).toMatchObject({ kind: 'result', jobId: 'j1', ep: 'wasm', fallbackReason: 'forced' })
    const buf = (r.event as { rgba: ArrayBuffer }).rgba
    expect(r.transfer).toEqual([buf])
  })

  it('InpaintError becomes an error event with its code', async () => {
    const { events, handler } = setup(() => Promise.reject(new InpaintError('TOO_LARGE', 'big')))
    await handler(req('j1'))
    expect(events.at(-1)!.event).toEqual({ kind: 'error', jobId: 'j1', code: 'TOO_LARGE', message: 'big' })
  })

  it('plain Error becomes INTERNAL', async () => {
    const { events, handler } = setup(() => Promise.reject(new Error('oops')))
    await handler(req('j1'))
    expect(events.at(-1)!.event).toMatchObject({ kind: 'error', code: 'INTERNAL', message: 'oops' })
  })

  it('a third job cancels the pending second job, never the running first', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { events, handler } = setup(async (n) => {
      if (n === 1) await gate
      return okResult()
    })
    const a = handler(req('a'))
    const b = handler(req('b'))
    const c = handler(req('c'))
    await b
    expect(events.find((e) => e.event.kind === 'error')!.event).toMatchObject({ jobId: 'b', code: 'CANCELLED' })
    release()
    await Promise.all([a, c])
    const results = events.filter((e) => e.event.kind === 'result').map((e) => (e.event as { jobId: string }).jobId)
    expect(results).toEqual(['a', 'c'])
  })

  it('probe answers with a device event', async () => {
    const { events, handler } = setup(okResult)
    await handler({ kind: 'probe' })
    expect(events[0].event).toMatchObject({ kind: 'device', webgpu: false })
  })
})
