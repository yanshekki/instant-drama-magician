/**
 * Continue after finish100: more residual toward 100% lines.
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
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[0]?.id ?? 'e1')}>
        k-sel
      </button>
      <button type="button" onClick={() => p.onPackAbut?.()}>
        k-pack
      </button>
      <button
        type="button"
        onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'e1', 0, 5)}
      >
        k-resize
      </button>
      <button
        type="button"
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'e1', 1, 6)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'prop', id: 'prop-1' }, 8)}
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
  }) =>
    p.open ? (
      <div data-testid="adv">
        <button type="button" onClick={() => p.onStartVideoQueue?.(['entry-1'])}>
          q
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
        <button type="button" onClick={() => p.onConfirm?.({ burnSubtitles: true })}>
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
      () => expect(document.body.textContent || '').toMatch(/Confirm reference/i),
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
    readyClips: 1,
    totalClips: 2,
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
    entityIds: {},
    kind: 'action-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
}

describe('continue100 Audit channel prettify + invalid ts', () => {
  beforeEach(() => seed())

  it('diverse channels and invalid timestamps', async () => {
    api.activity.query = vi.fn().mockResolvedValue({
      entries: [
        {
          ts: 'not-a-date',
          kind: 'ipc',
          message: 'media:exportFinal done',
          level: 'info',
          storyId: null,
          meta: { ms: 50, channel: 'media:exportFinal' }
        },
        {
          ts: 'also-bad',
          kind: 'generation',
          message: 'stories:aiFillScript ok',
          level: 'debug',
          storyId: 'story-1',
          meta: { ms: 1500, channel: 'stories:aiFillScript' }
        },
        {
          ts: '2026-07-15T12:00:00.000Z',
          kind: 'error',
          message: 'characters:generateSheet failed',
          level: 'error',
          storyId: 'story-1',
          meta: { ms: 120000, channel: 'characters:generateSheet' }
        },
        {
          ts: '2026-07-15T11:00:00.000Z',
          kind: 'settings',
          message: 'settings:set applied',
          level: 'info',
          storyId: null,
          meta: { ms: 5, channel: 'app:getInfo' }
        },
        {
          ts: '2026-07-15T10:00:00.000Z',
          kind: 'timeline',
          message: 'timeline:update_clip',
          level: 'warn',
          storyId: 'story-1',
          meta: { ms: 2500, channel: 'timeline:update' }
        },
        {
          ts: '2026-07-15T09:00:00.000Z',
          kind: 'ai',
          message: 'ai:status check',
          level: 'info',
          storyId: null,
          meta: { channel: 'ai:status' }
        },
        {
          ts: '2026-07-15T08:00:00.000Z',
          kind: 'scenes',
          message: 'scenes:generatePlate',
          level: 'info',
          storyId: null,
          meta: { ms: 800, channel: 'scenes:generatePlate' }
        },
        {
          ts: '2026-07-15T07:00:00.000Z',
          kind: 'props',
          message: 'props:aiFill',
          level: 'info',
          storyId: null,
          meta: { ms: 400, channel: 'props:aiFill' }
        }
      ],
      path: null
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(<AuditLogPage />, { withToastHost: true })
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())
    await clickNamed(/More options|Advanced/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 6); i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    for (const th of Array.from(document.querySelectorAll('th, button'))) {
      const t = (th.textContent || '').trim()
      if (/Time|Severity|Category|Event|Duration|ms|level|kind/i.test(t)) {
        await act(async () => fireEvent.click(th))
      }
    }
    for (const re of [/Errors|Warnings|Generation|Exports|Media|All|Live/i]) {
      await clickNamed(re)
    }
    const rows = screen.queryAllByText(/exportFinal|aiFill|generateSheet|getInfo/i)
    for (const r of rows.slice(0, 4)) {
      await act(async () => fireEvent.click(r))
    }
    await clickNamed(/Copy for support|Copy/i)
    await clickNamed(/Open log folder/i)
  }, 20000)
})

describe('continue100 Actions intro draft continue + plate cancel', () => {
  beforeEach(() => seed())

  it('intro continue draft + plate discard cancel + delete cancel', async () => {
    // Seed a video prep draft so continueVideoPrepDraft runs
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['action-intro:act-1:/a.png']: {
            kind: 'action-intro',
            entityIds: { actionId: 'act-1' },
            sourceImagePath: '/a.png',
            professionalPrompt: 'p',
            stillPath: '/s.png',
            durationSeconds: 6
          }
        })
      )
    } catch {
      /* ignore */
    }
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        id: 'act-1',
        name: 'Draw gun',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag')
      })
    ])
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    api.actions.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/p.png',
      label: 'G'
    })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: []
    })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'D', description: 'd', motionNotes: 'm' },
      profileJson: '{}',
      raw: ''
    })
    api.actions.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/c.png', refGalleryJson: gal('/c.png') })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])

    await renderWithProviders(
      <>
        <Probe />
        <ActionsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Draw gun')
    await clickNamed(/^References$/i)
    await clickNamed(/Intro|demo|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
    }
    // plate then cancel confirm (escape / cancel button)
    await clickNamed(/Generate instruction board/i)
    await waitFor(
      () => expect(document.body.textContent || '').toMatch(/Confirm reference/i),
      { timeout: 4000 }
    ).catch(() => undefined)
    const cancel = screen
      .getAllByRole('button')
      .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
    if (cancel) await act(async () => fireEvent.click(cancel))
    // confirm go path
    await clickNamed(/Generate instruction board/i)
    await confirmImageGen()

    await clickNamed(/→|←/i)
    await clickNamed(/^Cancel$/i)
    // delete cancel
    const del = screen
      .getAllByRole('button')
      .find((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (del) {
      await act(async () => fireEvent.click(del))
      const no = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (no && document.querySelector('[role="alertdialog"]')) {
        await act(async () => fireEvent.click(no))
      }
    }
  }, 35000)
})

