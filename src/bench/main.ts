import { summarize, type Summary } from '../core/stats'
import { createInpaintClient } from '../worker/client'
import { rectMask, syntheticImage } from './synthetic'

export type EpResult = {
  ep: 'webgpu' | 'wasm'
  threads: number
  sessionMs: number
  run: Summary
  total: Summary
}

export type BenchResult = {
  runs: number
  image: { width: number; height: number }
  hole: { x: number; y: number; w: number; h: number }
  userAgent: string
  hardwareConcurrency: number
  crossOriginIsolated: boolean
  adapter: string | null
  gpuDescription: string | null
  webgpu: EpResult | null
  wasm: EpResult
}

const params = new URLSearchParams(location.search)
const runs = Math.max(1, Number(params.get('runs') ?? 20))
const SIZE = 512
const HOLE = { x: 192, y: 192, w: 128, h: 128 }

async function measure(ep: 'webgpu' | 'wasm'): Promise<{ result: EpResult | null; adapter: string | null }> {
  const client = createInpaintClient()
  try {
    const device = await client.probe()
    if (ep === 'webgpu' && !device.webgpu) return { result: null, adapter: null }
    const image = syntheticImage(SIZE, SIZE)
    const mask = rectMask(SIZE, SIZE, HOLE)
    const forceWasm = ep === 'wasm'
    const warm = await client.inpaint(image, mask, { forceWasm })
    if (warm.ep !== ep) return { result: null, adapter: device.adapter ?? null }
    const run: number[] = []
    const total: number[] = []
    for (let i = 0; i < runs; i++) {
      const r = await client.inpaint(image, mask, { forceWasm })
      run.push(r.timings.runMs)
      total.push(r.timings.totalMs)
    }
    return {
      result: {
        ep,
        threads: ep === 'wasm' ? device.threads : 1,
        sessionMs: warm.timings.sessionMs,
        run: summarize(run),
        total: summarize(total),
      },
      adapter: device.adapter ?? null,
    }
  } finally {
    client.terminate()
  }
}

async function gpuDescription(): Promise<string | null> {
  try {
    const a = await navigator.gpu?.requestAdapter()
    return a?.info?.description || null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const gpu = await measure('webgpu')
  const wasm = await measure('wasm')
  const result: BenchResult = {
    runs,
    image: { width: SIZE, height: SIZE },
    hole: HOLE,
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated: self.crossOriginIsolated,
    adapter: gpu.adapter,
    gpuDescription: await gpuDescription(),
    webgpu: gpu.result,
    wasm: wasm.result!,
  }
  ;(window as unknown as { __benchResult: BenchResult }).__benchResult = result
  const rows = [result.webgpu, result.wasm]
    .filter((r): r is EpResult => !!r)
    .map((r) => `<tr><td>${r.ep}</td><td>${r.threads}</td><td>${r.sessionMs.toFixed(0)}</td><td>${r.run.median.toFixed(1)}</td><td>${r.run.p90.toFixed(1)}</td></tr>`)
    .join('')
  document.getElementById('out')!.innerHTML =
    `<table><tr><th>ep</th><th>threads</th><th>session ms</th><th>run median ms</th><th>run p90 ms</th></tr>${rows}</table>`
}

void main().catch((e) => {
  document.getElementById('out')!.textContent = `bench failed: ${e}`
  ;(window as unknown as { __benchError: string }).__benchError = String(e)
})
