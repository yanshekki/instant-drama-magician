import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import { useToast } from '../context/ToastContext'
import { Button } from './ui'
import { LocalMediaImage } from './LocalMediaImage'
import type { ComicPageVideo } from '../../domain/comicPageVideos'

export function ComicPageVideoLibrary({
  videos,
  primaryPath,
  stillPath,
  canGenerate,
  generateBusy,
  onGenerate,
  onPlay,
  onSetPrimary,
  onDelete
}: {
  videos: ComicPageVideo[]
  primaryPath?: string | null
  stillPath?: string | null
  canGenerate: boolean
  generateBusy?: boolean
  onGenerate: () => void
  onPlay: (video: ComicPageVideo) => void
  onSetPrimary: (video: ComicPageVideo) => void
  onDelete: (video: ComicPageVideo, versionN: number) => void
}): JSX.Element {
  const { t } = useTranslation()
  const n = videos.length
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-100">
            {t('comics.videoLibrary')}
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {n === 0
              ? t('comics.emptyVideos')
              : t('comics.videoCount', { n })}
          </p>
        </div>
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || generateBusy}
        >
          {n === 0 ? t('comics.pageVideo') : t('comics.newVersion')}
        </Button>
      </div>
      {n === 0 ? (
        <button
          type="button"
          disabled={!canGenerate || generateBusy}
          onClick={onGenerate}
          className="flex min-h-[9rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-4 py-8 text-center text-sm text-ink-400 transition hover:border-ink-500 hover:text-ink-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg" aria-hidden>
            ▶
          </span>
          {t('comics.pageVideo')}
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video, i) => {
            const versionN = n - i
            const isPrimary = Boolean(
              primaryPath && video.path === primaryPath
            )
            return (
              <VideoVersionCard
                key={video.id}
                video={video}
                versionN={versionN}
                isPrimary={isPrimary}
                stillPath={stillPath}
                onPlay={() => onPlay(video)}
                onSetPrimary={() => onSetPrimary(video)}
                onDelete={() => onDelete(video, versionN)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function VideoVersionCard({
  video,
  versionN,
  isPrimary,
  stillPath,
  onPlay,
  onSetPrimary,
  onDelete
}: {
  video: ComicPageVideo
  versionN: number
  isPrimary: boolean
  stillPath?: string | null
  onPlay: () => void
  onSetPrimary: () => void
  onDelete: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const schemeKey =
    video.scheme === 'drama'
      ? 'comics.schemeDramaTitle'
      : 'comics.schemePageTitle'
  return (
    <article
      className={[
        'overflow-hidden rounded-xl border bg-ink-950/70',
        isPrimary
          ? 'border-brand-400 ring-2 ring-brand-400/80'
          : 'border-ink-800'
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onPlay}
        className="group relative block aspect-video w-full overflow-hidden bg-ink-900"
        aria-label={t('comics.playPageVideo')}
      >
        <VideoPoster path={video.path} fallbackStill={stillPath} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-2xl text-white opacity-90 transition group-hover:bg-black/40 group-hover:opacity-100">
          ▶
        </span>
        {isPrimary ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
            {t('comics.isPrimary')}
          </span>
        ) : null}
      </button>
      <div className="space-y-2 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-200">
            {t(schemeKey)}
          </span>
          <span className="text-[11px] font-medium text-ink-300">
            {t('comics.versionN', { n: versionN })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            className="!h-9 !min-h-9 !px-2 !text-xs"
            onClick={onPlay}
          >
            {t('comics.playPageVideo')}
          </Button>
          {isPrimary ? (
            <Button
              variant="secondary"
              className="!h-9 !min-h-9 !px-2 !text-xs"
              disabled
            >
              {t('comics.isPrimary')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="!h-9 !min-h-9 !px-2 !text-xs"
              onClick={onSetPrimary}
            >
              {t('comics.setPrimary')}
            </Button>
          )}
          <Button
            variant="ghost"
            className="!h-9 !min-h-9 !px-2 !text-xs"
            onClick={onPlay}
          >
            {t('comics.openPageVideo')}
          </Button>
          <Button
            variant="danger"
            className="!h-9 !min-h-9 !px-2 !text-xs"
            onClick={onDelete}
          >
            {t('comics.deleteVersion')}
          </Button>
        </div>
      </div>
    </article>
  )
}

function VideoPoster({
  path,
  fallbackStill
}: {
  path: string
  fallbackStill?: string | null
}): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    setFailed(false)
    setUrl(null)
    void getApi()
      .media.toPreviewUrl(path)
      .then((r) => {
        if (alive) setUrl(r.url)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [path])
  if (failed || !url) {
    if (fallbackStill) {
      return (
        <LocalMediaImage
          filePath={fallbackStill}
          alt=""
          variant="fill"
          showActions={false}
          className="h-full w-full object-cover"
        />
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-ink-500">
        ▶
      </div>
    )
  }
  return (
    <video
      src={url}
      muted
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
    />
  )
}

export function ComicVideoPlayerDialog({
  path,
  title,
  onClose
}: {
  path: string | null
  title: string
  onClose: () => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let alive = true
    void getApi()
      .media.toPreviewUrl(path)
      .then((r) => {
        if (!alive) return
        const sep = r.url.includes('?') ? '&' : '?'
        setUrl(`${r.url}${sep}p=${encodeURIComponent(path)}`)
      })
      .catch((err) => {
        toast.error(formatUserError(parseIpcError(err).message, t))
        onClose()
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play one path
  }, [path])
  if (!path) return null
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-4 py-2.5">
          <span className="truncate text-sm font-medium text-ink-100">
            {title}
          </span>
          <button
            type="button"
            className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-800"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>
        {url ? (
          <video
            key={url}
            src={url}
            controls
            autoPlay
            className="max-h-[80vh] w-full bg-black"
          />
        ) : (
          <div className="px-4 py-10 text-center text-sm text-ink-400">
            {t('common.loading')}
          </div>
        )}
      </div>
    </div>
  )
}
