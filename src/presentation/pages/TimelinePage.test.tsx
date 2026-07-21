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
import { TimelinePage } from './TimelinePage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: () => <div data-testid="konva-timeline">timeline-canvas</div>
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: () => <div data-testid="preview-player">preview</div>
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: () => <div data-testid="advanced">advanced</div>
}))
vi.mock('../components/ExportFinalDialog', () => ({
  ExportFinalDialog: (props: { open?: boolean }) =>
    props.open ? <div data-testid="export-dlg">export</div> : null
}))

describe('TimelinePage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([
      makeStory(),
      makeStory({ id: 'story-2', title: 'Second' })
    ])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry(),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        dialogue: 'Next line',
        startTime: 4,
        endTime: 8,
        mediaStatus: 'READY',
        mediaPath: '/media/c.mp4'
      })
    ])
    api.timeline.create = vi
      .fn()
      .mockResolvedValue(makeTimelineEntry({ id: 'e-new' }))
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      defaultMaxClipSeconds: 6,
      videoMode: 'stub',
      burnSubtitles: true
    })
    api.generation.run = vi.fn().mockResolvedValue({ success: true, steps: [] })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
    api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/tmp/out.mp4' })
    api.media.exportPreflight = vi.fn().mockResolvedValue({ ok: true })
    api.media.listExports = vi.fn().mockResolvedValue([])
    api.media.importClip = vi.fn().mockResolvedValue({ path: '/tmp/imp.mp4' })
    api.media.openClip = vi.fn().mockResolvedValue({})
  })

  it('empty stories shows pick hint', async () => {
    api.stories.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<TimelinePage />, { route: '/timeline' })
    await waitFor(() =>
      expect(
        screen.getByText(/Choose a story above to edit its timeline/i)
      ).toBeTruthy()
    )
  })

  it('mounts timeline page with stories without hanging', async () => {
    await renderWithProviders(<TimelinePage />, { route: '/timeline' })
    await waitFor(() => {
      expect(document.body.textContent || '').toMatch(
        /Timeline|Demo Story|story|clip|Choose/i
      )
    })
    // Best-effort: select story if a select is present
    const storySelect = document.querySelector(
      'select'
    ) as HTMLSelectElement | null
    if (storySelect && storySelect.options.length > 0) {
      await act(async () => {
        fireEvent.change(storySelect, {
          target: { value: storySelect.options[0].value }
        })
      })
    }
    expect(document.body.textContent).toBeTruthy()
  })
})
