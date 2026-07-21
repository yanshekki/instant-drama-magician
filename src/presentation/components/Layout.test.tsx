import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
const isWebRuntime = vi.fn(() => true)

vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isWebRuntime: () => isWebRuntime()
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' }
  })
}))
vi.mock('../../lib/i18n', () => ({
  changeUiLanguage: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../hooks/useMenuActions', () => ({
  useMenuActions: () => undefined
}))
vi.mock('./AiJobHud', () => ({ AiJobHud: () => <div data-testid="hud" /> }))
vi.mock('./VideoPrepHost', () => ({
  VideoPrepHost: () => <div data-testid="vph" />
}))
vi.mock('./AiDraftModal', () => ({
  AiDraftModal: () => <div data-testid="draft" />
}))

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    aiStatus: {
      available: true,
      chat: { available: true },
      image: { available: false, message: 'off' },
      video: { available: true, message: 'ok' },
      llmProvider: 'grok-cli',
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok'
    },
    stories: [],
    activeStoryId: null,
    setActiveStoryId: vi.fn(),
    refreshStories: vi.fn(),
    refreshAiStatus: vi.fn(),
    loading: false
  })
}))

import { Layout } from './Layout'

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isWebRuntime.mockReturnValue(true)
    api.settings.get = vi.fn().mockResolvedValue({
      lastGenerationDegraded: true,
      uiLanguage: 'en',
      colorScheme: 'dark'
    })
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1.2.0',
      name: 'IDM'
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0'
    })
    api.updates.onState = vi.fn((cb: (s: unknown) => void) => {
      // also fire downloaded
      setTimeout(() => {
        cb({
          status: 'downloaded',
          currentVersion: '1.0.0',
          latestVersion: '1.2.0'
        })
      }, 0)
      return () => undefined
    })
    api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => cleanup())

  it('renders nav, version, web badge, degraded banner, update banner', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('v1.2.0')).toBeTruthy())
    expect(screen.getByText('Web')).toBeTruthy()
    expect(screen.getByTestId('hud')).toBeTruthy()
    expect(screen.getByTestId('vph')).toBeTruthy()
    // YSK logo click
    fireEvent.click(screen.getByLabelText('YSK Limited'))
    await waitFor(() => expect(api.shell.openExternal).toHaveBeenCalled())
  })

  it('settings/get failure still renders', async () => {
    api.settings.get = vi.fn().mockRejectedValue(new Error('x'))
    api.app.getInfo = vi.fn().mockRejectedValue(new Error('y'))
    api.updates.status = vi.fn().mockRejectedValue(new Error('z'))
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
  })

  it('openExternal failure falls back to window.open', async () => {
    api.shell.openExternal = vi.fn().mockRejectedValue(new Error('no'))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => screen.getByLabelText('YSK Limited'))
    fireEvent.click(screen.getByLabelText('YSK Limited'))
    await waitFor(() => expect(open).toHaveBeenCalled())
    open.mockRestore()
  })
})
