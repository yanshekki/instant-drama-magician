import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import type {
  MediaGenPrepOpenRequest,
  MediaGenPrepResult
} from './MediaGenPrepModal'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))

const startJob = vi.fn()
const startMediaGen = vi.fn()
const upsertDraft = vi.fn()
const removeDraft = vi.fn()
let mediaGenRequest: MediaGenPrepOpenRequest | null = null
const setMediaGenRequest = vi.fn((r: MediaGenPrepOpenRequest | null) => {
  mediaGenRequest = r
})
const registerStartMediaGen = vi.fn()

vi.mock('../context/AiJobsContext', () => ({
  useAiJobs: () => ({
    mediaGenRequest,
    setMediaGenRequest,
    startJob,
    startMediaGen,
    registerStartMediaGen,
    upsertSavedVideoPrepDraft: upsertDraft,
    removeSavedVideoPrepDraft: removeDraft
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) =>
      o?.defaultValue ?? k,
    i18n: { language: 'zh-HK' }
  })
}))

let lastOnGenerated: ((r: MediaGenPrepResult) => void) | null = null
let lastOnClose: (() => void) | null = null
let lastOnSaveDraft:
  | ((payload: {
      kind: string
      polishedPrompt: string
      videoPrompt: string
      stillPath: string
      userExtraPrompt: string
      durationSeconds: number
      aspectRatio: string
      sourceImagePath?: string | null
      queueIndex?: number
      queueTotal?: number
      queueRemaining?: string[]
    }) => void)
  | null = null
let lastOnVideoDone:
  | ((detail: {
      kind: string
      path: string
      stillPath: string | null
      queueRemaining?: string[]
      queueIndex?: number
      queueTotal?: number
    }) => void)
  | null = null

vi.mock('./MediaGenPrepModal', () => ({
  MediaGenPrepModal: (props: {
    open: boolean
    onGenerated: (r: MediaGenPrepResult) => void
    onClose: () => void
    onSaveDraft?: typeof lastOnSaveDraft
    onVideoDone?: typeof lastOnVideoDone
  }) => {
    lastOnGenerated = props.onGenerated
    lastOnClose = props.onClose
    lastOnSaveDraft = props.onSaveDraft ?? null
    lastOnVideoDone = props.onVideoDone ?? null
    return props.open ? <div data-testid="media-gen-modal" /> : null
  }
}))

vi.mock('../lib/startIntroMediaGen', () => ({
  buildIntroMediaGenRequest: vi.fn(async (opts: Record<string, unknown>) => ({
    kind: 'timeline-clip',
    storyId: opts.storyId,
    entryId: opts.entryId,
    skipStillIfExists: opts.skipStillIfExists,
    userExtraPrompt: opts.userExtraPrompt,
    durationSeconds: opts.durationSeconds
  }))
}))

import { MediaGenHost } from './MediaGenHost'

const result: MediaGenPrepResult = {
  path: '/tmp/out.png',
  panelLayout: 'grid-2x2',
  artStyle: 'anime',
  usedEdit: false,
  promptUsed: 'p'
}

