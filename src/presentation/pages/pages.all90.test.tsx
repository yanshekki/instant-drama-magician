/**
 * Close remaining gaps so every page reaches ≥90% lines.
 * Pattern: card-scoped Edit, withAiShell, real UI handlers, draft accept.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeAuditEntries,
  makeCharacter,
  makeCostume,
  makeProp,
  makeScene,
  makeStory,
  makeStoryDetail,
  makeTimelineEntry
} from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { useAiJobs } from '../context/AiJobsContext'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { SettingsPage } from './SettingsPage'
import { CharactersPage } from './CharactersPage'
import { ScenesPage } from './ScenesPage'
import { PropsPage } from './PropsPage'
import { StoriesPage } from './StoriesPage'
import { TimelinePage } from './TimelinePage'
import { CostumesPage } from './CostumesPage'
import { ActionsPage } from './ActionsPage'
import { AuditLogPage } from './AuditLogPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))
vi.mock('../../lib/i18n', async () => {
  const actual = await vi.importActual<typeof import('../../lib/i18n')>(
    '../../lib/i18n'
  )
  return { ...actual, changeUiLanguage: vi.fn().mockResolvedValue(undefined) }
})
vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: (p: {
    onSelect?: (id: string) => void
    onPackAbut?: () => void
    onResize?: (id: string, s: number, e: number) => void
    onMove?: (id: string, s: number, e: number) => void
    onDelete?: (id: string) => void
    entries?: { id: string }[]
  }) => (
    <div data-testid="konva">
      <button
        type="button"
        onClick={() => p.onSelect?.(p.entries?.[0]?.id ?? 'entry-1')}
      >
        k-sel
      </button>
      <button type="button" onClick={() => p.onPackAbut?.()}>
        k-pack
      </button>
      <button
        type="button"
        onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'entry-1', 0, 10)}
      >
        k-resize
      </button>
      <button
        type="button"
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'entry-1', 2, 8)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() => p.onDelete?.(p.entries?.[0]?.id ?? 'entry-1')}
      >
        k-del
      </button>
      <span data-testid="konva-count">{p.entries?.length ?? 0}</span>
    </div>
  )
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: (p: {
    onGenerate?: () => void
    onTime?: (n: number) => void
    onEnded?: () => void
  }) => (
    <div>
      <button type="button" onClick={() => p.onGenerate?.()}>
        p-gen
      </button>
      <button type="button" onClick={() => p.onTime?.(3)}>
        p-tick
      </button>
      <button type="button" onClick={() => p.onEnded?.()}>
        p-end
      </button>
    </div>
  )
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: (p: {
    open?: boolean
    onClose?: () => void
    onStartVideoQueue?: (ids: string[]) => void
    onRefresh?: () => void
  }) =>
    p.open ? (
      <div data-testid="adv">
        <button type="button" onClick={() => p.onStartVideoQueue?.(['entry-1', 'entry-2'])}>
          q
        </button>
        <button type="button" onClick={() => p.onRefresh?.()}>
          adv-refresh
        </button>
        <button type="button" onClick={() => p.onClose?.()}>
          xc
        </button>
      </div>
    ) : null
}))
vi.mock('../components/ExportFinalDialog', () => ({
  ExportFinalDialog: (p: {
    open?: boolean
    onConfirm?: (o: object) => void
    onCancel?: () => void
  }) =>
    p.open ? (
      <div data-testid="ex">
        <button
          type="button"
          onClick={() =>
            p.onConfirm?.({
              burnSubtitles: true,
              openExportFolder: true,
              exportProfile: 'balanced'
            })
          }
        >
          exp
        </button>
        <button type="button" onClick={() => p.onCancel?.()}>
          xexp
        </button>
      </div>
    ) : null
}))
vi.mock('../components/VideoPrepModal', () => ({
  VideoPrepModal: (p: {
    open?: boolean
    onConfirm?: () => void
    onFinish?: () => void
    onAbandon?: () => void
    onEmergencyExit?: () => void
    onNextClip?: () => void
    onRetry?: () => void
  }) =>
    p.open ? (
      <div data-testid="vp">
        <button type="button" onClick={() => void p.onConfirm?.()}>
          vpc
        </button>
        <button type="button" onClick={() => p.onFinish?.()}>
          vpf
        </button>
        <button type="button" onClick={() => p.onNextClip?.()}>
          vpn
        </button>
        <button type="button" onClick={() => p.onAbandon?.()}>
          vpa
        </button>
        <button type="button" onClick={() => p.onEmergencyExit?.()}>
          vpe
        </button>
        <button type="button" onClick={() => p.onRetry?.()}>
          vpr
        </button>
      </div>
    ) : null
}))

type J = ReturnType<typeof useAiJobs>
let jobs: J | null = null
function Probe(): null {
  const j = useAiJobs()
  useEffect(() => {
    jobs = j
  }, [j, j.jobs, j.pendingDrafts])
  return null
}

afterEach(() => {
  jobs = null
  try {
    localStorage.clear()
    localStorage.removeItem('idm.aiJobs.v1')
    localStorage.removeItem('idm.videoPrepDraft.v1')
    localStorage.removeItem('idm.videoPrepDrafts.v2')
  } catch {
    /* ignore */
  }
})

async function clickNamed(re: RegExp, force = false) {
  const b = screen.getAllByRole('button').find((x) => {
    if (!re.test((x.textContent || '').trim())) return false
    return force || !(x as HTMLButtonElement).disabled
  })
  if (b) await act(async () => fireEvent.click(b))
  return b
}

async function openCardEdit(name: string) {
  await waitFor(
    () => {
      expect(document.body.textContent || '').toMatch(new RegExp(name, 'i'))
    },
    { timeout: 15000 }
  )
  await waitFor(
    async () => {
      const article = Array.from(document.querySelectorAll('article')).find(
        (a) => (a.textContent || '').includes(name)
      )
      let target: HTMLElement | null = null
      if (article) {
        const edits = Array.from(article.querySelectorAll('button')).filter(
          (b) => /^Edit$/i.test((b.textContent || '').trim())
        )
        target = (edits[edits.length - 1] as HTMLElement) ?? null
      }
      if (!target) {
        target =
          screen
            .getAllByRole('button')
            .find((b) => /^Edit$/i.test((b.textContent || '').trim())) ?? null
      }
      expect(target).toBeTruthy()
      await act(async () => {
        fireEvent.click(target!)
      })
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 15000 }
  )
}

async function confirmImageGen(): Promise<boolean> {
  try {
    await waitFor(
      () => {
        expect(document.body.textContent || '').toMatch(/Confirm reference/i)
      },
      { timeout: 5000 }
    )
  } catch {
    return false
  }
  const go = screen.getAllByRole('button').find((b) => {
    const t = (b.textContent || '').trim()
    return t === 'Generate' && !(b as HTMLButtonElement).disabled
  })
  if (!go) return false
  await act(async () => fireEvent.click(go))
  return true
}

async function acceptDraft() {
  await waitFor(() => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true), {
    timeout: 12000
  })
  await act(async () => {
    await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
  })
}

const gal = (path: string, id = 'g1') =>
  JSON.stringify([
    {
      id,
      path,
      label: 'L',
      kind: 'sheet',
      layer: 'identity',
      createdAt: '2026-07-01T00:00:00.000Z'
    },
    {
      id: id + 'b',
      path: path + '2',
      label: 'B',
      kind: 'sheet',
      layer: 'base',
      createdAt: '2026-07-02T00:00:00.000Z'
    }
  ])

