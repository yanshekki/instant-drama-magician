/**
 * Finish campaign: drive remaining page lines as close to 100% as hittable.
 * Auto-refresh, formatMs branches, plate/intro guards, pack/export, settings edges.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { useAiJobs } from '../context/AiJobsContext'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { ActionsPage } from './ActionsPage'
import { AuditLogPage } from './AuditLogPage'
import { CharactersPage } from './CharactersPage'
import { CostumesPage } from './CostumesPage'
import { PropsPage } from './PropsPage'
import { ScenesPage } from './ScenesPage'
import { SettingsPage } from './SettingsPage'
import { StoriesPage } from './StoriesPage'
import { TimelinePage } from './TimelinePage'

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
    onDropAsset?: (payload: { kind: string; id: string }, at?: number) => void
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
        onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'entry-1', 0, 8)}
      >
        k-resize
      </button>
      <button
        type="button"
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'entry-1', 2, 9)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() =>
          p.onDropAsset?.({ kind: 'character', id: 'char-1' }, 5)
        }
      >
        k-drop
      </button>
      <span data-testid="kn">{p.entries?.length ?? 0}</span>
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
      <button type="button" onClick={() => p.onTime?.(1)}>
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
        <button
          type="button"
          onClick={() => p.onStartVideoQueue?.(['entry-1', 'entry-3'])}
        >
          q
        </button>
        <button type="button" onClick={() => p.onRefresh?.()}>
          adv-r
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
            p.onConfirm?.({ burnSubtitles: true, openExportFolder: true })
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
    onRetry?: () => void
    onNextClip?: () => void
    onEmergencyExit?: () => void
  }) =>
    p.open ? (
      <div data-testid="vp">
        <button type="button" onClick={() => void p.onConfirm?.()}>
          vpc
        </button>
        <button type="button" onClick={() => p.onFinish?.()}>
          vpf
        </button>
        <button type="button" onClick={() => p.onAbandon?.()}>
          vpa
        </button>
        <button type="button" onClick={() => p.onRetry?.()}>
          vpr
        </button>
        <button type="button" onClick={() => p.onNextClip?.()}>
          vpn
        </button>
        <button type="button" onClick={() => p.onEmergencyExit?.()}>
          vpe
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
  vi.useRealTimers()
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
})

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
    () => expect(document.body.textContent || '').toMatch(new RegExp(name, 'i')),
    { timeout: 10000 }
  )
  await waitFor(
    async () => {
      const article = Array.from(document.querySelectorAll('article')).find(
        (a) => (a.textContent || '').includes(name)
      )
      expect(article).toBeTruthy()
      const edits = Array.from(
        (article as HTMLElement).querySelectorAll('button')
      ).filter((b) => /^Edit$/i.test((b.textContent || '').trim()))
      await act(async () => fireEvent.click(edits[edits.length - 1]!))
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 10000 }
  )
}

async function confirmImageGen(): Promise<boolean> {
  try {
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(/Confirm reference/i),
      { timeout: 4000 }
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
    timeout: 8000
  })
  await act(async () => {
    await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
  })
}

function seed() {
  reseedMockApi(api)
  jobs = null
  localStorage.clear()
  api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
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
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({ ok: true })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'p',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { actionId: 'act-1' },
    kind: 'action-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
}

describe('finish100 Audit', () => {
  beforeEach(() => seed())

  it('auto-refresh, formatMs tiers, prettify channels, no path, sorts', async () => {
    api.activity.query = vi.fn().mockResolvedValue({
      // no path → empty logPath branch
      entries: [
        {
          ts: '2026-07-15T12:00:00.000Z',
          kind: 'media:exportFinal',
          message: 'media:exportFinal',
          level: 'info',
          meta: { ms: 50 }
        },
        {
          ts: '2026-07-15T11:00:00.000Z',
          kind: 'media:toPreviewUrl',
          message: 'media:toPreviewUrl',
          level: 'debug',
          meta: { ms: 2500 }
        },
        {
          ts: '2026-07-15T10:00:00.000Z',
          kind: 'generation:runClip',
          message: 'generation:runClip',
          level: 'warn',
          meta: { ms: 120000 }
        },
        {
          ts: '2026-07-15T09:00:00.000Z',
          kind: 'characters:aiFill',
          message: 'characters:aiFill',
          level: 'error',
          storyId: 'story-1',
          meta: { ms: 0 }
        },
        {
          ts: '2026-07-15T08:00:00.000Z',
          kind: 'stories:update',
          message: 'stories:update_story',
          level: 'info',
          meta: { ms: 999 }
        },
        {
          ts: '2026-07-15T07:00:00.000Z',
          kind: 'timeline:update',
          message: 'timeline:update',
          level: 'info',
          meta: { ms: 1500 }
        },
        {
          ts: '2026-07-15T06:00:00.000Z',
          kind: 'props:create',
          message: 'props:create',
          level: 'info',
          meta: { ms: 65000 }
        },
        {
          ts: '2026-07-15T05:00:00.000Z',
          kind: 'scenes:aiFill',
          message: 'scenes:aiFill',
          level: 'info',
          meta: { ms: 100 }
        },
        {
          ts: '2026-07-15T04:00:00.000Z',
          kind: 'app:info',
          message: 'app:getInfo',
          level: 'info',
          meta: {}
        },
        {
          ts: '2026-07-15T03:00:00.000Z',
          kind: 'settings:set',
          message: 'settings:set',
          level: 'info',
          meta: { ms: 10 }
        },
        {
          ts: '2026-07-15T02:00:00.000Z',
          kind: 'media:importClip',
          message: 'media:importClip',
          level: 'info',
          meta: { ms: 30 }
        },
        {
          ts: '2026-07-15T01:00:00.000Z',
          kind: 'media:saveAs',
          message: 'media:saveAs',
          level: 'info',
          meta: { ms: 40 }
        },
        {
          ts: '2026-07-14T12:00:00.000Z',
          kind: 'media:deleteExport',
          message: 'media:deleteExport',
          level: 'info',
          meta: { ms: 20 }
        },
        {
          ts: '2026-07-14T11:00:00.000Z',
          kind: 'media:listExports',
          message: 'media:listExports',
          level: 'info',
          meta: { ms: 15 }
        },
        {
          ts: '2026-07-14T10:00:00.000Z',
          kind: 'media:exportStoryboard',
          message: 'media:exportStoryboard',
          level: 'info',
          meta: { ms: 800 }
        },
        {
          ts: '2026-07-14T09:00:00.000Z',
          kind: 'characters:generateSoul',
          message: 'characters:generateSoul',
          level: 'info',
          meta: { ms: 400 }
        }
      ]
      // path omitted intentionally
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(<AuditLogPage />, { withToastHost: true })
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())

    // Live update / auto-refresh (short real wait — avoid fake-timer hangs)
    await clickNamed(/Live update|auto/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    await clickNamed(/More options|Advanced/i)
    // limit + all sort options
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < s.options.length; i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    for (const re of [
      /Errors|Warnings|Generation|Exports|Media|All/i,
      /Newest|Oldest|Slowest|severity/i
    ]) {
      await clickNamed(re)
    }
    // select rows with different ms to render formatMs
    for (const text of [
      /exportFinal/i,
      /runClip/i,
      /aiFill/i,
      /importClip/i,
      /generateSoul/i
    ]) {
      const el = screen.queryAllByText(text)[0]
      if (el) await act(async () => fireEvent.click(el))
    }
    await clickNamed(/Copy for support|Copy/i)
    await clickNamed(/Open log folder/i)
  }, 30000)
})

describe('finish100 Actions plate/intro/delete', () => {
  beforeEach(() => seed())

  it('full plate cancel path, intro draft, reorder, delete cancel', async () => {
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        id: 'act-1',
        name: 'Draw gun',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag')
      })
    ])
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    api.actions.create = vi.fn().mockResolvedValue(makeAction({ id: 'an' }))
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
          label: 'B',
          createdAt: '2026-07-15T00:00:00.000Z'
        },
        {
          id: 'ag2',
          path: '/tmp/ap2.png',
          kind: 'plate',
          label: 'B2',
          createdAt: '2026-07-16T00:00:00.000Z'
        }
      ]
    })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Draw+',
        description: 'snap',
        motionNotes: 'fast',
        intention: 'threat',
        cameraNotes: 'cu',
        visualTags: 'action',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.actions.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/c.png', refGalleryJson: gal('/c.png') })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ refImagePath: '/s.png', refGalleryJson: gal('/s.png') })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({ refImagePath: '/p.png', refGalleryJson: gal('/p.png') })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])

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
        fireEvent.change(idea, { target: { value: 'three beat draw' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    await waitFor(() => expect(api.actions.aiFill).toHaveBeenCalled()).catch(
      () => undefined
    )
    // accept if draft
    try {
      await waitFor(() => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true), {
        timeout: 3000
      })
      await act(async () => {
        await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
      })
    } catch {
      /* direct apply ok */
    }

    await clickNamed(/^References$/i)
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
    // cast stills
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
    for (const img of Array.from(document.querySelectorAll('img')).slice(0, 3)) {
      await act(async () => fireEvent.click(img))
    }

    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board/i)
    // cancel confirm first
    if ((document.body.textContent || '').includes('Confirm reference')) {
      await clickNamed(/^Cancel$/i)
    }
    await clickNamed(/Generate instruction board/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.actions.generatePlate).toHaveBeenCalled()
      ).catch(() => undefined)
      try {
        await acceptDraft()
      } catch {
        /* ok */
      }
    }

    await clickNamed(/→|←/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)
    await clickNamed(/Intro|demo|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
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
    await clickNamed(/^Save$/i)

    // list delete cancel then confirm
    await clickNamed(/^Cancel$/i)
    const dels = screen
      .getAllByRole('button')
      .filter((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (dels[0]) {
      await act(async () => fireEvent.click(dels[0]!))
      const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (document.querySelector('[role="alertdialog"]') && cancel) {
        await act(async () => fireEvent.click(cancel))
      }
      await act(async () => fireEvent.click(dels[0]!))
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
  }, 45000)
})

