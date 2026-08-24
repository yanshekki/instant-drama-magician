/**
 * Collapsible per-part template picker. Assembled text is applied to a parent
 * textarea; the panel collapses after Apply.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FIELD_KIT_PAGE_SIZE,
  assembleFieldKitPrompt,
  countFieldKitParts,
  emptyFieldKit,
  fieldKitHasSelection,
  fieldKitPartLabel,
  fieldKitSearchHaystack,
  fieldKitTemplateKeywords,
  fieldKitTemplateLabel,
  fieldKitTemplateStructure,
  listFieldKitTemplates,
  paginateItems,
  setFieldKitPart,
  type FieldKitSelection,
  type FieldKitSpec,
  type FieldKitTemplate
} from '../../domain/fieldKit'
import { matchesSearchQuery } from '../lib/searchQuery'
import { LibraryPagination } from './LibraryBrowseBar'
import { Button, Textarea } from './ui'

export function FieldKitBuilder({
  spec,
  kit,
  onChange,
  onApply,
  disabled,
  children,
  toggleLabel,
  hint,
  applyLabel,
  notesPlaceholder
}: {
  spec: FieldKitSpec
  kit: FieldKitSelection
  onChange: (kit: FieldKitSelection) => void
  onApply: (assembled: string) => void
  disabled?: boolean
  children?: ReactNode
  toggleLabel?: string
  hint?: string
  applyLabel?: string
  notesPlaceholder?: string
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [open, setOpen] = useState(false)
  const [part, setPart] = useState<string>(spec.parts[0] ?? '')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const selectedCount = countFieldKitParts(spec, kit)
  const preview = useMemo(
    () => assembleFieldKitPrompt(spec, kit, locale),
    [spec, kit, locale]
  )
  const canApply = fieldKitHasSelection(spec, kit) && Boolean(preview)

  const templates = listFieldKitTemplates(spec, part)
  const filtered = useMemo(() => {
    return templates.filter((def) =>
      matchesSearchQuery(fieldKitSearchHaystack(def, locale), q)
    )
  }, [templates, locale, q])

  useEffect(() => {
    setPage(1)
  }, [part, q])

  useEffect(() => {
    if (!spec.parts.includes(part)) {
      setPart(spec.parts[0] ?? '')
    }
  }, [spec, part])

  const paged = paginateItems(filtered, page, FIELD_KIT_PAGE_SIZE)

  const pick = (id: string): void => {
    if (disabled) return
    const current = kit[part]
    onChange(setFieldKitPart(spec, kit, part, current === id ? null : id))
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-ink-800 bg-ink-900/40 px-2.5 py-1 text-[11px] text-ink-200 transition hover:border-ink-600 hover:bg-ink-800/50 disabled:opacity-50"
        >
          <span className="font-medium text-ink-100">
            {toggleLabel ?? t('common.fieldKitToggle')}
          </span>
          <span className="tabular-nums text-ink-500">
            {t('common.fieldKitCount', { n: selectedCount })}
          </span>
        </button>
      </div>
      {children}

      {open ? (
        <div className="space-y-3 rounded-xl border border-ink-800 bg-ink-950/40 p-3">
          <p className="text-[11px] leading-relaxed text-ink-500">
            {hint ?? t('common.fieldKitHint')}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {spec.parts.map((id) => {
              const active = part === id
              const picked = Boolean(kit[id])
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPart(id)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[11px] transition',
                    active
                      ? 'border-brand-500 bg-brand-950/50 text-brand-100'
                      : picked
                        ? 'border-brand-700/60 bg-ink-900 text-ink-100'
                        : 'border-ink-800 bg-ink-900/40 text-ink-400 hover:border-ink-600'
                  ].join(' ')}
                >
                  {fieldKitPartLabel(spec, id, locale)}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              disabled={disabled}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('common.fieldKitSearch')}
              className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-50"
            />
            <Button
              variant="ghost"
              disabled={disabled}
              className="!h-9 !min-h-9 !text-xs"
              onClick={() => onChange(setFieldKitPart(spec, kit, part, null))}
            >
              {t('common.fieldKitSkip')}
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-[11px] text-ink-500">{t('common.fieldKitEmpty')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {paged.items.map((def, i) => (
                  <FieldKitCard
                    key={`${def.part}-${def.id}`}
                    def={def}
                    index={templates.findIndex((d) => d.id === def.id)}
                    selected={kit[part] === def.id}
                    disabled={disabled}
                    locale={locale}
                    onPick={() => pick(def.id)}
                    fallbackIndex={(paged.page - 1) * FIELD_KIT_PAGE_SIZE + i}
                  />
                ))}
              </div>
              <LibraryPagination
                page={paged.page}
                totalPages={paged.totalPages}
                onPageChange={setPage}
                filteredCount={filtered.length}
                totalCount={templates.length}
                disabled={disabled}
              />
            </>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] text-ink-400">
              {t('common.fieldKitNotes')}
            </span>
            <Textarea
              size="sm"
              disabled={disabled}
              value={kit.notes ?? ''}
              placeholder={notesPlaceholder ?? t('common.fieldKitNotesPh')}
              onChange={(e) =>
                onChange({
                  ...kit,
                  notes: e.target.value
                })
              }
            />
          </label>

          {preview ? (
            <div className="space-y-1">
              <p className="text-[11px] text-ink-400">
                {t('common.fieldKitPreview')}
              </p>
              <p className="whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/70 px-3 py-2 text-[11px] leading-relaxed text-ink-300">
                {preview}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              disabled={disabled || !canApply}
              className="w-full !text-xs sm:w-auto"
              onClick={() => {
                onApply(preview)
                setOpen(false)
              }}
            >
              {applyLabel ?? t('common.fieldKitApply')}
            </Button>
            <Button
              variant="secondary"
              disabled={disabled || !fieldKitHasSelection(spec, kit)}
              className="w-full !text-xs sm:w-auto"
              onClick={() => onChange(emptyFieldKit())}
            >
              {t('common.fieldKitClear')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FieldKitCard({
  def,
  index,
  selected,
  disabled,
  locale,
  onPick,
  fallbackIndex
}: {
  def: FieldKitTemplate
  index: number
  selected: boolean
  disabled?: boolean
  locale: string
  onPick: () => void
  fallbackIndex: number
}): JSX.Element {
  const n = String((index >= 0 ? index : fallbackIndex) + 1).padStart(2, '0')
  const keywords = fieldKitTemplateKeywords(def, locale)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={[
        'rounded-xl border p-3 text-left text-xs transition',
        selected
          ? 'border-brand-500 bg-brand-950/40'
          : 'border-ink-800 bg-ink-900/40 hover:border-ink-600'
      ].join(' ')}
    >
      <div className="font-medium text-ink-100">
        {n} · {fieldKitTemplateLabel(def, locale)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {keywords.map((k, ki) => (
          <span
            key={`${k}-${ki}`}
            className="rounded-full bg-ink-800/90 px-2 py-0.5 text-[10px] text-ink-300"
          >
            {k}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
        {fieldKitTemplateStructure(def, locale)}
      </p>
    </button>
  )
}
