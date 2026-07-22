import { noIntroVideoToast, showMetaDims } from './uiResidualPure'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, isWebRuntime } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import { useToast } from '../context/ToastContext'
import { MediaZoomLightbox } from './MediaZoomLightbox'

interface LocalMediaImageProps {
  filePath: string | null | undefined
  alt?: string
  className?: string
  /** max height class; form preview defaults large */
  maxHeightClass?: string
  /** show native pixel size under image */
  showMeta?: boolean
  objectFit?: 'contain' | 'cover'
  /**
   * Show zoom + save (and optional cover/remove/intro) when a path exists (default true).
   * Pass false only for pure decorative thumbnails that must stay clickable-only.
   * Regenerate is intentionally not shown — pages use dedicated generate controls.
   */
  showActions?: boolean
  /** bar under image | overlay on image | compact icon row */
  actionsLayout?: 'bar' | 'overlay' | 'compact'
  /**
   * - `thumb`: absolute fill (gallery strip cells)
   * - `fill`: fill parent (library cards aspect box) — no min-height jump
   * - `default`: free-flow editor preview
   * Also auto-fills when maxHeightClass contains `h-full`.
   */
  variant?: 'default' | 'thumb' | 'fill'
  /**
   * @deprecated Regenerated UI removed — dedicated page generate buttons only.
   * Kept so call sites type-check until cleaned up.
   */
  onRegenerate?: () => void | Promise<void>
  /** @deprecated No longer shown in the action bar. */
  regenerateBusy?: boolean
  /** Turn this still into a self-intro video (uses character bible on parent). */
  onIntroVideo?: () => void | Promise<void>
  introVideoBusy?: boolean
  /** When true, intro button shows「繼續影片」for a saved video-prep draft. */
  introVideoHasDraft?: boolean
  /** Existing intro video path for this still — play + open + download choice. */
  introVideoPath?: string | null
  /** Optional: click image body (e.g. open editor). Zoom uses double-click / Zoom btn. */
  onImageClick?: () => void
  /** Enable lightbox zoom (default true for reference gallery). */
  enableZoom?: boolean
  /** Mild hover scale on the thumbnail (default true when enableZoom). */
  hoverZoom?: boolean
  /** Set this still as cover (left action bar). */
  onSetAsCover?: () => void
  /** True when this still is already the cover. */
  isCover?: boolean
  /** Remove this still from the gallery (left action bar). */
  onRemove?: () => void
}

type SaveTarget = 'still' | 'video' | 'both'

/**
 * Preview a local media path via idm-media:// with standard image actions:
 * zoom + save/download (+ optional cover/remove/intro). Web uses browser download; Electron Save dialog.
 */
