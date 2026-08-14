import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeProp,
  makeScene,
  makeStory,
  makeTimelineEntry
} from '../../test/pageFixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TimelineV2Page } from './TimelineV2Page'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: (props: {
    onSelect?: (id: string) => void
    entries?: Array<{ id: string }>
  }) => (
    <div data-testid="konva-timeline">
      <button
        type="button"
        data-testid="konva-select"
        onClick={() => props.onSelect?.(props.entries?.[0]?.id ?? 'entry-1')}
      >
        select-clip
      </button>
      timeline-canvas
    </div>
  )
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: () => <div data-testid="preview-player">preview</div>
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: (props: { open?: boolean; onClose?: () => void }) =>
    props.open ? (
      <div data-testid="advanced">
        <button type="button" onClick={() => props.onClose?.()}>
          close-advanced
        </button>
        advanced
      </div>
    ) : null
}))
vi.mock('../components/ExportFinalDialog', () => ({
  ExportFinalDialog: (props: { open?: boolean; onCancel?: () => void }) =>
    props.open ? (
      <div data-testid="export-dlg">
        <button type="button" onClick={() => props.onCancel?.()}>
          close-export
        </button>
        export
      </div>
    ) : null
}))

function seed() {
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
    castCards: [
      {
        characterId: 'char-1',
        name: 'Aria',
        selectedRefImagePath: '/media/aria.png'
      }
    ],
    cells: [
      {
        entryId: 'entry-1',
        stillPath: '/media/s.png',
        stillStatus: 'ready',
        order: 0
      }
    ],
    summary: { castReady: 1, castTotal: 1, stillReady: 1, stillTotal: 1, videoReady: 0 }
  })
  api.timeline.update = vi.fn().mockResolvedValue({})
  api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
  api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  api.props.list = vi.fn().mockResolvedValue([makeProp()])
  api.actions.list = vi.fn().mockResolvedValue([makeAction()])
  api.settings.get = vi.fn().mockResolvedValue({
    defaultMaxClipSeconds: 6,
    videoMode: 'stub',
    imageProvider: 'same-as-llm',
    videoProvider: 'stub'
  })
  api.generation.onProgress = vi.fn(() => () => undefined)
  api.media.listExports = vi.fn().mockResolvedValue({ items: [], latestPath: null })
  api.media.saveAs = vi.fn().mockResolvedValue({ filePath: '/tmp/受戒下山-第1段.mp4' })
}

describe('TimelineV2Page', () => {
  beforeEach(() => {
    reseedMockApi(api)
    seed()
    localStorage.clear()
  })

  it('shows pick hint without an active story list', async () => {
    api.stories.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<TimelineV2Page />, { route: '/timeline-v2' })
    await waitFor(() =>
      expect(
        screen.getByText(/Choose a story above to edit its timeline/i)
      ).toBeTruthy()
    )
    expect(screen.getByText(/Track view|Track/i)).toBeTruthy()
  })

  it('renders pipeline graph and can save the prompt', async () => {
    await renderWithProviders(<TimelineV2Page />, { route: '/timeline-v2' })
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getAllByTestId('timeline-graph-canvas').length).toBeGreaterThan(0)
    )
    expect(screen.getAllByText(/^Timeline$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Track view|Track/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Board view|Board/i).length).toBeGreaterThan(0)

    const areas = Array.from(document.querySelectorAll('textarea'))
    expect(areas.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.change(areas[0]!, { target: { value: 'Updated beat line' } })
    })
    const save = screen
      .queryAllByRole('button')
      .find((b) => /^Save$/i.test(b.textContent || ''))
    if (save) {
      await act(async () => {
        fireEvent.click(save)
      })
      await waitFor(() => expect(api.timeline.update).toHaveBeenCalled())
    }
  })

  it('opens advanced prep', async () => {
    await renderWithProviders(<TimelineV2Page />, { route: '/timeline-v2' })
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    const adv = screen
      .queryAllByRole('button')
      .find((b) => /Advanced/i.test(b.textContent || ''))
    expect(adv).toBeTruthy()
    await act(async () => {
      fireEvent.click(adv!)
    })
    await waitFor(() => expect(screen.getByTestId('advanced')).toBeTruthy())
  })

  it('exports the selected clip via saveAs', async () => {
    await renderWithProviders(<TimelineV2Page />, { route: '/timeline-v2' })
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    const exportBtn = await waitFor(() => {
      const btn = screen
        .queryAllByRole('button')
        .find((b) => /Export this clip|匯出此段|exportClip/i.test(b.textContent || ''))
      expect(btn).toBeTruthy()
      return btn!
    })
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    await waitFor(() => expect(api.media.saveAs).toHaveBeenCalled())
    expect(api.media.saveAs).toHaveBeenCalledWith(
      '/media/clip-1.mp4',
      undefined,
      expect.stringMatching(/第1段|\.mp4$/)
    )
  })
})
