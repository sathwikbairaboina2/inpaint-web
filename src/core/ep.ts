import { InpaintError, type EpName } from './types'

export type AdapterLike = {
  limits?: { maxBufferSize?: number }
  info?: { vendor?: string; architecture?: string }
}
export type GpuLike = { requestAdapter(): Promise<AdapterLike | null> }

export type Selection<S> = { ep: EpName; session: S; reason?: string; adapterInfo?: string }

export function wasmThreads(crossOriginIsolated: boolean, hardwareConcurrency: number): number {
  if (!crossOriginIsolated) return 1
  return Math.min(Math.max(Math.floor(hardwareConcurrency) || 1, 1), 16)
}

function describeAdapter(adapter: AdapterLike): string | undefined {
  const parts = [adapter.info?.vendor, adapter.info?.architecture].filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
}

export async function selectProvider<S>(opts: {
  gpu: GpuLike | undefined
  forceWasm: boolean
  minBufferBytes: number
  createSession: (ep: EpName) => Promise<S>
}): Promise<Selection<S>> {
  const wasm = async (reason: string, adapterInfo?: string): Promise<Selection<S>> => {
    try {
      return { ep: 'wasm', session: await opts.createSession('wasm'), reason, adapterInfo }
    } catch (e) {
      throw new InpaintError('UNSUPPORTED', `no execution provider available: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (opts.forceWasm) return wasm('forced')
  if (!opts.gpu) return wasm('no-webgpu-api')

  let adapter: AdapterLike | null
  try {
    adapter = await opts.gpu.requestAdapter()
  } catch {
    adapter = null
  }
  if (!adapter) return wasm('no-adapter')

  const info = describeAdapter(adapter)
  if ((adapter.limits?.maxBufferSize ?? 0) < opts.minBufferBytes) return wasm('limits', info)

  try {
    return { ep: 'webgpu', session: await opts.createSession('webgpu'), adapterInfo: info }
  } catch (e) {
    return wasm(`session-error: ${e instanceof Error ? e.message : String(e)}`, info)
  }
}
