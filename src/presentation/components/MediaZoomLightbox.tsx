import { wheelZoomDelta, preventWheel } from './uiResidualPure'
import { dragTransition } from '../../domain/residualLabels'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from 'react'
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

/**
 * Fullscreen zoom viewer for reference gallery images.
 * Wheel / buttons zoom, drag to pan, Esc / backdrop to close.
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
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    active: boolean
    x: number
    y: number
    tx: number
    ty: number
  }>({ active: false, x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setUrl(null)
    setScale(1)
    setTx(0)
    setTy(0)
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

  // React's onWheel is passive — must use native listener to preventDefault (zoom without page scroll)
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

  const onPointerDown = (e: ReactMouseEvent): void => {
    if (e.button !== 0) return
    e.preventDefault()
    drag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      tx,
      ty
    }
  }

  useEffect(() => {
    if (!open) return
    const onMove = (e: MouseEvent): void => {
      if (!drag.current.active) return
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      setTx(drag.current.tx + dx)
      setTy(drag.current.ty + dy)
    }
    const onUp = (): void => {
      drag.current.active = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('media.zoomTitle')}
      onClick={onClose}
    >
      {/* Toolbar — always light-on-dark; high z so never buried under previews */}
      <div
        className="relative z-[1] flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-zinc-950 px-4 py-2.5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 truncate text-sm font-medium text-white">
          {alt || t('media.zoomTitle')}
          <span className="ml-2 font-mono text-xs font-normal text-white/70">
            {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarBtn onClick={() => zoomBy(-STEP)} label={t('media.zoomOut')}>
            −
          </ToolbarBtn>
          <ToolbarBtn onClick={reset} label={t('media.zoomReset')}>
            1:1
          </ToolbarBtn>
          <ToolbarBtn onClick={() => zoomBy(STEP)} label={t('media.zoomIn')}>
            +
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setScale(2)} label="200%">
            2×
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setScale(4)} label="400%">
            4×
          </ToolbarBtn>
          <button
            type="button"
            className="ml-2 rounded-lg border border-white/50 bg-white/15 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-white/25"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            {t('common.cancel')} ✕
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onPointerDown}
      >
        <div className="flex h-full w-full items-center justify-center">
          {url ? (
            <img
              src={url}
              alt={alt}
              draggable={false}
              className="max-h-none max-w-none select-none object-contain shadow-2xl"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: dragTransition(drag.current.active),
                imageRendering: scale > 2 ? 'auto' : 'auto'
              }}
            />
          ) : (
            <span className="text-white/60">{t('common.loading')}</span>
          )}
        </div>
        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/55">
          {t('media.zoomHint')}
        </p>
      </div>
    </div>
  )
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
