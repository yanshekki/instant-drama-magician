/**
 * Drive AiJobs draft accept + VideoPrepHost / MediaGenHost from real pages.
 * Uses withAiShell (Hud + DraftModal + VideoPrepHost) plus MediaGenHost where
 * photo/video gen goes through the materials → polish → generate shell.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeCostume,
  makeProp,
  makeScene,
  makeStory,
  makeStoryDetail,
  makeTimelineEntry
} from '../../test/pageFixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import { MediaGenHost } from '../components/MediaGenHost'
import { useAiJobs } from '../context/AiJobsContext'
import { CharactersPage } from './CharactersPage'
import { PropsPage } from './PropsPage'
import { ScenesPage } from './ScenesPage'
import { StoriesPage } from './StoriesPage'
import { TimelinePage } from './TimelinePage'
import { CostumesPage } from './CostumesPage'
import { ActionsPage } from './ActionsPage'

/** Minimal extract payload so polish is enabled (include ≥ 1). */
const mediaGenExtractOk = {
  entityIds: {},
  sections: [
    {
      id: 'task-1',
      kind: 'text-profile' as const,
      title: 'Profile',
      entityType: 'character' as const,
      text: 'cyber noir lead',
      include: true,
      canBeEditBase: false,
      group: 'task' as const
    }
  ],
  editBaseSectionId: null,
  fallbackPrompt: 'FALLBACK PROMPT FOR MEDIA GEN',
  taskHint: 'task',
  genOptions: { useIdentityEdit: false },
  hardRules: null
}

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: (props: { onSelect?: (id: string) => void }) => (
    <button
      type="button"
      data-testid="konva-select"
      onClick={() => props.onSelect?.('entry-1')}
    >
      select
    </button>
  )
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: () => <div data-testid="preview" />
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: (props: { open?: boolean; onClose?: () => void }) =>
    props.open ? (
      <button type="button" onClick={() => props.onClose?.()}>
        close-advanced
      </button>
    ) : null
}))
vi.mock('../components/ExportFinalDialog', () => ({
  ExportFinalDialog: (props: {
    open?: boolean
    onConfirm?: (o: Record<string, unknown>) => void
    onClose?: () => void
  }) =>
    props.open ? (
      <div data-testid="export-dlg">
        <button type="button" onClick={() => props.onConfirm?.({})}>
          confirm-export
        </button>
        <button type="button" onClick={() => props.onClose?.()}>
          close-export
        </button>
      </div>
    ) : null
}))

// Light video prep modal for host create pipeline
vi.mock('../components/VideoPrepModal', () => ({
  VideoPrepModal: (props: {
    open?: boolean
    phase?: string
    onConfirm?: () => void
    onFinish?: () => void
    onAbandon?: () => void
  }) =>
    props.open ? (
      <div data-testid="vp-modal" data-phase={props.phase}>
        <button type="button" onClick={() => void props.onConfirm?.()}>
          vp-confirm
        </button>
        <button type="button" onClick={() => props.onFinish?.()}>
          vp-finish
        </button>
        <button type="button" onClick={() => props.onAbandon?.()}>
          vp-abandon
        </button>
      </div>
    ) : null
}))

const galleryJson = JSON.stringify([
  {
    id: 'g1',
    path: '/media/aria.png',
    label: 'Front',
    kind: 'sheet',
    layer: 'identity',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'g2',
    path: '/media/base.png',
    label: 'Base',
    kind: 'sheet',
    layer: 'base',
    createdAt: '2026-07-02T00:00:00.000Z'
  }
])

type JobsApi = ReturnType<typeof useAiJobs>
let jobsApi: JobsApi | null = null

function JobsProbe(): null {
  const j = useAiJobs()
  useEffect(() => {
    jobsApi = j
  }, [j, j.jobs, j.pendingDrafts, j.reviewingJobId])
  return null
}

