import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import type { MediaGenPrepOpenRequest, MediaGenPrepResult } from './MediaGenPrepModal'

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
    t: (k: string) => k,
    i18n: { language: 'zh-HK' }
  })
}))

let lastOnGenerated:
  | ((r: MediaGenPrepResult) => void)
  | null = null

vi.mock('./MediaGenPrepModal', () => ({
  MediaGenPrepModal: (props: {
    open: boolean
    onGenerated: (r: MediaGenPrepResult) => void
  }) => {
    lastOnGenerated = props.onGenerated
    return props.open ? <div data-testid="media-gen-modal" /> : null
  }
}))

import { MediaGenHost } from './MediaGenHost'

describe('MediaGenHost timeline still accept', () => {
  beforeEach(() => {
    startJob.mockClear()
    toast.success.mockClear()
    toast.info.mockClear()
    setMediaGenRequest.mockClear()
    mediaGenRequest = {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1'
    }
    lastOnGenerated = null
  })

  it('dispatches idm:timeline-still-done and skips draft job', async () => {
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
      expect(events[0]).toMatchObject({
        storyId: 's1',
        entryId: 'e1',
        path: '/lib/e1_continuity.png',
        kind: 'timeline-still'
      })
      expect(startJob).not.toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith(
        'timeline.advanced.stillGenOk'
      )
    } finally {
      window.removeEventListener('idm:timeline-still-done', onEv)
    }
  })
})
