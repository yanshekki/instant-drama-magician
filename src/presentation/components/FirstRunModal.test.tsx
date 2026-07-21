import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

const appState = {
  stories: [] as { id: string }[],
  loading: false
}
vi.mock('../context/AppContext', () => ({
  useApp: () => appState
}))

import { FirstRunModal } from './FirstRunModal'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('FirstRunModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appState.stories = []
    appState.loading = false
    api.settings.get = vi.fn().mockResolvedValue({ firstRunSeen: false })
    api.settings.set = vi.fn().mockResolvedValue({})
  })

  afterEach(() => cleanup())

  it('returns null while loading', async () => {
    appState.loading = true
    wrap(<FirstRunModal />)
    expect(screen.queryByText('onboarding.welcome')).toBeNull()
  })

  it('opens when first run and no stories', async () => {
    wrap(<FirstRunModal />)
    await waitFor(() =>
      expect(screen.getByText('onboarding.welcome')).toBeTruthy()
    )
  })

  it('dismiss sets firstRunSeen', async () => {
    wrap(<FirstRunModal />)
    await waitFor(() => screen.getByText('onboarding.skip'))
    fireEvent.click(screen.getByText('onboarding.skip'))
    await waitFor(() =>
      expect(api.settings.set).toHaveBeenCalledWith({ firstRunSeen: true })
    )
  })

  it('go new story navigates', async () => {
    wrap(<FirstRunModal />)
    await waitFor(() => screen.getByText('stories.new'))
    fireEvent.click(screen.getByText('stories.new'))
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
  })

  it('settings error keeps closed', async () => {
    api.settings.get = vi.fn().mockRejectedValue(new Error('x'))
    wrap(<FirstRunModal />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(screen.queryByText('onboarding.welcome')).toBeNull()
  })
})
