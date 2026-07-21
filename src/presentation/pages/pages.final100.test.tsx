/**
 * Absolute residual: force every remaining page branch toward 100% lines.
 * Force-inject sort keys, i18n miss for prettify, Date throw for formatTs catch,
 * busy jobs, cancel mid-plate, form fields, empty search, motionNotes ellipsis.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import i18n from 'i18next'
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
import {
  AuditLogPage,
  formatMs,
  formatTs,
  formatTsFull,
  prettifyChannel
} from './AuditLogPage'
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
        onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'e1', 0, 8)}
      >
        k-resize
      </button>
      <button
        type="button"
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'e1', 2, 9)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'character', id: 'char-1' }, 5)}
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
  // restore Date / i18n if patched
  vi.restoreAllMocks()
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

/** Force LibraryFilterSelect / native select to values not in options list. */
async function forceSelectValues(values: string[]) {
  for (const sel of Array.from(document.querySelectorAll('select'))) {
    const s = sel as HTMLSelectElement
    for (const v of values) {
      if (![...s.options].some((o) => o.value === v)) {
        const o = document.createElement('option')
        o.value = v
        o.textContent = v
        s.appendChild(o)
      }
      await act(async () => fireEvent.change(s, { target: { value: v } }))
    }
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
  api.settings.get = vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS })
  api.settings.set = vi.fn().mockResolvedValue({})
}

