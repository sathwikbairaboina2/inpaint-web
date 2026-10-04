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

export type Round = { webgpu: EpResult | null; wasm: EpResult }

export type BenchResult = {
  runs: number
  rounds: Round[]
  image: { width: number; height: number }
  hole: { x: number; y: number; w: number; h: number }
  userAgent: string
  hardwareConcurrency: number
  crossOriginIsolated: boolean
  adapter: string | null
  gpuDescription: string | null
}

const params = new URLSearchParams(location.search)
const runs = Math.max(1, Number(params.get('runs') ?? 20))
const rounds = Math.max(1, Number(params.get('rounds') ?? 5))
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
  // each round measures webgpu and wasm back to back, alternating which goes first, so a change in host load
  // hits both EPs of a round and the per-round ratio stays meaningful
  const all: Round[] = []
  let adapter: string | null = null
  for (let i = 0; i < rounds; i++) {
    let gpu: Awaited<ReturnType<typeof measure>>
    let wasm: Awaited<ReturnType<typeof measure>>
    if (i % 2 === 0) {
      gpu = await measure('webgpu')
      wasm = await measure('wasm')
    } else {
      wasm = await measure('wasm')
      gpu = await measure('webgpu')
    }
    adapter ??= gpu.adapter
    all.push({ webgpu: gpu.result, wasm: wasm.result! })
  }
  const result: BenchResult = {
    runs,
    rounds: all,
    image: { width: SIZE, height: SIZE },
    hole: HOLE,
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated: self.crossOriginIsolated,
    adapter,
    gpuDescription: await gpuDescription(),
  }
  ;(window as unknown as { __benchResult: BenchResult }).__benchResult = result
  const rows = all
    .flatMap((r, i) => [r.webgpu, r.wasm].map((x) => [i + 1, x] as const))
    .filter((p): p is readonly [number, EpResult] => !!p[1])
    .map(([n, r]) => `<tr><td>${n} ${r.ep}</td><td>${r.threads}</td><td>${r.sessionMs.toFixed(0)}</td><td>${r.run.median.toFixed(1)}</td><td>${r.run.p90.toFixed(1)}</td></tr>`)
    .join('')
  document.getElementById('out')!.innerHTML =
    `<table><tr><th>round ep</th><th>threads</th><th>session ms</th><th>run median ms</th><th>run p90 ms</th></tr>${rows}</table>`
}

void main().catch((e) => {
  document.getElementById('out')!.textContent = `bench failed: ${e}`
  ;(window as unknown as { __benchError: string }).__benchError = String(e)
})
