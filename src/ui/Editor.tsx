import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeError } from './errors'
import type { LastRun } from './DeviceBadge'
import type { Mask, Progress, Rect, RGBAImage, Timings } from '../core/types'
import type { InpaintClient } from '../worker/client'
import { MaskCanvas, type Tool } from './MaskCanvas'
import { ProgressBar } from './ProgressBar'
import { paintRGBA } from './image'

export type RunSummary = { ep: 'webgpu' | 'wasm'; fallbackReason?: string; timings: Timings }

declare global {
  interface Window {
    __inpaint?: {
      setMask(rects: Rect[]): void
      run(): Promise<RunSummary>
      getOriginal(): RGBAImage
      getResult(): RGBAImage | null
    }
  }
}

type Props = {
  client: InpaintClient
  image: RGBAImage
  forceWasm: boolean
  onLast: (last: LastRun) => void
}

const MAX_UNDO = 20

export function Editor({ client, image, forceWasm, onLast }: Props) {
  const base = useRef<HTMLCanvasElement>(null)
  const mask = useMemo<Mask>(() => ({ data: new Uint8Array(image.width * image.height), width: image.width, height: image.height }), [image])
  const undoStack = useRef<Uint8Array[]>([])
  const [rev, setRev] = useState(0)
  const [hasMask, setHasMask] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [tool, setTool] = useState<Tool>('brush')
  const [radius, setRadius] = useState(32)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<RGBAImage | null>(null)
  const [error, setError] = useState<{ code: string; text: string } | null>(null)

  const latest = useRef({ image, result, forceWasm, mask })
  latest.current = { image, result, forceWasm, mask }

  useEffect(() => {
    setResult(null)
    undoStack.current = []
    setUndoCount(0)
    setHasMask(false)
    setRev((r) => r + 1)
  }, [image])

  useEffect(() => {
    if (base.current) paintRGBA(base.current, result ?? image)
  }, [image, result])

  const scan = useCallback(() => setHasMask(mask.data.some((v) => v === 1)), [mask])

  const run = useCallback(async (): Promise<RunSummary> => {
    const cur = latest.current
    setRunning(true)
    setError(null)
    setProgress({ phase: 'pre', done: 0, total: 1 })
    try {
      const r = await client.inpaint(cur.image, cur.mask, { forceWasm: cur.forceWasm, onProgress: setProgress })
      setResult(r.image)
      latest.current.result = r.image
      onLast({ ep: r.ep, fallbackReason: r.fallbackReason, adapterInfo: r.adapterInfo })
      return { ep: r.ep, fallbackReason: r.fallbackReason, timings: r.timings }
    } catch (e) {
      setError(describeError(e))
      throw e
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }, [client, onLast])

  useEffect(() => {
    window.__inpaint = {
      setMask(rects) {
        const m = latest.current.mask
        m.data.fill(0)
        for (const r of rects) {
          for (let y = Math.max(0, r.y); y < Math.min(m.height, r.y + r.h); y++) {
            for (let x = Math.max(0, r.x); x < Math.min(m.width, r.x + r.w); x++) m.data[y * m.width + x] = 1
          }
        }
        setRev((v) => v + 1)
        setHasMask(m.data.some((v) => v === 1))
      },
      run,
      getOriginal: () => latest.current.image,
      getResult: () => latest.current.result,
    }
    return () => {
      delete window.__inpaint
    }
  }, [run])

  const onStrokeStart = () => {
    undoStack.current.push(mask.data.slice())
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    setUndoCount(undoStack.current.length)
  }

  const undo = () => {
    const prev = undoStack.current.pop()
    if (!prev) return
    mask.data.set(prev)
    setUndoCount(undoStack.current.length)
    setRev((r) => r + 1)
    scan()
  }

  const clear = () => {
    if (hasMask) onStrokeStart()
    mask.data.fill(0)
    setRev((r) => r + 1)
    setHasMask(false)
  }

  return (
    <main className="editor">
      <div className="toolbar">
        <button className={`btn${tool === 'brush' ? ' active' : ''}`} data-testid="tool-brush" onClick={() => setTool('brush')} aria-pressed={tool === 'brush'}>
          Brush
        </button>
        <button className={`btn${tool === 'eraser' ? ' active' : ''}`} data-testid="tool-eraser" onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'}>
          Eraser
        </button>
        <label>
          Size
          <input
            data-testid="brush-size"
            type="range"
            min={4}
            max={128}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label="Brush size"
          />
          <span>{radius}px</span>
        </label>
        <button className="btn" data-testid="undo" onClick={undo} disabled={undoCount === 0 || running}>
          Undo
        </button>
        <button className="btn" data-testid="clear-mask" onClick={clear} disabled={!hasMask || running}>
          Clear
        </button>
        <span className="spacer" />
        <button className="btn primary" data-testid="remove-button" onClick={() => void run().catch(() => {})} disabled={!hasMask || running}>
          Remove object
        </button>
      </div>
      {progress && <ProgressBar progress={progress} />}
      {error && (
        <div className="error" data-testid="error" role="alert">
          <strong>{error.code}</strong> {error.text}
        </div>
      )}
      <div className="stage">
        <canvas ref={base} className="base" />
        <MaskCanvas mask={mask} rev={rev} tool={tool} radius={radius} disabled={running} onStrokeStart={onStrokeStart} onStrokeEnd={scan} />
      </div>
      <p className="hint">Paint over what you want gone, then press Remove object. Pixels outside your paint are never changed.</p>
    </main>
  )
}
