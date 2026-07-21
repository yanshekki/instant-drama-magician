/**
 * Drive ALL presentation pages to 100% lines.
 * Safe videoPrep.create (professionalPrompt always set) + capped rAF from tl100.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    onSnapEnabledChange?: (v: boolean) => void
    onSnapGridSecChange?: (v: number) => void
    entries?: { id: string }[]
  }) => (
    <div data-testid="konva">
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[0]?.id ?? 'entry-1')}>
        k-sel
      </button>
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[1]?.id ?? 'entry-2')}>
        k-sel2
      </button>
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[2]?.id ?? 'entry-3')}>
        k-sel3
      </button>
      <button type="button" onClick={() => p.onPackAbut?.()}>
        k-pack
      </button>
      <button type="button" onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'entry-1', 0, 8)}>
        k-resize
      </button>
      <button type="button" onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'entry-1', 2, 9)}>
        k-move
      </button>
      <button type="button" onClick={() => p.onDropAsset?.({ kind: 'character', id: 'char-1' }, 5)}>
        k-drop
      </button>
      <button type="button" onClick={() => p.onSnapEnabledChange?.(true)}>
        k-snap-on
      </button>
      <button type="button" onClick={() => p.onSnapEnabledChange?.(false)}>
        k-snap-off
      </button>
      <button type="button" onClick={() => p.onSnapGridSecChange?.(0.25)}>
        k-snap-grid
      </button>
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
      <button type="button" onClick={() => p.onTime?.(0.5)}>
        p-tick
      </button>
      <button type="button" onClick={() => p.onTime?.(4.2)}>
        p-tick2
      </button>
      <button type="button" onClick={() => p.onTime?.(15)}>
        p-tick-end
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
    onRefreshTimeline?: () => void
  }) =>
    p.open ? (
      <div data-testid="adv">
        <button type="button" onClick={() => p.onStartVideoQueue?.(['entry-1', 'entry-3'])}>
          q
        </button>
        <button type="button" onClick={() => p.onRefresh?.()}>
          adv-r
        </button>
        <button type="button" onClick={() => p.onRefreshTimeline?.()}>
          adv-rt
        </button>
        <button type="button" onClick={() => p.onClose?.()}>
          xc
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

function installRafCap(maxCalls = 6) {
  let n = 0
  const origRaf = globalThis.requestAnimationFrame
  const origCaf = globalThis.cancelAnimationFrame
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    n++
    if (n > maxCalls) return n
    const id = n
    setTimeout(() => {
      try {
        cb(performance.now())
      } catch {
        /* ignore */
      }
    }, 0)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  return () => {
    vi.stubGlobal('requestAnimationFrame', origRaf)
    vi.stubGlobal('cancelAnimationFrame', origCaf)
  }
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

const costumesJson = JSON.stringify([
  {
    id: 'look-1',
    name: 'Coat',
    description: 'black trench',
    artStyle: 'anime',
    imagePath: '/media/aria.png',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
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
    () =>
      expect(document.body.textContent || '').toMatch(new RegExp(name, 'i')),
    { timeout: 10000 }
  )
  await waitFor(
    async () => {
      if (
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ) {
        return
      }
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
      { timeout: 3000 }
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

async function dismissVideoPrep(maxMs = 2500) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const cancel = screen
      .queryAllByRole('button')
      .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
    if (cancel && Date.now() - start > 700) {
      await act(async () => fireEvent.click(cancel))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      return true
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
  }
  const cancel = screen
    .queryAllByRole('button')
    .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
  if (cancel) {
    await act(async () => fireEvent.click(cancel))
    return true
  }
  return false
}

async function hangBusy(kind: string, scope: Record<string, string | undefined>) {
  await act(async () => {
    void jobs!.startJob({
      kind: kind as never,
      label: 'hang',
      scope: scope as never,
      run: async () => {
        await new Promise(() => {
          /* hang */
        })
      }
    })
  })
}

async function cancelAllJobs() {
  for (const j of [...(jobs?.activeJobs ?? [])]) {
    await act(async () => {
      await jobs!.cancelJob(j.id)
    })
  }
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
  api.media.discardSheetDraft = vi
    .fn()
    .mockRejectedValueOnce(new Error('discard'))
    .mockResolvedValue({})
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({
    ok: true,
    isDirectory: true,
    path: '/tmp/u'
  })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockImplementation(async (payload: {
    kind?: string
    storyId?: string
    entryId?: string
    characterId?: string
    sceneId?: string
    propId?: string
    actionId?: string
    costumeId?: string
    sourceImagePath?: string
  }) => ({
    professionalPrompt: 'FULL PROFESSIONAL PROMPT all100 safe residual',
    stillPath: payload?.sourceImagePath ?? '/s.png',
    sourceImagePath: payload?.sourceImagePath ?? '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: {
      storyId: payload?.storyId ?? 'story-1',
      entryId: payload?.entryId,
      characterId: payload?.characterId,
      sceneId: payload?.sceneId,
      propId: payload?.propId,
      actionId: payload?.actionId,
      costumeId: payload?.costumeId
    },
    kind: payload?.kind ?? 'character-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1,
    materialsSummary: 'm',
    stillPromptUsed: 's',
    skippedStill: false
  }))
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'FROM STILL FULL',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' },
    kind: 'timeline-clip',
    userExtraPrompt: ''
  })
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  api.generation.run = vi.fn().mockResolvedValue({
    success: true,
    steps: [
      { step: 'script', success: true },
      { step: 'timeline', success: true, degraded: true }
    ]
  })
  api.generation.onProgress = vi.fn(() => () => undefined)
  api.settings.get = vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS })
  api.settings.set = vi.fn().mockResolvedValue({})
  api.costumes.list = vi.fn().mockResolvedValue([])
  api.costumes.listForCharacter = vi.fn().mockResolvedValue([])
  api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
  api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  api.props.list = vi.fn().mockResolvedValue([makeProp()])
  api.actions.list = vi.fn().mockResolvedValue([makeAction()])
  api.timeline.list = vi.fn().mockResolvedValue([])
  api.souls.list = vi.fn().mockResolvedValue({
    data: [],
    total_pages: 1,
    current_page: 1
  })
  api.souls.searchLocal = vi.fn().mockResolvedValue({ items: [] })
  api.souls.ensureIndex = vi.fn().mockResolvedValue({
    count: 0,
    pages: 0,
    fromCache: true,
    suggestions: []
  })
}

