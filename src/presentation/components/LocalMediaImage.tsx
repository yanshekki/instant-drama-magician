import { useEffect, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
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
   * Always show 重新 gen + Save as when a path exists (default true).
   * Pass false only for pure decorative thumbnails that must stay clickable-only.
   */
  showActions?: boolean
  /** bar under image | overlay on image | compact icon row */
  actionsLayout?: 'bar' | 'overlay' | 'compact'
  /** Re-generate this image. Required for the button to work. */
  onRegenerate?: () => void | Promise<void>
  regenerateBusy?: boolean
  /** Turn this still into a self-intro video (uses character bible on parent). */
  onIntroVideo?: () => void | Promise<void>
  introVideoBusy?: boolean
  /** Existing intro video path for this still — play + open buttons. */
  introVideoPath?: string | null
  /** Optional: click image body (e.g. open editor). Zoom uses double-click / Zoom btn. */
  onImageClick?: () => void
  /** Enable lightbox zoom (default true for reference gallery). */
  enableZoom?: boolean
  /** Mild hover scale on the thumbnail (default true when enableZoom). */
  hoverZoom?: boolean
}

/**
 * Preview a local media path via idm-media:// with standard image actions:
 * 重新 gen + Save as + Zoom on every image display.
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
  onRegenerate,
  regenerateBusy = false,
  onIntroVideo,
  introVideoBusy = false,
  introVideoPath = null,
  onImageClick,
  enableZoom = true,
  hoverZoom
}: LocalMediaImageProps): JSX.Element | null {
  const { t } = useTranslation()
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  /** User-facing load error; missing files use a soft placeholder instead of raw IPC text. */
  const [error, setError] = useState<string | null>(null)
  const [missingFile, setMissingFile] = useState(false)
  const [dims, setDims] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [regenBusyLocal, setRegenBusyLocal] = useState(false)
  const [introBusyLocal, setIntroBusyLocal] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  /** In-app intro video player (idm-media preview URL). */
  const [introPlayOpen, setIntroPlayOpen] = useState(false)
  const [introPlayUrl, setIntroPlayUrl] = useState<string | null>(null)
  const [introPlayBusy, setIntroPlayBusy] = useState(false)

  const useHoverZoom = hoverZoom ?? enableZoom

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    setMissingFile(false)
    setDims(null)
    setActionMsg(null)
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
          setError(body.message)
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

  if (!filePath) return null

  const busy =
    regenerateBusy ||
    regenBusyLocal ||
    saveBusy ||
    introVideoBusy ||
    introBusyLocal

  const handleSaveAs = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setSaveBusy(true)
    setActionMsg(null)
    try {
      const r = await getApi().media.saveAs(filePath)
      if (r?.filePath) {
        setActionMsg(t('media.savedAs'))
        toast.success(t('media.savedAs'))
      }
    } catch (err) {
      const body = parseIpcError(err)
      setActionMsg(body.message)
      toast.error(body.message)
    } finally {
      setSaveBusy(false)
    }
  }

  const handleRegenerate = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    if (!onRegenerate || busy) return
    setRegenBusyLocal(true)
    setActionMsg(null)
    try {
      // Parent handler owns start toasts (avoid duplicate top-right alerts).
      await onRegenerate()
    } catch (err) {
      const body = parseIpcError(err)
      setActionMsg(body.message)
      toast.error(body.message)
    } finally {
      setRegenBusyLocal(false)
    }
  }

  const handleIntroVideo = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    if (!onIntroVideo || busy) return
    setIntroBusyLocal(true)
    setActionMsg(null)
    try {
      await onIntroVideo()
    } catch (err) {
      const body = parseIpcError(err)
      setActionMsg(body.message)
      toast.error(body.message)
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
      toast.error(body.message)
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
    // Same as play: only open when user clicks (never auto on editor mount).
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

  // Count bar buttons so grid columns stay even (avoids uneven wrap / 走位).
  const barButtonCount =
    (enableZoom ? 1 : 0) +
    1 /* regenerate */ +
    (onIntroVideo ? 1 : 0) +
    (introVideoPath ? 2 : 0) /* play + open */ +
    1 /* save as */
  const barColsClass =
    barButtonCount <= 2
      ? 'grid-cols-2'
      : barButtonCount === 3
        ? 'grid-cols-3'
        : barButtonCount === 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3'

  const actions = showActions ? (
    <div
      className={
        actionsLayout === 'overlay'
          ? 'absolute inset-x-0 bottom-0 z-10 flex flex-wrap gap-1 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 pt-6'
          : actionsLayout === 'compact'
            ? 'absolute inset-x-0 bottom-0 z-10 flex gap-0.5 bg-black/75 p-0.5'
            : `grid w-full ${barColsClass} gap-1.5 border-t border-ink-800 bg-ink-950/90 p-2`
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
      <button
        type="button"
        disabled={busy || !onRegenerate}
        title={
          onRegenerate
            ? t('media.regenerate')
            : t('media.regenerateUnavailable')
        }
        onClick={(e) => void handleRegenerate(e)}
        className={actionBtnClass(actionsLayout, !onRegenerate)}
      >
        {regenBusyLocal || regenerateBusy
          ? t('common.loading')
          : t('media.regenerate')}
      </button>
      {onIntroVideo && (
        <button
          type="button"
          disabled={busy}
          title={t('media.introVideo')}
          onClick={(e) => void handleIntroVideo(e)}
          className={actionBtnClass(actionsLayout, false)}
        >
          {introBusyLocal || introVideoBusy
            ? t('common.loading')
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
      <button
        type="button"
        disabled={busy}
        title={t('media.saveAs')}
        onClick={(e) => void handleSaveAs(e)}
        className={actionBtnClass(actionsLayout, false)}
      >
        {saveBusy ? t('common.loading') : t('media.saveAs')}
      </button>
    </div>
  ) : null

  if (missingFile || error) {
    return (
      <div
        className={[
          'relative flex flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-950/60',
          className
        ].join(' ')}
      >
        <div
          className={[
            'flex flex-col items-center justify-center gap-1.5 px-3 text-center',
            maxHeightClass,
            'min-h-[8rem] w-full'
          ].join(' ')}
        >
          <span className="text-2xl opacity-40" aria-hidden>
            {missingFile ? '🖼' : '!'}
          </span>
          <p
            className={[
              'max-w-full text-[11px] leading-snug',
              missingFile ? 'text-ink-500' : 'text-rose-200'
            ].join(' ')}
          >
            {missingFile ? t('media.fileMissing') : error}
          </p>
        </div>
        {actions}
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={[
          'relative flex flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-950/60',
          className
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center justify-center text-xs text-ink-500',
            maxHeightClass,
            'min-h-[12rem] w-full'
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
          // Only consume the event when we handle it — otherwise parent
          // controls (e.g. gallery thumbnail buttons) must receive the click.
          if (onImageClick) {
            e.stopPropagation()
            onImageClick()
            return
          }
          if (enableZoom) {
            e.stopPropagation()
            openZoom()
          }
        }}
        onDoubleClick={(e) => {
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
          'relative overflow-hidden rounded-xl border border-ink-800 bg-black/40',
          className
        ].join(' ')}
      >
        {actionsLayout === 'bar' ? (
          <>
            {imageBody}
            {showMeta && dims && (
              <p className="border-t border-ink-800 px-2 py-1 text-center text-[10px] text-ink-500">
                {dims}
              </p>
            )}
            {actions}
          </>
        ) : (
          <div className="relative h-full">
            {imageBody}
            {actions}
            {showMeta && dims && (
              <p className="absolute left-1 top-1 z-[5] rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-ink-200">
                {dims}
              </p>
            )}
          </div>
        )}
        {actionMsg && (
          <p className="border-t border-ink-800 px-2 py-1 text-center text-[10px] text-ink-400">
            {actionMsg}
          </p>
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
              // Avoid accidental pause if parent re-renders focus; stream needs Range (main).
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
    'rounded font-medium transition disabled:cursor-not-allowed disabled:opacity-40'
  if (layout === 'compact') {
    return [
      base,
      'flex-1 px-0.5 py-0.5 text-[8px] leading-tight text-ink-50 hover:bg-white/15',
      muted ? 'opacity-50' : ''
    ].join(' ')
  }
  if (layout === 'overlay') {
    return [
      base,
      'bg-white/15 px-2.5 py-1 text-[11px] text-white backdrop-blur hover:bg-white/25',
      muted ? 'opacity-50' : ''
    ].join(' ')
  }
  return [
    base,
    // Full-cell width so bar grid stays aligned; truncate long labels with title tooltip.
    'flex min-h-[2.25rem] w-full items-center justify-center border border-ink-600 bg-ink-800 px-1.5 py-1.5 text-center text-[11px] leading-tight text-ink-100 hover:border-ink-500 hover:bg-ink-700 sm:text-xs',
    muted ? 'opacity-50' : ''
  ].join(' ')
}