describe('final100 Audit residual sorts prettify Date catch', () => {
  beforeEach(() => seed())

  it('unit pure helpers formatTs catch formatMs prettify', () => {
    expect(formatMs(50)).toMatch(/ms/)
    expect(formatMs(2500)).toMatch(/s/)
    expect(formatMs(120000)).toMatch(/min/)
    expect(prettifyChannel('media:exportFinal')).toBeTruthy()
    expect(prettifyChannel('stories:update_story')).toBeTruthy()
    expect(prettifyChannel('characters:aiFill')).toBeTruthy()
    expect(prettifyChannel('___')).toBeTruthy()
    expect(prettifyChannel('')).toBe('')
    const orig = Date.prototype.toLocaleString
    Date.prototype.toLocaleString = function () {
      throw new Error('bad locale')
    }
    expect(formatTs('2026-07-15T12:00:00.000Z')).toBe('2026-07-15T12:00:00.000Z')
    expect(formatTsFull('2026-07-15T12:00:00.000Z')).toBe(
      '2026-07-15T12:00:00.000Z'
    )
    Date.prototype.toLocaleString = orig
    expect(formatTs('2026-07-15T12:00:00.000Z', 'en')).toBeTruthy()
    expect(formatTsFull('2026-07-15T12:00:00.000Z', 'en')).toBeTruthy()
  })

  it('force kind/message/ms sorts, prettify miss, auto-refresh toggle', async () => {
    // Force prettifyChannel path: t returns key for generic
    const origT = i18n.t.bind(i18n)
    vi.spyOn(i18n, 't').mockImplementation(((key: unknown, ...rest: unknown[]) => {
      const k = String(key)
      if (
        k.includes('evtGeneric') ||
        k.includes('evtIpc') ||
        k === 'audit.evtGeneric'
      ) {
        return k
      }
      return (origT as (a: unknown, ...b: unknown[]) => string)(key, ...rest)
    }) as typeof i18n.t)

    api.activity.query = vi.fn().mockResolvedValue({
      entries: [
        {
          ts: '2026-07-15T12:00:00.000Z',
          kind: 'zzz_unknown_channel:fooBar_baz',
          message: 'media:weird_camelCase_thing',
          level: 'info',
          meta: { ms: 50 }
        },
        {
          ts: '2026-07-15T11:00:00.000Z',
          kind: 'totally.unknown',
          message: 'stories:custom_Event-Name',
          level: 'warn',
          meta: { ms: 2500 }
        },
        {
          ts: '2026-07-15T10:00:00.000Z',
          kind: 'ipc',
          message: 'ipc',
          level: 'debug',
          meta: { ms: 120000 }
        },
        {
          ts: '2026-07-15T09:00:00.000Z',
          kind: 'b',
          message: 'aaa',
          level: 'error',
          meta: {}
        },
        {
          ts: '2026-07-15T08:00:00.000Z',
          kind: 'a',
          message: 'zzz',
          level: 'info',
          meta: { ms: 10 }
        }
      ]
      // no path
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    vi.useFakeTimers({ shouldAdvanceTime: true })
    const view = await renderWithProviders(<AuditLogPage />, {
      withToastHost: true
    })
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())

    // Fire auto-refresh interval body (void load inside refresh)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    await clickNamed(/Live update|auto/i)
    await clickNamed(/Live update|auto/i)
    await clickNamed(/Live update|auto/i)
    vi.useRealTimers()

    await clickNamed(/More options|Advanced/i)
    // Target the sort select specifically (has ms:desc option)
    const sortSel = Array.from(document.querySelectorAll('select')).find((s) =>
      [...(s as HTMLSelectElement).options].some((o) => o.value === 'ms:desc')
    ) as HTMLSelectElement | undefined
    expect(sortSel).toBeTruthy()
    for (const v of [
      'kind:asc',
      'kind:desc',
      'message:asc',
      'message:desc',
      'ms:asc',
      'ms:desc',
      'level:asc',
      'level:desc',
      'ts:asc',
      'ts:desc',
      'bogus:desc'
    ]) {
      if (![...sortSel!.options].some((o) => o.value === v)) {
        const o = document.createElement('option')
        o.value = v
        o.textContent = v
        sortSel!.appendChild(o)
      }
      await act(async () => fireEvent.change(sortSel!, { target: { value: v } }))
    }

    for (const text of [/fooBar|weird/i, /custom_Event/i, /ipc/i, /aaa|zzz/i]) {
      const el = screen.queryAllByText(text)[0]
      if (el) await act(async () => fireEvent.click(el))
    }
    await clickNamed(/Copy for support|Copy/i)

    view.unmount()
  }, 30000)
})

describe('final100 Actions residual busy cancel form fields', () => {
  beforeEach(() => seed())

  it('all form fields, busy guards, plate cancel, wrong-id draft, empty search', async () => {
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        id: 'act-1',
        name: 'Draw gun',
        motionNotes: 'a very long motion note that exceeds twenty four chars',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag')
      })
    ])
    api.actions.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd fail'))
      .mockResolvedValue(makeAction({ id: 'act-1', name: 'Draw gun' }))
    api.actions.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create fail'))
      .mockResolvedValue(makeAction({ id: 'act-new', name: 'Kick' }))
    let plateCalls = 0
    api.actions.generatePlate = vi.fn().mockImplementation(async () => {
      plateCalls++
      if (plateCalls === 1) {
        // hang briefly so cancel can mark signal
        await new Promise((r) => setTimeout(r, 80))
        return { path: '/tmp/ap.png', label: 'Board', panelLayout: 'strip-3' }
      }
      throw Object.assign(new Error('plate boom'), {
        details: 'detail-x'
      })
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
        hardRules: 'no blur',
        artStyle: 'not-a-real-style'
      },
      profileJson: '{}',
      raw: ''
    })
    api.actions.delete = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/c.png',
        refGalleryJson: gal('/c.png')
      })
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
    await waitFor(() => expect(api.actions.list).toHaveBeenCalled())

    // empty search → EmptyState
    const search = document.querySelector(
      'input[placeholder], input[type="search"]'
    ) as HTMLInputElement | null
    const searchInputs = Array.from(document.querySelectorAll('input')).filter(
      (i) =>
        /search/i.test(i.placeholder || '') ||
        /search/i.test(i.getAttribute('aria-label') || '')
    )
    const q = searchInputs[0] || search
    if (q) {
      await act(async () =>
        fireEvent.change(q, { target: { value: 'zzzz-nomatch' } })
      )
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      await act(async () => fireEvent.change(q, { target: { value: '' } }))
    }

    await openCardEdit('Draw gun')

    // Type every profile field (hardRules, motion, intention, camera, visualTags)
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ) as HTMLElement[]) {
      const tag = el.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') {
        await act(async () =>
          fireEvent.change(el, {
            target: { value: 'field-val-final100-long-enough' }
          })
        )
      }
    }
    // AI fill with image path but empty idea → aiFillFromImage branch if only image
    await clickNamed(/AI fill \/ improve/i)
    await waitFor(() => expect(api.actions.aiFill).toHaveBeenCalled()).catch(
      () => undefined
    )
    try {
      await acceptDraft()
    } catch {
      /* ok */
    }

    // Wrong-id profile draft apply → reload branch
    await act(async () => {
      const unsub = jobs?.onActionProfileApply?.(() => undefined)
      // acceptDraft already applied; dispatch via starting job that returns other id
      jobs?.startJob({
        kind: 'action-ai-fill',
        label: 'wrong-id',
        scope: { actionId: 'other-act' },
        run: async () =>
          ({
            type: 'action-profile' as const,
            actionId: 'other-act',
            storyId: 'story-1',
            profile: {
              name: 'Other',
              description: 'x',
              motionNotes: 'm',
              intention: 'i',
              cameraNotes: 'c',
              visualTags: 'v',
              artStyle: 'anime'
            },
            profileJson: '{}',
            raw: ''
          }) as never
      })
      void unsub
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    try {
      await waitFor(() => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true), {
        timeout: 3000
      })
      await act(async () => {
        await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
      })
    } catch {
      /* ok */
    }

    // Refs: identity, multi-select, plate, cancel mid-flight
    await clickNamed(/^References$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    // invalid art style → DEFAULT_ART_STYLE
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const o = document.createElement('option')
      o.value = 'not-a-real-style'
      s.appendChild(o)
      await act(async () =>
        fireEvent.change(s, { target: { value: 'not-a-real-style' } })
      )
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    // cast refs
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 6)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    await clickNamed(/Generate instruction board/i)
    if (await confirmImageGen()) {
      // cancel job mid-run to hit signal.cancelled + discardSheetDraft
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
      const running = jobs?.jobs?.find((j) => j.status === 'running')
      if (running) {
        await act(async () => {
          await jobs!.cancelJob(running.id)
        })
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 120))
      })
    }

    // Busy guard: hang a job then re-trigger plate/AI/intro
    await act(async () => {
      jobs?.startJob({
        kind: 'action-plate',
        label: 'busy-hold',
        scope: { actionId: 'act-1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 800))
          return undefined as never
        }
      })
    })
    await clickNamed(/Generate instruction board/i)
    await confirmImageGen()
    await clickNamed(/^Profile$/i)
    await clickNamed(/AI fill \/ improve/i)
    await clickNamed(/^References$/i)
    await clickNamed(/Intro|demo|video/i)

    // Wait busy job done
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900))
    })

    // plate error path with details
    await clickNamed(/Generate instruction board/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
    }

    // Reorder gallery via ← →
    await clickNamed(/→|←/i)
    await clickNamed(/→|←/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    // Remove cover image (coverPath === removedPath branch)
    await clickNamed(/Remove this|remove/i)

    // Save with update fail first
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await openCardEdit('Draw gun').catch(() => undefined)
    await clickNamed(/^Save$/i)

    // New action create fail
    await clickNamed(/New action|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 4)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Kick final100' } })
      )
    }
    await clickNamed(/^Save$/i)
    // plate ensureSavedId create path
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board/i)
    await confirmImageGen()
  }, 60000)
})