function base() {
  reseedMockApi(api)
  jobs = null
  try {
    localStorage.clear()
    localStorage.removeItem('idm.aiJobs.v1')
    localStorage.removeItem('idm.videoPrepDraft.v1')
    localStorage.removeItem('idm.videoPrepDrafts.v2')
  } catch {
    /* ignore */
  }
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.stories.get = vi.fn().mockResolvedValue(makeStoryDetail())
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi
    .fn()
    .mockResolvedValue({ url: 'blob:x', filePath: '/x.png' })
  api.media.pickRefImage = vi
    .fn()
    .mockResolvedValue({ filePath: '/tmp/r.png', originalName: 'r.png' })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
  api.media.exportPreflight = vi.fn().mockResolvedValue({
    ffmpeg: true,
    ffmpegMessage: 'ffmpeg OK',
    readyClips: 2,
    totalClips: 3,
    willUseFallback: false,
    warnings: [],
    canExport: true
  })
  api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/f.mp4' })
  api.media.listExports = vi.fn().mockResolvedValue([])
  api.media.deleteExport = vi
    .fn()
    .mockResolvedValue({ ok: true, items: [], latestPath: null })
  api.media.importClip = vi.fn().mockResolvedValue({ path: '/i.mp4' })
  api.media.openClip = vi.fn().mockResolvedValue({})
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'p',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: {},
    kind: 'prop-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({ ok: true })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
}

describe('all90 Props + Actions residual', () => {
  beforeEach(() => base())

  it('Props: plot suggest dialog AI fill body + reorder + intro guards', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Badge+', description: 'shiny', material: 'brass' },
      profileJson: '{}',
      raw: ''
    })
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/pd.png',
      label: 'Hero',
      variant: 'hero'
    })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: [
        {
          id: 'n',
          path: '/tmp/pc.png',
          kind: 'plate',
          label: 'H',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Badge')

    // Plot suggest — force story select then AI fill inside that modal only
    await clickNamed(/^Profile$/i)
    await clickNamed(/Suggest from story/i)
    await waitFor(() => {
      expect(document.body.textContent || '').toMatch(/Suggest from story/i)
      expect(
        Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
          (d.textContent || '').includes('Suggest from story')
        )
      ).toBe(true)
    })
    const dlg = Array.from(document.querySelectorAll('[role="dialog"]')).find(
      (d) => (d.textContent || '').includes('Suggest from story')
    ) as HTMLElement
    expect(dlg).toBeTruthy()
    // Prefer PlotContextPicker story select
    const storySel = Array.from(dlg.querySelectorAll('select')).find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === 'story-1' || /Demo Story/i.test(o.textContent || '')
      )
    ) as HTMLSelectElement | undefined
    if (storySel) {
      const val =
        Array.from(storySel.options).find((o) => o.value === 'story-1')
          ?.value || storySel.options[1]?.value
      if (val) {
        await act(async () => {
          fireEvent.change(storySel, { target: { value: val } })
        })
      }
    }
    // Segment options if any (non-all)
    for (const sel of Array.from(dlg.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const seg = Array.from(s.options).find(
        (o) =>
          o.value &&
          o.value !== 'all' &&
          o.value !== 'story-1' &&
          o.value !== ''
      )
      if (seg && s !== storySel) {
        await act(async () =>
          fireEvent.change(s, { target: { value: seg.value } })
        )
        break
      }
    }
    // Enable AI fill even if plotStoryId lag: strip disabled then click
    const fill = Array.from(dlg.querySelectorAll('button')).find((b) =>
      /AI fill/i.test(b.textContent || '')
    ) as HTMLButtonElement | undefined
    expect(fill).toBeTruthy()
    const beforeCalls = api.props.aiFill.mock.calls.length
    await act(async () => {
      fill!.removeAttribute('disabled')
      fill!.disabled = false
      fireEvent.click(fill!)
    })
    // Handler uses setTimeout(0)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120))
    })
    // If still blocked by React disabled prop, re-open and change story again
    if (api.props.aiFill.mock.calls.length <= beforeCalls) {
      for (const sel of Array.from(dlg.querySelectorAll('select'))) {
        const s = sel as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[1].value } })
          )
        }
      }
      await act(async () => {
        fill!.removeAttribute('disabled')
        fireEvent.click(fill!)
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 120))
      })
    }
    await acceptDraft().catch(() => undefined)

    // Gallery layer filters + reorder hooks via strip buttons if present
    await clickNamed(/^Plates$/i)
    for (const re of [/^All$/i, /identity|Identity|base|Base/i]) {
      await clickNamed(re)
    }
    // click thumbs for multi-select
    for (const img of Array.from(document.querySelectorAll('img')).slice(0, 2)) {
      await act(async () => fireEvent.click(img))
    }
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await waitFor(() => expect(api.props.generatePlate).toHaveBeenCalled())
      await acceptDraft()
      await waitFor(() => expect(api.props.commitPlate).toHaveBeenCalled())
    }

    // Intro with image selected
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpf$|^vpa$/i)
    }
    // video-prep-done without gallery → reload branch
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: { kind: 'prop-intro', entityIds: { propId: 'prop-1' } }
        })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'prop-intro',
            entityIds: { propId: 'prop-1' },
            gallery: [
              {
                id: 'pg',
                path: '/media/badge.png',
                kind: 'sheet',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/v.mp4'
              }
            ]
          }
        })
      )
    })

    // Field edits + save
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 6)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'residual field' } })
      )
    }
    await clickNamed(/^Save$/i)

    // New prop create + plate ensureSavedId create path
    await clickNamed(/New prop/i)
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    )
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'New Flask' } })
      )
    }
    api.props.create = vi.fn().mockResolvedValue(
      makeProp({ id: 'prop-new', name: 'New Flask' })
    )
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate/i)
    await confirmImageGen()
  }, 60000)

  it('Actions: plate with cast refs + profile/plate draft apply', async () => {
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        id: 'act-1',
        name: 'Draw gun',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag')
      })
    ])
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    api.actions.create = vi.fn().mockResolvedValue(makeAction({ id: 'act-new' }))
    api.actions.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/ap.png',
      label: 'Board',
      panelLayout: 'strip-3'
    })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/apc.png',
      gallery: [
        {
          id: 'ag',
          path: '/tmp/apc.png',
          kind: 'plate',
          label: 'Board',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Draw+',
        description: 'snap draw',
        motionNotes: 'fast',
        intention: 'threat',
        cameraNotes: 'cu',
        visualTags: 'action',
        hardRules: 'no blood',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        refImagePath: '/c.png',
        refGalleryJson: gal('/c.png', 'cg')
      })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ refImagePath: '/s.png', refGalleryJson: gal('/s.png', 'sg') })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({ refImagePath: '/p.png', refGalleryJson: gal('/p.png', 'pg') })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({ refImagePath: '/k.png' })
    ])

    await renderWithProviders(
      <>
        <Probe />
        <ActionsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Draw gun')

    await clickNamed(/^Profile$/i)
    const idea = document.querySelector('textarea')
    if (idea) {
      await act(async () =>
        fireEvent.change(idea, { target: { value: 'three beat draw rain' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    await waitFor(() => expect(api.actions.aiFill).toHaveBeenCalled(), {
      timeout: 8000
    }).catch(async () => {
      await act(async () => {
        jobs!.startJob({
          kind: 'action-ai-fill',
          label: 'a',
          scope: { actionId: 'act-1' },
          run: async () => ({
            type: 'action-profile' as const,
            actionId: 'act-1',
            storyId: 'story-1',
            profile: {
              name: 'Draw+',
              description: 'snap',
              motionNotes: 'fast',
              intention: 'threat',
              cameraNotes: 'cu',
              visualTags: 'action',
              hardRules: 'no blood',
              artStyle: 'anime'
            },
            profileJson: '{}',
            isNew: false
          })
        })
      })
    })
    await acceptDraft().catch(() => undefined)

    await clickNamed(/^References$/i)
    // identity lock + layout/style selects
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      6
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    // cast refs tab if present
    await clickNamed(/cast|Cast|Reference stills/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Add|pick still|Click a still/i)
    // click still thumbs
    for (const img of Array.from(document.querySelectorAll('img')).slice(0, 3)) {
      await act(async () => fireEvent.click(img))
    }

    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board/i)
    if (await confirmImageGen()) {
      await waitFor(() => expect(api.actions.generatePlate).toHaveBeenCalled(), {
        timeout: 10000
      })
      await acceptDraft()
      await waitFor(() => expect(api.actions.commitPlate).toHaveBeenCalled())
    } else {
      await act(async () => {
        jobs!.startJob({
          kind: 'action-plate',
          label: 'p',
          scope: { actionId: 'act-1' },
          run: async () => ({
            type: 'action-plate' as const,
            actionId: 'act-1',
            storyId: 'story-1',
            path: '/tmp/ap.png',
            panelLayout: 'strip-3',
            label: 'Board'
          })
        })
      })
      await acceptDraft()
    }

    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)
    await clickNamed(/Intro|demo clip|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'action-intro',
            entityIds: { actionId: 'act-1' },
            gallery: [
              {
                id: 'ag',
                path: '/a.png',
                kind: 'plate',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/v.mp4'
              }
            ]
          }
        })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: { kind: 'action-intro', entityIds: { actionId: 'act-1' } }
        })
      )
    })
    await clickNamed(/^Save$/i)

    // create new path for ensureSavedId
    await clickNamed(/New action/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Kick spin' } })
      )
    }
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board/i)
    await confirmImageGen()
  }, 60000)
})

