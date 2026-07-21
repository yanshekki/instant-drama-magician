import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

vi.mock('./LegalDocumentBody', () => ({
  LegalDocumentBody: ({ kind }: { kind: string }) => (
    <div data-testid="body">{kind}</div>
  )
}))

import {
  LegalDocumentModal,
  openLegalDocument,
  LEGAL_OPEN_EVENT
} from './LegalDocumentModal'

describe('LegalDocumentModal', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('openLegalDocument dispatches event', () => {
    const spy = vi.fn()
    window.addEventListener(LEGAL_OPEN_EVENT, spy)
    openLegalDocument('terms')
    expect(spy).toHaveBeenCalled()
    window.removeEventListener(LEGAL_OPEN_EVENT, spy)
  })

  it('opens on event, switches tabs, closes', () => {
    render(<LegalDocumentModal />)
    expect(screen.queryByTestId('body')).toBeNull()

    act(() => {
      openLegalDocument('terms')
    })
    expect(screen.getByTestId('body').textContent).toBe('terms')

    fireEvent.click(screen.getByText('legal.openDisclaimer'))
    expect(screen.getByTestId('body').textContent).toBe('disclaimer')

    fireEvent.click(screen.getByText('common.close'))
    expect(screen.queryByTestId('body')).toBeNull()
  })

  it('defaults kind to disclaimer', () => {
    render(<LegalDocumentModal />)
    act(() => {
      openLegalDocument()
    })
    expect(screen.getByTestId('body').textContent).toBe('disclaimer')
  })
})
