/**
 * Grouped picker for image / video channels.
 * Only lists providers whose caps match this channel (image gen / video gen).
 */
import { useTranslation } from 'react-i18next'
import {
  LLM_GROUP_ORDER,
  imageCapablePresets,
  isLlmProviderPreset,
  providerCaps,
  videoCapablePresets,
  type LlmProviderGroup,
  type LlmProviderPreset
} from '../../domain/openaiCompatible'

export type ChannelExtraId =
  | 'same-as-llm'
  | 'stub'
  | 'seedance'
  | 'seedream'

export type ChannelPickerValue = ChannelExtraId | LlmProviderPreset

interface ProviderChannelPickerProps {
  /** 'image' shows same-as-llm; 'video' also shows stub */
  channel: 'image' | 'video'
  value: ChannelPickerValue
  onChange: (id: ChannelPickerValue) => void
  disabled?: boolean
}

/** Theme-aware badges: use CSS-variable colors (work in light + dark). */
const GROUP_BADGE: Record<LlmProviderGroup | 'channel', string> = {
  channel: 'bg-violet-950/80 text-violet-200 border-violet-800/60',
  recommended: 'bg-brand-950/80 text-brand-200 border-brand-800/50',
  cloud: 'bg-sky-950/80 text-sky-200 border-sky-800/60',
  local: 'bg-emerald-950/80 text-emerald-200 border-emerald-800/50',
  advanced: 'bg-ink-800 text-ink-300 border-ink-700'
}

function CapPill({ on, label }: { on: boolean; label: string }): JSX.Element {
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-medium',
        on
          ? 'bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-700/40'
          : 'bg-ink-800 text-ink-500 line-through decoration-ink-600 ring-1 ring-ink-700/60'
      ].join(' ')}
    >
      {label}
    </span>
  )
}

function OptionCard({
  active,
  disabled,
  title,
  hint,
  onClick
}: {
  active: boolean
  disabled?: boolean
  title: string
  hint: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-xl border px-3 py-2.5 text-left transition shadow-theme-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-brand-500 bg-brand-950 ring-1 ring-brand-500/50'
          : 'border-ink-700 bg-ink-900 hover:border-brand-400/50 hover:bg-ink-900'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={[
            'text-sm font-semibold',
            active ? 'text-brand-100' : 'text-ink-100'
          ].join(' ')}
        >
          {title}
        </span>
        {active && (
          <span className="shrink-0 text-[10px] font-medium text-brand-400">
            ✓
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-ink-400">
        {hint}
      </p>
    </button>
  )
}

export function ProviderChannelPicker({
  channel,
  value,
  onChange,
  disabled
}: ProviderChannelPickerProps): JSX.Element {
  const { t } = useTranslation()

  const catalog =
    channel === 'image' ? imageCapablePresets() : videoCapablePresets()

  const caps = isLlmProviderPreset(value)
    ? providerCaps(value)
    : value === 'stub'
      ? { chat: false, image: false, video: true }
      : value === 'seedance'
        ? { chat: false, image: false, video: true }
        : value === 'seedream'
          ? { chat: false, image: true, video: false }
          : { chat: true, image: true, video: true }

  const extras: Array<{ id: ChannelExtraId; title: string; hint: string }> = [
    {
      id: 'same-as-llm',
      title: t('settings.channelPreset.sameAsLlm'),
      hint: t('settings.channelPresetHint.sameAsLlm')
    }
  ]
  if (channel === 'video') {
    extras.push(
      {
        id: 'stub',
        title: t('settings.channelPreset.stub'),
        hint: t('settings.channelPresetHint.stub')
      },
      {
        id: 'seedance',
        title: t('settings.channelPreset.seedance'),
        hint: t('settings.channelPresetHint.seedance')
      }
    )
  }
  if (channel === 'image') {
    extras.push({
      id: 'seedream',
      title: t('settings.channelPreset.seedream'),
      hint: t('settings.channelPresetHint.seedream')
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className={[
              'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              GROUP_BADGE.channel
            ].join(' ')}
          >
            {t('settings.llmGroup.channel')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map((ex) => (
            <OptionCard
              key={ex.id}
              active={value === ex.id}
              disabled={disabled}
              title={ex.title}
              hint={ex.hint}
              onClick={() => onChange(ex.id)}
            />
          ))}
        </div>
      </div>

      {LLM_GROUP_ORDER.map((group) => {
        const items = catalog.filter((p) => p.group === group)
        if (items.length === 0) return null
        return (
          <div key={group}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={[
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                  GROUP_BADGE[group]
                ].join(' ')}
              >
                {t(`settings.llmGroup.${group}`)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <OptionCard
                  key={p.id}
                  active={value === p.id}
                  disabled={disabled}
                  title={t(`settings.llmPreset.${p.labelKey}`)}
                  hint={t(`settings.llmPresetHint.${p.hintKey}`)}
                  onClick={() => onChange(p.id)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 shadow-theme-sm">
        <span className="text-[11px] text-ink-400">
          {t('settings.capabilities')}:
        </span>
        <CapPill on={caps.chat} label={t('settings.capChat')} />
        <CapPill on={caps.image} label={t('settings.capImage')} />
        <CapPill on={caps.video} label={t('settings.capVideo')} />
      </div>
    </div>
  )
}
