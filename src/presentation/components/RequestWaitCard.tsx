/**
 * Settings → App: one wait control for chat, stills, and video.
 */
import { useTranslation } from 'react-i18next'
import type { AppSettings } from '../../types/settings'
import {
  applyRequestWaitPreset,
  CHAT_TIMEOUT_MS_MAX,
  CHAT_TIMEOUT_MS_MIN,
  IMAGE_TIMEOUT_MS_MAX,
  IMAGE_TIMEOUT_MS_MIN,
  minutesFromMs,
  minutesFromSec,
  msFromMinutes,
  REQUEST_WAIT_PRESET_IDS,
  secFromMinutes,
  VIDEO_TIMEOUT_SEC_MAX,
  VIDEO_TIMEOUT_SEC_MIN,
  type RequestWaitPreset
} from '../../domain/requestWait'
import { Label } from './ui'

export type RequestWaitPatch = Pick<
  AppSettings,
  'chatTimeoutMs' | 'imageTimeoutMs' | 'videoTimeoutSec' | 'requestWaitPreset'
>

interface RequestWaitCardProps {
  value: RequestWaitPatch
  onChange: (patch: RequestWaitPatch) => void
}

function chipClass(active: boolean): string {
  return [
    'rounded-xl border px-2.5 py-2.5 text-center text-sm font-medium transition',
    active
      ? 'border-brand-500 bg-brand-950 text-brand-100 ring-1 ring-brand-500/45'
      : 'border-ink-700 bg-ink-950 text-ink-200 hover:border-ink-500 hover:bg-ink-900'
  ].join(' ')
}

function formatMinutes(min: number): string {
  const n = Number.isInteger(min) ? String(min) : min.toFixed(1)
  return n
}

export function RequestWaitCard({
  value,
  onChange
}: RequestWaitCardProps): JSX.Element {
  const { t } = useTranslation()
  const preset = value.requestWaitPreset
  const chatMin = minutesFromMs(value.chatTimeoutMs)
  const imageMin = minutesFromMs(value.imageTimeoutMs)
  const videoMin = minutesFromSec(value.videoTimeoutSec)

  const applyPreset = (id: RequestWaitPreset): void => {
    if (id === 'custom') {
      onChange({ ...value, requestWaitPreset: 'custom' })
      return
    }
    const next = applyRequestWaitPreset(id)
    onChange({ ...next, requestWaitPreset: id })
  }

  const patchCustom = (partial: Partial<RequestWaitPatch>): void => {
    onChange({
      ...value,
      ...partial,
      requestWaitPreset: 'custom'
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>{t('settings.requestWaitTitle')}</Label>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {t('settings.requestWaitHint')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REQUEST_WAIT_PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => applyPreset(id)}
            className={chipClass(preset === id)}
          >
            {t(`settings.requestWaitPresets.${id}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-300">
        {t('settings.requestWaitSummary', {
          chat: formatMinutes(chatMin),
          stills: formatMinutes(imageMin),
          video: formatMinutes(videoMin)
        })}
      </p>
      {preset === 'custom' && (
        <div className="space-y-3 rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
          <WaitSlider
            label={t('settings.requestWaitChat')}
            minMinutes={minutesFromMs(CHAT_TIMEOUT_MS_MIN)}
            maxMinutes={minutesFromMs(CHAT_TIMEOUT_MS_MAX)}
            valueMinutes={chatMin}
            onChange={(min) =>
              patchCustom({ chatTimeoutMs: msFromMinutes(min) })
            }
          />
          <WaitSlider
            label={t('settings.requestWaitStills')}
            minMinutes={minutesFromMs(IMAGE_TIMEOUT_MS_MIN)}
            maxMinutes={minutesFromMs(IMAGE_TIMEOUT_MS_MAX)}
            valueMinutes={imageMin}
            onChange={(min) =>
              patchCustom({ imageTimeoutMs: msFromMinutes(min) })
            }
          />
          <WaitSlider
            label={t('settings.requestWaitVideo')}
            minMinutes={minutesFromSec(VIDEO_TIMEOUT_SEC_MIN)}
            maxMinutes={minutesFromSec(VIDEO_TIMEOUT_SEC_MAX)}
            valueMinutes={videoMin}
            onChange={(min) =>
              patchCustom({ videoTimeoutSec: secFromMinutes(min) })
            }
          />
        </div>
      )}
    </div>
  )
}

function WaitSlider({
  label,
  minMinutes,
  maxMinutes,
  valueMinutes,
  onChange
}: {
  label: string
  minMinutes: number
  maxMinutes: number
  valueMinutes: number
  onChange: (minutes: number) => void
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-ink-400">
          {t('settings.requestWaitMinutes', {
            n: formatMinutes(valueMinutes)
          })}
        </span>
      </div>
      <input
        type="range"
        min={minMinutes}
        max={maxMinutes}
        step={0.5}
        value={valueMinutes}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand-500"
      />
    </div>
  )
}
