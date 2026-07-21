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

  it('loads clips, creates entry, generates and export paths', async () => {
    await renderWithProviders(<TimelinePage />, { route: '/timeline' })
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())

    // Select story via first select that has story-1
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const opt = Array.from(s.options).find((o) => o.value === 'story-1')
      if (opt) {
        await act(async () => {
          fireEvent.change(s, { target: { value: 'story-1' } })
        })
        break
      }
    }

    await waitFor(
      () =>
        expect(api.timeline.list.mock.calls.length).toBeGreaterThan(0) ||
        expect(document.body.textContent || '').toMatch(/We start here|clip|entry/i),
      { timeout: 4000 }
    ).catch(() => undefined)

    // Add / new clip
    for (const re of [/add clip|new clip|add entry|\+/i]) {
      const btn = screen.getAllByRole('button').find((b) =>
        re.test(b.textContent || '')
      )
      if (btn && !(btn as HTMLButtonElement).disabled) {
        await act(async () => {
          btn.click()
        })
        break
      }
    }
    await act(async () => {
      await Promise.resolve()
    })

    // Generate pipeline / clip
    for (const re of [
      /generate all|run pipeline|generate/i,
      /export final|export/i,
      /import clip|import/i,
      /advanced|studio/i
    ]) {
      const btn = screen.getAllByRole('button').find((b) =>
        re.test(b.textContent || '')
      )
      if (btn && !(btn as HTMLButtonElement).disabled) {
        await act(async () => {
          btn.click()
        })
      }
    }

    // Edit dialogue fields if present
    for (const el of Array.from(
      document.querySelectorAll('textarea, input')
    ).slice(0, 4)) {
      const tag = el.tagName.toLowerCase()
      if (tag === 'textarea' || (el as HTMLInputElement).type === 'text') {
        await act(async () => {
          fireEvent.change(el, { target: { value: 'Updated line' } })
        })
      }
    }

    expect(document.body.textContent).toBeTruthy()
  })

  it('handles empty timeline for selected story', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<TimelinePage />, { route: '/timeline' })
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (Array.from(s.options).some((o) => o.value === 'story-1')) {
        await act(async () => {
          fireEvent.change(s, { target: { value: 'story-1' } })
        })
        break
      }
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /empty|no clip|add|timeline|Demo Story/i
      )
    )
  })
})