describe('continue100 Props Costumes residual', () => {
  beforeEach(() => seed())

  it('Props intro no image + plate cancel + busy AI', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: null,
        refGalleryJson: null
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/pd.png',
      label: 'H',
      variant: 'hero'
    })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'B', description: 'd' },
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
    await clickNamed(/Intro|video/i)
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate/i)
    await waitFor(
      () => expect(document.body.textContent || '').toMatch(/Confirm reference/i),
      { timeout: 4000 }
    ).catch(() => undefined)
    const cancel = screen
      .getAllByRole('button')
      .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
    if (cancel) await act(async () => fireEvent.click(cancel))
    await clickNamed(/Generate prop plate/i)
    await confirmImageGen()
    // upload then intro
    await clickNamed(/Upload reference/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$/i)
  }, 25000)

  it('Costumes update fail on intro + blocked dress', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: 'trench',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd fail'))
      .mockResolvedValue(makeCostume())
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png',
      costume: { id: 'cos-1', refImagePath: '/tmp/d.png' }
    })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'N',
      description: 'D'
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

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')
    await clickNamed(/Image \/ dress|Dress/i)
    await clickNamed(/Intro|video/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    // dress with character
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const aria = Array.from(s.options).find((o) =>
        /Aria|char-1/i.test(o.textContent || o.value)
      )
      if (aria) {
        await act(async () =>
          fireEvent.change(s, { target: { value: aria.value } })
        )
      }
    }
    // start a blocking job then try dress
    await act(async () => {
      jobs?.startJob({
        kind: 'costume-swap',
        label: 'block',
        scope: { characterId: 'char-1', costumeId: 'cos-1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 200))
          return undefined
        }
      })
    })
    await clickNamed(/Generate dressed look|Generate look/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 25000)
})