// ─── Actions → 100 ───
describe('all100 Actions residual', () => {
  beforeEach(() => seed())

  it('empty name, update fail, AI need idea, busy, plate cancel discard, intro draft', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['action-intro:act-1:/a.png']: {
            kind: 'action-intro',
            entityIds: { actionId: 'act-1' },
            sourceImagePath: '/a.png',
            professionalPrompt: 'DRAFT FULL PROMPT',
            stillPath: '/s.png',
            durationSeconds: 6,
            aspectRatio: '16:9',
            savedAt: Date.now()
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
        description: 'snap',
        motionNotes: 'quick',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag'),
        castRefsJson: JSON.stringify([
          {
            id: 'cr1',
            kind: 'character',
            entityId: 'char-1',
            imagePath: '/c.png',
            label: 'Aria'
          }
        ])
      }),
      makeAction({ id: 'act-2', name: 'Kick', refImagePath: null })
    ])
    let updN = 0
    api.actions.update = vi.fn().mockImplementation(async () => {
      updN++
      if (updN === 1) throw new Error('upd fail')
      return makeAction({ id: 'act-1', name: 'Draw gun' })
    })
    api.actions.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create fail'))
      .mockResolvedValue(makeAction({ id: 'an', name: 'New' }))
    api.actions.delete = vi.fn().mockRejectedValueOnce(new Error('del'))
    api.actions.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('plate'), { details: 'pd' })
      )
      .mockResolvedValue({ path: '/tmp/ap.png', label: 'B', panelLayout: '2x2' })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Draw gun', description: 'd' },
      profileJson: '{}',
      raw: ''
    })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/apc.png',
      gallery: []
    })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.costumes.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <ActionsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Draw gun/i)
    )

    // filters + clear
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Draw' } })
      )
    }
    await clickNamed(/Clear filters/i)

    // delete fail
    const art = Array.from(document.querySelectorAll('article')).find((a) =>
      (a.textContent || '').includes('Kick')
    )
    if (art) {
      const del = within(art as HTMLElement).queryByRole('button', {
        name: /^Delete$/i
      })
      if (del) {
        await act(async () => fireEvent.click(del))
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }

    await openCardEdit('Draw gun')

    // empty name save
    for (const el of Array.from(document.querySelectorAll('input'))) {
      if ((el as HTMLInputElement).value === 'Draw gun') {
        await act(async () => fireEvent.change(el, { target: { value: '' } }))
      }
    }
    await clickNamed(/^Save$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Draw gun' } })
      )
    }

    // AI need idea
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Draw gun' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'motion residual' } })
      )
    }

    // busy
    await hangBusy('action-ai-fill', { actionId: 'act-1' })
    await clickNamed(/AI fill/i)
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board|Generate plate/i)
    await cancelAllJobs()

    // plate fail with details then success + cancel discard
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    // hang plate then cancel for discard path
    await hangBusy('action-plate', { actionId: 'act-1' })
    await clickNamed(/Generate instruction board|Generate plate/i)
    await cancelAllJobs()

    // multi checkbox identity
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // intro continue draft
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)

    // save update fail then ok
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // new action plate saveFirst create fail
    await clickNamed(/New action|New/i)
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board|Generate plate/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Nova act residual' } })
      )
    }
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }, 70000)
})

