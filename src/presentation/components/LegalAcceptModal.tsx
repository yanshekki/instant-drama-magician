/**
 * Blocking gate until user accepts current LEGAL_VERSION.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, isElectron } from '../../lib/api'
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  needsLegalAccept,
  type LegalDocKind
} from '../../domain/legal'
import { LegalDocumentBody } from './LegalDocumentBody'
import { Button } from './ui'

export function LegalAcceptModal(): JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<LegalDocKind>('disclaimer')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getApi()
      .settings.get()
      .then((s) => {
        setOpen(needsLegalAccept(s))
      })
      .catch(() => {
        // If settings fail, still require accept for safety
        setOpen(true)
      })
  }, [])

  if (!open) return null

  const accept = async (): Promise<void> => {
    if (!checked || busy) return
    setBusy(true)
    try {
      await getApi().settings.set({
        legalAcceptedVersion: LEGAL_VERSION,
        legalAcceptedAt: new Date().toISOString()
      })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const decline = (): void => {
    if (isElectron()) {
      // Best-effort quit via window close
      window.close()
    }
    // Web: keep modal open
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay/80 p-3 sm:p-6">
      <div className="flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-xl">
        <div className="border-b border-ink-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-ink-50">
            {t('legal.menuTitle')}
          </h2>
          <p className="mt-1 text-xs text-ink-400">
            {t('legal.versionLabel', {
              version: LEGAL_VERSION,
              date: LEGAL_EFFECTIVE_DATE
            })}
          </p>
          <p className="mt-2 text-xs text-ink-500">{t('legal.scrollHint')}</p>
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

        <div className="space-y-3 border-t border-ink-800 px-5 py-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-200">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-600"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>{t('legal.acceptCheckbox')}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void accept()}
              disabled={!checked || busy}
            >
              {t('legal.acceptContinue')}
            </Button>
            <Button
              variant="secondary"
              onClick={decline}
              disabled={busy}
            >
              {t('legal.decline')}
            </Button>
          </div>
          <p className="text-[11px] text-ink-500">{t('legal.declineHint')}</p>
        </div>
      </div>
    </div>
  )
}