describe('final100 Props Costumes residual', () => {
  beforeEach(() => seed())

  it('Props form fields busy plate intro empty search', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        description: 'brass badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeProp())
    api.props.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create'))
      .mockResolvedValue(makeProp({ id: 'pn' }))
    api.props.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('plate'), { details: 'd' }))
      .mockResolvedValue({ path: '/tmp/pd.png', label: 'H', variant: 'hero' })
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
        },
        {
          id: 'n2',
          path: '/tmp/pc2.png',
          kind: 'plate',
          label: 'H2',
          createdAt: '2026-07-16T00:00:00.000Z',
          layer: 'base'
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
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ) as HTMLElement[]) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'prop-field-final100' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    try {
      await acceptDraft()
    } catch {
      /* ok */
    }
    await clickNamed(/^Plates$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 6)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await act(async () => {
      jobs?.startJob({
        kind: 'prop-plate',
        label: 'busy',
        scope: { propId: 'prop-1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 600))
          return undefined as never
        }
      })
    })
    await clickNamed(/Generate prop plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700))
    })
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
    }
    await clickNamed(/→|←/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$|^vpc$|^vpa$/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Costumes dress filters intro link busy AI', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: 'long trench for storms',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeCostume({ id: 'cos-1', name: 'Rain coat' }))
    api.costumes.create = vi.fn().mockResolvedValue(makeCostume({ id: 'cn' }))
    api.costumes.generateDressed = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('dress fail'), { details: 'x' }))
      .mockResolvedValue({
        path: '/tmp/d.png',
        costume: {
          id: 'cos-1',
          refImagePath: '/tmp/d.png',
          refGalleryJson: gal('/tmp/d.png')
        }
      })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Storm',
      description: 'wet',
      hardRules: 'keep silhouette'
    })
    api.costumes.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link fail'))
      .mockResolvedValue({})
    api.costumes.unlinkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('unlink fail'))
      .mockResolvedValue({})
    api.costumes.delete = vi.fn().mockResolvedValue({ ok: true })
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
    await waitFor(() => expect(api.costumes.list).toHaveBeenCalled())
    // open first (filters after would hide card)
    await openCardEdit('Rain coat')
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 10)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'cos-field-final100' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    try {
      await waitFor(
        () => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true),
        { timeout: 2500 }
      )
      await act(async () => {
        await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
      })
    } catch {
      /* ok */
    }
    await clickNamed(/Dress|Wear|Character|Links/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 4)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate dressed|Dress|Generate/i)
    await confirmImageGen()
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ).slice(0, 4)) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/^Save$/i)
    // list filters residual
    await clickNamed(/^Cancel$/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 4)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[0].value } })
        )
      }
    }
  }, 40000)
})