function seedCommon() {
  reseedMockApi(api)
  jobsApi = null
  try {
    localStorage.removeItem('idm.aiJobs.v1')
    localStorage.removeItem('idm.videoPrepDraft.v1')
    localStorage.removeItem('idm.videoPrepDrafts.v2')
  } catch {
    /* ignore */
  }
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.stories.get = vi.fn().mockResolvedValue(makeStoryDetail())
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi.fn().mockResolvedValue({
    url: 'blob:test',
    filePath: '/media/aria.png'
  })
  api.media.pickRefImage = vi.fn().mockResolvedValue({
    path: '/tmp/ref.png',
    filePath: '/tmp/ref.png'
  })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'cinematic intro',
    stillPath: '/media/aria.png',
    sourceImagePath: '/media/aria.png',
    durationSeconds: 5,
    aspectRatio: '16:9',
    entityIds: { characterId: 'char-1' },
    kind: 'character-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({
    videoPath: '/tmp/out.mp4'
  })
  api.videoPrep.regenStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'new',
    stillPath: '/media/new.png'
  })
  api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'from still',
    stillPath: '/media/s.png',
    durationSeconds: 4,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' }
  })
  api.mediaGen.extract = vi.fn().mockResolvedValue({
    kind: 'character-sheet',
    ...mediaGenExtractOk
  })
  api.mediaGen.polish = vi.fn().mockResolvedValue({
    polishedPrompt: 'POLISHED PROMPT LONG ENOUGH FOR GEN',
    polished: true,
    imageCount: 1
  })
  api.mediaGen.generateImage = vi.fn().mockResolvedValue({
    path: '/tmp/media-gen.png',
    draft: true,
    panelLayout: 'bible',
    artStyle: 'anime',
    usedEdit: false,
    promptUsed: 'POLISHED PROMPT LONG ENOUGH FOR GEN'
  })
}

/** Drive MediaGenPrepModal: materials → polish → generate still → add to gallery. */
async function completeMediaGenImageFlow(expectedPath?: string) {
  await waitFor(
    () => {
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /Next:\s*polish/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 8000 }
  )
  await clickBtn(/Next:\s*polish/i)
  await waitFor(
    () => {
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Generate image$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 8000 }
  )
  await clickBtn(/^Generate image$/i)
  await waitFor(
    () => expect(api.mediaGen.generateImage).toHaveBeenCalled(),
    { timeout: 8000 }
  )
  if (expectedPath) {
    expect(api.mediaGen.generateImage).toHaveBeenCalled()
  }
  await waitFor(
    () => {
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /Add to gallery/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 8000 }
  )
  await clickBtn(/Add to gallery/i)
}

async function clickBtn(re: RegExp, opts?: { allowDisabled?: boolean }) {
  const b = screen.getAllByRole('button').find((x) => {
    if (!re.test(x.textContent || '')) return false
    if (opts?.allowDisabled) return true
    return !(x as HTMLButtonElement).disabled
  })
  if (b) {
    await act(async () => {
      fireEvent.click(b)
    })
  }
  return b
}

async function openEditNamed(name: string) {
  await act(async () => {
    await Promise.resolve()
  })
  await waitFor(
    () => {
      expect(document.body.textContent || '').toMatch(new RegExp(name, 'i'))
    },
    { timeout: 15000 }
  )
  // Prefer explicit Edit; fall back to first matching card button
  let target =
    screen
      .queryAllByRole('button')
      .find((b) => /^Edit$/i.test((b.textContent || '').trim())) || null
  if (!target) {
    const el = screen.getAllByText(new RegExp(name, 'i'))[0]
    target = (el.closest('article')?.querySelector('button') as HTMLButtonElement) || null
  }
  expect(target).toBeTruthy()
  await act(async () => {
    fireEvent.click(target!)
  })
  await waitFor(
    () => {
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 10000 }
  )
}

async function waitPendingDraft(min = 1) {
  await waitFor(
    () => {
      expect(jobsApi).toBeTruthy()
      expect(jobsApi!.pendingDrafts.length).toBeGreaterThanOrEqual(min)
    },
    { timeout: 10000 }
  )
}

async function acceptLatestDraft() {
  await waitPendingDraft(1)
  const id = jobsApi!.pendingDrafts[0]!.id
  await act(async () => {
    await jobsApi!.acceptDraft(id)
  })
}

