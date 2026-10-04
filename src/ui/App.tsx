import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAX_PIXELS, MAX_SIDE } from '../core/budget'
import { InpaintError, type RGBAImage } from '../core/types'
import { createInpaintClient } from '../worker/client'
import type { DeviceEvent } from '../worker/protocol'
import { DeviceBadge, type LastRun } from './DeviceBadge'
import { Editor } from './Editor'
import { describeError } from './errors'
import { bitmapToRGBA, decodeBitmap, fitWithinBudget, sniffBlobSize } from './image'

type Oversize = { blob: Blob; fit: { width: number; height: number }; width: number; height: number }

const params = new URLSearchParams(location.search)

export function App() {
  const client = useMemo(() => createInpaintClient(), [])
  const [device, setDevice] = useState<DeviceEvent | null>(null)
  const [image, setImage] = useState<RGBAImage | null>(null)
  const [error, setError] = useState<{ code: string; text: string } | null>(null)
  const [oversize, setOversize] = useState<Oversize | null>(null)
  const [dragging, setDragging] = useState(false)
  const [last, setLast] = useState<LastRun | null>(null)
  const [forceWasm, setForceWasm] = useState(params.get('ep') === 'wasm')

  useEffect(() => {
    client.probe().then(setDevice, (e) => setError(describeError(e)))
  }, [client])

  const loadBlob = useCallback(async (blob: Blob, size?: { width: number; height: number }) => {
    setError(null)
    setOversize(null)
    try {
      if (!size) {
        // refuse an oversized photo from its header, before allocating width x height x 4 bytes
        const head = await sniffBlobSize(blob)
        if (head && (Math.max(head.width, head.height) > MAX_SIDE || head.width * head.height > MAX_PIXELS)) {
          setError(describeError(new InpaintError('TOO_LARGE', 'too large')))
          setOversize({ blob, fit: fitWithinBudget(head.width, head.height), width: head.width, height: head.height })
          return
        }
      }
      const bitmap = await decodeBitmap(blob, size)
      try {
        if (!size && (Math.max(bitmap.width, bitmap.height) > MAX_SIDE || bitmap.width * bitmap.height > MAX_PIXELS)) {
          setError(describeError(new InpaintError('TOO_LARGE', 'too large')))
          setOversize({ blob, fit: fitWithinBudget(bitmap.width, bitmap.height), width: bitmap.width, height: bitmap.height })
          return
        }
        setImage(bitmapToRGBA(bitmap))
      } finally {
        bitmap.close()
      }
    } catch (e) {
      setError(describeError(e instanceof InpaintError ? e : new InpaintError('BAD_INPUT', 'decode failed')))
    }
  }, [])

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch('/samples/aldrin.jpg')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadBlob(await res.blob())
    } catch (e) {
      setError(describeError(new InpaintError('DOWNLOAD_FAILED', e instanceof Error ? e.message : 'sample failed')))
    }
  }, [loadBlob])

  useEffect(() => {
    if (params.get('sample') === '1') void loadSample()
  }, [loadSample])

  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const file = Array.from(ev.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) void loadBlob(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadBlob])

  const onFile = (file: File | undefined) => {
    if (file) void loadBlob(file)
  }

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">Inpaint Web</h1>
        <div className="row">
          <label className="hint">
            <input
              data-testid="force-wasm"
              type="checkbox"
              checked={forceWasm}
              onChange={(e) => setForceWasm(e.target.checked)}
            />{' '}
            Force WASM
          </label>
          <DeviceBadge device={device} forceWasm={forceWasm} last={last} />
        </div>
      </header>

      {error && (
        <div className="error" data-testid="error" role="alert">
          <strong>{error.code}</strong> {error.text}
          {oversize && (
            <button className="btn" onClick={() => void loadBlob(oversize.blob, oversize.fit)}>
              Downscale to {oversize.fit.width}x{oversize.fit.height}
            </button>
          )}
        </div>
      )}

      {image ? (
        <Editor client={client} image={image} forceWasm={forceWasm} onLast={setLast} onApply={setImage} />
      ) : (
        <main
          className={`drop${dragging ? ' drag' : ''}`}
          data-testid="drop-zone"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            onFile(e.dataTransfer.files[0])
          }}
        >
          <h2>Remove objects from photos, on your device.</h2>
          <p>Drop an image, paste one, or pick a file. Nothing is uploaded.</p>
          <div className="row">
            <label className="btn primary">
              Choose image
              <input
                data-testid="file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <button className="btn" data-testid="sample-button" onClick={() => void loadSample()}>
              Try sample photo
            </button>
          </div>
        </main>
      )}
    </div>
  )
}