describe('MediaGenHost', () => {
  beforeEach(() => {
    startJob.mockClear()
    toast.success.mockClear()
    toast.info.mockClear()
    toast.error.mockClear()
    setMediaGenRequest.mockClear()
    registerStartMediaGen.mockClear()
    upsertDraft.mockClear()
    removeDraft.mockClear()
    mediaGenRequest = null
    lastOnGenerated = null
    lastOnClose = null
    lastOnSaveDraft = null
    lastOnVideoDone = null
  })

  it('registers startMediaGen and setMediaGenRequest on mount', async () => {
    render(<MediaGenHost />)
    await waitFor(() => expect(registerStartMediaGen).toHaveBeenCalled())
    const regFn = registerStartMediaGen.mock.calls[0]![0] as (
      r: MediaGenPrepOpenRequest
    ) => void
    regFn({ kind: 'character-sheet', characterId: 'c1' })
    expect(setMediaGenRequest).toHaveBeenCalledWith({
      kind: 'character-sheet',
      characterId: 'c1'
    })
  })

  it('timeline-still dispatches event and skips draft job', async () => {
    mediaGenRequest = {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1'
    }
    const events: unknown[] = []
    const onEv = (ev: Event): void => {
      events.push((ev as CustomEvent).detail)
    }
    window.addEventListener('idm:timeline-still-done', onEv)
    try {
      render(<MediaGenHost />)
      await waitFor(() => expect(lastOnGenerated).toBeTruthy())
      await act(async () => {
        lastOnGenerated!({ path: '/lib/e1_continuity.png' })
      })
      expect(events).toHaveLength(1)
      expect(startJob).not.toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
    } finally {
      window.removeEventListener('idm:timeline-still-done', onEv)
    }
  })

  it('timeline-clip video mode no-ops onGenerated (video via confirm + video-prep-done)', async () => {
    mediaGenRequest = {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1'
    }
    const events: unknown[] = []
    window.addEventListener('idm:timeline-still-done', (ev) => {
      events.push((ev as CustomEvent).detail)
    })
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnGenerated).toBeTruthy())
    await act(async () => {
      lastOnGenerated!({ path: '/lib/e1.png' })
    })
    // R2/B3: video kinds must not dispatch still-done from onGenerated
    expect(events).toHaveLength(0)
    expect(startJob).not.toHaveBeenCalled()
  })

  it('character-intro video mode no-ops without draft job', async () => {
    mediaGenRequest = {
      kind: 'character-intro',
      characterId: 'c1'
    }
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnGenerated).toBeTruthy())
    await act(async () => {
      lastOnGenerated!(result)
    })
    expect(startJob).not.toHaveBeenCalled()
  })

  it('onGenerated with null request after close is a no-op', async () => {
    mediaGenRequest = {
      kind: 'character-sheet',
      characterId: 'c1'
    }
    const { rerender } = render(<MediaGenHost />)
    await waitFor(() => expect(lastOnGenerated).toBeTruthy())
    // clear request and re-render so useCallback sees null
    mediaGenRequest = null
    rerender(<MediaGenHost />)
    await waitFor(() => expect(lastOnGenerated).toBeTruthy())
    startJob.mockClear()
    await act(async () => {
      lastOnGenerated!(result)
    })
    expect(startJob).not.toHaveBeenCalled()
  })

  it('close clears mediaGenRequest', async () => {
    mediaGenRequest = { kind: 'story-cover', storyId: 's1' }
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnClose).toBeTruthy())
    await act(async () => {
      lastOnClose!()
    })
    expect(setMediaGenRequest).toHaveBeenCalledWith(null)
  })

  it.each([
    [
      'character-sheet',
      { kind: 'character-sheet' as const, characterId: 'c1', storyId: 's1', sheetVariant: 'bible' },
      'character-sheet'
    ],
    [
      'scene-plate',
      { kind: 'scene-plate' as const, sceneId: 'sc1', storyId: 's1' },
      'scene-plate'
    ],
    [
      'prop-plate',
      { kind: 'prop-plate' as const, propId: 'p1', storyId: 's1' },
      'prop-plate'
    ],
    [
      'story-cover',
      { kind: 'story-cover' as const, storyId: 's1' },
      'story-cover'
    ],
    [
      'costume-dress',
      {
        kind: 'costume-dress' as const,
        characterId: 'c1',
        costumeId: 'cos1',
        costumeDescription: 'trench'
      },
      'costume-swap'
    ],
    [
      'costume-swap',
      {
        kind: 'costume-swap' as const,
        characterId: 'c1',
        costumeDescription: 'jacket'
      },
      'costume-swap'
    ],
    [
      'atmosphere-swap',
      {
        kind: 'atmosphere-swap' as const,
        sceneId: 'sc1',
        atmosphereDescription: 'storm'
      },
      'atmosphere-swap'
    ],
    [
      'action-plate',
      {
        kind: 'action-plate' as const,
        actionId: 'a1',
        storyId: 's1',
        panelLayout: 'grid-2x2'
      },
      'action-plate'
    ]
  ])(
    'image kind %s starts draft job',
    async (_label, req, jobKind) => {
      mediaGenRequest = req
      render(<MediaGenHost />)
      await waitFor(() => expect(lastOnGenerated).toBeTruthy())
      await act(async () => {
        lastOnGenerated!(result)
      })
      expect(toast.info).toHaveBeenCalled()
      expect(startJob).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: jobKind,
          scope: expect.any(Object),
          run: expect.any(Function)
        })
      )
      // execute run to cover draftPayloadFor return path
      const run = startJob.mock.calls[0]![0].run as (args: {
        setProgress: (n: number, s: string) => void
      }) => Promise<unknown>
      const draft = await run({ setProgress: vi.fn() })
      expect(draft).toMatchObject({ path: result.path })
    }
  )

  it('onSaveDraft persists video prep draft and clears request', async () => {
    mediaGenRequest = {
      kind: 'character-intro',
      characterId: 'c1',
      storyId: 's1',
      queueRemaining: ['e2'],
      queueIndex: 0,
      queueTotal: 2
    }
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnSaveDraft).toBeTruthy())
    await act(async () => {
      lastOnSaveDraft!({
        kind: 'character-intro',
        polishedPrompt: 'still polished',
        videoPrompt: 'video polished',
        stillPath: '/still.png',
        userExtraPrompt: 'extra',
        durationSeconds: 10,
        aspectRatio: '9:16',
        sourceImagePath: '/src.png',
        queueIndex: 0,
        queueTotal: 2,
        queueRemaining: ['e2']
      })
    })
    expect(upsertDraft).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalled()
    expect(setMediaGenRequest).toHaveBeenCalledWith(null)
  })

  it('onSaveDraft no-ops without request and surfaces storage errors', async () => {
    mediaGenRequest = { kind: 'scene-intro', sceneId: 'sc1' }
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnSaveDraft).toBeTruthy())
    // Clear request via close first
    mediaGenRequest = null
    await act(async () => {
      lastOnClose!()
    })
    await act(async () => {
      lastOnSaveDraft!({
        kind: 'scene-intro',
        polishedPrompt: 'p',
        videoPrompt: 'v',
        stillPath: '/s.png',
        userExtraPrompt: '',
        durationSeconds: 6,
        aspectRatio: '16:9'
      })
    })
    // Host still has requestRef until re-render; force save error path
    mediaGenRequest = { kind: 'prop-intro', propId: 'p1' }
    upsertDraft.mockImplementationOnce(() => {
      throw new Error('quota')
    })
    const { rerender } = render(<MediaGenHost />)
    await waitFor(() => expect(lastOnSaveDraft).toBeTruthy())
    await act(async () => {
      lastOnSaveDraft!({
        kind: 'prop-intro',
        polishedPrompt: 'p',
        videoPrompt: 'v',
        stillPath: '/s.png',
        userExtraPrompt: '',
        durationSeconds: 6,
        aspectRatio: '16:9'
      })
    })
    expect(toast.error).toHaveBeenCalled()
    void rerender
  })

  it('onVideoDone clears draft and queues next timeline clip', async () => {
    mediaGenRequest = {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      queueRemaining: ['e2', 'e3'],
      queueIndex: 0,
      queueTotal: 3,
      queueSkipStillIfExists: true,
      queueUserExtraByEntryId: { e2: 'more rain' },
      queueDurationSecondsByEntryId: { e2: 8 }
    }
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnVideoDone).toBeTruthy())
    await act(async () => {
      lastOnVideoDone!({
        kind: 'timeline-clip',
        path: '/v1.mp4',
        stillPath: '/s1.png',
        queueRemaining: ['e2', 'e3'],
        queueIndex: 0,
        queueTotal: 3
      })
    })
    expect(removeDraft).toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalled()
  })

  it('onVideoDone ignores non-queue video kinds and draft remove errors', async () => {
    mediaGenRequest = {
      kind: 'character-intro',
      characterId: 'c1'
    }
    removeDraft.mockImplementationOnce(() => {
      throw new Error('storage')
    })
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnVideoDone).toBeTruthy())
    await act(async () => {
      lastOnVideoDone!({
        kind: 'character-intro',
        path: '/v.mp4',
        stillPath: '/s.png'
      })
    })
    // no queue progress toast for non-timeline
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('close after queue videoDone starts next timeline-clip via startMediaGen', async () => {
    mediaGenRequest = {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      queueRemaining: ['e2'],
      queueIndex: 0,
      queueTotal: 2,
      queueSkipStillIfExists: true,
      queueUserExtraByEntryId: { e2: 'cinematic' },
      queueDurationSecondsByEntryId: { e2: 8 }
    }
    render(<MediaGenHost />)
    await waitFor(() => expect(lastOnVideoDone).toBeTruthy())
    await act(async () => {
      lastOnVideoDone!({
        kind: 'timeline-clip',
        path: '/v1.mp4',
        stillPath: '/s1.png',
        queueRemaining: ['e2'],
        queueIndex: 0,
        queueTotal: 2
      })
    })
    startMediaGen.mockClear()
    await act(async () => {
      lastOnClose!()
    })
    await waitFor(() =>
      expect(startMediaGen).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'timeline-clip',
          storyId: 's1',
          entryId: 'e2',
          queueIndex: 1,
          queueTotal: 2,
          durationSeconds: 8,
          userExtraPrompt: 'cinematic'
        })
      )
    )
  })
})
