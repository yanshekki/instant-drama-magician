import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { ensureTestI18n } from '../../../test/renderWithProviders'
import {
  buildTimelineGraph,
  layoutTimelineGraph
} from '../../../domain/timelineGraph'
import {
  TimelineGraphCanvas,
  timelineGraphShouldZoomWheel
} from './TimelineGraphCanvas'
import type { TimelineGraphNodeHandlers } from './TimelineGraphNode'

vi.mock('../LocalMediaImage', () => ({
  LocalMediaImage: () => <div data-testid="media">img</div>
}))

const handlers: TimelineGraphNodeHandlers = {
  promptValue: 'hello',
  revisionValue: '',
  onPromptChange: vi.fn(),
  onRevisionChange: vi.fn(),
  onSavePrompt: vi.fn(),
  onGenStill: vi.fn(),
  onRegenStill: vi.fn(),
  onRefineStill: vi.fn(),
  onOpenSetup: vi.fn(),
  onOpenStoryEditor: vi.fn(),
  onOpenEntity: vi.fn()
}

describe('TimelineGraphCanvas', () => {
  it('empty layout shows hint', async () => {
    await ensureTestI18n()
    render(
      <I18nextProvider i18n={i18n}>
        <TimelineGraphCanvas
          layout={{ nodes: [], edges: [], width: 0, height: 0 }}
          handlers={handlers}
        />
      </I18nextProvider>
    )
    expect(screen.getByText(/Select a clip on the track below/i)).toBeTruthy()
  })

  it('renders derived nodes and save', async () => {
    await ensureTestI18n()
    const layout = layoutTimelineGraph(
      buildTimelineGraph({
        entry: {
          id: 'e1',
          characterId: 'c1',
          characterIds: ['c1'],
          mediaStatus: 'EMPTY'
        },
        story: { artStyle: 'photo_cinematic', styleNote: 'noir rain' },
        characters: [
          {
            id: 'c1',
            name: 'Aria',
            description: 'Lead detective in the rain',
            refImagePath: '/a.png'
          }
        ]
      })
    )
    render(
      <I18nextProvider i18n={i18n}>
        <TimelineGraphCanvas layout={layout} handlers={handlers} />
      </I18nextProvider>
    )
    expect(screen.getAllByTestId('graph-node-prompt').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('graph-node-still').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('graph-node-video').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Lead detective in the rain/i).length).toBeGreaterThan(
      0
    )
    expect(screen.getAllByText(/Cinematic photoreal/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('photo_cinematic')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /^Save$/i })[0]!)
    expect(handlers.onSavePrompt).toHaveBeenCalled()
  })

  it('does not treat field scroll as canvas zoom', () => {
    const field = document.createElement('textarea')
    expect(
      timelineGraphShouldZoomWheel({ target: field, ctrlKey: false, metaKey: false })
    ).toBe(false)
    expect(
      timelineGraphShouldZoomWheel({ target: field, ctrlKey: true, metaKey: false })
    ).toBe(false)
    const board = document.createElement('div')
    expect(
      timelineGraphShouldZoomWheel({ target: board, ctrlKey: false, metaKey: false })
    ).toBe(false)
    expect(
      timelineGraphShouldZoomWheel({ target: board, ctrlKey: true, metaKey: false })
    ).toBe(true)
  })
})
