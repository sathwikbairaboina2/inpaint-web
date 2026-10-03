import { useEffect, useRef } from 'react'
import { paintStroke } from '../core/stroke'
import type { Mask } from '../core/types'

export type Tool = 'brush' | 'eraser'

const ACCENT = '#c4552d'

type Props = {
  mask: Mask
  rev: number
  tool: Tool
  radius: number
  disabled: boolean
  onStrokeStart: () => void
  onStrokeEnd: () => void
}

function redraw(canvas: HTMLCanvasElement, mask: Mask): void {
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(mask.width, mask.height)
  const px = new Uint32Array(img.data.buffer)
  const color = 0xff2d55c4
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) px[i] = color
  ctx.putImageData(img, 0, 0)
}

export function MaskCanvas({ mask, rev, tool, radius, disabled, onStrokeStart, onStrokeEnd }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = mask.width
    c.height = mask.height
    redraw(c, mask)
  }, [mask, rev])

  const toImage = (e: React.PointerEvent): { x: number; y: number } => {
    const r = ref.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * mask.width, y: ((e.clientY - r.top) / r.height) * mask.height }
  }

  const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const value = tool === 'brush' ? 1 : 0
    paintStroke(mask, from, to, radius, value)
    const ctx = ref.current!.getContext('2d')!
    ctx.save()
    ctx.globalCompositeOperation = value ? 'source-over' : 'destination-out'
    ctx.strokeStyle = ACCENT
    ctx.fillStyle = ACCENT
    ctx.lineWidth = radius * 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(to.x, to.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  return (
    <canvas
      ref={ref}
      className="overlay"
      data-testid="mask-canvas"
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        onStrokeStart()
        const p = toImage(e)
        last.current = p
        draw(p, p)
      }}
      onPointerMove={(e) => {
        if (!last.current) return
        const p = toImage(e)
        draw(last.current, p)
        last.current = p
      }}
      onPointerUp={() => {
        if (!last.current) return
        last.current = null
        onStrokeEnd()
      }}
      onPointerCancel={() => {
        if (!last.current) return
        last.current = null
        onStrokeEnd()
      }}
    />
  )
}