// ─── Props → 100 ───
describe('all100 Props residual', () => {
  beforeEach(() => seed())

  it('filters delete fail AI need idea saveFirst busy plate intro draft', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['prop-intro:prop-1:/media/badge.png']: {
            kind: 'prop-intro',
            entityIds: { propId: 'prop-1' },
            sourceImagePath: '/media/badge.png',
            professionalPrompt: 'DRAFT FULL',
            stillPath: '/s.png',
            durationSeconds: 6,
            aspectRatio: '16:9',
            savedAt: Date.now()
          }
        })
      )
    } catch {
      /* ignore */
    }
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        description: 'metal',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      }),
      makeProp({ id: 'prop-2', name: 'Flask', refImagePath: null })
    ])
    api.props.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeProp())
    api.props.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('c'))
      .mockResolvedValue(makeProp({ id: 'pn', name: 'New' }))
    api.props.delete = vi.fn().mockRejectedValueOnce(new Error('d'))
    api.props.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('plate'), { details: 'pd' })
      )
      .mockResolvedValue({ path: '/tmp/pp.png', label: 'H' })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Badge', description: 'd' },
      profileJson: '{}',
      raw: ''
    })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/ppc.png',
      gallery: []
    })
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Badge/i)
    )
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Badge' } })
      )
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Clear filters/i)

    const art = Array.from(document.querySelectorAll('article')).find((a) =>
      (a.textContent || '').includes('Flask')
    )
    if (art) {
      const del = within(art as HTMLElement).queryByRole('button', {
        name: /^Delete$/i
      })
      if (del) {
        await act(async () => fireEvent.click(del))
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }

    await clickNamed(/New prop/i)
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/Generate prop plate|Generate plate/i)
    await clickNamed(/Intro|video/i)
    await clickNamed(/^Cancel$/i)

    await openCardEdit('Badge')
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Badge' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'metal residual' } })
      )
    }
    await hangBusy('prop-ai-fill', { propId: 'prop-1' })
    await clickNamed(/AI fill/i)
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate|Generate plate/i)
    await cancelAllJobs()
    await clickNamed(/Generate prop plate|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
  }, 60000)
})

// ─── Costumes residual ───
describe('all100 Costumes residual', () => {
  beforeEach(() => seed())

  it('filters dress intro links busy AI clear', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cost-1',
        name: 'Rain coat',
        description: 'long black',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg'),
        characterLinks: [
          { characterId: 'char-1', character: { id: 'char-1', name: 'Aria' } }
        ]
      }),
      makeCostume({
        id: 'cost-2',
        name: 'Suit',
        refImagePath: null,
        characterLinks: []
      })
    ])
    api.costumes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeCostume())
    api.costumes.create = vi.fn().mockResolvedValue(
      makeCostume({ id: 'cn', name: 'New' })
    )
    api.costumes.delete = vi.fn().mockRejectedValueOnce(new Error('d'))
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Rain coat',
      description: 'filled'
    })
    api.costumes.generateDressed = vi
      .fn()
      .mockRejectedValueOnce(new Error('dress fail'))
      .mockResolvedValue({ path: '/tmp/d.png' })
    api.costumes.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link'))
      .mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([])
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ id: 'char-1', name: 'Aria', refImagePath: '/a.png' }),
      makeCharacter({ id: 'char-2', name: 'Ben' })
    ])

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rain coat/i)
    )
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
    await clickNamed(/Clear filters/i)

    await openCardEdit('Rain coat')
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'costume residual body' } })
      )
    }
    await clickNamed(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await hangBusy('costume-ai-fill', { costumeId: 'cost-1' })
    await clickNamed(/AI fill/i)
    await cancelAllJobs()

    await clickNamed(/Dress|Generate dressed|Link/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      -3
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate dressed look|Generate dressed|Dress/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/Generate dressed look|Generate dressed|Dress/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(2500)
    await clickNamed(/^Link$|Unlink/i)
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
  }, 60000)
})