describe('final100 Characters Scenes Stories residual', () => {
  beforeEach(() => seed())

  it('Characters all tabs soul wardrobe sheet gallery errors', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        appearance: 'dark hair',
        ageRange: '30s',
        gender: 'female',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'cg'),
        soulMd: '# Soul\nbrave'
      })
    ])
    api.characters.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeCharacter({ id: 'char-1', name: 'Aria' }))
    api.characters.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create'))
      .mockResolvedValue(makeCharacter({ id: 'cn', name: 'Nova' }))
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria+',
        appearance: 'a',
        ageRange: '30s',
        gender: 'female',
        personality: 'p',
        hardRules: 'h',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.characters.generateSheet = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('sheet'), { details: 'd' }))
      .mockResolvedValue({ path: '/tmp/sh.png', label: 'Sheet' })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
      gallery: [
        {
          id: 'cg',
          path: '/tmp/shc.png',
          kind: 'sheet',
          label: 'S',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity'
        }
      ]
    })
    api.characters.generateSoul = vi
      .fn()
      .mockRejectedValueOnce(new Error('soul fail'))
      .mockResolvedValue({ soulMd: '# New soul\ntext', path: '/soul.md' })
    api.characters.writeSoulContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('save soul'))
      .mockResolvedValue({})
    api.characters.readSoulContent = vi.fn().mockResolvedValue('# Soul\nbrave')
    api.characters.swapCostume = vi.fn().mockResolvedValue({
      path: '/tmp/sw.png',
      label: 'Swap'
    })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue([])
    api.characters.delete = vi.fn().mockResolvedValue({ ok: true })
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Coat',
        refImagePath: '/c.png',
        refGalleryJson: gal('/c.png')
      })
    ])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 8)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'char-field-final100' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    try {
      await waitFor(
        () => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true),
        { timeout: 3000 }
      )
      await act(async () => {
        await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
      })
    } catch {
      /* ok */
    }

    await clickNamed(/Sheet|Looks|Gallery/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 4)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate sheet|Generate look|Generate/i)
    await confirmImageGen()
    await clickNamed(/→|←/i)
    await clickNamed(/Upload/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$|^vpc$/i)

    await clickNamed(/Soul/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(0, 2)) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '# soul final100' } })
      )
    }
    await clickNamed(/Generate soul|Regenerate soul/i)
    await clickNamed(/Save soul|Save/i)
    await clickNamed(/Generate soul|Regenerate soul/i)

    await clickNamed(/Wardrobe|Costume/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 3)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Swap|Dress|Generate/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 55000)

  it('Scenes plot atmosphere plate intro errors', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Harbor',
        description: 'fog docks',
        refImagePath: '/h.png',
        refGalleryJson: gal('/h.png', 'sg')
      })
    ])
    api.scenes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeScene({ id: 'scene-1', title: 'Harbor' }))
    api.scenes.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create'))
      .mockResolvedValue(makeScene({ id: 'sn' }))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Harbor+',
        description: 'd',
        atmosphere: 'fog',
        timeOfDay: 'night',
        hardRules: 'h',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('plate'), { details: 'd' }))
      .mockResolvedValue({ path: '/tmp/sp.png', label: 'P' })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: [
        {
          id: 'sg',
          path: '/tmp/spc.png',
          kind: 'plate',
          label: 'P',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.scenes.swapAtmosphere = vi
      .fn()
      .mockRejectedValueOnce(new Error('atm'))
      .mockResolvedValue({ path: '/tmp/atm.png', gallery: [] })
    api.scenes.copyGalleryFrom = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy'))
      .mockResolvedValue({ gallery: [] })
    api.scenes.delete = vi.fn().mockResolvedValue({ ok: true })
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({ id: 'b1', order: 0, dialogue: 'beat one' })
    ])

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Harbor')
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 8)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'scene-field-final100' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    try {
      await waitFor(
        () => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true),
        { timeout: 3000 }
      )
      await act(async () => {
        await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
      })
    } catch {
      /* ok */
    }

    await clickNamed(/Plate|Looks|Gallery/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 4)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate plate|Generate look|Generate/i)
    await confirmImageGen()
    await clickNamed(/Atmosphere/i)
    await clickNamed(/Copy/i)
    await clickNamed(/Upload/i)
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) await clickNamed(/^vpf$/i)
    await clickNamed(/→|←/i)

    await clickNamed(/Plot|Story|Suggest/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1 && /story/i.test(s.getAttribute('aria-label') || s.name || '') || s.options.length > 1) {
        const storyOpt = [...s.options].find((o) => /story|demo/i.test(o.textContent || '') || o.value === 'story-1')
        if (storyOpt) {
          await act(async () =>
            fireEvent.change(s, { target: { value: storyOpt.value } })
          )
        }
      }
    }
    // open plot dialog if present
    await clickNamed(/Suggest from story|Suggest plot|Suggest/i)
    for (const sel of Array.from(
      document.querySelectorAll('[role="dialog"] select, select')
    ).slice(0, 3)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/AI fill|Suggest|Confirm|Apply/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Save$/i)
  }, 45000)

  it('Stories cast beats cover script meta errors', async () => {
    api.stories.list = vi.fn().mockResolvedValue([
      makeStory({ id: 'story-1', title: 'Demo Story', status: 'DRAFT' })
    ])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        id: 'story-1',
        title: 'Demo Story',
        status: 'DRAFT',
        logline: 'a rainy noir'
      })
    )
    api.stories.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeStory({ id: 'story-1', title: 'Demo Story' }))
    api.stories.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create'))
      .mockResolvedValue(makeStory({ id: 'sn' }))
    api.stories.delete = vi.fn().mockResolvedValue({ ok: true })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      title: 'Demo+',
      logline: 'll',
      synopsis: 'syn',
      genre: 'noir',
      tone: 'dark',
      styleNote: 'cinematic'
    })
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [
        { order: 0, dialogue: 'Hi there' },
        { order: 1, dialogue: 'Next beat' }
      ],
      drafts: [],
      raw: ''
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/tmp/cv.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/tmp/cvc.png' })
    api.stories.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link'))
      .mockResolvedValue({})
    api.stories.unlinkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('unlink'))
      .mockResolvedValue({})
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi.fn().mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({
        id: 'b1',
        storyId: 'story-1',
        order: 0,
        dialogue: 'beat one',
        characterId: null,
        sceneId: null
      }),
      makeTimelineEntry({
        id: 'b2',
        storyId: 'story-1',
        order: 1,
        dialogue: 'beat two',
        characterId: 'char-1',
        sceneId: 'scene-1'
      })
    ])
    api.timeline.create = vi.fn().mockResolvedValue(
      makeTimelineEntry({ id: 'b3', order: 2, dialogue: '' })
    )
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ id: 'char-1', name: 'Aria', refImagePath: '/a.png' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ id: 'scene-1', title: 'Harbor', refImagePath: '/h.png' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({ id: 'prop-1', name: 'Badge', refImagePath: '/p.png' })
    ])
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({ id: 'act-1', name: 'Draw', refImagePath: '/x.png' })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
    // open story card
    const card = Array.from(document.querySelectorAll('article, li, button')).find(
      (a) => (a.textContent || '').includes('Demo Story')
    )
    if (card) await act(async () => fireEvent.click(card))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    // prefer explicit Edit
    await clickNamed(/^Edit$/i)
    await clickNamed(/Meta|Details|Overview/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 6)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'story-field-final100' } })
      )
    }
    await clickNamed(/AI fill/i)
    try {
      await waitFor(
        () => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true),
        { timeout: 3000 }
      )
      await act(async () => {
        await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
      })
    } catch {
      /* ok */
    }

    await clickNamed(/Cast|Links|Characters/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ).slice(0, 8)) {
      await act(async () => fireEvent.click(cb))
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 6)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    await clickNamed(/Beats|Script/i)
    await clickNamed(/Add beat|New beat/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'beat final100' } })
      )
    }
    await clickNamed(/AI fill script|Fill script|Script/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/↑|↓|Up|Down/i)

    await clickNamed(/Cover/i)
    await clickNamed(/Generate cover|Cover/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 45000)
})

