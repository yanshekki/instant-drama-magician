import { wheelZoomDelta, preventWheel } from './uiResidualPure'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'

const MIN_SCALE = 0.5
const MAX_SCALE = 6
const STEP = 0.25

interface MediaZoomLightboxProps {
  filePath: string
  alt?: string
  open: boolean
  onClose: () => void
}

/** Keep a moved window inside the viewport after resize. */
export function clampLightboxOffset(
  x: number,
  y: number,
  vw: number,
  vh: number
): { x: number; y: number } {
  const pad = 56
  const maxX = Math.max(0, vw / 2 - pad)
  const maxY = Math.max(0, vh / 2 - pad)
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y))
  }
}

/**
 * Viewport-portaled image viewer. Must not render inside transformed /
 * overflow-hidden ancestors (Timeline v2 graph) or `fixed` is trapped.
 */
export function MediaZoomLightbox({
  filePath,
  alt = '',
  open,
  onClose
}: MediaZoomLightboxProps): JSX.Element | null {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [win, setWin] = useState({ x: 0, y: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const imgDrag = useRef<{
    active: boolean
    x: number
    y: number
    tx: number
    ty: number
  }>({ active: false, x: 0, y: 0, tx: 0, ty: 0 })
  const winDrag = useRef<{
    active: boolean
    x: number
    y: number
    ox: number
    oy: number
  }>({ active: false, x: 0, y: 0, ox: 0, oy: 0 })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setUrl(null)
    setScale(1)
    setTx(0)
    setTy(0)
    setWin({ x: 0, y: 0 })
    void getApi()
      .media.toPreviewUrl(filePath)
      .then((r) => {
        if (!cancelled) setUrl(r.url)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, filePath])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setScale((s) => Math.min(MAX_SCALE, s + STEP))
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setScale((s) => Math.max(MIN_SCALE, s - STEP))
      }
      if (e.key === '0') {
        setScale(1)
        setTx(0)
        setTy(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const zoomBy = useCallback((delta: number): void => {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)))
  }, [])

  const reset = useCallback((): void => {
    setScale(1)
    setTx(0)
    setTy(0)
  }, [])

  useEffect(() => {
    if (!open) return
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      preventWheel(e)
      zoomBy(wheelZoomDelta(e.deltaY, STEP))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, zoomBy])

  useEffect(() => {
    if (!open) return
    const onMove = (e: MouseEvent): void => {
      if (winDrag.current.active) {
        const next = clampLightboxOffset(
          winDrag.current.ox + (e.clientX - winDrag.current.x),
          winDrag.current.oy + (e.clientY - winDrag.current.y),
          window.innerWidth,
          window.innerHeight
        )
        setWin(next)
        return
      }
      if (!imgDrag.current.active) return
      setTx(imgDrag.current.tx + (e.clientX - imgDrag.current.x))
      setTy(imgDrag.current.ty + (e.clientY - imgDrag.current.y))
    }
    const onUp = (): void => {
      imgDrag.current.active = false
      winDrag.current.active = false
    }
    const onResize = (): void => {
      setWin((prev) =>
        clampLightboxOffset(prev.x, prev.y, window.innerWidth, window.innerHeight)
      )
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const onStageDown = (e: ReactPointerEvent): void => {
    if (e.button !== 0) return
    e.preventDefault()
    imgDrag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      tx,
      ty
    }
  }

  const onTitleDown = (e: ReactPointerEvent): void => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    winDrag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      ox: win.x,
      oy: win.y
    }
  }

  if (!open || typeof document === 'undefined') return null

  const node = (
    <div
      className="fixed inset-0 z-[220] bg-black/70 p-2 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('media.zoomTitle')}
      data-testid="media-zoom-dialog"
      onClick={onClose}
    >
      <button
        type="button"
        data-testid="media-zoom-close"
        className="fixed right-3 top-3 z-[230] flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-zinc-950/90 text-lg font-semibold text-white shadow-lg hover:bg-zinc-800"
        aria-label={t('common.close')}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        ✕
      </button>

      <div
        className="absolute left-1/2 top-1/2 flex max-h-[calc(100dvh-1rem)] w-[min(96vw,72rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
        style={{
          height: 'min(92dvh, 56rem)',
          transform: `translate(calc(-50% + ${win.x}px), calc(-50% + ${win.y}px))`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 cursor-grab items-center gap-2 border-b border-white/15 bg-zinc-950 px-3 py-2 active:cursor-grabbing"
          onPointerDown={onTitleDown}
        >
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {alt || t('media.zoomTitle')}
            <span className="ml-2 font-mono text-xs font-normal text-white/70">
              {Math.round(scale * 100)}%
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <ToolbarBtn onClick={() => zoomBy(-STEP)} label={t('media.zoomOut')}>
              −
            </ToolbarBtn>
            <ToolbarBtn onClick={reset} label={t('media.zoomReset')}>
              1:1
            </ToolbarBtn>
            <ToolbarBtn onClick={() => zoomBy(STEP)} label={t('media.zoomIn')}>
              +
            </ToolbarBtn>
            <span className="hidden sm:inline-flex">
              <ToolbarBtn onClick={() => setScale(2)} label="200%">
                2×
              </ToolbarBtn>
            </span>
            <span className="hidden sm:inline-flex">
              <ToolbarBtn onClick={() => setScale(4)} label="400%">
                4×
              </ToolbarBtn>
            </span>
            <button
              type="button"
              className="ml-1 rounded-lg border border-white/50 bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-black active:cursor-grabbing"
          onPointerDown={onStageDown}
        >
          <div className="flex h-full w-full items-center justify-center">
            {url ? (
              <img
                src={url}
                alt={alt}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain shadow-2xl"
                style={{
                  transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                  transformOrigin: 'center center'
                }}
              />
            ) : (
              <span className="text-white/60">{t('common.loading')}</span>
            )}
          </div>
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 px-3 text-center text-[11px] text-white/55">
            {t('media.zoomHint')}
          </p>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

function ToolbarBtn({
  children,
  onClick,
  label
}: {
  children: ReactNode
  onClick: () => void
  label: string
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="min-w-[2.25rem] rounded-lg border border-white/35 bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:border-white/50 hover:bg-white/20"
    >
      {children}
    </button>
  )
}