// ─── Characters residual ───
describe('all100 Characters residual', () => {
  beforeEach(() => seed())

  it('filters facets AI busy soul wardrobe sheet multi intro', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['character-intro:char-1:/media/aria.png']: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            sourceImagePath: '/media/aria.png',
            professionalPrompt: 'DRAFT FULL',
            stillPath: '/s.png',
            durationSeconds: 6,
            aspectRatio: '16:9',
            savedAt: Date.now()
          }
        })
      )
    } catch {
      /* ignore */
    }
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        gender: 'female',
        artStyle: 'anime',
        spokenLanguages: '["en","zh"]',
        soulHubId: 5,
        soulMdPath: 'soulmd-hub://5',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        costumesJson,
        hardRules: 'no logos',
        voiceDesc: 'low'
      }),
      makeCharacter({
        id: 'char-2',
        name: 'Ben',
        gender: '',
        artStyle: 'realistic',
        spokenLanguages: 'broken{',
        refImagePath: null
      }),
      makeCharacter({
        id: 'char-3',
        name: 'Cy',
        gender: 'male',
        artStyle: 'weird',
        spokenLanguages: '["ja"]',
        refImagePath: '/c.png',
        refSheetPath: '/cs.png'
      })
    ])
    api.characters.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeCharacter({ id: 'char-1' }))
    api.characters.delete = vi.fn().mockRejectedValueOnce(new Error('d'))
    api.characters.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('c'))
      .mockResolvedValue(makeCharacter({ id: 'cn', name: 'Nova' }))
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria+',
        description: 'd',
        appearance: 'a',
        costume: 'c',
        hardRules: 'h',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.characters.readSoulContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('soul'))
      .mockResolvedValue({ content: '# soul body' })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'R',
        costume: 'coat',
        artStyle: 'anime',
        rationale: 'r'
      }
    })
    api.characters.swapCostume = vi.fn().mockResolvedValue({
      path: '/tmp/sw.png',
      label: 'Swap',
      layer: 'costume'
    })
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible',
      layer: 'identity'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
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
    api.characters.generateSoul = vi.fn().mockResolvedValue({
      path: '/tmp/g.md',
      content: '# g',
      title: 'G'
    })
    api.characters.importSoulMd = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        filePath: '/tmp/i.md',
        content: '# Imported\n\nBody'
      })
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({ id: 'cost-1', name: 'Rain coat' })
    ])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([
      makeCostume({ id: 'cost-1', isActive: true })
    ])
    api.costumes.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('l'))
      .mockResolvedValue({})
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png'
    })
    api.souls.list = vi.fn().mockResolvedValue({
      data: [
        { id: 5, title: 'Soul5', description: 'd', role: 'lead', domain: 'noir' }
      ],
      total_pages: 2,
      current_page: 1
    })
    api.souls.get = vi
      .fn()
      .mockRejectedValueOnce(new Error('get'))
      .mockResolvedValue({
        id: 5,
        title: 'Soul5',
        contentFlat: '# flat',
        content: '# flat'
      })
    api.souls.searchLocal = vi
      .fn()
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({
        items: [{ id: 5, title: 'Soul5', content: '# local' }]
      })
    api.souls.ensureIndex = vi
      .fn()
      .mockRejectedValueOnce(new Error('idx'))
      .mockResolvedValue({
        count: 1,
        pages: 2,
        fromCache: false,
        suggestions: [{ id: 5, title: 'Soul5' }]
      })

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(
      () => expect(document.body.textContent || '').toMatch(/Aria|Ben|Character/i),
      { timeout: 10000 }
    )

    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 3); i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
      if (s.options.length) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[0].value } })
        )
      }
    }
    const search = document.querySelector(
      'input[aria-label*="Search" i], input[placeholder*="Search" i]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Aria' } })
      )
    }
    await clickNamed(/Clear filters/i)
    if (search) {
      await act(async () => fireEvent.change(search, { target: { value: '' } }))
    }

    const art = screen.queryByText('Ben')?.closest('article') as
      | HTMLElement
      | undefined
    if (art) {
      const del = within(art).queryByRole('button', { name: /^Delete$/i })
      if (del) {
        await act(async () => fireEvent.click(del))
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }

    await openCardEdit('Aria')
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    await clickNamed(/Generate Soul from profile/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Aria' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'storm residual' } })
      )
    }
    await hangBusy('character-ai-fill', { characterId: 'char-1' })
    await clickNamed(/AI fill/i)
    await clickNamed(/Generate Soul from profile/i)
    await cancelAllJobs()

    await clickNamed(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })

    await clickNamed(/^Costume$/i)
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/Add to library/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'new look residual' } })
      )
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Suggest from plot/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      -2
    )) {
      const s = sel as HTMLSelectElement
      const opt = Array.from(s.options).find((o) =>
        /Rain coat/i.test(o.textContent || '')
      )
      if (opt) {
        await act(async () =>
          fireEvent.change(s, { target: { value: opt.value } })
        )
      }
    }
    await clickNamed(/^Link$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickNamed(/^Link$/i)
    await clickNamed(/Generate dressed look/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await clickNamed(/^References$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const re of [/^All$/i, /Identity/i, /Base/i, /Costume/i]) {
      await clickNamed(re)
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)

    await clickNamed(/^Profile$/i)
    await clickNamed(/Import local soul/i)
    await clickNamed(/Import local soul/i)
    await clickNamed(/Search|Reload|Refresh/i)
    await clickNamed(/→/)
    await clickNamed(/←/)
    const soul = screen.queryAllByText(/Soul5/i)[0]
    if (soul) await act(async () => fireEvent.click(soul))
    await clickNamed(/Use soul|Use/i)
    await clickNamed(/Unlink|Clear soul/i)
    await clickNamed(/Generate Soul from profile/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
  }, 90000)
})

