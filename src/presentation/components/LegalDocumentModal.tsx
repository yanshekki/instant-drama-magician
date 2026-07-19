/**
 * Read-only re-open of disclaimer / terms (Settings, Help menu).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LegalDocKind } from '../../domain/legal'
import { LegalDocumentBody } from './LegalDocumentBody'
import { Button } from './ui'

export const LEGAL_OPEN_EVENT = 'idm:legal-open'

export type LegalOpenDetail = { kind?: LegalDocKind }

export function openLegalDocument(kind: LegalDocKind = 'disclaimer'): void {
  window.dispatchEvent(
    new CustomEvent(LEGAL_OPEN_EVENT, { detail: { kind } satisfies LegalOpenDetail })
  )
}

export function LegalDocumentModal(): JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<LegalDocKind>('disclaimer')

  useEffect(() => {
    const onOpen = (ev: Event): void => {
      const ce = ev as CustomEvent<LegalOpenDetail>
      setTab(ce.detail?.kind === 'terms' ? 'terms' : 'disclaimer')
      setOpen(true)
    }
    window.addEventListener(LEGAL_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(LEGAL_OPEN_EVENT, onOpen)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-overlay/70 p-3 sm:p-6">
      <div className="flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-5 py-3">
          <h2 className="text-base font-semibold text-ink-50">
            {t('legal.menuTitle')}
          </h2>
          <Button
            variant="secondary"
            className="!h-8 !px-2.5 !text-xs"
            onClick={() => setOpen(false)}
          >
            {t('common.close')}
          </Button>
        </div>
        <div className="flex gap-1 border-b border-ink-800 px-3 pt-2">
          {(
            [
              { id: 'disclaimer' as const, label: t('legal.openDisclaimer') },
              { id: 'terms' as const, label: t('legal.openTerms') }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                'rounded-t-lg px-3 py-2 text-sm font-medium transition',
                tab === item.id
                  ? 'bg-ink-800 text-brand-200 ring-1 ring-ink-700'
                  : 'text-ink-400 hover:text-ink-200'
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <LegalDocumentBody kind={tab} />
        </div>
      </div>
    </div>
  )
}
