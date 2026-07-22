import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../../lib/api'
import { formatUserError } from '../../lib/formatUserError'
import type { TimelineEntry } from '../../../types/domain'
import { Button } from '../ui'
import { tMediaStatus } from '../../lib/statusLabels'
import {
  safeSeekCurrentTime,
  shouldStartPlay,
  isNearClipEnd,
  shouldFireEnded,
  playVideoSafe
} from './previewPlayerPure'
import { attachPlayStart } from '../uiResidualPure'

interface PreviewPlayerProps {
  entry: TimelineEntry | null
  /** Global timeline time (seconds) */
  playhead: number
  isPlaying: boolean
  onGenerate?: () => void
  generateDisabled?: boolean
  generateLabel?: string
  className?: string
  /**
   * While this clip is playing, report media clock → global time
   * so the timeline playhead follows the video (sequential multi-clip).
   */
  onMediaClock?: (globalTime: number) => void
  /** Fired when this clip’s media reaches its end (or last frame). */
  onClipEnded?: () => void
}

/**
 * Timeline-driven preview: no native controls.
 * - Scrub: parent playhead → seek
 * - Play: video element is the clock; reports time via onMediaClock
 */
export function PreviewPlayer({
  entry,
  playhead,
  isPlaying,
  onGenerate,
  generateDisabled,
  generateLabel,
  className = '',
  onMediaClock,
  onClipEnded
}: PreviewPlayerProps): JSX.Element {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Keep last good src briefly so clip switch does not flash empty. */
  const lastSrcRef = useRef<string | null>(null)
  const endedGuard = useRef(false)
  const playReq = useRef(0)

  // Resolve preview URL for READY media
  useEffect(() => {
    let cancelled = false
    setError(null)
    endedGuard.current = false
    if (!entry?.mediaPath || entry.mediaStatus !== 'READY') {
      setSrc(null)
      return
    }
    const path = entry.mediaPath
    void getApi()
      .media.toPreviewUrl(path)
      .then((r) => {
        if (cancelled) return
        const sep = r.url.includes('?') ? '&' : '?'
        // Stable bust per path so re-gen updates; avoid remount thrash mid-play
        const url = `${r.url}${sep}p=${encodeURIComponent(path)}`
        lastSrcRef.current = url
        setSrc(url)
      })
      .catch((e) => {
        if (!cancelled) setError(formatUserError(e instanceof Error ? e.message : String(e), t))
      })
    return () => {
      cancelled = true
    }
  }, [entry?.id, entry?.mediaPath, entry?.mediaStatus])

  const seekToPlayhead = (v: HTMLVideoElement, force = false): void => {
    if (!entry) return
    const local = Math.max(0, playhead - entry.startTime)
    const clipLen = Math.max(0.05, entry.endTime - entry.startTime)
    const dur =
      Number.isFinite(v.duration) && v.duration > 0 ? v.duration : clipLen
    const target = Math.min(local, Math.max(0, Math.min(dur, clipLen) - 0.04))
    const threshold = force ? 0.02 : isPlaying ? 0.45 : 0.06
    if (Math.abs(v.currentTime - target) > threshold) {
      safeSeekCurrentTime((tt) => {
        v.currentTime = tt
      }, target)
    }
  }

  // Scrub / initial align from parent playhead (when paused, always; when playing, soft)
  useEffect(() => {
    const v = videoRef.current
    if (!v || !src || !entry) return
    if (isPlaying) return // media clock owns time while playing

    const run = (): void => seekToPlayhead(v, true)
    if (v.readyState >= 1) run()
    else {
      v.addEventListener('loadedmetadata', run, { once: true })
      return () => v.removeEventListener('loadedmetadata', run)
    }
  }, [playhead, entry?.id, entry?.startTime, entry?.endTime, src, isPlaying])

  // Play / pause + re-enter clip while still playing
  useEffect(() => {
    const v = videoRef.current
    if (!v || !src || !entry) return

    if (!isPlaying) {
      v.pause()
      seekToPlayhead(v, true)
      return
    }

    endedGuard.current = false
    const req = ++playReq.current

    const start = (): void => {
      if (!shouldStartPlay(playReq.current, req)) return
      seekToPlayhead(v, true)
      playVideoSafe(() => v.play())
    }

    return attachPlayStart({
      readyState: v.readyState,
      start,
      addEventListener: (ev, cb) => v.addEventListener(ev, cb),
      removeEventListener: (ev, cb) => v.removeEventListener(ev, cb),
      load: () => v.load()
    })
  }, [isPlaying, src, entry?.id])

  // Media clock → parent; detect clip end for sequential advance
  useEffect(() => {
    const v = videoRef.current
    if (!v || !entry || !onMediaClock) return

    const clipLen = Math.max(0.05, entry.endTime - entry.startTime)

    const onTime = (): void => {
      if (!isPlaying) return
      const local = v.currentTime || 0
      const global = entry.startTime + local
      onMediaClock(Math.min(global, entry.endTime - 0.001))

      const nearEnd = isNearClipEnd(local, clipLen, v.duration)
      if (nearEnd && !endedGuard.current) {
        endedGuard.current = true
        v.pause()
        onClipEnded?.()
      }
    }

    const onEnded = (): void => {
      if (!shouldFireEnded(isPlaying, endedGuard.current)) return
      endedGuard.current = true
      onMediaClock(entry.endTime - 0.001)
      onClipEnded?.()
    }

    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('ended', onEnded)
    }
  }, [
    entry?.id,
    entry?.startTime,
    entry?.endTime,
    isPlaying,
    onMediaClock,
    onClipEnded,
    src
  ])

  const shell = [
    'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-800/80 shadow-lg shadow-black/30',
    className
  ]
    .filter(Boolean)
    .join(' ')

  if (!entry) {
    return (
      <div
        className={[
          shell,
          'items-center justify-center border-dashed bg-ink-900/30 text-xs text-ink-500'
        ].join(' ')}
      >
        {t('timeline.previewEmpty')}
      </div>
    )
  }

  if (entry.mediaStatus !== 'READY' || !entry.mediaPath) {
    return (
      <div
        className={[
          shell,
          'items-center justify-center gap-3 bg-ink-900/40 text-xs text-ink-400'
        ].join(' ')}
      >
        <div className="text-center">
          <span className="block font-medium text-ink-200">
            {t('timeline.previewNoMedia')}
          </span>
          <span className="mt-1 inline-block rounded-full bg-ink-800 px-2 py-0.5 text-[10px] tracking-wide text-ink-400">
            {tMediaStatus(t, entry.mediaStatus)}
          </span>
        </div>
        {onGenerate && (
          <Button
            variant="secondary"
            className="!text-xs"
            disabled={generateDisabled}
            onClick={onGenerate}
          >
            {generateLabel ?? t('timeline.generateClip')}
          </Button>
        )}
        {isPlaying && (
          <p className="text-[10px] text-ink-500">{t('timeline.skipEmptyHint')}</p>
        )}
      </div>
    )
  }

  const displaySrc = src ?? lastSrcRef.current

  return (
    <div className={[shell, 'bg-black'].join(' ')}>
      {error && <p className="shrink-0 p-2 text-xs text-rose-300">{error}</p>}
      {displaySrc ? (
        <video
          ref={videoRef}
          src={src ?? undefined}
          className="h-full min-h-0 w-full flex-1 object-contain"
          playsInline
          preload="auto"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-ink-500">
          {t('common.loading')}
        </div>
      )}
    </div>
  )
}