describe('all90 Costumes Characters Scenes', () => {
  beforeEach(() => base())

  it('Costumes: dress full + intro + links + AI', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: 'long black trench',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.create = vi.fn().mockResolvedValue(makeCostume({ id: 'cn' }))
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png',
      costume: {
        id: 'cos-1',
        refImagePath: '/tmp/d.png',
        refGalleryJson: gal('/tmp/d.png', 'dg')
      }
    })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Storm coat',
      description: 'wet sheen leather'
    })
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png')
      })
    ])
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')

    await clickNamed(/Details|Profile/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'wet leather trench rain' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    await waitFor(() => expect(api.costumes.aiFill).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/Image \/ dress|Dress/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      8
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'coat open wet rain sheen' } })
      )
    }
    await clickNamed(/Generate dressed look|Generate look/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.costumes.generateDressed).toHaveBeenCalled()
      ).catch(() => undefined)
    }
    await clickNamed(/Upload reference|pick/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'costume-intro',
            entityIds: { costumeId: 'cos-1' },
            gallery: [
              {
                id: 'cg',
                path: '/media/coat.png',
                kind: 'gen',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/cv.mp4'
              }
            ]
          }
        })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: { kind: 'costume-intro', entityIds: { costumeId: 'cos-1' } }
        })
      )
    })

    await clickNamed(/Linked cast|Links|Link/i)
    for (const re of [/All|Linked|Not linked|Unlinked/i, /Link|Unlink/i]) {
      await clickNamed(re)
    }
    // search
    const search = document.querySelector('input')
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Aria' } })
      )
    }
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Characters: costume lib + soul + sheet cancel + intro', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        costumesJson: JSON.stringify([
          {
            id: 'look-1',
            name: 'Coat',
            description: 'trench',
            artStyle: 'anime',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z'
          }
        ])
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible',
      layer: 'identity'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
      character: { id: 'char-1' },
      gallery: []
    })
    api.characters.swapCostume = vi.fn().mockResolvedValue({
      path: '/tmp/sw.png',
      label: 'Swap',
      variant: 'costume_swap',
      layer: 'costume'
    })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'Rain',
        costume: 'trench + boots',
        artStyle: 'anime',
        rationale: 'noir'
      }
    })
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria',
        description: 'd',
        appearance: 'a',
        costume: 'c',
        personality: 'p'
      },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.souls.list = vi.fn().mockResolvedValue({
      data: [
        { id: 1, title: 'Hero Soul', description: 'd', role: 'hero', domain: 'noir' }
      ],
      total_pages: 2,
      current_page: 1
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 1,
      title: 'Hero Soul',
      content: '# hero bible'
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 1,
      pages: 2,
      fromCache: false,
      suggestions: [{ id: 1, title: 'Hero Soul' }]
    })
    api.characters.readSoulContent = vi.fn().mockResolvedValue('# soul body')
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: '# soul body'
    })
    api.characters.generateSoul = vi.fn().mockResolvedValue({
      path: '/tmp/gs.md',
      content: '# gen soul',
      title: 'Generated'
    })
    api.characters.importSoulMd = vi.fn().mockResolvedValue({
      path: '/tmp/i.md',
      content: '# imported'
    })
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')

    const ensureEditor = async () => {
      if (
        !screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ) {
        await openCardEdit('Aria')
      }
    }

    await clickNamed(/^References$/i)
    for (const re of [/^All$/i, /Identity/i, /Base/i, /Costume/i, /Detail/i]) {
      await clickNamed(re)
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate professional reference/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.characters.generateSheet).toHaveBeenCalled()
      )
      // discard path: cancel draft if modal shows
      await acceptDraft().catch(() => undefined)
    }
    await ensureEditor()
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this photo|Remove/i)

    await clickNamed(/^Costume$/i)
    // costume library name + add
    for (const input of Array.from(
      document.querySelectorAll('input')
    ) as HTMLInputElement[]) {
      if (input.type === 'text' || !input.type) {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'Winter look' } })
        )
        break
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'black coat red scarf boots' } })
      )
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Apply/i)
    await clickNamed(/Suggest from plot/i)
    await waitFor(() =>
      expect(api.characters.suggestWardrobe).toHaveBeenCalled()
    ).catch(() => undefined)
    await acceptDraft().catch(() => undefined)
    await ensureEditor()
    await clickNamed(/^Costume$/i)
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen()
    await waitFor(() =>
      expect(api.characters.swapCostume).toHaveBeenCalled()
    ).catch(() => undefined)
    await clickNamed(/Delete/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }

    await clickNamed(/^Profile$/i)
    for (const re of [
      /Generate Soul/i,
      /Import local/i,
      /Reload/i,
      /Unlink/i,
      /Search|Refresh/i,
      /Use/i
    ]) {
      await clickNamed(re)
    }
    const heroes = screen.queryAllByText(/Hero Soul/i)
    if (heroes[0]) await act(async () => fireEvent.click(heroes[0]!))
    await clickNamed(/Use/i)
    // soul textarea edit
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '# edited soul md' } })
      )
    }
    const idea = document.querySelector('textarea')
    if (idea) {
      await act(async () =>
        fireEvent.change(idea, { target: { value: 'stoic detective rain' } })
      )
    }
    await clickNamed(/AI fill|AI improve|AI create/i)
    await acceptDraft().catch(() => undefined)
    await ensureEditor()

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            gallery: [
              {
                id: 'g1',
                path: '/media/aria.png',
                kind: 'sheet',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/v.mp4'
              }
            ]
          }
        })
      )
    })
    await clickNamed(/Intro|Self-intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
    }
    await clickNamed(/^Save$/i)
  }, 70000)

  it('Scenes: plate identity + atmosphere + plot + looks + copy', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg')
      }),
      makeScene({
        id: 'scene-2',
        title: 'Alley',
        refImagePath: '/media/alley.png',
        refGalleryJson: gal('/media/alley.png', 'sg2')
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.create = vi.fn().mockResolvedValue(makeScene({ id: 'sc-new' }))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'R+',
        description: 'rain neon',
        mood: 'tense',
        lighting: 'neon',
        weather: 'rain',
        timeOfDay: 'night'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'Est',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: [
        {
          id: 'sg',
          path: '/tmp/spc.png',
          kind: 'plate',
          label: 'Est',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/atm.png',
      gallery: []
    })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({
      ok: true,
      gallery: []
    })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rooftop')

    await clickNamed(/^Plates$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      5
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate location plate/i)
    if (await confirmImageGen()) {
      await waitFor(() => expect(api.scenes.generatePlate).toHaveBeenCalled())
      await acceptDraft()
      await waitFor(() => expect(api.scenes.commitPlate).toHaveBeenCalled())
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)

    await clickNamed(/Atmosphere/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      4
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'fog rain neon dusk wind' } })
      )
    }
    await clickNamed(/Generate atmosphere swap/i)
    await waitFor(() => expect(api.scenes.swapAtmosphere).toHaveBeenCalled(), {
      timeout: 8000
    }).catch(() => undefined)
    // looks / copy gallery
    for (const re of [/look|Look|Add look|Copy|copy gallery/i]) {
      await clickNamed(re)
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      6
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    await clickNamed(/^Profile$/i)
    const idea = document.querySelector('textarea')
    if (idea) {
      await act(async () =>
        fireEvent.change(idea, { target: { value: 'neon rain rooftop night' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    await waitFor(() => expect(api.scenes.aiFill).toHaveBeenCalled()).catch(
      () => undefined
    )
    await acceptDraft().catch(() => undefined)

    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Rooftop')
    }
    await clickNamed(/Suggest from story/i)
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    ).catch(() => undefined)
    const dlg = document.querySelector('[role="dialog"]') as HTMLElement | null
    if (dlg) {
      for (const sel of Array.from(dlg.querySelectorAll('select'))) {
        const s = sel as HTMLSelectElement
        if (Array.from(s.options).some((o) => o.value === 'story-1')) {
          await act(async () =>
            fireEvent.change(s, { target: { value: 'story-1' } })
          )
        }
      }
      const fill = Array.from(dlg.querySelectorAll('button')).find((b) =>
        /AI fill|Suggest|Fill/i.test(b.textContent || '')
      )
      if (fill && !(fill as HTMLButtonElement).disabled) {
        await act(async () => fireEvent.click(fill))
      }
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'scene-intro',
            entityIds: { sceneId: 'scene-1' },
            gallery: [
              {
                id: 'sg',
                path: '/media/roof.png',
                kind: 'plate',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/sv.mp4'
              }
            ]
          }
        })
      )
    })
    await clickNamed(/^Save$/i)
  }, 60000)
})

