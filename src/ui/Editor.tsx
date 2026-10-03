import { useEffect, useRef } from 'react'
import type { RGBAImage } from '../core/types'
import { paintRGBA } from './image'

export function Editor({ image }: { image: RGBAImage }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) paintRGBA(canvas.current, image)
  }, [image])
  return (
    <main className="editor">
      <div className="stage">
        <canvas ref={canvas} className="base" />
      </div>
    </main>
  )
}
