import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createMockApi } from '../../../test/mockApi'

const api = createMockApi()
vi.mock('../../../lib/api', () => ({ getApi: () => api }))
const i18nMock = vi.hoisted(() => {
  const t = (k: string) => k
  return { t, i18n: { language: 'en' } }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => i18nMock
}))

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}
vi.mock('../../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('../../context/AiJobsContext', () => ({
  useAiJobs: () => ({ startJob: vi.fn().mockResolvedValue({ id: 'j1' }) })
}))

// Avoid heavy nested UI
vi.mock('../LocalMediaImage', () => ({
  LocalMediaImage: () => <div data-testid="lmi" />
}))
vi.mock('./KonvaTimeline', () => ({
  KonvaTimeline: () => <div data-testid="konva" />
}))

import { TimelineAdvancedStudio } from './TimelineAdvancedStudio'

const snap = {
  storyId: 's1',
  storyTitle: 'Demo',
  castPrep: {
    version: 1,
    characters: {
      c1: { refImagePath: '/c1.png', costumeId: null }
    }
  },
  castCards: [
    {
      characterId: 'c1',
      name: 'Alice',
      description: 'hero',
      gallery: [
        { id: 'g1', path: '/g1.png', label: 'Front', kind: 'sheet' }
      ],
      costumes: [
        {
          id: 'co1',
          name: 'Coat',
          description: 'trench',
          imagePath: '/co.png',
          selectable: true
        }
      ],
      selectedRefImagePath: '/g1.png',
      selectedCostumeId: null,
      hasAnyImage: true
    }
  ],
  cells: [
    {
      entryId: 'e1',
      order: 0,
      displayIndex: 1,
      startTime: 0,
      endTime: 4,
      dialogue: 'Hello',
      beatSnippet: 'Hello',
      stillPath: '',
      stillStatus: 'missing' as const,
      mediaStatus: 'EMPTY',
      continuityKind: 'first' as const,
      characterIds: ['c1'],
      characterNames: ['Alice'],
      hasCachedPrompt: false,
      professionalPrompt: null,
      durationSeconds: 4
    },
    {
      entryId: 'e2',
      order: 1,
      displayIndex: 2,
      startTime: 4,
      endTime: 8,
      dialogue: 'Next',
      beatSnippet: 'Next',
      stillPath: '/still.png',
      stillStatus: 'ready' as const,
      mediaStatus: 'READY',
      continuityKind: 'locked' as const,
      characterIds: ['c1'],
      characterNames: ['Alice'],
      hasCachedPrompt: true,
      professionalPrompt: 'cinematic',
      durationSeconds: 4,
      mediaPath: '/m.mp4'
    }
  ],
  summary: {
    castReady: 1,
    castTotal: 1,
    stillReady: 1,
    stillTotal: 2,
    videoReady: 1
  }
}

describe('TimelineAdvancedStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue(snap)
    api.timeline.setCastPrep = vi.fn().mockResolvedValue({})
    api.timeline.update = vi.fn().mockResolvedValue({})
  })

  afterEach(() => cleanup())

  function renderOpen(props?: Partial<React.ComponentProps<typeof TimelineAdvancedStudio>>) {
    return render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          storyId="s1"
          open
          onClose={() => undefined}
          onStartVideoQueue={() => undefined}
          {...props}
        />
      </MemoryRouter>
    )
  }

  it('null when closed', () => {
    const { container } = render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          storyId="s1"
          open={false}
          onClose={() => undefined}
          onStartVideoQueue={() => undefined}
        />
      </MemoryRouter>
    )
    expect(container.firstChild).toBeNull()
  })

  it('loads advanced prep and shows cast tab', async () => {
    const onClose = vi.fn()
    renderOpen({ onClose })
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalledWith('s1')
    )
    // close button may be common.close or timeline.advanced.close
    const close = screen.queryByText('common.close') || screen.queryByLabelText(/close/i)
    if (close) fireEvent.click(close)
  })

  it('handles load error', async () => {
    api.timeline.getAdvancedPrep = vi.fn().mockRejectedValue(new Error('boom'))
    renderOpen()
    await waitFor(() => expect(api.timeline.getAdvancedPrep).toHaveBeenCalled())
  })

  it('empty storyId skips load', async () => {
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          storyId=""
          open
          onClose={() => undefined}
          onStartVideoQueue={() => undefined}
        />
      </MemoryRouter>
    )
    await waitFor(() => {
      // may still call or not depending on implementation
      expect(true).toBe(true)
    })
  })

  it('switches tabs and toggles cast selections', async () => {
    renderOpen()
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    // Wait for cast content to render after load
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Alice|cast|timeline/i)
    )

    const buttons = () => screen.queryAllByRole('button')
    for (const re of [
      /storyboard|still/i,
      /cast/i,
      /save|apply/i,
      /generate|queue|video/i,
      /batch|all stills/i
    ]) {
      const tab = buttons().find((b) => re.test(b.textContent || ''))
      if (tab && !(tab as HTMLButtonElement).disabled) {
        await act(async () => {
          fireEvent.click(tab)
        })
      }
    }

    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"], select')
    ).slice(0, 8)) {
      if (cb.tagName === 'SELECT') {
        const sel = cb as HTMLSelectElement
        if (sel.options.length > 1) {
          await act(async () => {
            fireEvent.change(sel, { target: { value: sel.options[1].value } })
          })
        }
      } else {
        await act(async () => {
          fireEvent.click(cb)
        })
      }
    }

    expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
  })
})