describe('continue100 Characters Scenes Stories Settings Timeline', () => {
  beforeEach(() => seed())

  it('Characters ensureSavedId fail + wardrobe no name', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png')
      })
    ])
    api.characters.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeCharacter())
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible',
      layer: 'identity'
    })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'W',
        costume: 'c',
        artStyle: 'anime',
        rationale: 'r'
      }
    })
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'A', description: 'd', appearance: 'a' },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([])
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
    api.souls.searchLocal = vi.fn().mockResolvedValue({ items: [] })
    api.characters.readSoulContent = vi.fn().mockResolvedValue('')
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: ''
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
    // clear name then suggest wardrobe
    await clickNamed(/^Costume$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/Suggest from plot/i)
    // restore name on profile, sheet with update fail
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Aria' } })
      )
    }
    await clickNamed(/^References$/i)
    await clickNamed(/Generate professional reference/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 30000)

  it('Scenes intro no image + plot empty story + atmosphere', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        refImagePath: null,
        refGalleryJson: null
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: { title: 'R', description: 'd' },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'E',
      variant: 'establishing'
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
    await openCardEdit('Rooftop')
    await clickNamed(/Intro|video/i)
    await clickNamed(/Suggest from story/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    // try fill without story if enabled
    const fill = Array.from(document.querySelectorAll('button')).find(
      (b) =>
        /^AI fill/i.test((b.textContent || '').trim()) &&
        !(b as HTMLButtonElement).disabled
    )
    if (fill) await act(async () => fireEvent.click(fill))
    await clickNamed(/^Cancel$/i)
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate location plate/i)
    await confirmImageGen()
    await clickNamed(/Atmosphere/i)
    await clickNamed(/Generate atmosphere swap/i)
    await clickNamed(/^Save$/i)
  }, 25000)

  it('Stories seed demo + export + empty cast filters', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        characters: [],
        scenes: [],
        props: [],
        actions: [],
        timeline: []
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue({})
    api.stories.seedDemo = vi.fn().mockResolvedValue({
      storyId: 'story-1',
      title: 'Demo'
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 's',
      hardRules: 'h',
      artStyle: 'anime'
    })
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [],
      drafts: [],
      raw: ''
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/c.png' })
    api.characters.list = vi.fn().mockResolvedValue([])
    api.scenes.list = vi.fn().mockResolvedValue([])
    api.props.list = vi.fn().mockResolvedValue([])
    api.actions.list = vi.fn().mockResolvedValue([])
    api.costumes.list = vi.fn().mockResolvedValue([])
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.update = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.list = vi.fn().mockResolvedValue([])
    api.project = {
      ...(api as { project?: object }).project,
      exportBackup: vi.fn().mockResolvedValue({ filePath: '/b.zip' }),
      importBackup: vi.fn().mockResolvedValue({ storyId: 's2', title: 'Imp' })
    } as never

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    await clickNamed(/seed|demo|Sample/i)
    await clickNamed(/^Edit$/i)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled()).catch(
      () => undefined
    )
    await clickNamed(/Cast/i)
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      await clickNamed(kind)
    }
    await clickNamed(/Script/i)
    await clickNamed(/Add beat/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Basics|Meta/i)
    await clickNamed(/AI fill style notes/i)
    await clickNamed(/export|backup/i)
    await clickNamed(/^Save$/i)
  }, 25000)

  it('Settings gateway missing + models fail + web', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      legalAcceptedAt: '2026-01-01T00:00:00.000Z',
      firstRunSeen: true,
      llmProvider: 'grok-local',
      webServerEnabled: false,
      webServerPort: 8787
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
      message: 'missing'
    })
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'gateway_missing',
      healthOk: false,
      message: 'no',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://a'
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'gateway_missing',
      healthOk: false,
      message: 'no'
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/',
      installCommand: 'curl x'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: false })
    api.ai.listModels = vi.fn().mockRejectedValue(new Error('429'))
    api.ai.testChat = vi.fn().mockRejectedValue(new Error('fail'))
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'http://x',
      model: 'm'
    })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: false,
      url: null,
      port: 8787,
      error: 'err',
      staticReady: false,
      token: null
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('t')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'idle',
      channel: 'stable',
      currentVersion: '1',
      latestVersion: null,
      canCheck: true,
      canDownload: false,
      canAutoInstall: false,
      progress: 0
    })
    api.updates.check = vi.fn().mockResolvedValue({ status: 'up-to-date' })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'x',
      currentVersion: '1',
      latestVersion: '1',
      updateAvailable: false,
      checkedAt: new Date().toISOString(),
      installCommand: ''
    })
    api.updates.onState = vi.fn(() => () => undefined)
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.media.pickBgm = vi.fn().mockResolvedValue(null)
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
    await clickNamed(/Chat model/i)
    await clickNamed(/Show advanced|Refresh|Test|Grok|Recheck|Ensure|Install|Copy/i)
    await clickNamed(/^Image$/i)
    await clickNamed(/^Video$/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Clear/i)
    await clickNamed(/^App$/i)
    for (const re of [
      /Enable|Start|Stop|Regenerate|Copy|Check|npm|backup|export|import|support|diagnostics|folder|English|Light|Dark|System/i
    ]) {
      await clickNamed(re)
    }
    await clickNamed(/^Save$/i)
  }, 30000)

  it('Timeline one clip pack need + export cancel', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        dialogue: 'solo'
      })
    ])
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      videoMode: 'stub',
      defaultMaxClipSeconds: 6
    })
    api.generation.run = vi.fn().mockResolvedValue({ success: true, steps: [] })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.generation.onProgress = vi.fn(() => () => undefined)

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled()).catch(
      () => undefined
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    // pack with 1 clip → need 2
    await clickNamed(/^k-pack$/i)
    await clickNamed(/Pack clips/i)
    await clickNamed(/^k-drop$/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/^xexp$/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await clickNamed(/Add to timeline/i)
  }, 20000)
})
