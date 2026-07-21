import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => (k.startsWith('aiJobs.step.') ? `STEP:${k}` : k),
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
    aiJobs.activeJobs = [
      {
        id: 'r1',
        status: 'running',
        label: 'Run job',
        message: 'GENERATING',
        progress: 0.4
      },
      {
        id: 'q1',
        status: 'queued',
        label: 'Queued',
        message: 'clip'
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
    fireEvent.click(screen.getAllByText('aiJobs.cancel')[0])
    expect(aiJobs.cancelJob).toHaveBeenCalled()
    fireEvent.click(screen.getByText('aiJobs.review'))
    expect(aiJobs.setReviewingJobId).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByText('aiJobs.dismiss'))
    expect(aiJobs.dismissJob).toHaveBeenCalledWith('f1')
  })
})
