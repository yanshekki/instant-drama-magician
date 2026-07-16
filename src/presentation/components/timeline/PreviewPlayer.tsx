import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../../lib/api'
import type { TimelineEntry } from '../../../types/domain'

interface PreviewPlayerProps {
  entry: TimelineEntry | null
  playhead: number
  isPlaying: boolean
}

export function PreviewPlayer({
  entry,
  playhead,
  isPlaying
}: PreviewPlayerProps): JSX.Element {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setSrc(null)
    if (!entry?.mediaPath || entry.mediaStatus !== 'READY') return
    void getApi()
      .media.toPreviewUrl(entry.mediaPath)
      .then((r) => {
        if (!cancelled) setSrc(r.url)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [entry?.id, entry?.mediaPath, entry?.mediaStatus])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !entry) return
    const local = Math.max(0, playhead - entry.startTime)
    if (Math.abs(v.currentTime - local) > 0.35) {
      try {
        v.currentTime = local
      } catch {
        // ignore seek errors while loading
      }
    }
  }, [playhead, entry?.id, entry?.startTime])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) void v.play().catch(() => undefined)
    else v.pause()
  }, [isPlaying, src])

  if (!entry) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-ink-700 text-xs text-ink-500">
        {t('timeline.previewEmpty')}
      </div>
    )
  }

  if (entry.mediaStatus !== 'READY' || !entry.mediaPath) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-ink-800 bg-ink-900/50 text-xs text-ink-400">
        <span className="font-medium text-ink-200">{t('timeline.previewNoMedia')}</span>
        <span className="mt-1 uppercase tracking-wide">{entry.mediaStatus}</span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-800 bg-black">
      {error && <p className="p-2 text-xs text-rose-300">{error}</p>}
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="aspect-video w-full"
          controls
          muted
          playsInline
        />
      ) : (
        <div className="flex h-40 items-center justify-center text-xs text-ink-500">
          {t('common.loading')}
        </div>
      )}
    </div>
  )
}