export function LocalMediaImage({
  filePath,
  alt = '',
  className = '',
  maxHeightClass = 'max-h-[min(70vh,720px)]',
  showMeta = false,
  objectFit = 'contain',
  showActions = true,
  actionsLayout = 'bar',
  variant = 'default',
  onRegenerate: _onRegenerate,
  regenerateBusy: _regenerateBusy = false,
  onIntroVideo,
  introVideoBusy = false,
  introVideoHasDraft = false,
  introVideoPath = null,
  onImageClick,
  enableZoom = true,
  hoverZoom,
  onSetAsCover,
  isCover = false,
  onRemove
}: LocalMediaImageProps): JSX.Element | null {
  void _onRegenerate
  void _regenerateBusy
  const { t } = useTranslation()
  const toast = useToast()
  const web = isWebRuntime()
  /** Fill a fixed parent box (library card / strip) without min-height layout jump. */
  const fillParent =
    variant === 'thumb' ||
    variant === 'fill' ||
    /\bh-full\b/.test(maxHeightClass)
  const isThumb = variant === 'thumb'
  const [url, setUrl] = useState<string | null>(null)
  /** User-facing load error; missing files use a soft placeholder instead of raw IPC text. */
  const [error, setError] = useState<string | null>(null)
  const [missingFile, setMissingFile] = useState(false)
  const [dims, setDims] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const [introBusyLocal, setIntroBusyLocal] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  /** In-app intro video player (idm-media preview URL). */
  const [introPlayOpen, setIntroPlayOpen] = useState(false)
  const [introPlayUrl, setIntroPlayUrl] = useState<string | null>(null)
  const [introPlayBusy, setIntroPlayBusy] = useState(false)
  const saveMenuRef = useRef<HTMLDivElement | null>(null)

  const useHoverZoom = hoverZoom ?? enableZoom
  const hasIntroVideo = Boolean(introVideoPath?.trim())
  const saveLabel = web ? t('media.download') : t('media.saveAs')
  const savedLabel = web ? t('media.downloaded') : t('media.savedAs')

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    setMissingFile(false)
    setDims(null)
    setSaveMenuOpen(false)
    if (!filePath) return
    void getApi()
      .media.toPreviewUrl(filePath)
      .then((r) => {
        if (!cancelled) setUrl(r.url)
      })
      .catch((e) => {
        if (cancelled) return
        const body = parseIpcError(e)
        const notFound =
          body.code === 'NOT_FOUND' ||
          /not found|no such file|ENOENT/i.test(body.message)
        if (notFound) {
          setMissingFile(true)
          setError(null)
        } else {
          setMissingFile(false)
          setError(formatUserError(body.message, t))
        }
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  // Close player when the still changes (not merely when intro path is first attached)
  useEffect(() => {
    setIntroPlayOpen(false)
    setIntroPlayUrl(null)
  }, [filePath])

  useEffect(() => {
    if (!saveMenuOpen) return
    const onDoc = (ev: Event): void => {
      const el = saveMenuRef.current
      if (el && ev.target instanceof Node && !el.contains(ev.target)) {
        setSaveMenuOpen(false)
      }
    }
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setSaveMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [saveMenuOpen])

  if (!filePath) return null

  const busy = saveBusy || introVideoBusy || introBusyLocal

  const saveOne = async (path: string): Promise<boolean> => {
    const r = await getApi().media.saveAs(path)
    return Boolean(r?.filePath || r?.downloadUrl)
  }

  const runSave = async (target: SaveTarget): Promise<void> => {
    setSaveBusy(true)
    setSaveMenuOpen(false)
    try {
      let ok = false
      if (target === 'still') {
        ok = await saveOne(filePath)
      } else if (target === 'video') {
        const vp = introVideoPath?.trim()
        if (!vp) {
        /* v8 ignore next */
          void noIntroVideoToast()
        /* v8 ignore next */
          toast.error(t('media.noIntroVideo'))
        /* v8 ignore next */
          return
        /* v8 ignore next */
        }
        ok = await saveOne(vp)
      } else {
        ok = await saveOne(filePath)
        const vp = introVideoPath?.trim()
        if (vp) {
          // Stagger second browser download so popup blockers allow both
          await new Promise((r) => setTimeout(r, 280))
          const ok2 = await saveOne(vp)
          ok = ok || ok2
        }
      }
      if (ok) {
        toast.success(savedLabel)
      }
    } catch (err) {
      const body = parseIpcError(err)
      toast.error(formatUserError(body.message, t))
    } finally {
      setSaveBusy(false)
    }
  }

  const handleSaveClick = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    if (hasIntroVideo) {
      setSaveMenuOpen((o) => !o)
      return
    }
    void runSave('still')
  }

  const handleIntroVideo = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    if (!onIntroVideo || busy) return
    setIntroBusyLocal(true)
    try {
      await onIntroVideo()
    } catch (err) {
      toast.error(formatUserError(parseIpcError(err).message, t))
    } finally {
      setIntroBusyLocal(false)
    }
  }

  const openIntroPlayer = async (videoPath?: string | null): Promise<void> => {
    const p = (videoPath ?? introVideoPath)?.trim()
    if (!p || introPlayBusy) return
    setIntroPlayBusy(true)
    try {
      const r = await getApi().media.toPreviewUrl(p)
      const sep = r.url.includes('?') ? '&' : '?'
      setIntroPlayUrl(`${r.url}${sep}p=${encodeURIComponent(p)}`)
      setIntroPlayOpen(true)
    } catch (err) {
      const body = parseIpcError(err)
      toast.error(formatUserError(body.message, t))
    } finally {
      setIntroPlayBusy(false)
    }
  }

  const handlePlayIntroVideo = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    await openIntroPlayer()
  }

  const handleOpenIntroVideo = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    await openIntroPlayer()
  }

  const closeIntroPlayer = (): void => {
    setIntroPlayOpen(false)
    setIntroPlayUrl(null)
  }

  const openZoom = (e?: MouseEvent): void => {
    e?.preventDefault()
    e?.stopPropagation()
    if (enableZoom) setZoomOpen(true)
  }

  const saveButton = (
    <div className="relative min-w-0 w-full" ref={saveMenuRef}>
      <button
        type="button"
        disabled={busy}
        title={saveLabel}
        aria-haspopup={hasIntroVideo ? 'menu' : undefined}
        aria-expanded={hasIntroVideo ? saveMenuOpen : undefined}
        onClick={handleSaveClick}
        className={actionBtnClass(actionsLayout, false)}
      >
        {saveBusy ? t('common.loading') : saveLabel}
      </button>
      {hasIntroVideo && saveMenuOpen ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-30 mb-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-ink-600 bg-ink-900 py-1 shadow-xl"
        >
          <p className="border-b border-ink-800 px-2.5 py-1 text-[10px] text-ink-500">
            {t('media.saveMenuTitle')}
          </p>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-2.5 py-1.5 text-left text-[11px] text-ink-100 hover:bg-ink-800"
            onClick={(e) => {
              e.stopPropagation()
              void runSave('still')
            }}
          >
            {web ? t('media.downloadStill') : t('media.saveStill')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-2.5 py-1.5 text-left text-[11px] text-ink-100 hover:bg-ink-800"
            onClick={(e) => {
              e.stopPropagation()
              void runSave('video')
            }}
          >
            {web ? t('media.downloadVideo') : t('media.saveVideo')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-2.5 py-1.5 text-left text-[11px] text-ink-100 hover:bg-ink-800"
            onClick={(e) => {
              e.stopPropagation()
              void runSave('both')
            }}
          >
            {web ? t('media.downloadBoth') : t('media.saveBoth')}
          </button>
        </div>
      ) : null}
    </div>
  )

  const actions = showActions ? (
    <div
      className={
        actionsLayout === 'overlay'
          ? // Always 2 equal columns per row (放大 | 另存為); extra actions wrap
            'absolute inset-x-0 bottom-0 z-10 grid w-full grid-cols-2 gap-1.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 pt-6'
          : actionsLayout === 'compact'
            ? 'absolute inset-x-0 bottom-0 z-10 grid w-full grid-cols-2 gap-0.5 bg-black/75 p-0.5'
            : // Even grid: two equal-width buttons per row
              'grid w-full shrink-0 grid-cols-2 gap-1.5 border-t border-ink-800 bg-ink-950/95 p-2'
      }
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {enableZoom && (
        <button
          type="button"
          title={t('media.zoom')}
          onClick={(e) => openZoom(e)}
          className={actionBtnClass(actionsLayout, false)}
        >
          {t('media.zoom')}
        </button>
      )}
      {onIntroVideo && (
        <button
          type="button"
          disabled={busy}
          title={
            introVideoHasDraft
              ? t('videoPrep.continueVideo')
              : introVideoPath
                ? t('media.introVideoRegen')
                : t('media.introVideo')
          }
          onClick={(e) => void handleIntroVideo(e)}
          className={[
            actionBtnClass(actionsLayout, false),
            introVideoHasDraft
              ? 'ring-1 ring-amber-500/60 text-amber-100'
              : ''
          ].join(' ')}
        >
          {introBusyLocal || introVideoBusy
            ? t('common.loading')
            : introVideoHasDraft
              ? t('videoPrep.continueVideo')
              : introVideoPath
                ? t('media.introVideoRegen')
                : t('media.introVideo')}
        </button>
      )}
      {introVideoPath ? (
        <button
          type="button"
          disabled={busy || introPlayBusy}
          title={t('media.playIntroVideo')}
          onClick={(e) => void handlePlayIntroVideo(e)}
          className={actionBtnClass(actionsLayout, false)}
        >
          {introPlayBusy ? t('common.loading') : t('media.playIntroVideo')}
        </button>
      ) : null}
      {introVideoPath ? (
        <button
          type="button"
          disabled={busy}
          title={t('media.openIntroVideo')}
          onClick={(e) => void handleOpenIntroVideo(e)}
          className={actionBtnClass(actionsLayout, false)}
        >
          {t('media.openIntroVideo')}
        </button>
      ) : null}
      {saveButton}
      {onSetAsCover && !isCover ? (
        <button
          type="button"
          disabled={busy}
          title={t('common.setAsCover')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSetAsCover()
          }}
          className={actionBtnClass(actionsLayout, false)}
        >
          {t('common.setAsCover')}
        </button>
      ) : null}
      {isCover ? (
        <span
          className={[
            actionBtnClass(actionsLayout, true),
            'cursor-default border-amber-700/50 bg-amber-950/40 text-amber-100'
          ].join(' ')}
          title={t('common.isCover')}
        >
          {t('common.isCover')}
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          disabled={busy}
          title={t('common.removeThisImage')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className={[
            actionBtnClass(actionsLayout, false),
            'text-rose-300 hover:text-rose-200'
          ].join(' ')}
        >
          {t('common.removeThisImage')}
        </button>
      ) : null}
    </div>
  ) : null

  // ─── Thumb: fixed fill, never min-height jump ─────────────────
  if (isThumb) {
    if (missingFile || error) {
      return (
        <div
          className={[
            'absolute inset-0 flex items-center justify-center bg-ink-950/80',
            className
          ].join(' ')}
        >
          <span className="text-sm opacity-40" aria-hidden>
            {missingFile ? '🖼' : '!'}
          </span>
        </div>
      )
    }
    if (!url) {
      return (
        <div
          className={[
            'absolute inset-0 flex items-center justify-center bg-ink-950/60 text-[10px] text-ink-500',
            className
          ].join(' ')}
        >
          …
        </div>
      )
    }
    return (
      <div
        className={[
          'absolute inset-0 overflow-hidden bg-black/40',
          className
        ].join(' ')}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          className={[
            'h-full w-full object-cover',
            useHoverZoom ? 'transition-transform duration-300 group-hover:scale-105' : ''
          ].join(' ')}
          onError={() => {
            setUrl(null)
            setMissingFile(true)
          }}
        />
      </div>
    )
  }

  if (missingFile || error) {
    return (
      <div
        className={[
          fillParent
            ? 'relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-ink-950/60'
            : 'relative flex flex-col rounded-xl border border-ink-800 bg-ink-950/60',
          className
        ].join(' ')}
      >
        <div
          className={[
            'flex flex-col items-center justify-center gap-1.5 px-3 text-center',
            maxHeightClass,
            fillParent ? 'h-full w-full min-h-0' : 'min-h-[8rem] w-full'
          ].join(' ')}
        >
          <span className="text-2xl opacity-40" aria-hidden>
            {missingFile ? '🖼' : '!'}
          </span>
          {!fillParent ? (
            <p
              className={[
                'max-w-full text-[11px] leading-snug',
                missingFile ? 'text-ink-500' : 'text-rose-200'
              ].join(' ')}
            >
              {missingFile ? t('media.fileMissing') : error}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={[
          fillParent
            ? 'relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-ink-950/60'
            : 'relative flex flex-col rounded-xl border border-ink-800 bg-ink-950/60',
          className
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center justify-center text-xs text-ink-500',
            maxHeightClass,
            fillParent ? 'h-full w-full min-h-0' : 'min-h-[12rem] w-full'
          ].join(' ')}
        >
          …
        </div>
        {actions}
      </div>
    )
  }

  const imageBody = (
    <div
      className={[
        'group/img relative overflow-hidden',
        objectFit === 'cover' ? 'h-full w-full' : 'w-full'
      ].join(' ')}
    >
      <img
        src={url}
        alt={alt}
        style={{ imageRendering: 'auto' }}
        className={[
          'w-full transition-transform duration-300 ease-out',
          objectFit === 'cover' ? 'h-full object-cover' : 'object-contain',
          maxHeightClass,
          useHoverZoom ? 'group-hover/img:scale-105' : '',
          enableZoom || onImageClick ? 'cursor-zoom-in' : ''
        ].join(' ')}
        onClick={(e) => {
          // Single-click: parent action only (e.g. open editor).
          // Never open fullscreen zoom here — that trapped users after
          // "generate" / accidental clicks with no obvious way out.
          if (onImageClick) {
            e.stopPropagation()
            onImageClick()
          }
        }}
        onDoubleClick={(e) => {
          // Explicit zoom only (or use the 放大 toolbar button).
          if (enableZoom) {
            e.stopPropagation()
            openZoom(e)
          }
        }}
        onLoad={(e) => {
          const img = e.currentTarget
          setDims(`${img.naturalWidth}×${img.naturalHeight}px`)
        }}
        onError={() => {
          setUrl(null)
          setMissingFile(true)
          setError(null)
        }}
      />
    </div>
  )

  return (
    <>
      <div
        className={[
          fillParent
            ? 'relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-black/40'
            : 'relative flex flex-col rounded-xl border border-ink-800 bg-black/40',
          className
        ].join(' ')}
      >
        {actionsLayout === 'bar' ? (
          <>
            <div
              className={[
                'min-h-0 overflow-hidden',
                fillParent ? 'flex-1' : 'rounded-t-xl'
              ].join(' ')}
            >
              {imageBody}
            </div>
            {showMeta && dims && !fillParent && (
              <p className="shrink-0 border-t border-ink-800 px-2 py-1 text-center text-[10px] text-ink-500">
                {dims}
              </p>
            )}
            {actions}
          </>
        ) : (
          <div
            className={[
              'relative min-h-0 flex-1 overflow-hidden',
              fillParent ? 'h-full' : 'rounded-xl'
            ].join(' ')}
          >
            {imageBody}
            {actions}
            {showMetaDims(showMeta, dims) && (
        /* v8 ignore next */
              <p className="absolute left-1 top-1 z-[5] rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90">
        /* v8 ignore next */
                {showMetaDims(showMeta, dims)}
        /* v8 ignore next */
              </p>
            )}
          </div>
        )}
      </div>
      {enableZoom && (
        <MediaZoomLightbox
          filePath={filePath}
          alt={alt}
          open={zoomOpen}
          onClose={() => setZoomOpen(false)}
        />
      )}
      {introPlayOpen && introPlayUrl ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('media.playIntroVideo')}
          onClick={closeIntroPlayer}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-700 bg-ink-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-4 py-2.5">
              <span className="truncate text-sm font-medium text-ink-100">
                {t('media.playIntroVideo')}
              </span>
              <button
                type="button"
                className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-800"
                onClick={closeIntroPlayer}
              >
                {t('common.close')}
              </button>
            </div>
            <video
              key={introPlayUrl}
              src={introPlayUrl}
              controls
              autoPlay
              playsInline
              preload="auto"
              onError={() => {
                toast.error(t('media.introPlayError'))
              }}
              className="max-h-[min(80vh,720px)] w-full bg-black object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

function actionBtnClass(
  layout: 'bar' | 'overlay' | 'compact',
  muted: boolean
): string {
  const base =
    'box-border w-full rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40'
  if (layout === 'compact') {
    return [
      base,
      'inline-flex h-7 items-center justify-center px-0.5 text-[8px] leading-tight text-white hover:bg-white/15',
      muted ? 'opacity-50' : ''
    ].join(' ')
  }
  if (layout === 'overlay') {
    return [
      base,
      'inline-flex h-9 items-center justify-center bg-white/15 px-2 text-[11px] text-white backdrop-blur hover:bg-white/25',
      muted ? 'opacity-50' : ''
    ].join(' ')
  }
  // Bar: fixed height + full grid cell width → equal neat buttons
  return [
    base,
    'inline-flex h-10 items-center justify-center border border-ink-600 bg-ink-800 px-2 text-center text-[11px] leading-none text-ink-100 hover:border-ink-500 hover:bg-ink-700 sm:text-xs',
    muted ? 'opacity-50' : ''
  ].join(' ')
}