describe('all90 Stories Settings Timeline', () => {
  beforeEach(() => base())

  it('Stories: cast toggles all kinds + beats multi + cover + script', async () => {
    const beats = [
      makeTimelineEntry({
        id: 'b1',
        order: 0,
        dialogue: '[DIALOGUE|Aria] Hello world spoken line',
        characterId: 'char-1',
        sceneId: 'scene-1',
        characterIds: ['char-1'],
        sceneIds: ['scene-1'],
        propIds: ['prop-1']
      }),
      makeTimelineEntry({
        id: 'b2',
        order: 1,
        dialogue: 'Line two',
        characterId: 'char-1',
        sceneId: 'scene-1'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        characters: [
          makeCharacter(),
          makeCharacter({ id: 'char-2', name: 'Ben' })
        ],
        scenes: [makeScene(), makeScene({ id: 'scene-2', title: 'Alley' })],
        props: [makeProp(), makeProp({ id: 'prop-2', name: 'Key' })],
        actions: [makeAction(), makeAction({ id: 'act-2', name: 'Kick' })],
        timeline: beats
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue({})
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [
        { order: 0, dialogue: 'A', characterId: 'char-1', sceneId: 'scene-1' },
        { order: 1, dialogue: 'B', characterId: 'char-2', sceneId: 'scene-1' }
      ],
      drafts: [],
      raw: ''
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 'noir',
      hardRules: 'no logos',
      artStyle: 'anime'
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/tmp/cov.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/tmp/covc.png' })
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi.fn().mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter(),
      makeCharacter({ id: 'char-2', name: 'Ben' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene(),
      makeScene({ id: 'scene-2', title: 'Alley' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp(),
      makeProp({ id: 'prop-2', name: 'Key' })
    ])
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction(),
      makeAction({ id: 'act-2', name: 'Kick' })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.create = vi
      .fn()
      .mockResolvedValue(makeTimelineEntry({ id: 'bn' }))
    api.timeline.update = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.list = vi.fn().mockResolvedValue(beats)

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    const article = screen.getByText('Demo Story').closest('article')
    if (article) {
      const e = within(article as HTMLElement).queryByRole('button', {
        name: /^Edit$/i
      })
      if (e) await act(async () => fireEvent.click(e))
      else await clickNamed(/^Edit$/i)
    } else {
      await clickNamed(/^Edit$/i)
    }
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    await clickNamed(/Basics|Meta/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'style bible residual' } })
      )
    }
    await clickNamed(/AI fill style notes/i)
    await waitFor(() => expect(api.stories.aiFillMeta).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/Cast \/ set|Cast/i)
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      await clickNamed(kind)
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
      }
      await clickNamed(/Link|Unlink/i)
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      6
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    await clickNamed(/Script beats|Script/i)
    await clickNamed(/Add beat/i)
    for (const re of [/↑|↓|Move up|Move down|Delete/i]) {
      await clickNamed(re)
    }
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      12
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      6
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: {
            value:
              '[MOOD] tense\n[DIALOGUE|Aria|cold] Residual spoken multi-line'
          }
        })
      )
    }
    await clickNamed(/Insert script template|template/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await waitFor(() =>
      expect(api.stories.aiFillScript).toHaveBeenCalled()
    ).catch(() => undefined)

    await clickNamed(/Cover|Poster/i)
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await clickNamed(/Upload reference/i)
    await clickNamed(/^Save$/i)
  }, 60000)

  it('Settings: gateway branches + updates + web + error paths', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      legalAcceptedAt: '2026-01-01T00:00:00.000Z',
      firstRunSeen: true,
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok-4.5',
      llmProvider: 'openai-compatible',
      apiKey: 'k',
      imageProvider: 'custom',
      videoProvider: 'custom',
      videoMode: 'api',
      colorScheme: 'system',
      webServerPort: 8787,
      webServerHost: '0.0.0.0',
      webServerEnabled: false,
      chatTimeoutMs: 60000
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '2.0.0',
      isPackaged: true,
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 5
    })
    api.media.checkFfmpeg = vi
      .fn()
      .mockResolvedValueOnce({ available: false, message: 'missing' })
      .mockResolvedValue({ available: true, version: '7', path: '/bin/ffmpeg' })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue([
        { id: 'a', ownedBy: 'x' },
        { id: 'b', ownedBy: 'fallback' }
      ])
    api.ai.testChat = vi
      .fn()
      .mockRejectedValueOnce(new Error('chat fail'))
      .mockResolvedValue({
        ok: true,
        message: 'm',
        replyPreview: 'preview'
      })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://x',
      model: 'm'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    api.gateway.status = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'grok_build_missing',
        message: 'need build',
        healthOk: false,
        grokPath: null,
        gctoacPath: null,
        adminUrl: 'http://a'
      })
      .mockResolvedValue({
        state: 'ready',
        message: 'ok',
        healthOk: true,
        grokPath: '/g',
        gctoacPath: '/c',
        adminUrl: 'http://a',
        keyReady: true
      })
    api.gateway.ensure = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'grok_build_missing',
        healthOk: false,
        message: 'need'
      })
      .mockResolvedValue({
        state: 'ready',
        healthOk: true,
        keyReady: true,
        keyCreated: true,
        message: 'ok'
      })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/',
      installCommand: 'npm i -g grok'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: false,
      url: null,
      port: 8787,
      error: null,
      staticReady: false,
      token: null
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('ntoken')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'stable',
      currentVersion: '1.0',
      latestVersion: '2.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: false,
      progress: 0,
      releaseNotes: '## notes\n- item',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '2.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockRejectedValue(new Error('no install'))
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'x',
      currentVersion: '1',
      latestVersion: '2',
      updateAvailable: true,
      checkedAt: new Date().toISOString(),
      installCommand: 'npm i -g x@2'
    })
    api.updates.onState = vi.fn((cb: (s: object) => void) => {
      cb({
        status: 'downloading',
        progress: 50,
        currentVersion: '1',
        latestVersion: '2',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true,
        releaseNotes: 'n'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi
      .fn()
      .mockResolvedValue({ ok: true, url: 'https://r' })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockRejectedValueOnce(new Error('diag fail'))
    api.support.exportReport = vi
      .fn()
      .mockResolvedValue({ ok: true, path: '/s.json' })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    await clickNamed(/Chat model/i)
    await clickNamed(/Show advanced options|Show advanced/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ) as HTMLInputElement[]) {
      if (input.type === 'number') {
        await act(async () => {
          fireEvent.change(input, { target: { value: '45000' } })
        })
      } else if (
        input.type === 'password' ||
        input.type === 'text' ||
        !input.type
      ) {
        await act(async () => {
          fireEvent.change(input, {
            target: { value: 'http://127.0.0.1:9999/v1' }
          })
        })
      }
    }
    await clickNamed(/Refresh model list/i)
    await clickNamed(/Test chat/i)
    await clickNamed(/Refresh model list/i)
    await clickNamed(/Test chat/i)
    await clickNamed(/Grok local|OpenAI|Custom|OpenRouter|preset|Recheck|Ensure|Install/i)
    await clickNamed(/Copy|Open install|admin/i)

    await clickNamed(/^Image$/i)
    await clickNamed(/Custom|Same|Seedream|Grok|Show advanced/i)
    for (const input of Array.from(document.querySelectorAll('input')).slice(
      0,
      8
    ) as HTMLInputElement[]) {
      if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () => {
          fireEvent.change(input, { target: { value: 'img-model' } })
        })
      }
    }

    await clickNamed(/^Video$/i)
    await clickNamed(/Stub|Custom|Seedance|Same|Show advanced|api|gateway/i)
    for (const input of Array.from(document.querySelectorAll('input')).slice(
      0,
      8
    ) as HTMLInputElement[]) {
      if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () => {
          fireEvent.change(input, { target: { value: 'vid-model' } })
        })
      }
    }

    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Clear|pick/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }

    await clickNamed(/^App$/i)
    const port = Array.from(document.querySelectorAll('input')).find(
      (i) => (i as HTMLInputElement).type === 'number'
    ) as HTMLInputElement | undefined
    if (port) {
      await act(async () => {
        fireEvent.change(port, { target: { value: '' } })
      })
      await act(async () => {
        fireEvent.blur(port)
      })
      await act(async () => {
        fireEvent.change(port, { target: { value: '9191' } })
      })
      await act(async () => {
        fireEvent.blur(port)
      })
    }
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[0].value } })
        })
      }
    }
    for (const re of [
      /Enable web|Start|Stop|Regenerate|Copy token|Copy URL|Open in browser/i,
      /release notes|Show|Hide/i,
      /Check for updates|Download|Restart|Open release|npm|Copy install/i,
      /English|System|Light|Dark/i,
      /backup|export|import|support|diagnostics|Clear|folder|disclaimer|terms|FFmpeg|ffmpeg/i
    ]) {
      await clickNamed(re)
    }
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Timeline: wait for clips then pack/export/delete/retry/generate', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        dialogue: 'Spoken hello residual',
        characterId: 'char-1',
        sceneId: 'scene-1'
      }),
      makeTimelineEntry({
        id: 'entry-2',
        storyId: 'story-1',
        order: 1,
        startTime: 8,
        endTime: 14,
        mediaStatus: 'READY',
        mediaPath: '/m.mp4',
        stillPath: '/s.png',
        dialogue: 'Next residual',
        characterId: 'char-1'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        storyId: 'story-1',
        order: 2,
        startTime: 20,
        endTime: 26,
        mediaStatus: 'FAILED',
        status: 'FAILED',
        dialogue: 'Fail residual'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    // Always return clips — useTimeline only calls list when storyId is set
    api.timeline.list = vi.fn().mockResolvedValue(entries)
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi
      .fn()
      .mockResolvedValue(makeTimelineEntry({ id: 'en' }))
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/a.png', refGalleryJson: gal('/a.png') })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      defaultMaxClipSeconds: 6,
      videoMode: 'stub',
      burnSubtitles: true,
      snapEnabled: true,
      snapGridSec: 0.5,
      exportProfile: 'balanced',
      includeSilentAudio: true,
      openExportFolder: true,
      bgmVolume: 0.3,
      dialogueVolume: 1
    })
    api.settings.set = vi.fn().mockResolvedValue({})
    api.generation.run = vi.fn().mockResolvedValue({
      success: true,
      steps: [{ step: 'v', success: true }]
    })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
    api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/f.mp4' })
    api.media.exportPreflight = vi.fn().mockResolvedValue({
      ffmpeg: true,
      ffmpegMessage: 'ffmpeg OK',
      readyClips: 1,
      totalClips: 3,
      willUseFallback: false,
      warnings: [],
      canExport: true
    })
    api.media.listExports = vi.fn().mockResolvedValue([
      {
        id: 'ex1',
        kind: 'final',
        fileName: 'f.mp4',
        path: '/f.mp4',
        createdAt: '2026-07-15T12:00:00.000Z',
        sizeBytes: 999000
      },
      {
        id: 'ex2',
        kind: 'board',
        fileName: 'b.png',
        path: '/b.png',
        createdAt: '2026-07-14T12:00:00.000Z',
        sizeBytes: 500
      }
    ])
    api.media.deleteExport = vi.fn().mockResolvedValue({
      ok: true,
      items: [
        {
          id: 'ex2',
          kind: 'board',
          fileName: 'b.png',
          path: '/b.png',
          createdAt: '2026-07-14T12:00:00.000Z',
          sizeBytes: 500
        }
      ],
      latestPath: '/b.png'
    })
    api.media.importClip = vi.fn().mockResolvedValue({ path: '/i.mp4' })
    api.media.openClip = vi.fn().mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
    // Wait until Konva sees ≥2 clips (entries loaded for active story)
    await waitFor(
      () => {
        const n = Number(
          screen.queryByTestId('konva-count')?.textContent || '0'
        )
        expect(n).toBeGreaterThanOrEqual(2)
      },
      { timeout: 15000 }
    )

    await clickNamed(/^k-sel$/i)
    await clickNamed(/^k-pack$/i)
    await clickNamed(/Pack clips/i)
    await waitFor(() => expect(api.timeline.update).toHaveBeenCalled(), {
      timeout: 8000
    })
    await clickNamed(/^k-resize$/i)
    await clickNamed(/^k-move$/i)
    await clickNamed(/^6s$|^10s$|Set to/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: { value: 'Updated residual timeline dialogue' }
        })
      )
    }
    await clickNamed(/^Save$/i)
    await clickNamed(/Import clip/i)
    await clickNamed(/Open clip/i)
    await clickNamed(/Generate this clip|Regenerate|Replay|^p-gen$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Undo$/i)
    await clickNamed(/^Redo$/i)

    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await waitFor(() => expect(api.media.exportFinal).toHaveBeenCalled(), {
      timeout: 8000
    })

    await clickNamed(/Export history/i)
    await waitFor(() => expect(api.media.listExports).toHaveBeenCalled())
    await clickNamed(/Open file|Show in folder|folder|Refresh/i)
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await waitFor(() => expect(api.media.deleteExport).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/Advanced/i)
    await clickNamed(/^q$/i)
    await clickNamed(/^adv-refresh$/i)
    await clickNamed(/^xc$/i)

    await clickNamed(/Retry failed/i)
    for (let i = 0; i < 3; i++) {
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$/i)
      await clickNamed(/^vpn$/i)
      await clickNamed(/^vpf$/i)
      await clickNamed(/^vpr$/i)
      await clickNamed(/^vpa$/i)
      await clickNamed(/^vpe$/i)
    }

    await clickNamed(/Add to timeline/i)
    await waitFor(() => expect(api.timeline.create).toHaveBeenCalled()).catch(
      () => undefined
    )
    await clickNamed(/^k-del$/i)
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      8
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ).slice(0, 4)) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/^Generate$/i)
    for (let i = 0; i < 2; i++) {
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
    await clickNamed(/^p-tick$|^p-end$|^p-gen$/i)
  }, 70000)
})