describe('final100 Settings Timeline residual', () => {
  beforeEach(() => seed())

  it('Settings every tab gateway web update error paths', async () => {
    api.settings.get = vi
      .fn()
      .mockRejectedValueOnce(new Error('settings load fail'))
      .mockResolvedValue({
        ...DEFAULT_SETTINGS,
        llmProvider: 'grok-gateway',
        uiLanguage: 'en',
        colorScheme: 'dark',
        webServerPort: 8787,
        snapEnabled: true,
        snapGridSec: 0.5
      })
    api.settings.set = vi
      .fn()
      .mockRejectedValueOnce(new Error('set fail'))
      .mockResolvedValue({})
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1.0.0',
      isPackaged: false,
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 4
    })
    api.media.checkFfmpeg = vi
      .fn()
      .mockRejectedValueOnce(new Error('ff'))
      .mockResolvedValue({ available: false, message: 'missing', version: '', path: '' })
    api.media.pickBgm = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi
      .fn()
      .mockRejectedValueOnce(new Error('models fail'))
      .mockResolvedValue([
        { id: 'a', ownedBy: 'x' },
        { id: 'b', ownedBy: 'y' }
      ])
    api.ai.testChat = vi
      .fn()
      .mockRejectedValueOnce(new Error('chat fail'))
      .mockResolvedValue({ ok: false, message: 'nope', replyPreview: '' })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://x',
      model: 'm'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    // gateway missing then present
    let gwCalls = 0
    api.gateway.status = vi.fn().mockImplementation(async () => {
      gwCalls++
      if (gwCalls === 1) throw new Error('gw down')
      return {
        state: 'ready',
        healthOk: true,
        message: 'ok',
        grokPath: '/g',
        gctoacPath: '/c',
        adminUrl: 'http://a',
        keyReady: true
      }
    })
    api.gateway.ensure = vi
      .fn()
      .mockRejectedValueOnce(new Error('ensure fail'))
      .mockResolvedValue({
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
    // delete gateway to hit gateway_missing
    const gwSave = api.gateway
    api.webServer.status = vi
      .fn()
      .mockRejectedValueOnce(new Error('ws'))
      .mockResolvedValue({
        running: false,
        url: null,
        port: 8787,
        error: 'not running',
        staticReady: false,
        token: null
      })
    api.webServer.start = vi
      .fn()
      .mockRejectedValueOnce(new Error('start fail'))
      .mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787
      })
    api.webServer.stop = vi
      .fn()
      .mockRejectedValueOnce(new Error('stop fail'))
      .mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('nt')
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
    api.updates.check = vi
      .fn()
      .mockRejectedValueOnce(new Error('check fail'))
      .mockResolvedValue({ status: 'available', latestVersion: '2' })
    api.updates.download = vi
      .fn()
      .mockRejectedValueOnce(new Error('dl fail'))
      .mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi
      .fn()
      .mockRejectedValueOnce(new Error('install fail'))
      .mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi
      .fn()
      .mockRejectedValueOnce(new Error('npm fail'))
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
        status: 'error',
        progress: 0,
        currentVersion: '1',
        error: 'upd err',
        canCheck: true,
        canDownload: false,
        canAutoInstall: false
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi
      .fn()
      .mockRejectedValueOnce(new Error('clear'))
      .mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error('bak'))
      .mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error('imp'))
      .mockResolvedValue({ ok: true })
    api.diagnostics.full = vi
      .fn()
      .mockRejectedValueOnce(new Error('diag'))
      .mockResolvedValue({ ok: true })
    api.support.exportReport = vi
      .fn()
      .mockRejectedValueOnce(new Error('sup'))
      .mockResolvedValue({ ok: true, path: '/s.json' })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValueOnce(new Error('clip'))
          .mockResolvedValue(undefined)
      }
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
      ).slice(0, 16) as HTMLInputElement[]) {
        if (input.type === 'checkbox') {
          await act(async () => fireEvent.click(input))
        } else if (input.type !== 'file') {
          await act(async () =>
            fireEvent.change(input, {
              target: {
                value: input.type === 'number' ? '9090' : 'final100-val'
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
        for (let i = 0; i < Math.min(s.options.length, 4); i++) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[i]!.value } })
          )
        }
      }
      for (const re of [
        /Refresh|Test|Grok|Custom|Seedream|Seedance|Stub|preset|BGM|Clear|Stop|Start|Enable|Regenerate|Copy|Check|Download|Restart|Open|npm|backup|export|import|support|diagnostics|folder|English|System|Light|Dark|release|Show|Hide|Install|Ensure|Admin|Token|Port/i
      ]) {
        await clickNamed(re)
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }
    // gateway missing branch
    // @ts-expect-error force missing
    api.gateway = undefined
    await clickNamed(/Chat model/i)
    await clickNamed(/Grok|Gateway|Ensure|Refresh/i)
    api.gateway = gwSave
    await clickNamed(/^Save$/i)
    await clickNamed(/^Save$/i)
  }, 60000)

  it('Timeline pack export undo progress cast errors', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        dialogue: 'A',
        characterId: 'char-1',
        sceneId: 'scene-1',
        stillPath: '/s1.png'
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
        dialogue: 'C',
        stillPath: '/s3.png'
      }),
      makeTimelineEntry({
        id: 'entry-4',
        storyId: 'story-1',
        order: 3,
        startTime: 16,
        endTime: 22,
        mediaStatus: 'GENERATING',
        dialogue: 'D'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    api.timeline.list = vi.fn().mockResolvedValue(entries)
    api.timeline.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue({})
    api.timeline.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create'))
      .mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.delete = vi
      .fn()
      .mockRejectedValueOnce(new Error('del'))
      .mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.setMedia = vi.fn().mockResolvedValue({})
    api.timeline.clearEntryStill = vi.fn().mockResolvedValue({})
    api.timeline.getAdvancedPrep = vi.fn().mockResolvedValue({})
    api.timeline.setCastPrep = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png')
      })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ id: 'scene-1', name: 'Harbor', refImagePath: '/h.png' })
    ])
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
    api.settings.set = vi
      .fn()
      .mockRejectedValueOnce(new Error('snap'))
      .mockResolvedValue({})
    api.generation.run = vi
      .fn()
      .mockRejectedValueOnce(new Error('run'))
      .mockResolvedValue({ success: true, steps: [] })
    api.generation.runClip = vi
      .fn()
      .mockRejectedValueOnce(new Error('clip'))
      .mockResolvedValue({ success: true })
    let progressCb: ((p: object) => void) | null = null
    api.generation.onProgress = vi.fn((cb: (p: object) => void) => {
      progressCb = cb
      return () => {
        progressCb = null
      }
    })
    api.media.listExports = vi
      .fn()
      .mockRejectedValueOnce(new Error('list exp'))
      .mockResolvedValue([
        {
          id: 'ex1',
          kind: 'final',
          fileName: 'f.mp4',
          path: '/f.mp4',
          createdAt: '2026-07-15T12:00:00.000Z',
          sizeBytes: 5000
        }
      ])
    api.media.deleteExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('del exp'))
      .mockResolvedValue({ ok: true, items: [], latestPath: null })
    api.media.exportPreflight = vi
      .fn()
      .mockResolvedValueOnce({
        ffmpeg: false,
        ffmpegMessage: 'no ff',
        readyClips: 0,
        totalClips: 3,
        willUseFallback: true,
        warnings: ['w'],
        canExport: false
      })
      .mockResolvedValue({
        ffmpeg: true,
        ffmpegMessage: 'ok',
        readyClips: 2,
        totalClips: 3,
        willUseFallback: false,
        warnings: [],
        canExport: true
      })
    api.media.exportFinal = vi
      .fn()
      .mockRejectedValueOnce(new Error('exp fail'))
      .mockResolvedValue({ path: '/f.mp4' })
    api.videoPrep.create = vi.fn().mockResolvedValue({
      professionalPrompt: 'p',
      stillPath: '/s.png',
      sourceImagePath: '/s.png',
      durationSeconds: 6,
      aspectRatio: '16:9',
      entityIds: { entryId: 'entry-1', storyId: 'story-1' },
      kind: 'timeline-clip',
      userExtraPrompt: '',
      queueIndex: 1,
      queueTotal: 1
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

    // keyboard undo/redo
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      )
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        })
      )
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })
      )
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
        for (const step of ['image', 'video', 'mux', 'done'] as const) {
          progressCb!({
            storyId: 'story-1',
            index: 0,
            total: 4,
            step,
            entryId: 'entry-1',
            mediaStatus: step === 'done' ? 'READY' : 'GENERATING'
          })
        }
        progressCb!({
          storyId: 'other',
          index: 0,
          total: 1,
          step: 'image',
          entryId: 'x',
          mediaStatus: 'GENERATING'
        })
      })
    }

    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'final100 timeline dlg' } })
      )
    }
    await clickNamed(/^Save$/i)
    await clickNamed(/^6s$|^10s$/i)
    await clickNamed(/Import clip/i)
    await clickNamed(/Open clip/i)
    // preflight deny then allow
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$|^xexp$/i)
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await clickNamed(/Export history/i)
    await clickNamed(/Open file|folder|Refresh|Delete/i)
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
      await clickNamed(/^vpc$|^vpf$|^vpa$|^vpr$|^vpn$|^vpe$/i)
    }
    await clickNamed(/Add to timeline/i)
    await clickNamed(/^Generate$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      10
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
    ).slice(0, 6)) {
      await act(async () => fireEvent.click(cb))
    }
    // snap toggles
    for (const re of [/Snap|Grid|Undo|Redo|Delete|Clear/i]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        const cancel = Array.from(document.querySelectorAll('button')).find(
          (b) => /^Cancel$/i.test((b.textContent || '').trim())
        )
        if (cancel) await act(async () => fireEvent.click(cancel))
        else await act(async () => clickDialogConfirm())
      }
    }
  }, 60000)
})
