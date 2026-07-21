import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

/** Stable t so useEffect([..., t]) does not infinite-loop. */
const i18nMock = vi.hoisted(() => {
  const t = (k: string, o?: Record<string, unknown>) =>
    o ? `${k}:${JSON.stringify(o)}` : k
  return {
    t,
    i18n: { language: 'en' }
  }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => i18nMock
}))

import { PlotContextPicker } from './PlotContextPicker'

describe('PlotContextPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.stories.get = vi.fn().mockResolvedValue({
      id: 's1',
      title: 'Story',
      styleNote: 'noir',
      scenes: [
        { id: 'sc1', sceneNumber: 1, title: 'Rain', description: 'desc' }
      ],
      timeline: [
        {
          id: 't1',
          order: 0,
          dialogue: 'Hello there friend',
          character: { name: 'Hero' }
        },
        {
          id: 't2',
          order: 1,
          dialogue: '  ',
          character: null
        },
        {
          id: 't3',
          order: 2,
          dialogue: 'Who?',
          character: null
        }
      ]
    })
  })

  afterEach(() => cleanup())

  it('loads segments for story and updates preview', async () => {
    const onStory = vi.fn()
    const onSeg = vi.fn()
    render(
      <PlotContextPicker
        stories={
          [
            { id: 's1', title: 'S1' },
            { id: 's2', title: 'S2' }
          ] as never
        }
        storyId="s1"
        segmentKey="all"
        onStoryChange={onStory}
        onSegmentChange={onSeg}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalledWith('s1'))
    const selects = document.querySelectorAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    // story change
    fireEvent.change(selects[0], { target: { value: 's2' } })
    expect(onStory).toHaveBeenCalledWith('s2')
  })

  it('empty storyId uses all segment only', async () => {
    render(
      <PlotContextPicker
        stories={[]}
        storyId=""
        segmentKey="all"
        onStoryChange={() => undefined}
        onSegmentChange={() => undefined}
      />
    )
    await waitFor(() =>
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0)
    )
  })

  it('resets segment when missing from options', async () => {
    const onSeg = vi.fn()
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKey="scene:gone"
        onStoryChange={() => undefined}
        onSegmentChange={onSeg}
      />
    )
    await waitFor(() => expect(onSeg).toHaveBeenCalledWith('all'))
  })

  it('handles get failure', async () => {
    api.stories.get = vi.fn().mockRejectedValue(new Error('x'))
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKey="all"
        onStoryChange={() => undefined}
        onSegmentChange={() => undefined}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
  })

  it('previews scene and beat segments', async () => {
    const { rerender } = render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKey="scene:sc1"
        onStoryChange={() => undefined}
        onSegmentChange={() => undefined}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/desc|Rain/i)
    )
    rerender(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKey="beat:t1"
        onStoryChange={() => undefined}
        onSegmentChange={() => undefined}
      />
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Hello there friend|Hero/i)
    )
  })
})