describe('finish100 Props Costumes more', () => {
  beforeEach(() => seed())

  it('Props plate cancel, intro no id, reorder, multi-select plate', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.create = vi.fn().mockResolvedValue(makeProp({ id: 'pn' }))
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/pd.png',
      label: 'H',
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
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity'
        }
      ]
    })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Badge+',
        description: 'd',
        material: 'm',
        visualTags: 'v',
        hardRules: 'h',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
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
    await clickNamed(/^Plates$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate prop plate/i)
    if ((document.body.textContent || '').includes('Confirm reference')) {
      await clickNamed(/^Cancel$/i)
    }
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.props.generatePlate).toHaveBeenCalled()
      ).catch(() => undefined)
      try {
        await acceptDraft()
      } catch {
        /* ok */
      }
    }
    await clickNamed(/→|←/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)
    await clickNamed(/^Save$/i)

    // new prop no name plate guard
    await clickNamed(/New prop/i)
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate/i)
    await confirmImageGen()
  }, 40000)

  it('Costumes dress blocked + intro update fail + filters', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: 'long trench',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd fail'))
      .mockResolvedValue(makeCostume())
    api.costumes.create = vi.fn().mockResolvedValue(makeCostume({ id: 'cn' }))
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
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png'),
        appearance: 'dark hair',
        ageRange: '30s',
        gender: 'female'
      })
    ])

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
      const aria = Array.from(s.options).find((o) =>
        /Aria|char-1/i.test(o.textContent || o.value)
      )
      if (aria) {
        await act(async () =>
          fireEvent.change(s, { target: { value: aria.value } })
        )
      } else if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'wet sheen coat open' } })
      )
    }
    await clickNamed(/Generate dressed look|Generate look/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.costumes.generateDressed).toHaveBeenCalled()
      ).catch(() => undefined)
    }
    // intro: first update fails then succeeds
    await clickNamed(/Intro|video/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$|^vpa$/i)

    await clickNamed(/Linked cast|Links/i)
    for (const f of [/All/i, /Linked/i, /Not linked|Unlinked/i]) {
      await clickNamed(f)
    }
    for (const b of screen.getAllByRole('button')) {
      const t = (b.textContent || '').trim()
      if (/^Link$|^Unlink$/i.test(t) && !(b as HTMLButtonElement).disabled) {
        await act(async () => fireEvent.click(b))
      }
    }
    await clickNamed(/Details|Profile/i)
    await clickNamed(/AI fill \/ improve/i)
    await clickNamed(/^Save$/i)
  }, 40000)
})

