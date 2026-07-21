import { onlineChipClass } from '../../domain/residualLabels'
/**
 * Grouped professional picker for OpenAI-compatible LLM presets.
 */
import { useTranslation } from 'react-i18next'
import {
  LLM_GROUP_ORDER,
  LLM_PRESET_CATALOG,
  type LlmProviderGroup,
  type LlmProviderPreset,
  providerCaps
} from '../../domain/openaiCompatible'

interface LlmProviderPickerProps {
  value: LlmProviderPreset
  onChange: (preset: LlmProviderPreset) => void
  disabled?: boolean
}

const GROUP_BADGE: Record<LlmProviderGroup, string> = {
  recommended: 'bg-brand-950/80 text-brand-200 border-brand-800/50',
  cloud: 'bg-sky-950/80 text-sky-200 border-sky-800/60',
  local: 'bg-emerald-950/80 text-emerald-200 border-emerald-800/50',
  advanced: 'bg-ink-800 text-ink-300 border-ink-700'
}

export function LlmProviderPicker({
  value,
  onChange,
  disabled
}: LlmProviderPickerProps): JSX.Element {
  const { t } = useTranslation()
  const caps = providerCaps(value)

  return (
    <div className="space-y-4">
      {LLM_GROUP_ORDER.map((group) => {
        const items = LLM_PRESET_CATALOG.filter((p) => p.group === group)
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
              {items.map((p) => {
                const active = value === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(p.id)}
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
                        {t(`settings.llmPreset.${p.labelKey}`)}
                      </span>
                      {active && (
                        <span className="shrink-0 text-[10px] font-medium text-brand-400">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-ink-400">
                      {t(`settings.llmPresetHint.${p.hintKey}`)}
                    </p>
                  </button>
                )
              })}
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

function CapPill({ on, label }: { on: boolean; label: string }): JSX.Element {
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-medium',
        onlineChipClass(on)
      ].join(' ')}
    >
      {on ? '✓ ' : '— '}
      {label}
    </span>
  )
}
