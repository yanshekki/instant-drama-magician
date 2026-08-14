import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeProp,
  makeScene,
  makeStory,
  makeTimelineEntry
} from '../../test/pageFixtures'
import {
  ensureTestI18n,
  TestProviders
} from '../../test/renderWithProviders'
import { useTimelineV2Studio } from './useTimelineV2Studio'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))
vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: () => <div data-testid="konva-timeline">timeline</div>
}))

function seed(): void {
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.timeline.list = vi.fn().mockResolvedValue([
    makeTimelineEntry({
      characterId: 'char-1',
      characterIds: ['char-1'],
      sceneId: 'scene-1',
      sceneIds: ['scene-1'],
      mediaPath: '/media/clip-1.mp4',
      mediaStatus: 'READY'
    })
  ])
  api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
    storyId: 'story-1',
    storyTitle: 'Demo Story',
    castPrep: { version: 1, characters: {} },
    castCards: [],
    cells: [],
    summary: { castReady: 0, castTotal: 0, stillReady: 0, stillTotal: 0, videoReady: 0 }
  })
  api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
  api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  api.props.list = vi.fn().mockResolvedValue([makeProp()])
  api.actions.list = vi.fn().mockResolvedValue([makeAction()])
  api.settings.get = vi.fn().mockResolvedValue({
    defaultMaxClipSeconds: 6,
    videoMode: 'stub'
  })
  api.generation.onProgress = vi.fn(() => () => undefined)
  api.media.listExports = vi.fn().mockResolvedValue({ items: [], latestPath: null })
}

describe('useTimelineV2Studio', () => {
  beforeEach(() => {
    reseedMockApi(api)
    seed()
    localStorage.clear()
  })

  it('lays out the pipeline graph from the selected clip', async () => {
    await ensureTestI18n()
    const { result } = renderHook(() => useTimelineV2Studio(), {
      wrapper: ({ children }) => (
        <TestProviders route="/timeline-v2">{children}</TestProviders>
      )
    })
    await waitFor(() => expect(result.current.entries.length).toBeGreaterThan(0))
    expect(result.current.graphLayout.nodes.length).toBeGreaterThan(0)
    expect(result.current.graphLayout.width).toBeGreaterThan(0)
  })
})
