import { forwardRef, useCallback, useEffect, useRef } from 'react'
import type { SpatialBlocking, SpatialMarker } from '../../../domain/spatialRef'

const W = 640

function markerFill(kind: SpatialMarker['kind']): string {
  switch (kind) {
    case 'character':
      return '#e8e8e8'
    case 'prop':
      return '#b0b0b0'
    case 'scene':
      return '#96969a'
    default:
      return '#c8c8c8'
  }
}

export function shotStageToPngDataUrl(canvas: HTMLCanvasElement | null): string | null {
  if (!canvas) return null
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export const TimelineShotStage = forwardRef<HTMLCanvasElement, {
  blocking: SpatialBlocking
  onChange: (next: SpatialBlocking) => void
  disabled?: boolean
}>(function TimelineShotStage(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<string | null>(null)
  const setCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }, [ref])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const aspect = props.blocking.aspect === '9:16' ? 9 / 16 : 16 / 9
    const width = W
    const height = Math.round(W / aspect)
    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#a8a8a8'
    ctx.fillRect(0, 0, width, height)
    const floorY = height * 0.62
    ctx.fillStyle = '#8c8c8c'
    ctx.fillRect(0, floorY, width, height - floorY)
    ctx.strokeStyle = '#6e6e6e'
    ctx.beginPath()
    ctx.moveTo(0, floorY)
    ctx.lineTo(width, floorY)
    ctx.stroke()
    for (const m of props.blocking.markers) {
      const x = m.x * width
      const y = floorY - m.z * (floorY - height * 0.12)
      ctx.fillStyle = markerFill(m.kind)
      if (m.kind === 'character' || m.kind === 'costume' || m.kind === 'action') {
        ctx.beginPath()
        ctx.arc(x, y - 18, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(x - 8, y - 8, 16, 28)
      } else if (m.kind === 'scene') {
        ctx.fillRect(x - 70, y - 20, 140, 28)
      } else {
        ctx.fillRect(x - 12, y - 12, 24, 24)
      }
      ctx.fillStyle = '#222'
      ctx.font = '11px sans-serif'
      ctx.fillText(m.name.slice(0, 16), x - 20, y + 28)
    }
    const cam = props.blocking.camera
    const cx = cam.x * width
    const cy = floorY - cam.z * (floorY - height * 0.08)
    const lx = cam.lookAtX * width
    const ly = floorY - cam.lookAtZ * (floorY - height * 0.08)
    ctx.strokeStyle = '#222'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(lx, ly)
    ctx.stroke()
    ctx.fillStyle = '#222'
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fill()
  }, [props.blocking])

  useEffect(() => {
    draw()
  }, [draw])

  const hit = (px: number, py: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const height = canvas.height
    const floorY = height * 0.62
    let best: { id: string; d: number } | null = null
    for (const m of props.blocking.markers) {
      const x = m.x * canvas.width
      const y = floorY - m.z * (floorY - height * 0.12)
      const d = (x - px) ** 2 + (y - py) ** 2
      if (d < 28 * 28 && (!best || d < best.d)) best = { id: m.id, d }
    }
    return best?.id ?? null
  }

  return (
    <canvas
      ref={setCanvas}
      data-testid="shot-stage"
      width={W}
      height={Math.round(W / (16 / 9))}
      className="w-full cursor-grab rounded border border-ink-700 bg-ink-800"
      onPointerDown={(e) => {
        if (props.disabled) return
        const rect = e.currentTarget.getBoundingClientRect()
        const scaleX = e.currentTarget.width / rect.width
        const scaleY = e.currentTarget.height / rect.height
        const id = hit((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
        dragRef.current = id
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* jsdom */
        }
      }}
      onPointerMove={(e) => {
        if (!dragRef.current || props.disabled) return
        const rect = e.currentTarget.getBoundingClientRect()
        const scaleX = e.currentTarget.width / rect.width
        const scaleY = e.currentTarget.height / rect.height
        const x = Math.min(1, Math.max(0, ((e.clientX - rect.left) * scaleX) / e.currentTarget.width))
        const y = ((e.clientY - rect.top) * scaleY) / e.currentTarget.height
        const floorY = 0.62
        const z = Math.min(1, Math.max(0, (floorY - y) / (floorY - 0.12)))
        props.onChange({
          ...props.blocking,
          markers: props.blocking.markers.map((m) =>
            m.id === dragRef.current ? { ...m, x, z } : m
          )
        })
      }}
      onPointerUp={() => {
        dragRef.current = null
      }}
    />
  )
})

TimelineShotStage.displayName = 'TimelineShotStage'
