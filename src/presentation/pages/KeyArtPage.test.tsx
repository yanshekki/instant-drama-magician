import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { makeStory } from '../../test/pageFixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import { KeyArtPage } from './KeyArtPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

describe('KeyArtPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.keyArt.get = vi.fn().mockResolvedValue({
      book: { id: 'ka-1', storyId: 's1', artStyle: null, hardRules: null },
      shots: [
        {
          id: 'shot-1',
          keyArtId: 'ka-1',
          order: 0,
          shotType: 'cover',
          makeMethod: 'fresh',
          pageFormat: 'wide',
          imagePath: null
        }
      ]
    })
    api.keyArt.addShot = vi.fn().mockResolvedValue({ id: 'shot-new' })
    api.keyArt.updateShot = vi.fn().mockResolvedValue({})
    api.timeline.list = vi.fn().mockResolvedValue([])
    api.stories.listCast = vi.fn().mockResolvedValue({
      characters: [],
      scenes: []
    })
    api.comics.get = vi.fn().mockResolvedValue({ pages: [] })
  })

  it('asks for a story when none is active', async () => {
    api.stories.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<KeyArtPage />)
    await waitFor(() =>
      expect(screen.getByText(/No stories|未有故事|暂无故事/i)).toBeTruthy()
    )
  })

  it('loads shots and type cards', async () => {
    await renderWithProviders(<KeyArtPage />)
    await waitFor(() =>
      expect(screen.getAllByText(/Still 1|第 1 張|第 1 点|Imagen 1/i).length).toBeGreaterThan(
        0
      )
    )
    expect(api.keyArt.get).toHaveBeenCalled()
    await act(async () => {
      screen.getByRole('tab', { name: /Type|題材|種類|Tipo/i }).click()
    })
    expect(
      screen.getAllByText(/Cover poster|封面海報|カバーポスター/i).length
    ).toBeGreaterThan(0)
  })
})