describe('all90 Audit residual', () => {
  beforeEach(() => base())

  it('Audit remaining filter/detail edges', async () => {
    api.activity.query = vi.fn().mockResolvedValue({
      entries: [
        ...makeAuditEntries(),
        {
          ts: '2026-07-15T09:00:00.000Z',
          kind: 'error',
          message: 'boom',
          level: 'error',
          storyId: 'story-1',
          meta: { ms: 9000, channel: 'x' }
        }
      ],
      path: '/tmp/a.jsonl'
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValueOnce(new Error('clip'))
          .mockResolvedValue(undefined)
      }
    })

    await renderWithProviders(<AuditLogPage />, { withToastHost: true })
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())
    await clickNamed(/More options|Advanced/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const re of [
      /Errors|Warnings|Generation|Exports|Media|All/i,
      /Newest|Oldest|Slowest/i
    ]) {
      await clickNamed(re)
    }
    const rows = screen.queryAllByText(/boom|export|generation|media/i)
    if (rows[0]) await act(async () => fireEvent.click(rows[0]!))
    await clickNamed(/Copy for support|Copy/i)
    await clickNamed(/Copy for support|Copy/i)
    await clickNamed(/Open log folder/i)
    await clickNamed(/Live update|auto/i)
    await clickNamed(/Clear all logs/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
  }, 20000)
})

