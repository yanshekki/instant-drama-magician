import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      if (o && typeof o === 'object' && 'defaultValue' in o) {
        return String((o as { defaultValue?: string }).defaultValue ?? k)
      }
      if (o && typeof o.n === 'number') return `${k}:${o.n}`
      if (o && typeof o.id === 'string') return `${k}:${o.id}`
      if (o && typeof o.count === 'number') return `${k}:${o.count}`
      return k
    },
    i18n: { language: 'en' }
  })
}))
vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: (p: { path?: string }) => (
    <div data-testid="local-media">{p.path}</div>
  )
}))

import { MediaGenPrepModal } from './MediaGenPrepModal'

const baseSection = {
  id: 'task-1',
  kind: 'text-profile' as const,
  title: 'Profile',
  entityType: 'character' as const,
  text: 'cyber lead',
  include: true,
  canBeEditBase: false,
  group: 'task' as const
}

const refSection = {
  id: 'ref-1',
  kind: 'ref-image' as const,
  title: 'Base',
  entityType: 'character' as const,
  imagePath: '/media/aria.png',
  text: '',
  include: true,
  canBeEditBase: true,
  editBasePriority: 10,
  group: 'refs' as const
}

const gallerySection = {
  id: 'gal-1',
  kind: 'ref-image' as const,
  title: 'Board',
  entityType: 'gallery' as const,
  imagePath: '/media/board.png',
  text: '',
  include: false,
  canBeEditBase: false,
  group: 'refs' as const
}

const layoutSection = {
  id: 'layout-1',
  kind: 'prompt-block' as const,
  title: 'grid-2x2',
  entityType: 'layout' as const,
  text: 'layout rules',
  include: true,
  canBeEditBase: false,
  group: 'task' as const
}

const hardRulesSection = {
  id: 'rules-1',
  kind: 'prompt-block' as const,
  title: 'Hard',
  entityType: 'hardRules' as const,
  text: 'no logos',
  include: true,
  canBeEditBase: false,
  group: 'rules' as const
}

