import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => {
      // Only translate known step tokens so unknown messages fall through to raw
      if (k === 'aiJobs.step.clip' || k === 'aiJobs.step.GENERATING') {
        return `STEP:${k}`
      }
      return k
    },
    i18n: { language: 'en' }
  })
}))

const aiJobs = {
  activeJobs: [] as unknown[],
  pendingDrafts: [] as unknown[],
  jobs: [] as unknown[],
  videoPrepSession: null as unknown,
  cancelJob: vi.fn(),
  setReviewingJobId: vi.fn(),
  dismissJob: vi.fn()
}

vi.mock('../context/AiJobsContext', () => ({
  useAiJobs: () => aiJobs
}))

import { AiJobHud } from './AiJobHud'

describe('AiJobHud', () => {
  afterEach(() => {
    cleanup()
    aiJobs.activeJobs = []
    aiJobs.pendingDrafts = []
    aiJobs.jobs = []
    aiJobs.videoPrepSession = null
    vi.clearAllMocks()
  })

  it('null when no jobs', () => {
    const { container } = render(<AiJobHud />)
    expect(container.firstChild).toBeNull()
  })

  it('null during video prep session', () => {
    aiJobs.activeJobs = [
      { id: '1', status: 'running', label: 'L', message: 'GENERATING' }
    ]
    aiJobs.videoPrepSession = { phase: 'review' }
    const { container } = render(<AiJobHud />)
    expect(container.firstChild).toBeNull()
  })

  it('renders running, pending draft, failed cards with actions', () => {
    // visible = active + pending(2) + failed(2), max 4
    aiJobs.activeJobs = [
      {
        id: 'r1',
        status: 'running',
        // raw message that is not media/scene/step key → formatStep fallback (line 51)
        label: 'Run job',
        message: 'custom-phase-xyz',
        progress: 0.4
      }
    ]
    aiJobs.pendingDrafts = [
      {
        id: 'p1',
        status: 'succeeded',
        label: 'Draft',
        draft: { type: 'character-sheet', path: '/x' },
        message: 'PENDING'
      }
    ]
    aiJobs.jobs = [
      {
        id: 'f1',
        status: 'failed',
        label: 'Fail',
        error: 'errors.networkFailed',
        message: '  '
      }
    ]
    render(<AiJobHud />)
    expect(screen.getByText('Run job')).toBeTruthy()
    expect(screen.getByText(/custom-phase-xyz/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('aiJobs.cancel')[0])
    expect(aiJobs.cancelJob).toHaveBeenCalled()
    fireEvent.click(screen.getByText('aiJobs.review'))
    expect(aiJobs.setReviewingJobId).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByText('aiJobs.dismiss'))
    expect(aiJobs.dismissJob).toHaveBeenCalledWith('f1')
  })
})