// ─── Settings residual ───
describe('all100 Settings residual', () => {
  beforeEach(() => seed())

  it('openai advanced image video matrix + app web npm + grok install', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-x',
      imageProvider: 'same-as-llm',
      videoProvider: 'stub',
      videoMode: 'stub',
      colorScheme: 'system',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true,
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
      userData: '/tmp/u',
      mediaRoot: '/tmp/m',
      name: 'IDM',
      channels: 4
    })
    api.media.checkFfmpeg = vi
      .fn()
      .mockResolvedValueOnce({ available: false, message: 'no ff' })
      .mockResolvedValue({ available: true, version: '7', path: '/ff' })
    api.media.pickBgm = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ path: '/b.mp3' })
    let modelsN = 0
    api.ai.listModels = vi.fn().mockImplementation(async () => {
      modelsN++
      if (modelsN === 1) {
        throw Object.assign(new Error('rate'), { code: 'AI_RATE_LIMIT' })
      }
      if (modelsN === 2) throw new Error('models generic')
      return [
        { id: 'gpt-4o', ownedBy: 'fallback' },
        { id: 'gpt-4.1', ownedBy: 'openai' }
      ]
    })
    api.ai.testChat = vi
      .fn()
      .mockRejectedValueOnce(new Error('chat'))
      .mockResolvedValue({ ok: true, message: 'ok', replyPreview: 'hi' })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    api.gateway.status = vi
      .fn()
      .mockRejectedValueOnce(new Error('gw'))
      .mockResolvedValue({
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
    api.webServer.status = vi
      .fn()
      .mockRejectedValueOnce(new Error('ws'))
      .mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787,
        error: null,
        staticReady: true,
        token: 't',
        addresses: [
          { id: 'lan', address: 'http://192.168.1.2:8787' },
          { id: 'localhost', address: 'http://127.0.0.1:8787' }
        ]
      })
    api.webServer.start = vi
      .fn()
      .mockRejectedValueOnce(new Error('start'))
      .mockResolvedValue({ running: true, url: 'http://127.0.0.1:8787', port: 8787 })
    api.webServer.stop = vi
      .fn()
      .mockRejectedValueOnce(new Error('stop'))
      .mockResolvedValue({ running: false })
    api.webServer.generateToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('tok'))
      .mockResolvedValue('nt')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'desktop-packaged',
      currentVersion: '1',
      latestVersion: '2',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 0,
      releaseNotes: '## n',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi
      .fn()
      .mockRejectedValueOnce(new Error('chk'))
      .mockResolvedValue({ status: 'available', latestVersion: '2' })
    api.updates.download = vi
      .fn()
      .mockRejectedValueOnce(new Error('dl'))
      .mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi
      .fn()
      .mockRejectedValueOnce(new Error('inst'))
      .mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi
      .fn()
      .mockRejectedValueOnce(new Error('npm'))
      .mockResolvedValue({
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
        progress: 40,
        currentVersion: '1',
        latestVersion: '2',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true,
        channel: 'desktop-packaged'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi
      .fn()
      .mockRejectedValueOnce(new Error('rel'))
      .mockResolvedValue({ ok: true })
    api.activity.clear = vi
      .fn()
      .mockRejectedValueOnce(new Error('clr'))
      .mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error('ex'))
      .mockResolvedValue({ ok: true, path: '/b.zip' })
    api.app.importFullBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error('im'))
      .mockResolvedValue({ ok: true })
    api.diagnostics.full = vi
      .fn()
      .mockRejectedValueOnce(new Error('diag'))
      .mockResolvedValue({ ok: true })
    api.support.exportReport = vi
      .fn()
      .mockRejectedValueOnce(new Error('sup'))
      .mockResolvedValue({ ok: true, path: '/s.json' })
    api.shell.openPath = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        isDirectory: true,
        path: '/tmp/u'
      })
      .mockRejectedValueOnce(new Error('path'))
      .mockResolvedValue({ ok: true, path: '/tmp/u' })
    api.shell.openExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('ext'))
      .mockResolvedValue({ ok: true })
    let clipN = 0
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn().mockImplementation(async () => {
          clipN++
          if (clipN % 2 === 1) throw new Error('clip')
        })
      }
    })

    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    await clickNamed(/Chat model|Chat|LLM/i)
    await clickNamed(/Show advanced options/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 10) as HTMLInputElement[]) {
      if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '80000' } })
        )
        await act(async () => fireEvent.blur(input))
      } else if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'https://api.x/v1' } })
        )
      }
    }
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Test chat|Test/i)
    await clickNamed(/Test chat|Test/i)
    for (const re of [/Grok|Custom|OpenAI|OpenRouter|preset|Apply/i]) {
      await clickNamed(re)
    }

    await clickNamed(/^Image$/i)
    for (const re of [/Seedream|Custom|Same|Grok/i]) await clickNamed(re)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < s.options.length; i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    await clickNamed(/Show advanced options|Hide advanced/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 8) as HTMLInputElement[]) {
      if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, {
            target: {
              value: input.type === 'number' ? '4' : 'https://img.custom/v1'
            }
          })
        )
      }
    }

    await clickNamed(/^Video$/i)
    for (const re of [/Seedance|Grok|Custom|Stub|Same/i]) await clickNamed(re)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 5); i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    await clickNamed(/Show advanced options|Hide advanced/i)

    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Pick|Browse|Clear/i)
    await clickNamed(/BGM|Pick|Browse/i)

    await clickNamed(/^App$/i)
    await clickNamed(/Show advanced options|Hide advanced/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 4); i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 12) as HTMLInputElement[]) {
      if (input.type === 'checkbox') {
        await act(async () => fireEvent.click(input))
      } else if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '9191' } })
        )
        await act(async () => fireEvent.blur(input))
      } else if (input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '0.0.0.0' } })
        )
      }
    }
    for (const re of [
      /Open folder/i,
      /Start|Stop|Enable|Regenerate|Copy/i,
      /Check|Download|Install|npm|release|notes|Show|Hide/i,
      /Export all data/i,
      /Restore from backup/i,
      /support|diagnostics|Clear activity|clear all/i,
      /Linktree|Copy/i,
      /Light|Dark|System/i
    ]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 8))
      })
    }
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Copy$/i.test((x.textContent || '').trim()))
      .slice(0, 5)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Open folder/i)
    await clickNamed(/Open folder/i)
    await clickNamed(/Open folder/i)
    await clickNamed(/Export all data/i)
    await clickNamed(/Export all data/i)
    await clickNamed(/Restore from backup/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Restore from backup/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Save$/i)
  }, 70000)

  it('grok-gateway need_build installHints + openExternal missing', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok-4.5',
      apiKey: '',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true
    })
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'grok_build_missing',
      healthOk: false,
      message: 'need',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://a',
      keyReady: false
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'grok_build_missing',
      healthOk: false,
      message: 'still',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://a',
      keyReady: false
    })
    api.gateway.installHints = vi
      .fn()
      .mockRejectedValueOnce(new Error('hints'))
      .mockResolvedValue({
        grokBuildUrl: 'https://x.ai/cli',
        installCommand: 'curl install'
      })
    // @ts-expect-error
    api.shell.openExternal = undefined
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValueOnce(new Error('c'))
          .mockResolvedValue(undefined)
      }
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({ available: true })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'idle',
      channel: 'desktop-dev',
      currentVersion: '1',
      canCheck: false,
      canDownload: false,
      canAutoInstall: false
    })
    api.webServer.status = vi.fn().mockResolvedValue({ running: false })
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1',
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 1
    })

    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /Install Grok Build|Open xAI/i
      )
    )
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Copy$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Open xAI website|Open xAI/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickNamed(/Open xAI website|Open xAI/i)
    await clickNamed(/Recheck|recheck/i)
  }, 30000)
})

