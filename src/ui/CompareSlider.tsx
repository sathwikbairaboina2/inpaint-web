import { useEffect, useRef, useState } from 'react'
import type { RGBAImage } from '../core/types'
import { paintRGBA } from './image'

export function CompareSlider({ before, after }: { before: RGBAImage; after: RGBAImage }) {
  const beforeRef = useRef<HTMLCanvasElement>(null)
  const afterRef = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)

  useEffect(() => {
    if (beforeRef.current) paintRGBA(beforeRef.current, before)
  }, [before])
  useEffect(() => {
    if (afterRef.current) paintRGBA(afterRef.current, after)
  }, [after])

  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div
      ref={box}
      className="compare"
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <canvas ref={beforeRef} aria-label="Before" />
      <canvas ref={afterRef} className="after" aria-label="After" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
      <div
        className="handle"
        data-testid="compare-slider"
        role="slider"
        tabIndex={0}
        aria-label="Compare before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        style={{ left: `${pos}%` }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5))
          else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5))
          else return
          e.preventDefault()
        }}
      />
    </div>
  )
}
