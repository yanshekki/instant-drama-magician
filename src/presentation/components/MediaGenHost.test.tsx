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
    registerStartMediaGen
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

vi.mock('./MediaGenPrepModal', () => ({
  MediaGenPrepModal: (props: {
    open: boolean
    onGenerated: (r: MediaGenPrepResult) => void
    onClose: () => void
  }) => {
    lastOnGenerated = props.onGenerated
    lastOnClose = props.onClose
    return props.open ? <div data-testid="media-gen-modal" /> : null
  }
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
    setMediaGenRequest.mockClear()
    registerStartMediaGen.mockClear()
    mediaGenRequest = null
    lastOnGenerated = null
    lastOnClose = null
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
})
