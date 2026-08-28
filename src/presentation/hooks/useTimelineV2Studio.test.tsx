import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
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
import * as TimelinePage from '../pages/TimelinePage'
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

  it('scopes workEntries and retry generate to clips inside the work area', async () => {
    const first = makeTimelineEntry({
      id: 'entry-1',
      order: 0,
      startTime: 0,
      endTime: 3,
      duration: 3,
      mediaStatus: 'FAILED',
      characterId: 'char-1',
      characterIds: ['char-1'],
      sceneId: 'scene-1',
      sceneIds: ['scene-1']
    })
    const second = makeTimelineEntry({
      id: 'entry-2',
      order: 1,
      startTime: 7,
      endTime: 9,
      duration: 2,
      dialogue: 'Later beat.',
      mediaStatus: 'FAILED',
      characterId: 'char-1',
      characterIds: ['char-1'],
      sceneId: 'scene-1',
      sceneIds: ['scene-1']
    })
    api.timeline.list = vi.fn().mockResolvedValue([first, second])
    const confirmSpy = vi
      .spyOn(TimelinePage, 'timelineConfirmGenerate')
      .mockResolvedValue('retry')
    const prepSpy = vi
      .spyOn(TimelinePage, 'timelineStartClipPrep')
      .mockReturnValue(true)

    await ensureTestI18n()
    const { result } = renderHook(() => useTimelineV2Studio(), {
      wrapper: ({ children }) => (
        <TestProviders route="/timeline-v2">{children}</TestProviders>
      )
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(2))

    act(() => {
      result.current.persistWorkArea(6, 10)
    })
    await waitFor(() => {
      expect(result.current.workEntries.map((e) => e.id)).toEqual(['entry-2'])
      expect(result.current.workCoversAll).toBe(false)
    })

    await act(async () => {
      await result.current.handleGenerate(true)
    })

    expect(confirmSpy).toHaveBeenCalled()
    const scopedIds = confirmSpy.mock.calls[0][0].entries.map((e) => e.id)
    expect(scopedIds).toEqual(['entry-2'])
    expect(scopedIds).not.toContain('entry-1')
    expect(prepSpy).toHaveBeenCalled()
    const queued = prepSpy.mock.calls.map((call) => call[0].entryIds)
    expect(queued.some((ids) => ids.includes('entry-1'))).toBe(false)
    expect(queued.some((ids) => ids.includes('entry-2'))).toBe(true)
    confirmSpy.mockRestore()
    prepSpy.mockRestore()
  })

  it('locks compiled prompt text until revert follows the timeline again', async () => {
    const uniqueLine = 'LOCKED_PROMPT_DIALOGUE_UNIQUE'
    let rows = [
      makeTimelineEntry({
        characterId: 'char-1',
        characterIds: ['char-1'],
        sceneId: 'scene-1',
        sceneIds: ['scene-1'],
        mediaPath: '/media/clip-1.mp4',
        mediaStatus: 'READY',
        dialogue: 'We start here.'
      })
    ]
    api.timeline.list = vi.fn(async () => rows)

    await ensureTestI18n()
    const { result } = renderHook(() => useTimelineV2Studio(), {
      wrapper: ({ children }) => (
        <TestProviders route="/timeline-v2">{children}</TestProviders>
      )
    })
    await waitFor(() => expect(result.current.selected?.id).toBe('entry-1'))
    await waitFor(() => expect(result.current.compiledText.length).toBeGreaterThan(0))
    const locked = result.current.compiledText
    expect(locked).toContain('We start here.')

    act(() => {
      result.current.lockCompiledPrompt()
    })
    expect(result.current.compiledLocked).toBe(true)

    rows = [{ ...rows[0], dialogue: uniqueLine }]
    await act(async () => {
      await result.current.reload()
    })
    await waitFor(() =>
      expect(result.current.entries[0]?.dialogue).toBe(uniqueLine)
    )
    expect(result.current.compiledText).toBe(locked)
    expect(result.current.compiledText).not.toContain(uniqueLine)

    act(() => {
      result.current.revertCompiledPrompt()
    })
    await waitFor(() => {
      expect(result.current.compiledLocked).toBe(false)
      expect(result.current.compiledText).toContain(uniqueLine)
    })
  })
})
