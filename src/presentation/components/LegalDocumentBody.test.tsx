import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, string>) =>
      o ? `${k}:${o.version ?? ''}` : k,
    i18n: { language: 'en' }
  })
}))

import { LegalDocumentBody } from './LegalDocumentBody'

describe('LegalDocumentBody', () => {
  afterEach(() => cleanup())

  it('renders disclaimer sections', () => {
    render(<LegalDocumentBody kind="disclaimer" />)
    expect(screen.getByText('legal.disclaimerTitle')).toBeTruthy()
    expect(screen.getByText(/legal.versionLabel/)).toBeTruthy()
  })

  it('renders terms sections', () => {
    render(<LegalDocumentBody kind="terms" />)
    expect(screen.getByText('legal.termsTitle')).toBeTruthy()
  })
})
