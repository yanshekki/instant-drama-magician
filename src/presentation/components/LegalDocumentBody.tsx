/**
 * Renders disclaimer or acceptable-use sections from i18n.
 */
import { useTranslation } from 'react-i18next'
import {
  LEGAL_DISCLAIMER_SECTIONS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_TERMS_SECTIONS,
  LEGAL_VERSION,
  type LegalDocKind
} from '../../domain/legal'

export function LegalDocumentBody({
  kind
}: {
  kind: LegalDocKind
}): JSX.Element {
  const { t } = useTranslation()
  const sections =
    kind === 'disclaimer' ? LEGAL_DISCLAIMER_SECTIONS : LEGAL_TERMS_SECTIONS
  const ns = kind === 'disclaimer' ? 'legal.disclaimer' : 'legal.terms'
  const titleKey =
    kind === 'disclaimer' ? 'legal.disclaimerTitle' : 'legal.termsTitle'

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-ink-50">{t(titleKey)}</h3>
        <p className="mt-1 text-[11px] text-ink-500">
          {t('legal.versionLabel', {
            version: LEGAL_VERSION,
            date: LEGAL_EFFECTIVE_DATE
          })}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          {t('legal.introNote')}
        </p>
      </div>
      {sections.map((id) => (
        <section key={id} className="space-y-1.5">
          <h4 className="text-sm font-semibold text-ink-100">
            {t(`${ns}.${id}Title`)}
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
            {t(`${ns}.${id}Body`)}
          </p>
        </section>
      ))}
    </div>
  )
}
