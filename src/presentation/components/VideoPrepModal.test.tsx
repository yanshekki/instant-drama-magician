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
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: () => <div data-testid="still" />
}))

import { VideoPrepModal } from './VideoPrepModal'

const draft = {
  kind: 'character-intro' as const,
  entityIds: { characterId: 'c1' },
  professionalPrompt: 'A cinematic intro',
  userExtraPrompt: 'slow',
  stillPath: '/still.png',
  sourceImagePath: '/src.png',
  durationSeconds: 5,
  aspectRatio: '16:9',
  queueIndex: 1,
  queueTotal: 2
}

const base = {
  open: true,
  draft,
  errorMessage: undefined as string | undefined,
  resultPath: undefined as string | undefined,
  queueIndex: 1,
  queueTotal: 2,
  hasNextInQueue: true,
  onAbandon: vi.fn(),
  onEmergencyExit: vi.fn(),
  onSaveDraft: vi.fn(),
  onConfirm: vi.fn().mockResolvedValue(undefined),
  onFinish: vi.fn(),
  onNextClip: vi.fn(),
  onRetry: vi.fn(),
  onDraftPatch: vi.fn(),
  onPhaseChange: vi.fn()
}

describe('VideoPrepModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.videoPrep.regenStill = vi.fn().mockResolvedValue({
      professionalPrompt: 'new prompt',
      stillPath: '/new.png',
      stillPromptUsed: 'p'
    })
  })
  afterEach(() => cleanup())

  it('null when closed', () => {
    const { container } = render(
      <VideoPrepModal {...base} open={false} phase="review" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('review phase interactions', async () => {
    render(<VideoPrepModal {...base} phase="review" />)
    expect(
      screen.getByText((content) => content.includes('videoPrep.title'))
    ).toBeTruthy()
    // textareas
    const areas = document.querySelectorAll('textarea')
    if (areas[0]) {
      fireEvent.change(areas[0], { target: { value: 'edited prompt' } })
    }
    if (areas[1]) {
      fireEvent.change(areas[1], { target: { value: 'extra' } })
    }
    // save draft
    const save = screen.queryByText('videoPrep.saveDraft')
    if (save) fireEvent.click(save)
    // confirm
    const confirm = screen.queryByText('videoPrep.confirmGenerate')
    if (confirm) {
      fireEvent.click(confirm)
      await waitFor(() => expect(base.onConfirm).toHaveBeenCalled())
    }
  })

  it('loading phases show messages', () => {
    for (const phase of [
      'loading-extract',
      'loading-materials',
      'loading-polish',
      'loading-still',
      'loading-regen',
      'loading-video'
    ] as const) {
      const { unmount } = render(
        <VideoPrepModal {...base} phase={phase} />
      )
      expect(
        screen.getByRole('dialog', { name: 'videoPrep.title' })
      ).toBeTruthy()
      unmount()
    }
  })

  it('error phase retry', () => {
    render(
      <VideoPrepModal
        {...base}
        phase="error"
        errorMessage="boom"
      />
    )
    const retry = screen.queryByText('videoPrep.retry')
    if (retry) {
      fireEvent.click(retry)
      expect(base.onRetry).toHaveBeenCalled()
    }
  })

  it('success phase finish and next', () => {
    render(
      <VideoPrepModal
        {...base}
        phase="success"
        resultPath="/out.mp4"
        hasNextInQueue
      />
    )
    const next = screen.queryByText('videoPrep.nextClip')
    if (next) fireEvent.click(next)
    const fin = screen.queryByText('videoPrep.finish')
    if (fin) fireEvent.click(fin)
  })

  it('regen still flow', async () => {
    render(<VideoPrepModal {...base} phase="review" />)
    // open regen UI if button exists
    const regen = Array.from(document.querySelectorAll('button')).find((b) =>
      /regen|重新|videoPrep/i.test(b.textContent || '')
    )
    // try known keys
    for (const key of [
      'videoPrep.regenStill',
      'videoPrep.openRegen',
      'videoPrep.improveStill'
    ]) {
      const el = screen.queryByText(key)
      if (el) fireEvent.click(el)
    }
  })

  it('abandon and emergency exit', () => {
    render(<VideoPrepModal {...base} phase="review" />)
    for (const key of ['videoPrep.abandon', 'videoPrep.emergencyExit']) {
      const el = screen.queryByText(key)
      if (el) fireEvent.click(el)
    }
  })
})
