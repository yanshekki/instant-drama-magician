import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

const isElectron = vi.fn(() => false)
vi.mock('../../lib/api', () => ({
  isElectron: () => isElectron()
}))

const getStoredAuthToken = vi.fn(() => null as string | null)
const loginWithToken = vi.fn().mockResolvedValue(true)
const setStoredAuthToken = vi.fn()
const clearStoredAuthToken = vi.fn()

vi.mock('../../lib/httpAppClient', () => ({
  getStoredAuthToken: () => getStoredAuthToken(),
  loginWithToken: (t: string) => loginWithToken(t),
  setStoredAuthToken: (t: string) => setStoredAuthToken(t),
  clearStoredAuthToken: () => clearStoredAuthToken()
}))

vi.mock('../../lib/i18n', () => ({
  changeUiLanguage: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' }
  })
}))

import { WebAuthGate } from './WebAuthGate'

describe('WebAuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isElectron.mockReturnValue(false)
    getStoredAuthToken.mockReturnValue(null)
    loginWithToken.mockResolvedValue(true)
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ authRequired: true })
    }) as never
  })

  afterEach(() => cleanup())

  it('passes children through in electron', async () => {
    isElectron.mockReturnValue(true)
    render(
      <WebAuthGate>
        <div>app</div>
      </WebAuthGate>
    )
    expect(screen.getByText('app')).toBeTruthy()
  })

  it('authRequired false opens without token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ authRequired: false })
    }) as never
    render(
      <WebAuthGate>
        <div>open</div>
      </WebAuthGate>
    )
    await waitFor(() => expect(screen.getByText('open')).toBeTruthy())
  })

  it('shows login form and submits token', async () => {
    render(
      <WebAuthGate>
        <div>secret</div>
      </WebAuthGate>
    )
    await waitFor(() =>
      expect(screen.getByText('web.authTitle')).toBeTruthy()
    )
    const input = screen.getByPlaceholderText('web.authTokenPlaceholder')
    fireEvent.change(input, { target: { value: 'tok' } })
    fireEvent.change(screen.getByLabelText('web.language'), {
      target: { value: 'zh-TW' }
    })
    fireEvent.click(screen.getByText('web.authSubmit'))
    await waitFor(() => expect(loginWithToken).toHaveBeenCalledWith('tok'))
    await waitFor(() => expect(screen.getByText('secret')).toBeTruthy())
  })

  it('shows error on failed login', async () => {
    loginWithToken.mockResolvedValue(false)
    render(
      <WebAuthGate>
        <div>x</div>
      </WebAuthGate>
    )
    await waitFor(() => screen.getByText('web.authTitle'))
    fireEvent.change(screen.getByPlaceholderText('web.authTokenPlaceholder'), {
      target: { value: 'bad' }
    })
    fireEvent.click(screen.getByText('web.authSubmit'))
    await waitFor(() =>
      expect(screen.getByText('web.authFail')).toBeTruthy()
    )
  })

  it('uses stored token', async () => {
    getStoredAuthToken.mockReturnValue('stored')
    loginWithToken.mockResolvedValue(true)
    render(
      <WebAuthGate>
        <div>in</div>
      </WebAuthGate>
    )
    await waitFor(() => expect(screen.getByText('in')).toBeTruthy())
  })

  it('clears invalid stored token', async () => {
    getStoredAuthToken.mockReturnValue('bad')
    loginWithToken.mockResolvedValue(false)
    render(
      <WebAuthGate>
        <div>in</div>
      </WebAuthGate>
    )
    await waitFor(() => expect(clearStoredAuthToken).toHaveBeenCalled())
    await waitFor(() => screen.getByText('web.authTitle'))
  })

  it('health fetch error shows login', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('net')) as never
    render(
      <WebAuthGate>
        <div>x</div>
      </WebAuthGate>
    )
    await waitFor(() => screen.getByText('web.authTitle'))
  })
})
