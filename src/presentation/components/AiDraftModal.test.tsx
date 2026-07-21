import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: ({ filePath }: { filePath: string }) => (
    <div data-testid="img">{filePath}</div>
  )
}))

const aiJobs = {
  jobs: [] as unknown[],
  reviewingJobId: null as string | null,
  setReviewingJobId: vi.fn(),
  acceptDraft: vi.fn(),
  discardDraft: vi.fn()
}

vi.mock('../context/AiJobsContext', () => ({
  useAiJobs: () => aiJobs
}))

import { AiDraftModal } from './AiDraftModal'

function setJob(draft: unknown, id = 'j1') {
  aiJobs.reviewingJobId = id
  aiJobs.jobs = [{ id, label: 'Job L', draft }]
}

describe('AiDraftModal', () => {
  afterEach(() => {
    cleanup()
    aiJobs.jobs = []
    aiJobs.reviewingJobId = null
    vi.clearAllMocks()
  })

  it('null without reviewing draft', () => {
    const { container } = render(<AiDraftModal />)
    expect(container.firstChild).toBeNull()
  })

  it('character-profile draft', () => {
    setJob({
      type: 'character-profile',
      profile: {
        name: 'N',
        description: 'D',
        appearance: 'A',
        voiceDesc: 'V',
        spokenLanguages: ['en', 'zh'],
        mannerisms: 'M'
      }
    })
    render(<AiDraftModal />)
    expect(screen.getByText('N')).toBeTruthy()
    expect(screen.getByText('en, zh')).toBeTruthy()
    fireEvent.click(screen.getByText('aiJobs.applyAndSave'))
    expect(aiJobs.acceptDraft).toHaveBeenCalledWith('j1')
    fireEvent.click(screen.getByText('aiJobs.discard'))
    expect(aiJobs.discardDraft).toHaveBeenCalledWith('j1')
  })

  it('character-sheet usedEdit variants and story-cover acknowledge', () => {
    setJob({
      type: 'character-sheet',
      path: '/sheet.png',
      label: 'sheet',
      usedEdit: true
    })
    const { rerender } = render(<AiDraftModal />)
    expect(screen.getByTestId('img').textContent).toBe('/sheet.png')
    expect(screen.getByText(/aiJobs.sheetModeEdit/)).toBeTruthy()
    fireEvent.click(screen.getByText('aiJobs.saveToGallery'))
    expect(aiJobs.acceptDraft).toHaveBeenCalled()

    setJob({
      type: 'character-sheet',
      path: '/s2.png',
      label: 's2',
      usedEdit: false
    })
    rerender(<AiDraftModal />)
    expect(screen.getByText(/aiJobs.sheetModeGenerate/)).toBeTruthy()

    setJob({
      type: 'story-cover',
      path: '/c.png',
      label: 'cover'
    })
    rerender(<AiDraftModal />)
    expect(screen.getByText('aiJobs.storyCoverDraftHint')).toBeTruthy()
    fireEvent.click(screen.getByText('aiJobs.acknowledge'))
  })

  it('pipeline success/fail, wardrobe, profiles, plates', () => {
    const drafts = [
      {
        type: 'pipeline',
        success: true,
        summary: 'ok summary'
      },
      {
        type: 'clip',
        success: false,
        summary: 'fail summary'
      },
      {
        type: 'wardrobe-suggest',
        suggestion: {
          name: 'W',
          costume: 'C',
          artStyle: 'A',
          rationale: 'R'
        }
      },
      {
        type: 'scene-profile',
        profile: {
          title: 'ST',
          description: 'SD',
          mood: 'M',
          script: 'SC'
        }
      },
      {
        type: 'scene-plate',
        path: '/sp.png',
        label: 'sp'
      },
      {
        type: 'prop-profile',
        profile: { name: 'P', description: 'PD', material: 'wood' }
      },
      {
        type: 'prop-plate',
        path: '/pp.png',
        label: 'pp'
      },
      {
        type: 'action-profile',
        profile: {
          name: 'A',
          description: 'AD',
          motionNotes: 'MN',
          intention: 'I'
        }
      },
      {
        type: 'action-plate',
        path: '/ap.png',
        label: 'ap'
      }
    ]
    for (const draft of drafts) {
      setJob(draft)
      const { unmount } = render(<AiDraftModal />)
      expect(screen.getByText('aiJobs.draftTitle')).toBeTruthy()
      unmount()
    }
  })

  it('closes on backdrop click', () => {
    setJob({
      type: 'story-cover',
      path: '/c.png',
      label: 'c'
    })
    render(<AiDraftModal />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(aiJobs.setReviewingJobId).toHaveBeenCalledWith(null)
  })
})
