import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { makeStory } from '../../test/pageFixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import { useApp } from './AppContext'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

function Probe() {
  const app = useApp()
  return (
    <div data-testid="probe">
      <span data-testid="loading">{String(app.loading)}</span>
      <span data-testid="count">{app.stories.length}</span>
      <span data-testid="active">{app.activeStoryId ?? 'none'}</span>
      <span data-testid="ai">{app.aiStatus?.available ? 'yes' : 'no'}</span>
      <span data-testid="ai-msg">{app.aiStatus?.message ?? ''}</span>
      <button type="button" onClick={() => app.setActiveStoryId('story-x')}>
        set-active
      </button>
      <button type="button" onClick={() => void app.refreshStories()}>
        refresh
      </button>
      <button type="button" onClick={() => void app.refreshAiStatus()}>
        refresh-ai
      </button>
    </div>
  )
}

describe('AppContext', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi
      .fn()
      .mockResolvedValue([
        makeStory(),
        makeStory({ id: 'story-2', title: 'B' })
      ])
    api.ai.status = vi.fn().mockResolvedValue({
      available: true,
      baseUrl: 'http://x',
      model: 'm',
      message: 'ok'
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('loads stories and ai status, sets active to first', async () => {
    await renderWithProviders(<Probe />, { withApp: true, withAiJobs: false })
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )
    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(screen.getByTestId('active').textContent).toBe('story-1')
    expect(screen.getByTestId('ai').textContent).toBe('yes')
  })

  it('setActiveStoryId updates and refresh keeps valid selection', async () => {
    await renderWithProviders(<Probe />, { withAiJobs: false })
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )
    await act(async () => {
      screen.getByText('set-active').click()
    })
    expect(screen.getByTestId('active').textContent).toBe('story-x')
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-2' })])
    await act(async () => {
      screen.getByText('refresh').click()
    })
    await waitFor(() =>
      expect(screen.getByTestId('active').textContent).toBe('story-2')
    )
  })

  it('refreshAiStatus falls back when status fails', async () => {
    api.ai.status = vi.fn().mockRejectedValue(new Error('down'))
    await renderWithProviders(<Probe />, { withAiJobs: false })
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )
    expect(screen.getByTestId('ai').textContent).toBe('no')
    expect(screen.getByTestId('ai-msg').textContent).toContain('AI_STATUS')
    api.ai.status = vi.fn().mockResolvedValue({
      available: true,
      message: 'back'
    })
    await act(async () => {
      screen.getByText('refresh-ai').click()
    })
    await waitFor(() =>
      expect(screen.getByTestId('ai').textContent).toBe('yes')
    )
  })
})