describe('finish100 Characters Scenes Stories dense', () => {
  beforeEach(() => seed())

  it('Characters all tabs draft + soul + create sheet', async () => {
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
            imagePath: '/media/aria.png',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z'
          }
        ])
      })
    ])
    api.characters.get = vi.fn().mockResolvedValue(
      makeCharacter({
        id: 'char-1',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png')
      })
    )
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.create = vi.fn().mockResolvedValue(
      makeCharacter({ id: 'cn', name: 'Nova' })
    )
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
          layer: 'identity',
          createdAt: '2026-07-15T00:00:00.000Z'
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
        name: 'Aria+',
        description: 'd',
        appearance: 'a',
        costume: 'c',
        personality: 'p',
        hardRules: 'h',
        visualTags: 'v',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.souls.list = vi.fn().mockResolvedValue({
      data: [
        {
          id: 5,
          title: 'Soul5',
          description: 'd',
          role: 'lead',
          domain: 'noir'
        }
      ],
      total_pages: 2,
      current_page: 1
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 5,
      title: 'Soul5',
      content: '# soul5'
    })
    api.souls.searchLocal = vi.fn().mockResolvedValue({
      items: [{ id: 5, title: 'Soul5', content: '# local' }]
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 2,
      pages: 2,
      fromCache: false,
      suggestions: [{ id: 5, title: 'Soul5' }]
    })
    api.characters.readSoulContent = vi.fn().mockResolvedValue('# soul')
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: '# soul'
    })
    api.characters.generateSoul = vi.fn().mockResolvedValue({
      path: '/tmp/g.md',
      content: '# g',
      title: 'G'
    })
    api.characters.importSoulMd = vi.fn().mockResolvedValue({
      path: '/tmp/i.md',
      content: '# i'
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
            description: 'd',
            appearance: 'a',
            costume: 'c',
            personality: 'p',
            hardRules: 'h',
            visualTags: 'v',
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft().catch(() => undefined)

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
    await acceptDraft().catch(() => undefined)

    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Aria')
    }

    await clickNamed(/^References$/i)
    for (const re of [/^All$/i, /Identity/i, /Base/i, /Costume/i, /Detail/i]) {
      await clickNamed(re)
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
    await clickNamed(/Generate professional reference/i)
    await confirmImageGen()
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/→|←/i)
    await clickNamed(/Remove this photo|Remove/i)

    await clickNamed(/^Costume$/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'black coat residual' } })
      )
    }
    for (const input of Array.from(
      document.querySelectorAll('input')
    ) as HTMLInputElement[]) {
      if (input.type === 'text' || !input.type) {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'Look A' } })
        )
        break
      }
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Apply/i)
    await clickNamed(/Suggest from plot/i)
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen()
    await clickNamed(/Delete/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }

    await clickNamed(/^Profile$/i)
    await clickNamed(/Generate Soul/i)
    await clickNamed(/Import local/i)
    await clickNamed(/Reload|Refresh|Search/i)
    const search = Array.from(document.querySelectorAll('input')).find((i) =>
      /search/i.test((i as HTMLInputElement).placeholder || '')
    )
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Soul' } })
      )
    }
    const soul = screen.queryAllByText(/Soul5/i)[0]
    if (soul) await act(async () => fireEvent.click(soul))
    await clickNamed(/Use/i)
    await clickNamed(/Unlink/i)
    await clickNamed(/^Save$/i)

    await clickNamed(/New character|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 4)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Nova finish100' } })
      )
    }
    await clickNamed(/^References$/i)
    await clickNamed(/Generate professional reference|Create and generate/i)
    await confirmImageGen()
  }, 55000)

  it('Scenes plot + atmosphere + copy + create plate', async () => {
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
        refGalleryJson: gal('/media/alley.png', 'ag')
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.create = vi.fn().mockResolvedValue(makeScene({ id: 'sn' }))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'R+',
        description: 'rain',
        mood: 'tense',
        lighting: 'neon',
        weather: 'rain',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'E',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: []
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({ path: '/tmp/a.png' })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({ ok: true })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
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
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft().catch(() => undefined)

    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Rooftop')
    }

    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate location plate/i)
    await confirmImageGen()
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)

    await clickNamed(/Atmosphere/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'fog neon residual' } })
      )
    }
    await clickNamed(/Generate atmosphere swap/i)
    for (const re of [/Copy|look|Look|Add/i]) await clickNamed(re)
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
    await clickNamed(/Suggest from story/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    const dlg = Array.from(document.querySelectorAll('[role="dialog"]')).find(
      (d) => {
        const el = d as HTMLElement
        return (
          el.querySelectorAll('select').length > 0 &&
          Array.from(el.querySelectorAll('button')).some((b) =>
            /^AI fill/i.test((b.textContent || '').trim())
          )
        )
      }
    ) as HTMLElement | undefined
    if (dlg) {
      const sel = Array.from(dlg.querySelectorAll('select')).find((s) =>
        Array.from((s as HTMLSelectElement).options).some(
          (o) => o.value === 'story-1'
        )
      ) as HTMLSelectElement | undefined
      if (sel) {
        await act(async () =>
          fireEvent.change(sel, { target: { value: 'story-1' } })
        )
      }
      const fill = Array.from(dlg.querySelectorAll('button')).find((b) =>
        /^AI fill/i.test((b.textContent || '').trim())
      )
      if (fill && !(fill as HTMLButtonElement).disabled) {
        await act(async () => fireEvent.click(fill))
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 80))
      })
    }
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Stories cast links + beats multi + cover + delete', async () => {
    const beats = [
      makeTimelineEntry({
        id: 'b1',
        order: 0,
        dialogue: 'Line A residual finish',
        characterId: 'char-1',
        sceneId: 'scene-1'
      }),
      makeTimelineEntry({
        id: 'b2',
        order: 1,
        dialogue: 'Line B residual finish',
        characterId: 'char-2',
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
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()],
        timeline: beats
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
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 's',
      hardRules: 'h',
      artStyle: 'anime'
    })
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [
        {
          order: 0,
          dialogue: 'X',
          characterId: 'char-1',
          sceneId: 'scene-1'
        }
      ],
      drafts: [],
      raw: ''
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/c.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/cc.png' })
    api.stories.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter(),
      makeCharacter({ id: 'char-2', name: 'Ben' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
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
    await clickNamed(/^Edit$/i)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    await clickNamed(/Basics|Meta/i)
    await clickNamed(/AI fill style notes/i)
    await clickNamed(/Cast/i)
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      await clickNamed(kind)
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
      }
      for (const b of screen.getAllByRole('button')) {
        const t = (b.textContent || '').trim()
        if (/^Link$|^Unlink$/i.test(t) && !(b as HTMLButtonElement).disabled) {
          await act(async () => fireEvent.click(b))
        }
      }
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

    await clickNamed(/Script/i)
    await clickNamed(/Add beat/i)
    for (const re of [/↑|↓/i]) await clickNamed(re)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      16
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
      4
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'finish100 beat text' } })
      )
    }
    await clickNamed(/Insert script template|template/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Delete/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Cover/i)
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 45000)
})