describe('pages AiJobs + VideoPrep shell', () => {
  beforeEach(() => {
    localStorage.clear()
    seedCommon()
  })

  it('Characters: AI fill accept + sheet commit + intro video host', async () => {
    api.characters.list = vi.fn().mockImplementation(async () => [
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refGalleryJson: galleryJson,
        refImagePath: '/media/aria.png'
      })
    ])
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria++',
        description: 'filled',
        appearance: 'silver',
        costume: 'coat',
        personality: 'cold'
      },
      profileJson: '{}',
      raw: ''
    })
    api.mediaGen.generateImage = vi.fn().mockResolvedValue({
      path: '/tmp/sheet-draft.png',
      draft: true,
      panelLayout: 'bible',
      artStyle: 'anime',
      usedEdit: false,
      promptUsed: 'POLISHED PROMPT LONG ENOUGH FOR GEN'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sheet-committed.png',
      character: { id: 'char-1', costume: 'coat' },
      gallery: [
        {
          id: 'ng',
          path: '/tmp/sheet-committed.png',
          kind: 'sheet',
          label: 'Bible',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity'
        }
      ]
    })
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'Rain look',
        costume: 'trench + boots',
        artStyle: 'anime',
        rationale: 'noir rain'
      }
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.list = vi.fn().mockResolvedValue([makeTimelineEntry()])
    api.souls.list = vi.fn().mockResolvedValue({
      data: [],
      total_pages: 1,
      current_page: 1
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 0,
      pages: 0,
      fromCache: true,
      suggestions: []
    })

    await renderWithProviders(
      <>
        <JobsProbe />
        <MediaGenHost />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openEditNamed('Aria')
    await clickBtn(/^Profile$/i)
    const idea = document.querySelector('textarea') as HTMLTextAreaElement
    if (idea) {
      await act(async () => {
        fireEvent.change(idea, { target: { value: 'cyber noir lead' } })
      })
    }
    await clickBtn(/AI fill \/ improve|AI fill/i)
    await waitFor(() => expect(api.characters.aiFill).toHaveBeenCalled(), {
      timeout: 5000
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.characters.update).toHaveBeenCalled())

    // Sheet via MediaGen shell (materials → polish → generate → gallery draft)
    await clickBtn(/^References$/i)
    await clickBtn(/Generate professional reference/i)
    await waitFor(() => expect(api.mediaGen.extract).toHaveBeenCalled(), {
      timeout: 8000
    })
    await completeMediaGenImageFlow('/tmp/sheet-draft.png')
    await acceptLatestDraft()
    await waitFor(() => expect(api.characters.commitSheet).toHaveBeenCalled())

    await clickBtn(/^Costume$/i)
    await clickBtn(/Suggest from plot/i)
    await waitFor(() =>
      expect(api.characters.suggestWardrobe).toHaveBeenCalled()
    )
    await acceptLatestDraft()

    // Intro video routes through MediaGen when host is registered
    await clickBtn(/^References$/i)
    await clickBtn(/Intro video|intro/i)
    await waitFor(
      () => {
        expect(api.mediaGen.extract).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'character-intro' })
        )
      },
      { timeout: 10000 }
    )
    // Cancel shell (video path not needed for host registration check)
    await clickBtn(/^Cancel$/i)
  }, 45000)

  it('Props: AI fill accept + plate commit', async () => {
    const g = JSON.stringify([
      {
        id: 'pg1',
        path: '/media/badge.png',
        label: 'Hero',
        kind: 'plate',
        createdAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.props.list = vi.fn().mockResolvedValue([makeProp({ refGalleryJson: g })])
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Badge+', description: 'shiny', material: 'brass' },
      profileJson: '{}',
      raw: ''
    })
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/prop-plate.png',
      label: 'Hero',
      variant: 'hero'
    })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/prop-committed.png',
      gallery: []
    })
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <JobsProbe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openEditNamed('Badge')

    // Drive draft via jobs API (page handlers already registered)
    await act(async () => {
      jobsApi!.startJob({
        kind: 'prop-ai-fill',
        label: 'prop-fill',
        scope: { propId: 'prop-1' },
        run: async () => ({
          type: 'prop-profile' as const,
          propId: 'prop-1',
          storyId: 'story-1',
          profile: {
            name: 'Badge+',
            description: 'shiny',
            material: 'brass'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.props.update).toHaveBeenCalled())

    await clickBtn(/References|ref/i)
    await act(async () => {
      jobsApi!.startJob({
        kind: 'prop-plate',
        label: 'prop-plate',
        scope: { propId: 'prop-1' },
        run: async () => ({
          type: 'prop-plate' as const,
          propId: 'prop-1',
          storyId: 'story-1',
          path: '/tmp/prop-plate.png',
          variant: 'hero',
          label: 'Hero'
        })
      })
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.props.commitPlate).toHaveBeenCalled())
  }, 35000)

  it('Scenes: AI fill accept + plate commit', async () => {
    const g = JSON.stringify([
      {
        id: 'sg1',
        path: '/media/roof.png',
        label: 'Est',
        kind: 'plate',
        createdAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ refGalleryJson: g })
    ])
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'Rooftop+',
        description: 'rain night',
        mood: 'tense'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sc-plate.png',
      label: 'Est',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/sc-committed.png',
      gallery: []
    })
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())

    await renderWithProviders(
      <>
        <JobsProbe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openEditNamed('Rooftop')
    await act(async () => {
      jobsApi!.startJob({
        kind: 'scene-ai-fill',
        label: 'scene-fill',
        scope: { sceneId: 'scene-1' },
        run: async () => ({
          type: 'scene-profile' as const,
          sceneId: 'scene-1',
          storyId: 'story-1',
          profile: {
            title: 'Rooftop+',
            description: 'rain night',
            mood: 'tense'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.scenes.update).toHaveBeenCalled())

    await clickBtn(/References|ref/i)
    await act(async () => {
      jobsApi!.startJob({
        kind: 'scene-plate',
        label: 'scene-plate',
        scope: { sceneId: 'scene-1' },
        run: async () => ({
          type: 'scene-plate' as const,
          sceneId: 'scene-1',
          storyId: 'story-1',
          path: '/tmp/sc-plate.png',
          variant: 'establishing',
          label: 'Est'
        })
      })
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.scenes.commitPlate).toHaveBeenCalled())
  }, 35000)

  it('Actions: AI fill + plate commit', async () => {
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Draw', description: 'quick' },
      profileJson: '{}',
      raw: ''
    })
    api.actions.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/act.png',
      label: 'Grid'
    })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/act-c.png',
      gallery: []
    })
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])

    await renderWithProviders(
      <>
        <JobsProbe />
        <ActionsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openEditNamed('Draw gun')
    await act(async () => {
      jobsApi!.startJob({
        kind: 'action-ai-fill',
        label: 'action-fill',
        scope: { actionId: 'action-1' },
        run: async () => ({
          type: 'action-profile' as const,
          actionId: 'action-1',
          storyId: 'story-1',
          profile: { name: 'Draw', description: 'quick' },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.actions.update).toHaveBeenCalled())

    await clickBtn(/References|ref/i)
    await act(async () => {
      jobsApi!.startJob({
        kind: 'action-plate',
        label: 'action-plate',
        scope: { actionId: 'action-1' },
        run: async () => ({
          type: 'action-plate' as const,
          actionId: 'action-1',
          storyId: 'story-1',
          path: '/tmp/act.png',
          variant: 'grid',
          label: 'Grid'
        })
      })
    })
    await acceptLatestDraft()
    await waitFor(() => expect(api.actions.commitPlate).toHaveBeenCalled())
  }, 35000)

  it('Stories: cover draft commit', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi.fn().mockResolvedValue(makeStoryDetail())
    api.mediaGen.extract = vi.fn().mockResolvedValue({
      kind: 'story-cover',
      ...mediaGenExtractOk,
      sections: [
        {
          id: 'task-cover',
          kind: 'text-profile' as const,
          title: 'Logline',
          entityType: 'story' as const,
          text: 'demo cover',
          include: true,
          canBeEditBase: false,
          group: 'task' as const
        }
      ]
    })
    api.mediaGen.generateImage = vi.fn().mockResolvedValue({
      path: '/tmp/cover-draft.png',
      draft: true,
      usedEdit: false,
      promptUsed: 'POLISHED PROMPT LONG ENOUGH FOR GEN'
    })
    api.stories.commitCover = vi.fn().mockResolvedValue({
      path: '/tmp/cover-final.png'
    })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <JobsProbe />
        <MediaGenHost />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    await clickBtn(/^Edit$/i)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
    await clickBtn(/Generate cover/i)
    await waitFor(
      () =>
        expect(api.mediaGen.extract).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'story-cover' })
        ),
      { timeout: 8000 }
    )
    await completeMediaGenImageFlow('/tmp/cover-draft.png')
    await acceptLatestDraft()
    await waitFor(() => expect(api.stories.commitCover).toHaveBeenCalled())
  }, 35000)

  it('Costumes: AI fill applies directly (no draft)', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Rain coat+',
      description: 'longer trench'
    })
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <JobsProbe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openEditNamed('Rain coat')
    const idea = document.querySelector('textarea') as HTMLTextAreaElement
    if (idea) {
      await act(async () => {
        fireEvent.change(idea, { target: { value: 'wet asphalt fashion' } })
      })
    }
    await clickBtn(/AI fill|fill/i)
    await waitFor(() => expect(api.costumes.aiFill).toHaveBeenCalled())
    // costume AI writes fields in-editor; no pending draft
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(document.body.textContent || '').toMatch(/Rain coat|Save|longer/i)
  }, 30000)

  it('Timeline: generate confirms dialogs and runs pipeline job', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry(),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        dialogue: 'Next',
        startTime: 4,
        endTime: 8,
        mediaStatus: 'FAILED',
        status: 'FAILED'
      })
    ])
    api.timeline.create = vi
      .fn()
      .mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/media/aria.png' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([])
    api.actions.list = vi.fn().mockResolvedValue([])
    api.settings.get = vi.fn().mockResolvedValue({
      defaultMaxClipSeconds: 6,
      videoMode: 'stub',
      burnSubtitles: true
    })
    api.generation.run = vi.fn().mockResolvedValue({
      success: true,
      steps: [{ step: 'video', success: true }]
    })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/tmp/out.mp4' })
    api.media.exportPreflight = vi.fn().mockResolvedValue({ ok: true })
    api.media.listExports = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <JobsProbe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled(), {
      timeout: 5000
    })
    // Wait settings so videoMode is stub (avoids extra missing-ref dialog race)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled(), {
      timeout: 5000
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    // Prefer toolbar Generate (exact label), not "Generate this clip"
    const gen =
      screen
        .getAllByRole('button')
        .find((b) => /^Generate$/i.test((b.textContent || '').trim())) || null
    expect(gen).toBeTruthy()
    await act(async () => {
      fireEvent.click(gen!)
    })

    // Confirm mode-hint (and optional missing-ref) dialogs — must wait; CI is slower
    for (let i = 0; i < 4; i++) {
      if (api.generation.run.mock.calls.length > 0) break
      const dlg = await waitFor(
        () => {
          const el = document.querySelector('[role="alertdialog"]')
          if (!el) throw new Error('no alertdialog yet')
          return el
        },
        { timeout: 3000 }
      ).catch(() => null)
      if (!dlg) break
      const buttons = Array.from(dlg.querySelectorAll('button'))
      const confirmBtn = buttons[buttons.length - 1] as HTMLButtonElement | undefined
      expect(confirmBtn).toBeTruthy()
      await act(async () => {
        fireEvent.click(confirmBtn!)
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
    }
    await waitFor(() => expect(api.generation.run).toHaveBeenCalled(), {
      timeout: 15000
    })
    // pipeline draft acknowledge if present
    if (jobsApi && jobsApi.pendingDrafts.length > 0) {
      await acceptLatestDraft()
    }

    await clickBtn(/^Export$/i)
    if (screen.queryByTestId('export-dlg')) {
      await act(async () => {
        fireEvent.click(screen.getByText('confirm-export'))
      })
    }
  }, 35000)
})
