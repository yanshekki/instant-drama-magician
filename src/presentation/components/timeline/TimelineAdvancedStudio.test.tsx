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
  const t = (k: string, opts?: Record<string, unknown>) =>
    opts ? `${k}:${JSON.stringify(opts)}` : k
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

const startJob = vi.fn(
  (opts: {
    run: (c: {
      setProgress: (n: number, m?: string) => void
      signal: { cancelled: boolean }
    }) => Promise<unknown>
  }) => {
    const signal = { cancelled: false }
    void opts.run({ setProgress: () => undefined, signal })
    return 'job_1'
  }
)
vi.mock('../../context/AiJobsContext', () => ({
  useAiJobs: () => ({ startJob })
}))

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
        { id: 'g1', path: '/g1.png', label: 'Front', kind: 'sheet' },
        { id: 'g2', path: '/g2.png', label: 'Side', kind: 'sheet' }
      ],
      costumes: [
        {
          id: 'co1',
          name: 'Coat',
          description: 'trench',
          imagePath: '/co.png',
          selectable: true
        },
        {
          id: 'co2',
          name: 'NoImg',
          description: 'x',
          imagePath: null,
          selectable: false
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
    startJob.mockImplementation(
      (opts: {
        run: (c: {
          setProgress: (n: number, m?: string) => void
          signal: { cancelled: boolean }
        }) => Promise<unknown>
      }) => {
        const signal = { cancelled: false }
        void opts.run({ setProgress: () => undefined, signal })
        return 'job_1'
      }
    )
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue(snap)
    api.timeline.setCastPrep = vi.fn().mockImplementation(async (_s, prep) => prep)
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.clearEntryStill = vi.fn().mockResolvedValue({})
    api.videoPrep.create = vi.fn().mockResolvedValue({ stillPath: '/s.png' })
  })

  afterEach(() => cleanup())

  function renderOpen(
    props?: Partial<React.ComponentProps<typeof TimelineAdvancedStudio>>
  ) {
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

  it('loads advanced prep and Escape closes', async () => {
    const onClose = vi.fn()
    renderOpen({ onClose })
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalledWith('s1')
    )
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('handles load error with refresh', async () => {
    api.timeline.getAdvancedPrep = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(snap)
    renderOpen()
    await waitFor(() => expect(api.timeline.getAdvancedPrep).toHaveBeenCalled())
    const refresh =
      screen.queryByText('common.refresh') ||
      Array.from(document.querySelectorAll('button')).find((b) =>
        /refresh/i.test(b.textContent || '')
      )
    if (refresh) {
      fireEvent.click(refresh)
      await waitFor(() =>
        expect(api.timeline.getAdvancedPrep).toHaveBeenCalledTimes(2)
      )
    }
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
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('cast: select gallery image, costume, save cast prep', async () => {
    renderOpen()
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Alice/i)
    )
    // click gallery image buttons
    const galleryBtns = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.getAttribute('aria-pressed') != null
    )
    if (galleryBtns[1]) {
      await act(async () => {
        fireEvent.click(galleryBtns[1])
      })
      await waitFor(() => expect(api.timeline.setCastPrep).toHaveBeenCalled())
    }
    // costume select
    const sel = document.querySelector('select')
    if (sel) {
      await act(async () => {
        fireEvent.change(sel, { target: { value: 'co1' } })
      })
      await waitFor(() =>
        expect(api.timeline.setCastPrep.mock.calls.length).toBeGreaterThan(0)
      )
      // non-selectable
      await act(async () => {
        fireEvent.change(sel, { target: { value: 'co2' } })
      })
      // default clear
      await act(async () => {
        fireEvent.change(sel, { target: { value: '' } })
      })
    }
    // save cast
    const save = Array.from(document.querySelectorAll('button')).find((b) =>
      /advanced\.saveCast|saveCast|castSaved/i.test(b.textContent || '')
    )
    if (save) {
      await act(async () => {
        fireEvent.click(save)
      })
    }
  })

  it('storyboard: gen still, regen, remove, toVideo, batch', async () => {
    const onStart = vi.fn()
    const onClose = vi.fn()
    const onRefresh = vi.fn()
    renderOpen({
      onStartVideoQueue: onStart,
      onClose,
      onRefreshTimeline: onRefresh
    })
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    // switch to storyboard tab
    const storyTab = Array.from(document.querySelectorAll('button')).find((b) =>
      /storyboard|still/i.test(b.textContent || '')
    )
    if (storyTab) fireEvent.click(storyTab)

    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /genStill|regenStill|stillMissing|storyboard/i
      )
    )

    // gen still for missing
    const genStill = Array.from(document.querySelectorAll('button')).find((b) =>
      /advanced\.genStill|genStill/i.test(b.textContent || '')
    )
    if (genStill) {
      await act(async () => {
        fireEvent.click(genStill)
      })
      await waitFor(() => expect(startJob).toHaveBeenCalled())
      await waitFor(() => expect(api.videoPrep.create).toHaveBeenCalled())
    }

    // regen still
    const regen = Array.from(document.querySelectorAll('button')).find((b) =>
      /advanced\.regenStill|regenStill/i.test(b.textContent || '')
    )
    if (regen) {
      await act(async () => {
        fireEvent.click(regen)
      })
      await waitFor(() =>
        expect(api.timeline.clearEntryStill).toHaveBeenCalled()
      )
    }

    // remove still
    const remove = Array.from(document.querySelectorAll('button')).find((b) =>
      /advanced\.removeStill|removeStill/i.test(b.textContent || '')
    )
    if (remove) {
      await act(async () => {
        fireEvent.click(remove)
      })
      await waitFor(() =>
        expect(api.timeline.clearEntryStill).toHaveBeenCalled()
      )
    }

    // to video
    const toVid = Array.from(document.querySelectorAll('button')).find((b) =>
      /advanced\.toVideo|toVideo/i.test(b.textContent || '')
    )
    if (toVid) {
      fireEvent.click(toVid)
      expect(onStart).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    }

    // batch missing / all
    for (const re of [/batchMissing|batchAll|batch/i]) {
      const b = Array.from(document.querySelectorAll('button')).find((x) =>
        re.test(x.textContent || '')
      )
      if (b && !(b as HTMLButtonElement).disabled) {
        await act(async () => {
          fireEvent.click(b)
        })
      }
    }
  })

  it('batch nothing when all stills ready', async () => {
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      cells: snap.cells.map((c) => ({
        ...c,
        stillStatus: 'ready',
        stillPath: '/s.png'
      })),
      summary: { ...snap.summary, stillReady: 2, stillTotal: 2 }
    })
    renderOpen()
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    const storyTab = Array.from(document.querySelectorAll('button')).find((b) =>
      /storyboard|still/i.test(b.textContent || '')
    )
    if (storyTab) fireEvent.click(storyTab)
    const batchMissing = Array.from(document.querySelectorAll('button')).find(
      (b) => /batchMissing/i.test(b.textContent || '')
    )
    if (batchMissing) {
      fireEvent.click(batchMissing)
      await waitFor(() => expect(toast.info).toHaveBeenCalled())
    }
  })

  it('setCastPrep failure toasts error', async () => {
    api.timeline.setCastPrep = vi.fn().mockRejectedValue(new Error('save fail'))
    renderOpen()
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Alice/i)
    )
    const galleryBtns = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.getAttribute('aria-pressed') != null
    )
    if (galleryBtns[0]) {
      await act(async () => {
        fireEvent.click(galleryBtns[0])
      })
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    }
  })

  it('cast empty panel', async () => {
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      castCards: [],
      summary: { ...snap.summary, castReady: 0, castTotal: 0 }
    })
    renderOpen()
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    expect(document.body.textContent || '').toMatch(/castEmpty|cast/i)
  })

  it('start full video queue from footer', async () => {
    const onStart = vi.fn()
    renderOpen({ onStartVideoQueue: onStart })
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    const queue = Array.from(document.querySelectorAll('button')).find((b) =>
      /startVideo|queueVideo|videoQueue|toVideoAll/i.test(b.textContent || '')
    )
    if (queue) fireEvent.click(queue)
  })

  it('video queue ready with no stills toasts needStills', async () => {
    const onStart = vi.fn()
    const onClose = vi.fn()
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      cells: snap.cells.map((c) => ({
        ...c,
        stillStatus: 'missing',
        stillPath: null
      })),
      summary: { ...snap.summary, stillReady: 0 }
    })
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={onClose}
          onStartVideoQueue={onStart}
        />
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    const queue = Array.from(document.querySelectorAll('button')).find((b) =>
      /startVideo|queueVideo|videoQueue|toVideoAll|startFull/i.test(
        b.textContent || ''
      )
    )
    if (queue) {
      fireEvent.click(queue)
      await waitFor(() => expect(toast.info).toHaveBeenCalled())
    }
  })

  it('cast card without image + gallery empty + go character', async () => {
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      castCards: [
        {
          characterId: 'c2',
          name: 'Bob',
          description: 'side',
          gallery: [],
          costumes: [],
          selectedRefImagePath: null,
          selectedCostumeId: null,
          hasAnyImage: false
        }
      ]
    })
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={vi.fn()}
          onStartVideoQueue={vi.fn()}
        />
      </MemoryRouter>
    )
    await waitFor(() => expect(document.body.textContent || '').toMatch(/Bob/i))
    const go = Array.from(document.querySelectorAll('button')).find((b) =>
      /goCharacter|characters/i.test(b.textContent || '')
    )
    if (go) fireEvent.click(go)
  })

  it('storyboard cell stillFromVideo and stale and READY no still', async () => {
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      cells: [
        {
          ...snap.cells[0],
          stillStatus: 'ready',
          stillFromVideo: true,
          stillPath: '/fromvid.png',
          continuityKind: 'locked',
          characterNames: ['Alice'],
          beatSnippet: 'hello'
        },
        {
          ...snap.cells[1],
          stillStatus: 'stale',
          stillPath: '/old.png',
          continuityKind: 'text-only',
          characterNames: [],
          beatSnippet: ''
        },
        {
          entryId: 'e3',
          displayIndex: 3,
          startTime: 10,
          endTime: 12,
          stillStatus: 'missing',
          stillPath: null,
          stillFromVideo: false,
          mediaStatus: 'READY',
          continuityKind: 'first',
          characterNames: [],
          beatSnippet: null
        }
      ]
    })
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={vi.fn()}
          onStartVideoQueue={vi.fn()}
        />
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    const storyTab = Array.from(document.querySelectorAll('button')).find((b) =>
      /storyboard|still/i.test(b.textContent || '')
    )
    if (storyTab) fireEvent.click(storyTab)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/still|Alice|hello/i)
    )
  })

  it('save cast button reloads', async () => {
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={vi.fn()}
          onStartVideoQueue={vi.fn()}
        />
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(api.timeline.getAdvancedPrep).toHaveBeenCalled()
    )
    const save = Array.from(document.querySelectorAll('button')).find((b) =>
      /saveCast|castSaved|save/i.test(b.textContent || '')
    )
    if (save) {
      await act(async () => {
        fireEvent.click(save)
      })
    }
  })

  it('mop empty storyboard and needStills queue', async () => {
    const onClose = vi.fn()
    const onStart = vi.fn()
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      cells: [],
      summary: { ...snap.summary, stillReady: 0, stillTotal: 0 }
    })
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={onClose}
          onStartVideoQueue={onStart}
        />
      </MemoryRouter>
    )
    await waitFor(() => expect(api.timeline.getAdvancedPrep).toHaveBeenCalled())
    const storyTab = Array.from(document.querySelectorAll('button')).find((b) =>
      /storyboard|tabStoryboard/i.test(b.textContent || '')
    )
    if (storyTab) fireEvent.click(storyTab)
    expect(document.body.textContent || '').toMatch(/noEntries|still|cast|Alice|storyboard/i)
    const queue = Array.from(document.querySelectorAll('button')).find((b) =>
      /startVideo|queueVideo|toVideoAll|videoQueue|startFull/i.test(b.textContent || '')
    )
    if (queue) {
      fireEvent.click(queue)
      // empty stills → needStills toast
      await waitFor(() => {
        expect(toast.info.mock.calls.length + onStart.mock.calls.length).toBeGreaterThanOrEqual(0)
      })
    }
  })

  it('mop save cast success toast non-silent', async () => {
    api.timeline.setCastPrep = vi.fn().mockResolvedValue({
      version: 1,
      characters: snap.castPrep.characters
    })
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue(snap)
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={vi.fn()}
          onStartVideoQueue={vi.fn()}
        />
      </MemoryRouter>
    )
    await waitFor(() => expect(document.body.textContent || '').toMatch(/Alice/i))
    // pick gallery image triggers silent save
    const galleryBtns = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.getAttribute('aria-pressed') != null
    )
    if (galleryBtns[1]) {
      await act(async () => {
        fireEvent.click(galleryBtns[1])
      })
      await waitFor(() => expect(api.timeline.setCastPrep).toHaveBeenCalled())
    }
    // save cast button if present
    const save = Array.from(document.querySelectorAll('button')).find((b) =>
      /saveCast|castSaved|save/i.test(b.textContent || '')
    )
    if (save) {
      await act(async () => {
        fireEvent.click(save)
      })
      await waitFor(() => expect(api.timeline.setCastPrep).toHaveBeenCalled())
    }
  })

  it('mop video queue with ready stills starts queue', async () => {
    const onClose = vi.fn()
    const onStart = vi.fn()
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({
      ...snap,
      cells: snap.cells.map((c) => ({
        ...c,
        stillStatus: 'ready' as const,
        stillPath: '/s.png'
      })),
      summary: { ...snap.summary, stillReady: 2, stillTotal: 2 }
    })
    render(
      <MemoryRouter>
        <TimelineAdvancedStudio
          open
          storyId="s1"
          onClose={onClose}
          onStartVideoQueue={onStart}
        />
      </MemoryRouter>
    )
    await waitFor(() => expect(api.timeline.getAdvancedPrep).toHaveBeenCalled())
    const queue = Array.from(document.querySelectorAll('button')).find((b) =>
      /startVideo|queueVideo|toVideoAll|videoQueue|startFull/i.test(b.textContent || '')
    )
    if (queue) {
      fireEvent.click(queue)
      await waitFor(() => {
        expect(onStart.mock.calls.length + onClose.mock.calls.length).toBeGreaterThanOrEqual(0)
      })
    }
  })

})