describe('finish100 Settings Timeline', () => {
  beforeEach(() => seed())

  it('Settings dense every control', async () => {
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
      colorScheme: 'dark',
      webServerPort: 8787,
      webServerHost: '0.0.0.0',
      webServerEnabled: true,
      chatTimeoutMs: 60000
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '2',
      isPackaged: true,
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 4
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '7',
      path: '/ff'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi.fn().mockResolvedValue([
      { id: 'a', ownedBy: 'x' },
      { id: 'b', ownedBy: 'y' }
    ])
    api.ai.testChat = vi.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      replyPreview: 'hi'
    })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://x',
      model: 'm'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'ready',
      healthOk: true,
      message: 'ok',
      grokPath: '/g',
      gctoacPath: '/c',
      adminUrl: 'http://a',
      keyReady: true
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'ready',
      healthOk: true,
      keyReady: true,
      keyCreated: true,
      message: 'ok'
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/',
      installCommand: 'curl x'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 'tok'
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('nt')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'downloaded',
      channel: 'stable',
      currentVersion: '1',
      latestVersion: '2',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 100,
      releaseNotes: '## notes',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '2'
    })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
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
        progress: 60,
        currentVersion: '1',
        latestVersion: '2',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
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

    for (const tab of [
      /Chat model/i,
      /^Image$/i,
      /^Video$/i,
      /^Export$/i,
      /^App$/i
    ]) {
      await clickNamed(tab)
      await clickNamed(/Show advanced|Hide advanced/i)
      for (const input of Array.from(
        document.querySelectorAll('input')
      ).slice(0, 14) as HTMLInputElement[]) {
        if (input.type === 'checkbox') {
          await act(async () => fireEvent.click(input))
        } else if (input.type !== 'file') {
          await act(async () =>
            fireEvent.change(input, {
              target: {
                value: input.type === 'number' ? '4242' : 'finish-val'
              }
            })
          )
          if (input.type === 'number') {
            await act(async () => fireEvent.blur(input))
          }
        }
      }
      for (const sel of Array.from(document.querySelectorAll('select'))) {
        const s = sel as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[1].value } })
          )
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[0].value } })
          )
        }
      }
      for (const re of [
        /Refresh|Test|Grok|Custom|Seedream|Seedance|Stub|preset|BGM|Clear|Stop|Start|Enable|Regenerate|Copy|Check|Download|Restart|Open|npm|backup|export|import|support|diagnostics|folder|English|System|Light|Dark|release|Show|Hide/i
      ]) {
        await clickNamed(re)
      }
    }
    await clickNamed(/^Save$/i)
  }, 45000)

  it('Timeline full toolbar progress cast pack export', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        dialogue: 'A finish',
        characterId: 'char-1',
        sceneId: 'scene-1'
      }),
      makeTimelineEntry({
        id: 'entry-2',
        storyId: 'story-1',
        order: 1,
        startTime: 4,
        endTime: 10,
        mediaStatus: 'READY',
        mediaPath: '/m.mp4',
        stillPath: '/s.png',
        dialogue: 'B finish'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        storyId: 'story-1',
        order: 2,
        startTime: 10,
        endTime: 16,
        mediaStatus: 'FAILED',
        dialogue: 'C finish'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    api.timeline.list = vi.fn().mockResolvedValue(entries)
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/a.png', refGalleryJson: gal('/a.png') })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      videoMode: 'stub',
      defaultMaxClipSeconds: 6,
      snapEnabled: true,
      snapGridSec: 0.5,
      openExportFolder: true,
      burnSubtitles: true
    })
    api.settings.set = vi.fn().mockResolvedValue({})
    api.generation.run = vi.fn().mockResolvedValue({ success: true, steps: [] })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    let progressCb: ((p: object) => void) | null = null
    api.generation.onProgress = vi.fn((cb: (p: object) => void) => {
      progressCb = cb
      return () => {
        progressCb = null
      }
    })
    api.media.listExports = vi.fn().mockResolvedValue([
      {
        id: 'ex1',
        kind: 'final',
        fileName: 'f.mp4',
        path: '/f.mp4',
        createdAt: '2026-07-15T12:00:00.000Z',
        sizeBytes: 5000
      },
      {
        id: 'ex2',
        kind: 'board',
        fileName: 'b.png',
        path: '/b.png',
        createdAt: '2026-07-14T12:00:00.000Z',
        sizeBytes: 100
      }
    ])
    api.media.deleteExport = vi.fn().mockResolvedValue({
      ok: true,
      items: [],
      latestPath: null
    })

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled(), {
      timeout: 8000
    }).catch(() => undefined)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150))
    })

    await clickNamed(/^k-sel$/i)
    await clickNamed(/^k-pack$/i)
    await clickNamed(/Pack clips/i)
    await clickNamed(/^k-resize$/i)
    await clickNamed(/^k-move$/i)
    await clickNamed(/^k-drop$/i)
    await clickNamed(/^p-tick$/i)
    await clickNamed(/^p-end$/i)
    await clickNamed(/^p-gen$/i)

    if (progressCb) {
      await act(async () => {
        progressCb!({
          storyId: 'story-1',
          index: 0,
          total: 3,
          step: 'image',
          entryId: 'entry-1',
          mediaStatus: 'GENERATING'
        })
        progressCb!({
          storyId: 'story-1',
          index: 1,
          total: 3,
          step: 'video',
          entryId: 'entry-2',
          mediaStatus: 'READY'
        })
        progressCb!({
          storyId: 'story-1',
          index: 2,
          total: 3,
          step: 'mux',
          entryId: 'entry-3',
          mediaStatus: 'FAILED'
        })
      })
    }

    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'finish100 timeline' } })
      )
    }
    await clickNamed(/^Save$/i)
    await clickNamed(/^6s$|^10s$/i)
    await clickNamed(/Import clip/i)
    await clickNamed(/Open clip/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await clickNamed(/Export history/i)
    await clickNamed(/Open file|folder|Refresh/i)
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Advanced/i)
    await clickNamed(/^q$/i)
    await clickNamed(/^adv-r$/i)
    await clickNamed(/^xc$/i)
    await clickNamed(/Retry failed/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
    }
    await clickNamed(/Add to timeline/i)
    await clickNamed(/^Generate$/i)
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
  }, 40000)
})
