import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAX_PIXELS, MAX_SIDE } from '../core/budget'
import { InpaintError, type RGBAImage } from '../core/types'
import { createInpaintClient } from '../worker/client'
import type { DeviceEvent } from '../worker/protocol'
import { DeviceBadge } from './DeviceBadge'
import { Editor } from './Editor'
import { bitmapToRGBA, decodeBitmap, fitWithinBudget } from './image'

type Oversize = { blob: Blob; fit: { width: number; height: number }; width: number; height: number }

const params = new URLSearchParams(location.search)

const SENTENCES: Record<string, string> = {
  TOO_LARGE: `This image is larger than ${MAX_SIDE}px on its long side or ${MAX_PIXELS.toLocaleString('en-US')} pixels.`,
  BAD_INPUT: 'This file could not be read as an image.',
  HASH_MISMATCH: 'The downloaded model did not match its checksum, so it was not used.',
  DOWNLOAD_FAILED: 'The model could not be downloaded. Check your connection and try again.',
  UNSUPPORTED: 'This browser cannot run the model on WebGPU or WASM.',
  OOM: 'The device ran out of memory. Try a smaller image or a smaller selection.',
  CANCELLED: 'This job was replaced by a newer one.',
  EMPTY_MASK: 'Paint over the object you want to remove first.',
  INTERNAL: 'Something went wrong while running the model.',
}

export function describeError(e: unknown): { code: string; text: string } {
  const code = e instanceof InpaintError ? e.code : 'INTERNAL'
  const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
  return { code, text: `${SENTENCES[code] ?? SENTENCES.INTERNAL}${code === 'INTERNAL' || code === 'DOWNLOAD_FAILED' ? detail : ''}` }
}

export function App() {
  const client = useMemo(() => createInpaintClient(), [])
  const [device, setDevice] = useState<DeviceEvent | null>(null)
  const [image, setImage] = useState<RGBAImage | null>(null)
  const [error, setError] = useState<{ code: string; text: string } | null>(null)
  const [oversize, setOversize] = useState<Oversize | null>(null)
  const [dragging, setDragging] = useState(false)
  const forceWasm = params.get('ep') === 'wasm'

  useEffect(() => {
    void client.probe().then(setDevice)
  }, [client])

  const loadBlob = useCallback(async (blob: Blob, size?: { width: number; height: number }) => {
    setError(null)
    setOversize(null)
    try {
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
        <DeviceBadge device={device} forceWasm={forceWasm} last={null} />
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
        <Editor image={image} />
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
