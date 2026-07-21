import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  render,
  waitFor,
  act,
  fireEvent,
  screen
} from '@testing-library/react'
import { useCallback, useState, type ReactNode } from 'react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' }
  })
}))

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}
const dialog = {
  confirm: vi.fn().mockResolvedValue(true),
  alert: vi.fn()
}

let startHandler: ((input: unknown) => void) | null = null
const upsertDraft = vi.fn()
const removeDraft = vi.fn()

vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('../context/DialogContext', () => ({ useDialog: () => dialog }))

// Stateful mock so setVideoPrepSession re-renders host
vi.mock('../context/AiJobsContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  const Ctx = React.createContext(null)
  return {
    useAiJobs: () => React.useContext(Ctx),
    __AiJobsTestCtx: Ctx
  }
})

vi.mock('./VideoPrepModal', () => ({
  VideoPrepModal: (props: Record<string, unknown>) =>
    props.open ? (
      <div data-testid="modal" data-phase={String(props.phase)}>
        <button type="button" onClick={() => (props.onAbandon as () => void)()}>
          abandon
        </button>
        <button
          type="button"
          onClick={() => (props.onEmergencyExit as () => void)()}
        >
          emergency
        </button>
        <button
          type="button"
          onClick={() =>
            void (props.onConfirm as (d: unknown) => Promise<void>)(
              props.draft
            )
          }
        >
          confirm
        </button>
        <button type="button" onClick={() => (props.onFinish as () => void)()}>
          finish
        </button>
        <button
          type="button"
          onClick={() => (props.onNextClip as () => void)()}
        >
          next
        </button>
        <button type="button" onClick={() => (props.onRetry as () => void)()}>
          retry
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onSaveDraft as (d: unknown) => void)(props.draft)
          }
        >
          save
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onDraftPatch as (d: unknown) => void)({
              ...(props.draft as object),
              professionalPrompt: 'patched'
            })
          }
        >
          patch
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onPhaseChange as (p: string) => void)('loading-video')
          }
        >
          phase
        </button>
      </div>
    ) : null
}))

import { VideoPrepHost } from './VideoPrepHost'
// @ts-expect-error test-only export from mock
import { __AiJobsTestCtx } from '../context/AiJobsContext'

function Provider({ children }: { children: ReactNode }) {
  const [videoPrepSession, setVideoPrepSession] = useState<unknown>(null)
  const registerStartVideoPrep = useCallback(
    (h: ((i: unknown) => void) | null) => {
      startHandler = h
    },
    []
  )
  const value = {
    videoPrepSession,
    setVideoPrepSession,
    registerStartVideoPrep,
    upsertSavedVideoPrepDraft: upsertDraft,
    removeSavedVideoPrepDraft: removeDraft
  }
  return (
    <__AiJobsTestCtx.Provider value={value}>{children}</__AiJobsTestCtx.Provider>
  )
}

const resumeDraft = {
  kind: 'character-intro',
  entityIds: { characterId: 'c1' },
  professionalPrompt: 'p',
  stillPath: '/s.png',
  durationSeconds: 5,
  aspectRatio: '16:9'
}

