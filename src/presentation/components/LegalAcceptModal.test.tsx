import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
const isElectron = vi.fn(() => false)

vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => isElectron()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

vi.mock('./LegalDocumentBody', () => ({
  LegalDocumentBody: ({ kind }: { kind: string }) => (
    <div data-testid="body">{kind}</div>
  )
}))

import { LegalAcceptModal } from './LegalAcceptModal'

describe('LegalAcceptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isElectron.mockReturnValue(false)
    api.settings.get = vi.fn().mockResolvedValue({
      legalAcceptedVersion: null
    })
    api.settings.set = vi.fn().mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
  })

  it('opens when legal not accepted', async () => {
    render(<LegalAcceptModal />)
    await waitFor(() =>
      expect(screen.getByText('legal.menuTitle')).toBeTruthy()
    )
    fireEvent.click(screen.getByText('legal.openTerms'))
    expect(screen.getByTestId('body').textContent).toBe('terms')
  })

  it('stays closed when already accepted', async () => {
    const { LEGAL_VERSION } = await import('../../domain/legal')
    api.settings.get = vi.fn().mockResolvedValue({
      legalAcceptedVersion: LEGAL_VERSION
    })
    render(<LegalAcceptModal />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(screen.queryByText('legal.menuTitle')).toBeNull()
  })

  it('opens on settings error', async () => {
    api.settings.get = vi.fn().mockRejectedValue(new Error('x'))
    render(<LegalAcceptModal />)
    await waitFor(() =>
      expect(screen.getByText('legal.menuTitle')).toBeTruthy()
    )
  })

  it('accept requires checkbox then closes', async () => {
    render(<LegalAcceptModal />)
    await waitFor(() => screen.getByText('legal.menuTitle'))
    const acceptBtn = screen.getByText('legal.acceptContinue')
    fireEvent.click(acceptBtn)
    expect(api.settings.set).not.toHaveBeenCalled()

    const checkbox = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('legal.acceptContinue'))
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByText('legal.menuTitle')).toBeNull()
    )
  })

  it('decline calls window.close in electron', async () => {
    isElectron.mockReturnValue(true)
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined)
    render(<LegalAcceptModal />)
    await waitFor(() => screen.getByText('legal.menuTitle'))
    fireEvent.click(screen.getByText('legal.decline'))
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })
})