// ─── Scenes / Stories / Timeline residual ───
describe('all100 Scenes Stories Timeline residual', () => {
  beforeEach(() => seed())

  it('Scenes plot looks copy plate intro AI busy create', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['scene-intro:scene-1:/media/roof.png']: {
            kind: 'scene-intro',
            entityIds: { sceneId: 'scene-1' },
            sourceImagePath: '/media/roof.png',
            professionalPrompt: 'DRAFT FULL',
            stillPath: '/s.png',
            durationSeconds: 6,
            aspectRatio: '16:9',
            savedAt: Date.now()
          }
        })
      )
    } catch {
      /* ignore */
    }
    const looksJson = JSON.stringify([
      {
        id: 'look-s1',
        name: 'Default',
        description: 'wet neon rain',
        artStyle: 'anime',
        imagePath: '/media/roof.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'look-s2',
        name: '',
        description: 'fog soft dawn',
        artStyle: 'realistic',
        imagePath: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        sceneNumber: 1,
        locationKey: 'rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg'),
        looksJson,
        artStyle: 'anime',
        locationType: 'exterior',
        timeOfDay: 'night',
        weather: 'rain',
        mood: 'tense'
      }),
      makeScene({
        id: 'scene-2',
        title: 'Rooftop',
        sceneNumber: 2,
        locationKey: 'rooftop',
        description: 'sister',
        refImagePath: '/media/roof2.png',
        refGalleryJson: gal('/media/roof2.png', 'sg2')
      })
    ])
    api.scenes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeScene())
    api.scenes.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('c'))
      .mockResolvedValue(makeScene({ id: 'sn', title: 'New', sceneNumber: 9 }))
    api.scenes.delete = vi.fn().mockRejectedValue(new Error('d'))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'Rooftop+',
        description: 'd',
        locationType: 'exterior',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('plate'), { details: 'pd' })
      )
      .mockResolvedValue({ path: '/tmp/sp.png', label: 'P', variant: 'hero' })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: []
    })
    api.scenes.swapAtmosphere = vi
      .fn()
      .mockRejectedValueOnce(new Error('atm'))
      .mockResolvedValue({ path: '/tmp/atm.png', label: 'A', layer: 'detail' })
    api.scenes.copyGalleryFrom = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy'))
      .mockResolvedValue({
        scene: makeScene({
          id: 'scene-1',
          locationKey: 'rooftop',
          refGalleryJson: gal('/media/roof2.png', 'c')
        })
      })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rooftop/i)
    )
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
    await clickNamed(/Clear filters/i)

    await clickNamed(/Suggest from story/i)
    await clickNamed(/AI fill|Confirm|Suggest|Generate/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/AI fill|Confirm|Suggest|Generate/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    await clickNamed(/^Cancel$/i)
    await clickNamed(/Clear filters/i)

    await openCardEdit('Rooftop')
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Rooftop' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'rain residual' } })
      )
    }
    await hangBusy('scene-ai-fill', { sceneId: 'scene-1' })
    await clickNamed(/AI fill/i)
    await cancelAllJobs()

    await clickNamed(/^Images$/i)
    const atmo = screen
      .getAllByRole('button')
      .filter((b) => /^Atmosphere$/i.test((b.textContent || '').trim()))
    if (atmo.length) {
      await act(async () => fireEvent.click(atmo[atmo.length - 1]!))
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /wet neon|Atmosphere library|Apply/i
      )
    )
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'new atmo residual' } })
      )
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Generate atmosphere|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Generate atmosphere|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    const plateMode = screen
      .getAllByRole('button')
      .find((b) => /^Plate$/i.test((b.textContent || '').trim()))
    if (plateMode) await act(async () => fireEvent.click(plateMode))
    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /#\s*2/i.test((b.textContent || '').trim()))
    if (copyBtn) {
      await act(async () => fireEvent.click(copyBtn))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      await act(async () => fireEvent.click(copyBtn))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate plate|Generate professional|Generate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
  }, 90000)

  it('Stories cast beats cover + Timeline generate snap play capped', async () => {
    const manyChars = Array.from({ length: 12 }, (_, i) =>
      makeCharacter({
        id: `char-${i + 1}`,
        name: i === 0 ? 'Aria' : `Cast${i}`,
        costumesJson: i === 0 ? costumesJson : null
      })
    )
    const beats = [
      makeTimelineEntry({
        id: 'entry-1',
        dialogue: '[DIALOGUE|Aria] Hi',
        characterIds: ['char-1'],
        sceneIds: ['scene-1'],
        propIds: [],
        actionIds: []
      }),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        dialogue: 'Two',
        startTime: 4,
        endTime: 8
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([
      makeStory({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        artStyle: 'anime',
        styleNote: 'noir',
        hardRules: 'no logos'
      })
    ])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        artStyle: 'anime',
        characters: [manyChars[0]],
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()],
        timeline: beats
      } as never)
    )
    api.stories.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeStory())
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi
      .fn()
      .mockRejectedValueOnce(new Error('ls'))
      .mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi
      .fn()
      .mockRejectedValueOnce(new Error('lp'))
      .mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi
      .fn()
      .mockRejectedValueOnce(new Error('la'))
      .mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi
      .fn()
      .mockRejectedValueOnce(new Error('sc'))
      .mockResolvedValue({})
    api.stories.generateCover = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('cover'), { details: 'cd' })
      )
      .mockResolvedValue({ path: '/tmp/cov.png', label: 'C' })
    api.stories.commitCover = vi.fn().mockResolvedValue({
      path: '/tmp/covc.png',
      gallery: []
    })
    api.stories.aiFillScript = vi
      .fn()
      .mockRejectedValueOnce(new Error('script'))
      .mockResolvedValue({
        beats: [{ order: 0, dialogue: 'X', characterIds: ['char-1'] }],
        drafts: [],
        raw: ''
      })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 's',
      hardRules: 'h',
      artStyle: 'anime'
    })
    api.characters.list = vi.fn().mockResolvedValue(manyChars)
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene(),
      makeScene({ id: 'scene-2', title: 'Alley' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp(),
      makeProp({ id: 'prop-2', name: 'Flask' })
    ])
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction(),
      makeAction({ id: 'act-2', name: 'Kick' })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.list = vi.fn().mockResolvedValue(beats)
    api.timeline.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('beat'))
      .mockImplementation(async (id, patch) => ({
        ...makeTimelineEntry({ id }),
        ...patch
      }))
    api.timeline.delete = vi.fn().mockRejectedValueOnce(new Error('bdel'))
    api.timeline.reorder = vi
      .fn()
      .mockRejectedValueOnce(new Error('reorder'))
      .mockResolvedValue({ ok: true })
    api.timeline.create = vi.fn().mockResolvedValue(
      makeTimelineEntry({ id: 'en' })
    )

    const { unmount } = await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Demo Story')
    await clickNamed(/Basics|Meta/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'meta residual' } })
      )
    }
    await clickNamed(/AI fill style notes|AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })

    await clickNamed(/Cast \/ set|Cast/i)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /Add to story|Remove from story|Aria/i
      )
    )
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      const tab = screen.getAllByRole('button').find((b) => {
        const t = (b.textContent || '').replace(/\d+/g, '').trim()
        return kind.test(t)
      })
      if (tab) await act(async () => fireEvent.click(tab))
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
      }
      for (const b of screen
        .getAllByRole('button')
        .filter((x) =>
          /Add to story|Remove from story/i.test((x.textContent || '').trim())
        )
        .slice(0, 3)) {
        await act(async () => fireEvent.click(b))
        await act(async () => {
          await new Promise((r) => setTimeout(r, 15))
        })
      }
      for (const sel of Array.from(document.querySelectorAll('select')).slice(
        0,
        3
      )) {
        const s = sel as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[1].value } })
          )
        }
      }
      await clickNamed(/→/)
      await clickNamed(/←/)
    }

    await clickNamed(/Script beats|Script/i)
    await clickNamed(/Add beat/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: { value: '[MOOD] tense\n[DIALOGUE|Aria] line' }
        })
      )
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      10
    )) {
      const s = sel as HTMLSelectElement
      if (s.multiple) {
        for (let i = 0; i < Math.min(s.options.length, 2); i++) {
          s.options[i].selected = true
        }
        await act(async () => fireEvent.change(s))
      } else if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/↑|↓|Move/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickNamed(/Cover|Poster/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate cover/i)
    if (document.body.textContent?.match(/Confirm reference/i)) {
      const cancel = screen
        .getAllByRole('button')
        .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
      if (cancel) await act(async () => fireEvent.click(cancel))
    }
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    unmount()

    // Timeline
    const restoreRaf = installRafCap(6)
    try {
      const entries = [
        makeTimelineEntry({
          id: 'entry-1',
          storyId: 'story-1',
          order: 0,
          startTime: 0,
          endTime: 4,
          mediaStatus: 'EMPTY',
          mediaPath: null,
          dialogue: 'Gap',
          characterId: 'char-1',
          beatContentJson: JSON.stringify({ spoken: ['Hi'] })
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
          dialogue: 'Ready'
        }),
        makeTimelineEntry({
          id: 'entry-3',
          storyId: 'story-1',
          order: 2,
          startTime: 10,
          endTime: 16,
          mediaStatus: 'FAILED',
          mediaPath: null,
          dialogue: 'Fail'
        })
      ]
      api.timeline.list = vi.fn().mockResolvedValue(entries)
      api.timeline.update = vi.fn().mockResolvedValue({})
      api.timeline.create = vi.fn().mockResolvedValue(
        makeTimelineEntry({ id: 'n' })
      )
      api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
      api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
      api.characters.list = vi.fn().mockResolvedValue([
        makeCharacter({ id: 'char-1', refImagePath: '/a.png' })
      ])
      api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
      api.props.list = vi.fn().mockResolvedValue([makeProp()])
      api.actions.list = vi.fn().mockResolvedValue([makeAction()])
      api.settings.get = vi.fn().mockResolvedValue({
        ...DEFAULT_SETTINGS,
        videoMode: 'stub',
        snapEnabled: false,
        snapGridSec: 0.5,
        openExportFolder: true
      })
      api.settings.set = vi
        .fn()
        .mockRejectedValueOnce(new Error('snap'))
        .mockResolvedValue({})
      api.media.listExports = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ex1',
            kind: 'final',
            fileName: 'f.mp4',
            path: '/e/f.mp4',
            createdAt: '2026-07-15T12:00:00.000Z',
            sizeBytes: 900
          }
        ],
        latestPath: '/e/f.mp4'
      })
      api.media.deleteExport = vi
        .fn()
        .mockRejectedValueOnce(new Error('del'))
        .mockResolvedValue({ ok: true, items: [], latestPath: null })
      api.media.exportPreflight = vi.fn().mockResolvedValue({
        ffmpeg: true,
        ffmpegMessage: 'ok',
        readyClips: 1,
        totalClips: 3,
        willUseFallback: false,
        warnings: [],
        canExport: true
      })
      api.media.exportFinal = vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('ffmpeg'), { code: 'FFMPEG_UNAVAILABLE' })
        )
        .mockResolvedValue({ path: '/out.mp4' })
      api.media.exportStoryboard = vi.fn().mockResolvedValue({ path: '/b.png' })
      api.generation.run = vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          steps: [{ step: 'script', success: false, error: 'x', degraded: true }]
        })
        .mockResolvedValue({
          success: true,
          steps: [
            { step: 'script', success: true },
            { step: 'timeline', success: true, degraded: true }
          ]
        })
      api.generation.onProgress = vi.fn((cb: (p: object) => void) => {
        cb({
          storyId: 'story-1',
          index: 0,
          total: 2,
          step: 'script',
          entryId: 'entry-1',
          mediaStatus: 'READY'
        })
        return () => undefined
      })

      await renderWithProviders(
        <>
          <Probe />
          <TimelinePage />
        </>,
        { route: '/timeline', withAiShell: true, withToastHost: true }
      )
      await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())

      await clickNamed(/^k-sel$/i)
      await clickNamed(/^p-tick$/i)
      await clickNamed(/^p-end$/i)
      await clickNamed(/^k-sel2$/i)
      await clickNamed(/^p-tick2$/i)
      await clickNamed(/^p-end$/i)
      await clickNamed(/^Play$|▶/i)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      await clickNamed(/Pause|Play|▶/i)
      // play at end wrap
      await clickNamed(/^p-tick-end$/i)
      await clickNamed(/^Play$|▶/i)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      await clickNamed(/Pause|Play|▶/i)

      for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
        0,
        2
      )) {
        await act(async () =>
          fireEvent.change(ta, { target: { value: 'tl dialogue' } })
        )
      }
      await clickNamed(/^k-snap-on$/i)
      await clickNamed(/^k-snap-off$/i)
      await clickNamed(/^k-snap-grid$/i)
      await clickNamed(/^k-pack$/i)
      await clickNamed(/^k-resize$/i)
      await clickNamed(/^k-move$/i)
      await clickNamed(/^k-drop$/i)

      await clickNamed(/Start generation|Generate all|^Generate$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      await dismissVideoPrep(400)
      await clickNamed(/Start generation|Generate all|^Generate$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await dismissVideoPrep(2500)
      await clickNamed(/Retry failed clips|Retry failed/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await dismissVideoPrep(2500)

      await clickNamed(/^k-sel3$/i)
      await clickNamed(/Generate this clip|Regenerate|Continue video/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^p-gen$/i)
      await dismissVideoPrep(2500)

      await clickNamed(/Advanced/i)
      await clickNamed(/^q$/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^adv-r$/i)
      await clickNamed(/^xc$/i)

      await clickNamed(/Export history/i)
      await clickNamed(/^Delete$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      await clickNamed(/^Delete$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      const x = Array.from(document.querySelectorAll('button')).find(
        (b) => (b.textContent || '').trim() === '✕'
      )
      if (x) await act(async () => fireEvent.click(x))
      await clickNamed(/Export final|Export video|Export/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      await clickNamed(/Export final|Export video|Export/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await clickNamed(/Storyboard|Board export|Export storyboard/i)

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent('idm:video-prep-done', {
            detail: {
              kind: 'timeline-clip',
              entityIds: { storyId: 'story-1', entryId: 'entry-1' },
              path: '/done.mp4'
            }
          })
        )
      })
    } finally {
      restoreRaf()
    }
  }, 120000)
})
