import { toggleLanguageCode } from './uiResidualPure'
/**
 * Searchable multi-select for world languages (character spoken languages).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  languageLabel,
  listWorldLanguages
} from '../../domain/worldLanguages'
import { matchesSearchQuery } from '../lib/searchQuery'

interface LanguageMultiPickProps {
  value: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
}

export function LanguageMultiPick({
  value,
  onChange,
  disabled
}: LanguageMultiPickProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const [q, setQ] = useState('')
  const selected = useMemo(() => new Set(value), [value])

  const catalog = useMemo(
    () => listWorldLanguages(i18n.language),
    [i18n.language]
  )

  const filtered = useMemo(() => {
    return catalog.filter((o) =>
      matchesSearchQuery([o.code, o.label].join(' '), q)
    )
  }, [catalog, q])

  const toggle = (code: string): void => {
    if (disabled) return
    onChange(toggleLanguageCode(value, code))
  }

  const remove = (code: string): void => {
    if (disabled) return
    onChange(value.filter((c) => c !== code))
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => remove(code)}
              title={t('characters.spokenLanguagesRemove')}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand-500/60 bg-brand-950/45 px-2.5 py-1 text-left text-[11px] text-brand-100 transition hover:border-brand-400 hover:bg-brand-900/50 disabled:opacity-50"
            >
              <span className="min-w-0 truncate">
                {languageLabel(code, i18n.language)}
              </span>
              <span className="shrink-0 text-brand-300/80" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('characters.spokenLanguagesSearch')}
        className="w-full rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-50"
      />

      <div className="max-h-44 overflow-y-auto rounded-lg border border-ink-700/80 bg-ink-950/40 p-1.5">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-[11px] text-ink-600">
            {t('characters.spokenLanguagesEmpty')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {filtered.map((o) => {
              const on = selected.has(o.code)
              return (
                <button
                  key={o.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(o.code)}
                  className={[
                    'rounded-md border px-2 py-1 text-left text-[11px] transition disabled:opacity-50',
                    on
                      ? 'border-brand-500 bg-brand-950/55 text-brand-100'
                      : 'border-ink-700/80 bg-ink-900/50 text-ink-300 hover:border-ink-500 hover:text-ink-100'
                  ].join(' ')}
                >
                  {on ? '✓ ' : ''}
                  {o.label}
                  <span className="ml-1 text-[9px] text-ink-600">
                    {o.code}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <p className="text-[10px] text-ink-600">
        {t('characters.spokenLanguagesHint', { n: value.length })}
      </p>
    </div>
  )
}
