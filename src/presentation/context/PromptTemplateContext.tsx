/**
 * Pick a prompt recipe before any LLM improve / generate.
 * Tests skip the dialog and use the safe default.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  templatesForFamily,
  type PromptTemplateFamily,
  type PromptTemplateId
} from '../../domain/promptTemplates'
import { Button } from '../components/ui'
import { RecipeCompareStars } from '../components/RecipeCompareStars'
import {
  readPromptTemplatePrefs,
  rememberedTemplate,
  withRemembered,
  writePromptTemplatePrefs
} from '../lib/promptTemplatePref'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Selected card must use `brand-*` (theme tokens). `accent-*` is not defined. */
export function recipePickerCardClass(active: boolean): string {
  return active
    ? 'border-2 border-brand-600 bg-brand-950 ring-2 ring-brand-600/50'
    : 'border border-ink-700 bg-ink-950/40 hover:border-ink-500'
}

function inVitest(): boolean {
  return Boolean(
    (import.meta as { env?: { MODE?: string; VITEST?: boolean } }).env
      ?.VITEST ||
      (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test'
  )
}

type Pending = {
  family: PromptTemplateFamily
  selected: PromptTemplateId
  always: boolean
  resolve: (id: PromptTemplateId | null) => void
}

interface PromptTemplateContextValue {
  pick: (family: PromptTemplateFamily) => Promise<PromptTemplateId | null>
}

const Ctx = createContext<PromptTemplateContextValue | null>(null)

export function PromptTemplateProvider({
  children
}: {
  children: ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)

  const pick = useCallback(
    (family: PromptTemplateFamily): Promise<PromptTemplateId | null> => {
      const remembered = rememberedTemplate(
        family,
        readPromptTemplatePrefs(storage())
      )
      if (inVitest() || remembered.always) {
        return Promise.resolve(remembered.id)
      }
      return new Promise((resolve) => {
        setPending({
          family,
          selected: remembered.id,
          always: false,
          resolve
        })
      })
    },
    []
  )

  const close = (ok: boolean): void => {
    if (!pending) return
    if (!ok) {
      pending.resolve(null)
      setPending(null)
      return
    }
    const next = withRemembered(
      readPromptTemplatePrefs(storage()),
      pending.family,
      pending.selected,
      pending.always
    )
    writePromptTemplatePrefs(next, storage())
    pending.resolve(pending.selected)
    setPending(null)
  }

  const value = useMemo(() => ({ pick }), [pick])
  const ids = pending ? templatesForFamily(pending.family) : []

  return (
    <Ctx.Provider value={value}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          role="presentation"
        >
          <div
            className="absolute inset-0 bg-overlay/70 backdrop-blur-sm"
            aria-hidden
            onClick={() => close(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-tpl-title"
            className="relative z-[1] flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-theme-md"
          >
            <div className="border-b border-ink-800/80 px-5 py-4">
              <h2
                id="prompt-tpl-title"
                className="text-base font-semibold tracking-tight text-ink-50"
              >
                {t('promptTpl.title')}
              </h2>
              <p className="mt-1 text-xs text-ink-400">
                {t('promptTpl.subtitle')}
              </p>
            </div>
            <div
              className="flex flex-col gap-2 overflow-y-auto px-5 py-4"
              role="radiogroup"
              aria-labelledby="prompt-tpl-title"
            >
              {ids.map((id) => {
                const active = pending.selected === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      setPending((cur) =>
                        cur ? { ...cur, selected: id } : cur
                      )
                    }
                    className={`rounded-xl px-3 py-2.5 text-left transition ${
                      recipePickerCardClass(active)
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={
                          active
                            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-brand-600 bg-brand-600 text-[11px] font-bold text-white'
                            : 'mt-0.5 flex h-5 w-5 shrink-0 rounded-full border-2 border-ink-500 bg-ink-900'
                        }
                      >
                        {active ? '✓' : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div
                            className={`text-sm ${
                              active
                                ? 'font-semibold text-ink-50'
                                : 'font-medium text-ink-50'
                            }`}
                          >
                            {t(`promptTpl.${id}.name`)}
                          </div>
                          {active ? (
                            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {t('promptTpl.selected')}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs leading-relaxed text-ink-400">
                          {t(`promptTpl.${id}.blurb`)}
                        </div>
                        <RecipeCompareStars
                          id={id}
                          family={pending.family}
                          labelFor={(axis) => t(`promptTpl.axis.${axis}`)}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
              <label className="mt-1 flex items-center gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  checked={pending.always}
                  onChange={(e) =>
                    setPending((cur) =>
                      cur ? { ...cur, always: e.target.checked } : cur
                    )
                  }
                />
                {t('promptTpl.remember')}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-800/80 bg-ink-950/50 px-5 py-3.5">
              <Button variant="secondary" onClick={() => close(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => close(true)}>
                {t('promptTpl.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function usePromptTemplate(): PromptTemplateContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('usePromptTemplate must be used within PromptTemplateProvider')
  }
  return ctx
}

/** Safe pick when provider may be missing (unit tests of isolated pages). */
export function useOptionalPromptTemplate(): PromptTemplateContextValue {
  const ctx = useContext(Ctx)
  return (
    ctx ?? {
      pick: (family) =>
        Promise.resolve(rememberedTemplate(family, {}).id)
    }
  )
}
