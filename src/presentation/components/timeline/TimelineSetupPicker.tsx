import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings } from '../../../types/settings'
import { Button, Label } from '../ui'
import {
  ProviderChannelPicker,
  type ChannelPickerValue
} from '../ProviderChannelPicker'

interface TimelineSetupPickerProps {
  open: boolean
  clipSeconds: 6 | 10
  settings: Pick<AppSettings, 'imageProvider' | 'videoProvider'> | null
  busy?: boolean
  onClose: () => void
  onApply: (next: {
    clipSeconds: 6 | 10
    imageProvider: ChannelPickerValue
    videoProvider: ChannelPickerValue
  }) => void
}

export function TimelineSetupPicker({
  open,
  clipSeconds,
  settings,
  busy,
  onClose,
  onApply
}: TimelineSetupPickerProps): JSX.Element | null {
  const { t } = useTranslation()
  const [seconds, setSeconds] = useState<6 | 10>(clipSeconds)
  const [imageProvider, setImageProvider] = useState<ChannelPickerValue>(
    (settings?.imageProvider as ChannelPickerValue) || 'same-as-llm'
  )
  const [videoProvider, setVideoProvider] = useState<ChannelPickerValue>(
    (settings?.videoProvider as ChannelPickerValue) || 'same-as-llm'
  )

  useEffect(() => {
    if (!open) return
    setSeconds(clipSeconds)
    setImageProvider(
      (settings?.imageProvider as ChannelPickerValue) || 'same-as-llm'
    )
    setVideoProvider(
      (settings?.videoProvider as ChannelPickerValue) || 'same-as-llm'
    )
  }, [open, clipSeconds, settings?.imageProvider, settings?.videoProvider])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('timeline.graph.setup')}
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-950 shadow-theme-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-800 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-50">
            {t('timeline.graph.setup')}
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {t('timeline.graph.setupHint')}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Label>{t('timeline.clipDuration')}</Label>
          <div className="mt-1.5 flex gap-2">
            {([6, 10] as const).map((sec) => (
              <Button
                key={sec}
                variant={seconds === sec ? 'primary' : 'secondary'}
                className="min-w-[4.5rem] !py-1.5 text-xs"
                disabled={busy}
                onClick={() => setSeconds(sec)}
              >
                {sec}s
              </Button>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
            {t('timeline.clipDurationHint')}
          </p>

          <div className="mt-5">
            <Label>{t('settings.imageProvider')}</Label>
            <div className="mt-2">
              <ProviderChannelPicker
                channel="image"
                value={imageProvider}
                onChange={setImageProvider}
                disabled={busy}
              />
            </div>
          </div>
          <div className="mt-5">
            <Label>{t('settings.videoProvider')}</Label>
            <div className="mt-2">
              <ProviderChannelPicker
                channel="video"
                value={videoProvider}
                onChange={setVideoProvider}
                disabled={busy}
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-ink-800 bg-ink-900/40 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              onApply({
                clipSeconds: seconds,
                imageProvider,
                videoProvider
              })
            }
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
