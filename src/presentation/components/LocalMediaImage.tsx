import { useEffect, useState } from 'react'
import { getApi } from '../../lib/api'

interface LocalMediaImageProps {
  filePath: string | null | undefined
  alt?: string
  className?: string
  /** max height class; form preview defaults large */
  maxHeightClass?: string
  /** show native pixel size under image */
  showMeta?: boolean
}

/**
 * Preview a local media path via idm-media:// (main process allowlist).
 */
export function LocalMediaImage({
  filePath,
  alt = '',
  className = '',
  maxHeightClass = 'max-h-[min(70vh,720px)]',
  showMeta = false
}: LocalMediaImageProps): JSX.Element | null {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dims, setDims] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    setDims(null)
    if (!filePath) return
    void getApi()
      .media.toPreviewUrl(filePath)
      .then((r) => {
        if (!cancelled) setUrl(r.url)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  if (!filePath) return null

  if (error) {
    return (
      <p className="rounded-lg bg-rose-950/40 px-2 py-1 text-[11px] text-rose-200">
        {error}
      </p>
    )
  }

  if (!url) {
    return (
      <div
        className={[
          'flex items-center justify-center rounded-xl border border-ink-800 bg-ink-950/60 text-xs text-ink-500',
          maxHeightClass,
          'min-h-[12rem] w-full'
        ].join(' ')}
      >
        …
      </div>
    )
  }

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border border-ink-800 bg-black/40',
        className
      ].join(' ')}
    >
      <img
        src={url}
        alt={alt}
        className={['w-full object-contain', maxHeightClass].join(' ')}
        onLoad={(e) => {
          const img = e.currentTarget
          setDims(`${img.naturalWidth}×${img.naturalHeight}px`)
        }}
      />
      {showMeta && dims && (
        <p className="border-t border-ink-800 px-2 py-1 text-center text-[10px] text-ink-500">
          {dims}
        </p>
      )}
    </div>
  )
}
