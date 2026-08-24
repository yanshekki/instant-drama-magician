/**
 * Appearance field kit — wraps FieldKitBuilder with encyclopedia spec + chrome.
 */
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import {
  APPEARANCE_KIT,
  type AppearanceKitSelection
} from '../../domain/characterAppearanceKit'
import { FieldKitBuilder } from './FieldKitBuilder'

export function AppearanceKitBuilder({
  kit,
  onChange,
  onApply,
  disabled,
  children
}: {
  kit: AppearanceKitSelection
  onChange: (kit: AppearanceKitSelection) => void
  onApply: (assembled: string) => void
  disabled?: boolean
  children?: ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <FieldKitBuilder
      spec={APPEARANCE_KIT}
      kit={kit}
      onChange={(next) => onChange(next as AppearanceKitSelection)}
      onApply={onApply}
      disabled={disabled}
      toggleLabel={t('characters.appearanceKitToggle')}
      hint={t('characters.appearanceKitHint')}
      applyLabel={t('characters.appearanceKitApply')}
      notesPlaceholder={t('characters.appearanceKitNotesPh')}
    >
      {children}
    </FieldKitBuilder>
  )
}
