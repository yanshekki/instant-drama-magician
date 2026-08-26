import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, isWebRuntime } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import { useToast } from '../context/ToastContext'
import { Button } from './ui'

/** True `<video>` player for a library path (photo-book film, not a still thumbnail). */
export function LocalMediaVideo({
  filePath,
  className = '',
  maxHeightClass = 'max-h-[min(28vh,280px)]'
}: {
  filePath?: string | null
  className?: string
  maxHeightClass?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  const toast = useToast()
  const web = isWebRuntime()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const path = filePath?.trim() || ''

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    if (!path) return
    void getApi()
      .media.toPreviewUrl(path)
      .then((r) => {
        if (!cancelled) setUrl(r.url)
      })
      .catch((e) => {
        if (cancelled) return
        setError(formatUserError(parseIpcError(e).message, t))
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!path) return null

  const saveLabel = web ? t('media.download') : t('characters.photoBookSaveFilm')

  const handleSave = async (): Promise<void> => {
    if (saveBusy) return
    setSaveBusy(true)
    try {
      const r = await getApi().media.saveAs(path)
      if (r?.filePath || r?.downloadUrl) {
        toast.success(web ? t('media.downloaded') : t('media.savedAs'))
      }
    } catch (err) {
      toast.error(formatUserError(parseIpcError(err).message, t))
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div
      className={[
        'flex flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-950/80',
        className
      ].join(' ')}
    >
      {error ? (
        <p className="px-3 py-6 text-center text-[11px] text-rose-200">{error}</p>
      ) : url ? (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className={['w-full bg-black', maxHeightClass].join(' ')}
        />
      ) : (
        <div
          className={[
            'flex items-center justify-center bg-ink-950/60 text-[10px] text-ink-500',
            maxHeightClass
          ].join(' ')}
        >
          …
        </div>
      )}
      <div className="border-t border-ink-800 p-2">
        <Button
          variant="secondary"
          className="w-full !h-9 !text-xs"
          disabled={saveBusy || !url}
          onClick={() => void handleSave()}
        >
          {saveBusy ? t('common.loading') : saveLabel}
        </Button>
      </div>
    </div>
  )
}