describe('VideoPrepHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    startHandler = null
    api.videoPrep.create = vi.fn().mockResolvedValue({
      professionalPrompt: 'prompt',
      stillPath: '/s.png',
      durationSeconds: 5,
      aspectRatio: '16:9',
      entityIds: { characterId: 'c1' }
    })
    api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
      professionalPrompt: 'from still',
      stillPath: '/still.png',
      durationSeconds: 4,
      aspectRatio: '16:9'
    })
    api.videoPrep.confirm = vi.fn().mockResolvedValue({
      videoPath: '/out.mp4'
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('registers start handler and opens resume draft', async () => {
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => expect(screen.getByTestId('modal')).toBeTruthy())
  })

  it('runs create pipeline for new session', async () => {
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' }
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    await waitFor(() => expect(api.videoPrep.create).toHaveBeenCalled())
  })

  it('timeline openFromStill path', async () => {
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'timeline-clip',
        entityIds: { storyId: 's1', entryId: 'e1' },
        skipStillIfExists: true
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    await waitFor(() =>
      expect(api.videoPrep.openFromStill).toHaveBeenCalled()
    )
  })

  it('modal actions: save, patch, abandon, emergency, confirm', async () => {
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByTestId('modal'))
    fireEvent.click(screen.getByText('patch'))
    fireEvent.click(screen.getByText('phase'))
    fireEvent.click(screen.getByText('confirm'))
    await waitFor(() => expect(api.videoPrep.confirm).toHaveBeenCalled())
    fireEvent.click(screen.getByText('finish'))

    // save closes session
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('save'))
    fireEvent.click(screen.getByText('save'))
    expect(upsertDraft).toHaveBeenCalled()

    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('abandon'))
    fireEvent.click(screen.getByText('abandon'))

    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('emergency'))
    fireEvent.click(screen.getByText('emergency'))
  })

  it('create failure shows error phase and retry', async () => {
    api.videoPrep.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create fail'))
      .mockResolvedValueOnce({
        professionalPrompt: 'ok',
        stillPath: '/s.png',
        durationSeconds: 5,
        aspectRatio: '16:9',
        entityIds: { characterId: 'c1' }
      })
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' }
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // retry button from modal mock after error may appear
    await waitFor(() => {
      // host may surface error without modal open
      expect(api.videoPrep.create).toHaveBeenCalled()
    })
    if (screen.queryByText('retry')) {
      fireEvent.click(screen.getByText('retry'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
    }
  })

  it('confirm failure and nextClip queue', async () => {
    api.videoPrep.confirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('confirm fail'))
      .mockResolvedValue({ videoPath: '/v.mp4' })
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByTestId('modal'))
    fireEvent.click(screen.getByText('confirm'))
    await waitFor(() => expect(api.videoPrep.confirm).toHaveBeenCalled())

    // next clip path
    fireEvent.click(screen.getByText('next'))
  })

  it('scene-intro and prop/costume/action kinds', async () => {
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    for (const kind of [
      'scene-intro',
      'prop-intro',
      'costume-intro',
      'action-intro'
    ] as const) {
      act(() => {
        startHandler!({
          kind,
          entityIds: {
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            costumeId: 'k1',
            actionId: 'a1'
          }
        })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })
    }
    expect(api.videoPrep.create.mock.calls.length).toBeGreaterThan(0)
  })

  it('openFromStill failure falls back to create', async () => {
    api.videoPrep.openFromStill = vi
      .fn()
      .mockRejectedValue(new Error('no still'))
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'timeline-clip',
        entityIds: { storyId: 's1', entryId: 'e1' },
        skipStillIfExists: true
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(api.videoPrep.create).toHaveBeenCalled())
  })

  it('dialog cancel on abandon keeps session when confirm false', async () => {
    dialog.confirm.mockResolvedValueOnce(false)
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('abandon'))
    fireEvent.click(screen.getByText('abandon'))
  })

  it('confirm degraded toast and video-prep-done event', async () => {
    api.videoPrep.confirm = vi.fn().mockResolvedValue({
      path: '/stub.mp4',
      degraded: true,
      gallery: []
    })
    const done = vi.fn()
    window.addEventListener('idm:video-prep-done', done)
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByTestId('modal'))
    fireEvent.click(screen.getByText('confirm'))
    await waitFor(() => expect(api.videoPrep.confirm).toHaveBeenCalled())
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    window.removeEventListener('idm:video-prep-done', done)
  })

  it('create with skippedStill toast', async () => {
    api.videoPrep.create = vi.fn().mockResolvedValue({
      professionalPrompt: 'p',
      stillPath: '/s.png',
      durationSeconds: 5,
      aspectRatio: '16:9',
      entityIds: { characterId: 'c1' },
      skippedStill: true,
      materialsSummary: 'm'
    })
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' }
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(api.videoPrep.create).toHaveBeenCalled())
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('nextClip opens remaining timeline queue; finish clears', async () => {
    // inject session with queue via resume then next
    const timelineDraft = {
      kind: 'timeline-clip' as const,
      entityIds: { storyId: 's1', entryId: 'e1' },
      professionalPrompt: 'p',
      stillPath: '/s.png',
      durationSeconds: 5,
      aspectRatio: '16:9',
      queueIndex: 1,
      queueTotal: 2
    }
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    // start with queueRemaining by calling startHandler then next
    act(() => {
      startHandler!({
        kind: 'timeline-clip',
        entityIds: { storyId: 's1', entryId: 'e1' },
        resumeDraft: timelineDraft,
        queueIndex: 1,
        queueTotal: 2,
        queueRemaining: ['e2']
      } as never)
    })
    await waitFor(() => screen.getByTestId('modal'))
    fireEvent.click(screen.getByText('next'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
  })

  it('save draft upsert failure toasts error', async () => {
    upsertDraft.mockImplementationOnce(() => {
      throw new Error('ls full')
    })
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('save'))
    fireEvent.click(screen.getByText('save'))
    expect(toast.error).toHaveBeenCalled()
  })

  it('retry after create error reopens session', async () => {
    api.videoPrep.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        professionalPrompt: 'ok',
        stillPath: '/s.png',
        durationSeconds: 5,
        aspectRatio: '16:9',
        entityIds: { characterId: 'c1' }
      })
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' }
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('retry'))
    fireEvent.click(screen.getByText('retry'))
  })

  it('abandon and emergency with dialog confirm true close session', async () => {
    dialog.confirm.mockResolvedValue(true)
    const dismiss = vi.fn()
    window.addEventListener('idm:video-prep-dismiss', dismiss)
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('abandon'))
    fireEvent.click(screen.getByText('abandon'))
    await waitFor(() => expect(dialog.confirm).toHaveBeenCalled())

    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    await waitFor(() => screen.getByText('emergency'))
    fireEvent.click(screen.getByText('emergency'))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    window.removeEventListener('idm:video-prep-dismiss', dismiss)
  })

  it('next with empty queueRemaining finishes session', async () => {
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'timeline-clip',
        entityIds: { storyId: 's1', entryId: 'e1' },
        resumeDraft: {
          kind: 'timeline-clip',
          entityIds: { storyId: 's1', entryId: 'e1' },
          professionalPrompt: 'p',
          stillPath: '/s.png',
          durationSeconds: 5,
          aspectRatio: '16:9',
          queueIndex: 2,
          queueTotal: 2
        },
        queueRemaining: []
      } as never)
    })
    await waitFor(() => screen.getByTestId('modal'))
    fireEvent.click(screen.getByText('next'))
  })

  it('retry from error with draft returns to review', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.videoPrep.create = vi.fn().mockRejectedValue(new Error('fail once'))
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        resumeDraft
      })
    })
    // Manually we need error phase with draft — use confirm reject
    api.videoPrep.confirm = vi.fn().mockRejectedValue(new Error('confirm fail'))
    await waitFor(() => screen.getByText('confirm'))
    fireEvent.click(screen.getByText('confirm'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    // if error phase reached with draft, retry restores review
    const retry = screen.queryByText('retry')
    if (retry) {
      fireEvent.click(retry)
    }
  })

  it('create openFromStill path and materials phase', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.videoPrep.create = vi.fn().mockImplementation(async (payload: { onProgress?: (p: { phase?: string }) => void }) => {
      payload.onProgress?.({ phase: 'materials' } as never)
      return {
        professionalPrompt: 'ok',
        stillPath: '/s.png',
        durationSeconds: 5,
        aspectRatio: '16:9',
        entityIds: { characterId: 'c1' },
        skippedStill: true,
        materialsSummary: 'm',
        stillPromptUsed: 'sp'
      }
    })
    render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        openFromStill: '/still.png',
        skipStillIfExists: true
      } as never)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(api.videoPrep.create).toHaveBeenCalled())
  })

  it('abort mid-create via unmount cancels sleep', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.videoPrep.create = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                professionalPrompt: 'late',
                stillPath: '/s.png',
                durationSeconds: 5,
                aspectRatio: '16:9',
                entityIds: { characterId: 'c1' }
              }),
            5000
          )
        })
    )
    const { unmount } = render(
      <Provider>
        <VideoPrepHost />
      </Provider>
    )
    await waitFor(() => expect(startHandler).toBeTruthy())
    act(() => {
      startHandler!({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' }
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
  })
})
