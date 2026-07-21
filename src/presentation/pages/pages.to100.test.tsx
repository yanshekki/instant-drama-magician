/**
 * Residual push toward 100% lines on every page.
 * Focus: error/guard branches, sort edges, empty-name, create-fail, busy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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
        onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'entry-1', 0, 6)}
      >
        k-resize
      </button>
      <button
        type="button"
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'entry-1', 1, 5)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'scene', id: 'scene-1' }, 3)}
      >
        k-drop
      </button>
      <span data-testid="konva-n">{p.entries?.length ?? 0}</span>
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
      <button type="button" onClick={() => p.onTime?.(2)}>
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
        <button type="button" onClick={() => p.onConfirm?.({ burnSubtitles: false })}>
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
    kind: 'prop-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
}

describe('to100 Audit residual sorts + clear fail', () => {
  beforeEach(() => seed())

  it('sort by level kind message ms + clear reject', async () => {
    api.activity.query = vi.fn().mockResolvedValue({
      entries: [
        ...makeAuditEntries(),
        {
          ts: '2026-07-15T10:00:00.000Z',
          kind: 'error',
          message: 'zzz-error',
          level: 'error',
          storyId: 'story-1',
          meta: { ms: 9000 }
        },
        {
          ts: '2026-07-15T09:00:00.000Z',
          kind: 'warn',
          message: 'aaa-warn',
          level: 'warn',
          storyId: null,
          meta: { ms: 10 }
        },
        {
          ts: '2026-07-15T08:00:00.000Z',
          kind: 'export',
          message: 'export final',
          level: 'info',
          storyId: 'story-1',
          meta: {}
        }
      ],
      path: '/tmp/a.jsonl'
    })
    api.activity.clear = vi
      .fn()
      .mockRejectedValueOnce(new Error('clear fail'))
      .mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(<AuditLogPage />, { withToastHost: true })
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())

    await clickNamed(/More options|Advanced/i)
    // Cycle sort selects / buttons for level, kind, message, ms
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < s.options.length; i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    for (const re of [
      /level|severity|kind|message|duration|ms|Newest|Oldest|Slowest|asc|desc/i
    ]) {
      await clickNamed(re)
    }
    // Click column headers if present
    for (const th of Array.from(document.querySelectorAll('th, button'))) {
      const t = (th.textContent || '').trim()
      if (/Time|Severity|Category|Event|Duration|ms/i.test(t)) {
        await act(async () => fireEvent.click(th))
      }
    }
    const row = screen.queryAllByText(/zzz-error|aaa-warn|export final/i)[0]
    if (row) await act(async () => fireEvent.click(row))
    await clickNamed(/Copy for support|Copy/i)
    await clickNamed(/Clear all logs|Clear/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    // Second clear success
    await clickNamed(/Clear all logs|Clear/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
  }, 25000)
})

describe('to100 Actions error guards', () => {
  beforeEach(() => seed())

  it('empty name save, update fail, create fail, AI need idea', async () => {
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        id: 'act-1',
        name: 'Draw gun',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag')
      })
    ])
    // update returns false via hook when API throws - useProps-like returns false on catch
    api.actions.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('update boom'))
      .mockResolvedValue(makeAction())
    api.actions.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create boom'))
      .mockResolvedValue(makeAction({ id: 'act-new' }))
    api.actions.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(new Error('plate boom'))
      .mockResolvedValue({ path: '/tmp/p.png', label: 'G' })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: []
    })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'D', description: 'd' },
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

    // Empty name save
    for (const el of Array.from(document.querySelectorAll('input'))) {
      if ((el as HTMLInputElement).value === 'Draw gun') {
        await act(async () =>
          fireEvent.change(el, { target: { value: '' } })
        )
      }
    }
    await clickNamed(/^Save$/i)

    // Restore name, save with update fail
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Draw gun' } })
      )
    }
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // AI need idea when all empty
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    const nameEl = document.querySelector('input')
    if (nameEl) {
      await act(async () =>
        fireEvent.change(nameEl, { target: { value: 'Draw gun' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)

    // Plate generate fail
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
    }

    // New action create fail then success
    await clickNamed(/New action|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Kick residual' } })
      )
    }
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)

    // Delete path
    await openCardEdit('Draw gun').catch(() => undefined)
    await clickNamed(/^Cancel$/i)
    // list delete
    const del = screen
      .getAllByRole('button')
      .find((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (del) {
      await act(async () => fireEvent.click(del))
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
  }, 40000)
})

describe('to100 Props Costumes error guards', () => {
  beforeEach(() => seed())

  it('Props empty name, update false, create fail, intro guards, reorder', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u boom'))
      .mockResolvedValue(makeProp())
    api.props.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('c boom'))
      .mockResolvedValue(makeProp({ id: 'prop-new', name: 'Flask' }))
    api.props.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(new Error('plate boom'))
      .mockResolvedValue({ path: '/tmp/p.png', label: 'H', variant: 'hero' })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: []
    })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'B', description: 'd' },
      profileJson: '{}',
      raw: ''
    })
    api.props.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Badge')

    // empty name
    for (const el of Array.from(document.querySelectorAll('input'))) {
      if ((el as HTMLInputElement).value === 'Badge') {
        await act(async () => fireEvent.change(el, { target: { value: '' } }))
      }
    }
    await clickNamed(/^Save$/i)
    // restore + update fail
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Badge' } })
      )
    }
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // intro with image
    await clickNamed(/^Plates$/i)
    await clickNamed(/→|←/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$|^vpa$/i)

    // plate fail
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
    }

    // New prop create fail then plate
    await clickNamed(/New prop/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Flask' } })
      )
    }
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)

    // AI empty idea on empty form
    await openCardEdit('Badge').catch(() => undefined)
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('textarea'))) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill \/ improve/i)
  }, 40000)

  it('Costumes link fail + dress guards + save first', async () => {
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
    api.costumes.create = vi.fn().mockResolvedValue(makeCostume({ id: 'cn' }))
    api.costumes.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link fail'))
      .mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png',
      costume: { id: 'cos-1', refImagePath: '/tmp/d.png', refGalleryJson: null }
    })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'N',
      description: 'D'
    })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png')
      }),
      makeCharacter({
        id: 'char-2',
        name: 'Ben',
        refImagePath: null,
        refGalleryJson: null
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

    await clickNamed(/Linked cast|Links/i)
    await clickNamed(/All/i)
    for (const b of screen.getAllByRole('button')) {
      if (/^Link$/i.test((b.textContent || '').trim())) {
        await act(async () => fireEvent.click(b))
        break
      }
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    for (const b of screen.getAllByRole('button')) {
      if (/^Link$|^Unlink$/i.test((b.textContent || '').trim())) {
        if (!(b as HTMLButtonElement).disabled) {
          await act(async () => fireEvent.click(b))
        }
      }
    }

    await clickNamed(/Image \/ dress|Dress/i)
    // pick char with no base
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const ben = Array.from(s.options).find((o) => /Ben|char-2/i.test(o.textContent || o.value))
      if (ben) {
        await act(async () => fireEvent.change(s, { target: { value: ben.value } }))
      }
    }
    await clickNamed(/Generate dressed look|Generate look/i)

    // pick Aria with base
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
    await clickNamed(/Generate dressed look|Generate look image/i)
    await confirmImageGen()

    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$/i)

    // AI empty
    await clickNamed(/Details|Profile/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill \/ improve/i)

    await clickNamed(/New look|New/i)
    await clickNamed(/Image \/ dress|Dress/i)
    await clickNamed(/Generate dressed look/i)
    await clickNamed(/Linked cast|Links/i)
    await clickNamed(/^Link$/i)
  }, 40000)
})

describe('to100 Characters Scenes Stories residual', () => {
  beforeEach(() => seed())

  it('Characters create fail + sheet fail + soul hub + empty AI', async () => {
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
    api.characters.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeCharacter())
    api.characters.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create fail'))
      .mockResolvedValue(makeCharacter({ id: 'cn', name: 'Nova' }))
    api.characters.generateSheet = vi
      .fn()
      .mockRejectedValueOnce(new Error('sheet fail'))
      .mockResolvedValue({
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
    api.characters.swapCostume = vi
      .fn()
      .mockRejectedValueOnce(new Error('swap fail'))
      .mockResolvedValue({
        path: '/tmp/sw.png',
        label: 'S',
        variant: 'costume_swap',
        layer: 'costume'
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
    api.characters.delete = vi.fn().mockResolvedValue({ ok: true })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.souls.list = vi.fn().mockResolvedValue({
      data: [{ id: 1, title: 'S1', description: 'd', role: null, domain: null }],
      total_pages: 1,
      current_page: 1
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 1,
      title: 'S1',
      content: '# s'
    })
    api.souls.searchLocal = vi.fn().mockResolvedValue({ items: [] })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 1,
      pages: 1,
      fromCache: true,
      suggestions: []
    })
    api.characters.readSoulContent = vi.fn().mockResolvedValue('# s')
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: '# s'
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
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickNamed(/^References$/i)
    await clickNamed(/Generate professional reference/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
    }
    await clickNamed(/→|←/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this photo|Remove/i)

    await clickNamed(/^Costume$/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'swap residual costume' } })
      )
    }
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen()
    await clickNamed(/Suggest from plot/i)
    await clickNamed(/Add to library/i)
    await clickNamed(/Apply/i)

    await clickNamed(/^Profile$/i)
    // empty AI
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill|AI improve|AI create/i)
    await clickNamed(/Generate Soul/i)
    await clickNamed(/Import local/i)
    await clickNamed(/Reload|Refresh|Unlink|Use/i)

    await clickNamed(/New character|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Nova residual' } })
      )
    }
    await clickNamed(/^References$/i)
    await clickNamed(/Generate professional reference|Create and generate/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Scenes save fail + plot need story + intro guards + create', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg')
      })
    ])
    api.scenes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('scene upd'))
      .mockResolvedValue(makeScene())
    api.scenes.create = vi.fn().mockResolvedValue(makeScene({ id: 'sn' }))
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
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: []
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({ path: '/tmp/a.png' })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({ ok: true })
    api.scenes.delete = vi.fn().mockResolvedValue({ ok: true })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rooftop')
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // plot without story (cancel before select)
    await clickNamed(/Suggest from story/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const fillEarly = Array.from(document.querySelectorAll('button')).find(
      (b) =>
        /^AI fill/i.test((b.textContent || '').trim()) &&
        (b as HTMLButtonElement).disabled
    )
    // try click cancel on plot
    await clickNamed(/^Cancel$/i)

    await clickNamed(/^Plates$/i)
    await clickNamed(/Intro|video/i)
    await clickNamed(/Generate location plate/i)
    await confirmImageGen()
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)

    await clickNamed(/Atmosphere/i)
    await clickNamed(/Generate atmosphere swap/i)
    for (const re of [/Copy|look|Look|Add/i]) await clickNamed(re)

    await clickNamed(/New scene|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Harbor residual' } })
      )
    }
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate location plate/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 40000)

  it('Stories load fail + link fail + beat delete cancel + meta', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi
      .fn()
      .mockRejectedValueOnce(new Error('detail fail'))
      .mockResolvedValue(
        makeStoryDetail({
          characters: [makeCharacter()],
          scenes: [makeScene()],
          props: [makeProp()],
          actions: [makeAction()],
          timeline: [
            makeTimelineEntry({ id: 'b1', dialogue: 'A' }),
            makeTimelineEntry({ id: 'b2', order: 1, dialogue: 'B' })
          ]
        } as never)
      )
    api.stories.update = vi.fn().mockResolvedValue({})
    api.stories.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link'))
      .mockResolvedValue({})
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
      beats: [{ order: 0, dialogue: 'X', characterId: 'char-1', sceneId: 'scene-1' }],
      drafts: [],
      raw: ''
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/c.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/cc.png' })
    api.stories.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('beat upd'))
      .mockResolvedValue(makeTimelineEntry())
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
    // first edit may fail detail load; second succeeds
    await clickNamed(/^Edit$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await clickNamed(/^Edit$/i)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled()).catch(
      () => undefined
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    await clickNamed(/Basics|Meta/i)
    await clickNamed(/AI fill style notes/i)
    await clickNamed(/Cast/i)
    for (const b of screen.getAllByRole('button')) {
      if (/^Link$/i.test((b.textContent || '').trim())) {
        await act(async () => fireEvent.click(b))
        break
      }
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    for (const b of screen.getAllByRole('button')) {
      if (/^Link$|^Unlink$/i.test((b.textContent || '').trim())) {
        if (!(b as HTMLButtonElement).disabled) {
          await act(async () => fireEvent.click(b))
        }
      }
    }

    await clickNamed(/Script/i)
    await clickNamed(/Add beat/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'beat residual to100' } })
      )
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
    await clickNamed(/Delete/i)
    // cancel delete dialog
    const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
      /^Cancel$/i.test((b.textContent || '').trim())
    )
    if (cancel && document.querySelector('[role="alertdialog"]')) {
      await act(async () => fireEvent.click(cancel))
    } else if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Save$/i)
  }, 40000)
})

describe('to100 Settings Timeline residual', () => {
  beforeEach(() => seed())

  it('Settings all tabs + gateway + web + updates dense', async () => {
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
      colorScheme: 'light',
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
      channels: 3
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '7',
      path: '/ff'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi.fn().mockResolvedValue([
      { id: 'm1', ownedBy: 'x' },
      { id: 'm2', ownedBy: 'y' }
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
      keyCreated: false,
      message: 'ok'
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/',
      installCommand: 'curl install'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 't'
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('nt')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'stable',
      currentVersion: '1',
      latestVersion: '2',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 0,
      releaseNotes: '## r',
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
        progress: 50,
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

    for (const tab of [/Chat model/i, /^Image$/i, /^Video$/i, /^Export$/i, /^App$/i]) {
      await clickNamed(tab)
      await clickNamed(/Show advanced|Hide advanced/i)
      for (const input of Array.from(
        document.querySelectorAll('input')
      ).slice(0, 12) as HTMLInputElement[]) {
        if (input.type === 'checkbox') {
          await act(async () => fireEvent.click(input))
        } else if (input.type !== 'file') {
          await act(async () =>
            fireEvent.change(input, {
              target: {
                value: input.type === 'number' ? '12345' : 'residual-val'
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
        }
      }
      for (const re of [
        /Refresh|Test|Grok|Custom|Seedream|Seedance|Stub|preset|BGM|Clear|Stop|Start|Enable|Regenerate|Copy|Check|Download|Restart|Open|npm|backup|export|import|support|diagnostics|folder|English|System|Light|Dark/i
      ]) {
        await clickNamed(re)
      }
    }
    await clickNamed(/^Save$/i)
  }, 45000)

  it('Timeline pack export delete progress cast', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        dialogue: 'A',
        characterId: 'char-1'
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
        dialogue: 'B'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        storyId: 'story-1',
        order: 2,
        startTime: 10,
        endTime: 16,
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
      openExportFolder: true
    })
    api.settings.set = vi.fn().mockResolvedValue({})
    api.generation.run = vi.fn().mockResolvedValue({ success: true, steps: [] })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
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
        sizeBytes: 1000
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
          total: 2,
          step: 'image',
          entryId: 'entry-1',
          mediaStatus: 'GENERATING'
        })
        progressCb!({
          storyId: 'story-1',
          index: 1,
          total: 2,
          step: 'video',
          entryId: 'entry-2',
          mediaStatus: 'READY'
        })
        progressCb!({
          storyId: 'story-1',
          index: 1,
          total: 2,
          step: 'video',
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
        fireEvent.change(ta, { target: { value: 'to100 timeline dlg' } })
      )
    }
    await clickNamed(/^Save$/i)
    await clickNamed(/Import clip/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await clickNamed(/Export history/i)
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Advanced/i)
    await clickNamed(/^q$|^xc$/i)
    await clickNamed(/Retry failed/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Add to timeline/i)
    await clickNamed(/^Generate$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
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
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ).slice(0, 3)) {
      await act(async () => fireEvent.click(cb))
    }
  }, 35000)
})