function seedExtract(
  sections = [baseSection, refSection, gallerySection, layoutSection, hardRulesSection]
) {
  api.mediaGen.extract = vi.fn().mockResolvedValue({
    kind: 'character-sheet',
    entityIds: { characterId: 'c1' },
    sections,
    editBaseSectionId: 'ref-1',
    fallbackPrompt: 'FALLBACK PROMPT LONG ENOUGH',
    taskHint: 'sheet task',
    genOptions: { useIdentityEdit: true, artStyle: 'anime' },
    hardRules: 'no logos'
  })
  api.mediaGen.polish = vi.fn().mockResolvedValue({
    polishedPrompt: 'POLISHED PROMPT LONG ENOUGH FOR GENERATION',
    polished: true,
    imageCount: 1
  })
  api.mediaGen.generateImage = vi.fn().mockResolvedValue({
    path: '/tmp/gen.png',
    draft: true,
    panelLayout: 'bible',
    artStyle: 'anime',
    usedEdit: true,
    promptUsed: 'POLISHED PROMPT LONG ENOUGH FOR GENERATION'
  })
  api.media.toPreviewUrl = vi.fn().mockResolvedValue({
    url: 'blob:test',
    filePath: '/media/aria.png'
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({
    path: '/tmp/out.mp4',
    videoPath: '/tmp/out.mp4',
    gallery: []
  })
}

describe('MediaGenPrepModal', () => {
  beforeEach(() => {
    reseedMockApi(api)
    seedExtract()
  })
  afterEach(() => cleanup())

  it('returns null when closed or no request', () => {
    const { container: c1 } = render(
      <MediaGenPrepModal
        open={false}
        request={null}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    expect(c1.innerHTML).toBe('')
    const { container: c2 } = render(
      <MediaGenPrepModal
        open={true}
        request={null}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    expect(c2.innerHTML).toBe('')
  })

  it('image flow: extract → polish → generate → accept', async () => {
    const onClose = vi.fn()
    const onGenerated = vi.fn()
    render(
      <MediaGenPrepModal
        open
        request={{
          kind: 'character-sheet',
          characterId: 'c1',
          galleryIdentityPaths: ['/media/aria.png'],
          preferIdentityEdit: true,
          artStyle: 'anime',
          sheetVariant: 'bible'
        }}
        onClose={onClose}
        onGenerated={onGenerated}
      />
    )

    await waitFor(() => expect(api.mediaGen.extract).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )

    // toggle include / edit base / expand tech / select all-none
    const checks = screen.getAllByRole('checkbox')
    if (checks[0]) {
      await act(async () => {
        fireEvent.click(checks[0])
        fireEvent.click(checks[0])
      })
    }
    const selectAll = screen
      .getAllByRole('button')
      .find((b) => /mediaGen.selectAll/i.test(b.textContent || ''))
    if (selectAll) {
      await act(async () => fireEvent.click(selectAll))
    }
    const selectNone = screen
      .getAllByRole('button')
      .find((b) => /mediaGen.selectNone/i.test(b.textContent || ''))
    if (selectNone) {
      await act(async () => fireEvent.click(selectNone))
      // re-include so polish enabled
      await act(async () => {
        if (selectAll) fireEvent.click(selectAll)
      })
    }
    const tech = screen
      .getAllByRole('button')
      .find((b) => /mediaGen.showTech/i.test(b.textContent || ''))
    if (tech) {
      await act(async () => fireEvent.click(tech))
    }

    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() => expect(api.mediaGen.polish).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText('mediaGen.generateImage')).toBeTruthy()
    )

    // repolish + back materials
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.repolish'))
    })
    await waitFor(() => expect(api.mediaGen.polish).toHaveBeenCalledTimes(2))
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.backMaterials'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.generateImage')).toBeTruthy()
    )

    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.generateImage'))
    })
    await waitFor(() => expect(api.mediaGen.generateImage).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText('mediaGen.acceptResult')).toBeTruthy()
    )

    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.acceptResult'))
    })
    expect(onGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/tmp/gen.png' })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('extract error shows error phase', async () => {
    api.mediaGen.extract = vi.fn().mockRejectedValue(new Error('extract boom'))
    render(
      <MediaGenPrepModal
        open
        request={{ kind: 'character-sheet', characterId: 'c1' }}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/extract boom|error/i)
    )
  })

  it('polish and generate error recovery', async () => {
    api.mediaGen.polish = vi.fn().mockRejectedValue(new Error('polish boom'))
    render(
      <MediaGenPrepModal
        open
        request={{ kind: 'scene-plate', sceneId: 'sc1' }}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/polish boom/i)
    )

    seedExtract()
    api.mediaGen.polish = vi.fn().mockResolvedValue({
      polishedPrompt: 'POLISHED PROMPT LONG ENOUGH FOR GENERATION',
      polished: false,
      imageCount: 0
    })
    api.mediaGen.generateImage = vi
      .fn()
      .mockRejectedValue(new Error('gen boom'))

    // reopen polish path after re-extract via cancel/reopen
    cleanup()
    render(
      <MediaGenPrepModal
        open
        request={{ kind: 'prop-plate', propId: 'p1' }}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.generateImage')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.generateImage'))
    })
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/gen boom/i)
    )
  })

  it('video flow: keyframe → confirm → done', async () => {
    const onClose = vi.fn()
    render(
      <MediaGenPrepModal
        open
        request={{
          kind: 'character-intro',
          characterId: 'c1',
          galleryIdentityPaths: ['/media/aria.png'],
          durationSeconds: 6
        }}
        onClose={onClose}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.generateKeyframe')).toBeTruthy()
    )

    // edit duration / user extra
    const areas = document.querySelectorAll('textarea')
    for (const ta of Array.from(areas)) {
      await act(async () => {
        fireEvent.change(ta, { target: { value: 'slow push-in' } })
      })
    }
    const numberInputs = document.querySelectorAll('input[type="number"]')
    for (const inp of Array.from(numberInputs)) {
      await act(async () => {
        fireEvent.change(inp, { target: { value: '8' } })
      })
    }

    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.generateKeyframe'))
    })
    await waitFor(() => expect(api.mediaGen.generateImage).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText('mediaGen.nextConfirmVideo')).toBeTruthy()
    )

    // regen keyframe
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.regenKeyframe'))
    })
    await waitFor(() =>
      expect(api.mediaGen.generateImage.mock.calls.length).toBeGreaterThan(1)
    )
    await waitFor(() =>
      expect(screen.getByText('mediaGen.nextConfirmVideo')).toBeTruthy()
    )

    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.nextConfirmVideo'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.confirmGenerateVideo')).toBeTruthy()
    )

    const events: unknown[] = []
    const onEv = (ev: Event): void => {
      events.push((ev as CustomEvent).detail)
    }
    window.addEventListener('idm:video-prep-done', onEv)
    try {
      await act(async () => {
        fireEvent.click(screen.getByText('mediaGen.confirmGenerateVideo'))
      })
      await waitFor(() => expect(api.videoPrep.confirm).toHaveBeenCalled())
      await waitFor(() =>
        expect(screen.getByText('mediaGen.finish')).toBeTruthy()
      )
      expect(events.length).toBeGreaterThanOrEqual(1)
    } finally {
      window.removeEventListener('idm:video-prep-done', onEv)
    }

    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.finish'))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('video confirm failure returns to confirm-video', async () => {
    api.videoPrep.confirm = vi.fn().mockRejectedValue(new Error('vid fail'))
    render(
      <MediaGenPrepModal
        open
        request={{
          kind: 'timeline-clip',
          storyId: 's1',
          entryId: 'e1',
          durationSeconds: 5
        }}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.generateKeyframe')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.generateKeyframe'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.nextConfirmVideo')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.nextConfirmVideo'))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.confirmGenerateVideo'))
    })
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/vid fail/i)
    )
  })

  it('cancel from materials closes', async () => {
    const onClose = vi.fn()
    render(
      <MediaGenPrepModal
        open
        request={{ kind: 'story-cover', storyId: 's1' }}
        onClose={onClose}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText('common.cancel')).toBeTruthy())
    await act(async () => {
      fireEvent.click(screen.getByText('common.cancel'))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('discard result closes without onGenerated', async () => {
    const onClose = vi.fn()
    const onGenerated = vi.fn()
    render(
      <MediaGenPrepModal
        open
        request={{ kind: 'action-plate', actionId: 'a1' }}
        onClose={onClose}
        onGenerated={onGenerated}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.continuePolish'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.generateImage')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.generateImage'))
    })
    await waitFor(() =>
      expect(screen.getByText('mediaGen.discardResult')).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByText('mediaGen.discardResult'))
    })
    expect(onGenerated).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('preview url failure still renders section thumbs', async () => {
    api.media.toPreviewUrl = vi.fn().mockRejectedValue(new Error('no preview'))
    render(
      <MediaGenPrepModal
        open
        request={{ kind: 'character-sheet', characterId: 'c1' }}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    )
    await waitFor(() => expect(api.mediaGen.extract).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText('mediaGen.continuePolish')).toBeTruthy()
    )
  })
})