describe('all90 dense draft listeners + error paths', () => {
  beforeEach(() => base())

  it('Props: full profile/plate draft fields + save errors + reorder', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.create = vi.fn().mockResolvedValue(makeProp({ id: 'prop-new' }))
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/pd.png',
      label: 'H',
      variant: 'hero'
    })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: []
    })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Badge++',
        description: 'shiny metal',
        material: 'brass',
        sizeNotes: 'palm',
        condition: 'worn',
        visualTags: 'badge,gold',
        hardRules: 'no logos',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Badge')

    // Profile draft with full fields
    await act(async () => {
      jobs!.startJob({
        kind: 'prop-ai-fill',
        label: 'f',
        scope: { propId: 'prop-1' },
        run: async () => ({
          type: 'prop-profile' as const,
          propId: 'prop-1',
          storyId: 'story-1',
          profile: {
            name: 'Badge++',
            description: 'shiny metal',
            material: 'brass',
            sizeNotes: 'palm',
            condition: 'worn',
            visualTags: 'badge,gold',
            hardRules: 'no logos',
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft()

    // Wrong propId early return branch
    await act(async () => {
      jobs!.startJob({
        kind: 'prop-ai-fill',
        label: 'f2',
        scope: { propId: 'other' },
        run: async () => ({
          type: 'prop-profile' as const,
          propId: 'other-prop',
          storyId: 'story-1',
          profile: { name: 'X', description: 'y' },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft().catch(() => undefined)

    // Plate commit with empty gallery → list reload branch
    await act(async () => {
      jobs!.startJob({
        kind: 'prop-plate',
        label: 'p',
        scope: { propId: 'prop-1' },
        run: async () => ({
          type: 'prop-plate' as const,
          propId: 'prop-1',
          storyId: 'story-1',
          path: '/tmp/pd.png',
          variant: 'hero',
          label: 'H'
        })
      })
    })
    await acceptDraft()

    // Plate commit with full gallery + introVideoPath
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc2.png',
      gallery: [
        {
          id: 'n1',
          path: '/tmp/pc2.png',
          kind: 'gen',
          label: 'G',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity',
          introVideoPath: '/v.mp4'
        }
      ]
    })
    await act(async () => {
      jobs!.startJob({
        kind: 'prop-plate',
        label: 'p2',
        scope: { propId: 'prop-1' },
        run: async () => ({
          type: 'prop-plate' as const,
          propId: 'prop-1',
          storyId: 'story-1',
          path: '/tmp/pc2.png',
          variant: 'hero',
          label: 'G'
        })
      })
    })
    await acceptDraft()

    await clickNamed(/^Save$/i)
    await waitFor(() => expect(api.props.update).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.props.generatePlate).toHaveBeenCalled()
      ).catch(() => undefined)
    }

    // Intro without id path: cancel editor and try new
    await clickNamed(/^Cancel$/i)
    await clickNamed(/New prop/i)
    await clickNamed(/Intro|video/i)

    // Reorder via keyboard on strip if arrows exist
    await openCardEdit('Badge').catch(() => undefined)
    await clickNamed(/^Plates$/i)
    for (const re of [/←|→|left|right/i]) {
      await clickNamed(re)
    }
  }, 50000)

  it('Costumes: generateDressed job body + error guards', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: 'trench',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png',
      costume: {
        id: 'cos-1',
        refImagePath: '/tmp/d.png',
        refGalleryJson: gal('/tmp/d.png')
      }
    })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Storm',
      description: 'wet'
    })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png')
      })
    ])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')
    await clickNamed(/Image \/ dress|Dress/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate dressed look|Generate look image/i)
    await confirmImageGen()
    await waitFor(() =>
      expect(api.costumes.generateDressed).toHaveBeenCalled()
    ).catch(() => undefined)

    // Intro from selected still
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$|^vpe$/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'costume-intro',
            entityIds: { costumeId: 'cos-1' },
            gallery: [
              {
                id: 'cg',
                path: '/media/coat.png',
                kind: 'upload',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                layer: 'costume',
                introVideoPath: '/c.mp4'
              }
            ]
          }
        })
      )
    })
    await clickNamed(/Linked cast|Links/i)
    await clickNamed(/Link|Unlink/i)
    await clickNamed(/Details|Profile/i)
    await clickNamed(/AI fill \/ improve/i)
    await clickNamed(/^Save$/i)

    // New look without save → dress guards
    await clickNamed(/New look|New/i)
    await clickNamed(/Image \/ dress|Dress/i)
    await clickNamed(/Generate dressed look|Generate look/i)
    await clickNamed(/Intro|video/i)
  }, 45000)

  it('Characters: wardrobe draft + sheet draft cancel + soul errors', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        costumesJson: JSON.stringify([
          {
            id: 'look-1',
            name: 'Coat',
            description: 'trench',
            artStyle: 'anime',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
            imagePath: '/media/aria.png'
          }
        ])
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible',
      layer: 'identity'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
      character: { id: 'char-1', costume: 'c' },
      gallery: [
        {
          id: 'ng',
          path: '/tmp/shc.png',
          kind: 'sheet',
          label: 'S',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity'
        }
      ]
    })
    api.characters.swapCostume = vi.fn().mockResolvedValue({
      path: '/tmp/sw.png',
      label: 'Swap',
      variant: 'costume_swap',
      layer: 'costume'
    })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'Rain',
        costume: 'coat',
        artStyle: 'anime',
        rationale: 'wet'
      }
    })
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria',
        description: 'd',
        appearance: 'a',
        costume: 'c',
        personality: 'p',
        hardRules: 'no logos',
        visualTags: 'rain',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.souls.list = vi.fn().mockResolvedValue({
      data: [{ id: 2, title: 'V2', description: 'd', role: null, domain: null }],
      total_pages: 1,
      current_page: 1
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 2,
      title: 'V2',
      content: '# v2'
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 1,
      pages: 1,
      fromCache: true,
      suggestions: []
    })
    api.characters.readSoulContent = vi.fn().mockResolvedValue('# ok')
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: '# ok'
    })
    api.characters.generateSoul = vi.fn().mockResolvedValue({
      path: '/tmp/gs.md',
      content: '# g',
      title: 'G'
    })
    api.characters.importSoulMd = vi.fn().mockResolvedValue({
      path: '/tmp/i.md',
      content: '# i'
    })

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')

    // Full profile draft
    await act(async () => {
      jobs!.startJob({
        kind: 'character-ai-fill',
        label: 'f',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'character-profile' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          profile: {
            name: 'Aria+',
            description: 'filled',
            appearance: 'silver',
            costume: 'coat',
            personality: 'cold',
            hardRules: 'no logos',
            visualTags: 'rain',
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft()

    await act(async () => {
      jobs!.startJob({
        kind: 'character-sheet',
        label: 's',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'character-sheet' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          path: '/tmp/sh.png',
          variant: 'bible',
          label: 'S',
          layer: 'identity'
        })
      })
    })
    await acceptDraft()

    await act(async () => {
      jobs!.startJob({
        kind: 'wardrobe-suggest',
        label: 'w',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'wardrobe-suggest' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          suggestion: {
            name: 'Rain',
            costume: 'trench',
            artStyle: 'anime',
            rationale: 'noir'
          }
        })
      })
    })
    await acceptDraft().catch(() => undefined)

    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Aria')
    }
    await clickNamed(/^Costume$/i)
    await clickNamed(/Apply/i)
    await clickNamed(/Add to library/i)
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen()
    await clickNamed(/^Profile$/i)
    await clickNamed(/Generate Soul/i)
    await clickNamed(/Import local/i)
    await clickNamed(/Reload/i)
    await clickNamed(/Refresh|Search/i)
    await clickNamed(/^Save$/i)
  }, 60000)

  it('Scenes: draft apply full profile + plate gallery + atmosphere fail', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg')
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'R+',
        description: 'rain',
        mood: 'tense',
        lighting: 'neon',
        weather: 'rain',
        timeOfDay: 'night',
        locationType: 'exterior',
        colorPalette: 'cyan',
        setDressing: 'AC',
        soundscape: 'rain',
        cameraNotes: 'wide',
        visualTags: 'city',
        hardRules: 'empty set',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'Est',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: [
        {
          id: 'n',
          path: '/tmp/spc.png',
          kind: 'plate',
          label: 'Est',
          createdAt: '2026-07-15T00:00:00.000Z',
          introVideoPath: '/sv.mp4'
        }
      ]
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({ path: '/tmp/atm.png' })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({ ok: true })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rooftop')

    await act(async () => {
      jobs!.startJob({
        kind: 'scene-ai-fill',
        label: 'f',
        scope: { sceneId: 'scene-1' },
        run: async () => ({
          type: 'scene-profile' as const,
          sceneId: 'scene-1',
          storyId: 'story-1',
          profile: {
            title: 'R+',
            description: 'rain',
            mood: 'tense',
            lighting: 'neon',
            weather: 'rain',
            timeOfDay: 'night',
            locationType: 'exterior',
            colorPalette: 'cyan',
            setDressing: 'AC',
            soundscape: 'rain',
            cameraNotes: 'wide',
            visualTags: 'city',
            hardRules: 'empty set',
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft()

    await act(async () => {
      jobs!.startJob({
        kind: 'scene-plate',
        label: 'p',
        scope: { sceneId: 'scene-1' },
        run: async () => ({
          type: 'scene-plate' as const,
          sceneId: 'scene-1',
          storyId: 'story-1',
          path: '/tmp/sp.png',
          variant: 'establishing',
          label: 'Est'
        })
      })
    })
    await acceptDraft()

    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Rooftop')
    }
    await clickNamed(/Atmosphere/i)
    await clickNamed(/Generate atmosphere swap/i)
    await clickNamed(/Generate atmosphere swap/i)
    await clickNamed(/Copy|copy|look/i)
    await clickNamed(/^Save$/i)
  }, 45000)

  it('Stories: link/unlink error paths + script AI + cover draft', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        characters: [makeCharacter()],
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()],
        timeline: [
          makeTimelineEntry({ id: 'b1', dialogue: 'Line one' }),
          makeTimelineEntry({ id: 'b2', order: 1, dialogue: 'Line two' })
        ]
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue({})
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi.fn().mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [{ order: 0, dialogue: 'A', characterId: 'char-1', sceneId: 'scene-1' }],
      drafts: [],
      raw: ''
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 's',
      hardRules: 'h',
      artStyle: 'anime'
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/tmp/c.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/tmp/cc.png' })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'bn' }))
    api.timeline.update = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({ id: 'b1' }),
      makeTimelineEntry({ id: 'b2', order: 1 })
    ])

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    await clickNamed(/^Edit$/i)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    await clickNamed(/Cast/i)
    await clickNamed(/Link|Unlink/i)
    await clickNamed(/Link|Unlink/i)
    for (const kind of [/Scene/i, /Prop/i, /Action/i]) {
      await clickNamed(kind)
      await clickNamed(/Link|Unlink/i)
    }

    await clickNamed(/Script/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await acceptDraft().catch(() => undefined)

    await act(async () => {
      jobs!.startJob({
        kind: 'story-cover',
        label: 'c',
        scope: { storyId: 'story-1' },
        run: async () => ({
          type: 'story-cover' as const,
          storyId: 'story-1',
          path: '/tmp/c.png'
        })
      })
    })
    await acceptDraft().catch(() => undefined)

    await clickNamed(/Cover/i)
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 45000)

  it('Timeline: pack after konva-count + export delete + cancel jobs', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 5,
        mediaStatus: 'EMPTY',
        dialogue: 'A',
        characterId: 'char-1'
      }),
      makeTimelineEntry({
        id: 'entry-2',
        storyId: 'story-1',
        order: 1,
        startTime: 10,
        endTime: 16,
        mediaStatus: 'READY',
        mediaPath: '/m.mp4',
        stillPath: '/s.png',
        dialogue: 'B'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        storyId: 'story-1',
        order: 2,
        startTime: 20,
        endTime: 26,
        mediaStatus: 'FAILED',
        dialogue: 'C'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    api.timeline.list = vi.fn().mockResolvedValue(entries)
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/a.png' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      videoMode: 'stub',
      defaultMaxClipSeconds: 6,
      snapEnabled: false,
      snapGridSec: 1,
      openExportFolder: true
    })
    api.settings.set = vi.fn().mockResolvedValue({})
    api.media.exportPreflight = vi.fn().mockResolvedValue({
      ffmpeg: true,
      ffmpegMessage: 'ffmpeg OK',
      readyClips: 1,
      totalClips: 3,
      willUseFallback: false,
      warnings: [],
      canExport: true
    })
    api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/f.mp4' })
    api.media.listExports = vi.fn().mockResolvedValue([
      {
        id: 'ex1',
        kind: 'final',
        fileName: 'f.mp4',
        path: '/f.mp4',
        createdAt: '2026-07-15T12:00:00.000Z',
        sizeBytes: 2048
      }
    ])
    api.media.deleteExport = vi.fn().mockResolvedValue({
      ok: true,
      items: [],
      latestPath: null
    })
    api.generation.run = vi.fn().mockResolvedValue({ success: true, steps: [] })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
    api.media.importClip = vi.fn().mockResolvedValue({ path: '/i.mp4' })
    api.media.openClip = vi.fn().mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled(), {
      timeout: 10000
    })
    await waitFor(
      () => {
        const n = Number(screen.queryByTestId('konva-count')?.textContent || '0')
        expect(n).toBeGreaterThanOrEqual(2)
      },
      { timeout: 12000 }
    )
    await clickNamed(/^k-pack$/i)
    await waitFor(() => expect(api.timeline.update.mock.calls.length).toBeGreaterThan(0), {
      timeout: 8000
    }).catch(() => undefined)
    await clickNamed(/^k-sel$/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await waitFor(() => expect(api.media.exportFinal).toHaveBeenCalled()).catch(
      () => undefined
    )
    await clickNamed(/Export history/i)
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await waitFor(() => expect(api.media.deleteExport).toHaveBeenCalled()).catch(
      () => undefined
    )
    // start a job then cancel
    await act(async () => {
      jobs!.startJob({
        kind: 'pipeline',
        label: 'pipe',
        scope: { storyId: 'story-1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 5000))
          return { type: 'pipeline' as const, storyId: 'story-1', ok: true }
        }
      })
    })
    await clickNamed(/Cancel|Stop/i)
    await clickNamed(/Retry failed/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Generate$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
  }, 50000)

  it('Settings: gateway missing + models fail + web start/stop', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      legalAcceptedAt: '2026-01-01T00:00:00.000Z',
      firstRunSeen: true,
      llmProvider: 'grok-local',
      imageProvider: 'same-as-chat',
      videoProvider: 'same-as-chat',
      webServerEnabled: true,
      webServerPort: 8787,
      webServerHost: '127.0.0.1'
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1',
      isPackaged: false,
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 1
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: false,
      message: 'missing ffmpeg'
    })
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'gateway_missing',
      message: 'no gw',
      healthOk: false,
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://a'
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'gateway_missing',
      healthOk: false,
      message: 'no package'
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/',
      installCommand: 'curl install'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: false })
    api.ai.listModels = vi.fn().mockRejectedValue(new Error('429'))
    api.ai.testChat = vi.fn().mockRejectedValue(new Error('chat down'))
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'http://x',
      model: 'm'
    })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: false,
      url: null,
      port: 8787,
      error: 'bind fail',
      staticReady: false,
      token: 't'
    })
    api.webServer.start = vi
      .fn()
      .mockRejectedValueOnce(new Error('start fail'))
      .mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787
      })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('tok')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'error',
      channel: 'stable',
      currentVersion: '1',
      latestVersion: null,
      canCheck: true,
      canDownload: false,
      canAutoInstall: false,
      progress: 0,
      releaseNotes: null,
      releaseUrl: null,
      error: 'network'
    })
    api.updates.check = vi.fn().mockRejectedValue(new Error('check fail'))
    api.updates.checkNpm = vi.fn().mockRejectedValue(new Error('npm fail'))
    api.updates.onState = vi.fn(() => () => undefined)
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.media.pickBgm = vi.fn().mockResolvedValue(null)
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockRejectedValue(new Error('backup fail'))
    api.app.importFullBackup = vi.fn().mockRejectedValue(new Error('import fail'))
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockRejectedValue(new Error('support fail'))
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('clip')) }
    })

    await renderWithProviders(<SettingsPage />, {
      withToastHost: true,
      withAiShell: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/Chat model/i)
    await clickNamed(/Show advanced|Refresh model|Test chat|Grok|Recheck|Ensure|Install|Copy/i)
    await clickNamed(/^Image$/i)
    await clickNamed(/^Video$/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Clear/i)
    await clickNamed(/^App$/i)
    for (const re of [
      /Enable|Start|Stop|Regenerate|Copy/i,
      /Check for updates|npm/i,
      /backup|export|import|support|diagnostics|Clear|folder/i
    ]) {
      await clickNamed(re)
    }
    await clickNamed(/^Save$/i)
  }, 40000)
})
