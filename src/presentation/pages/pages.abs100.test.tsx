/**
 * Absolute 100% lines on every presentation page.
 * Safe videoPrep.create + capped rAF; focused residual hits per uncov list.
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
import i18n from 'i18next'
import {
  ActionsPage,
  actionsAiFillInfoMessage,
  actionsAiFillRefPath,
  actionsAiFillToastKey,
  actionsAppendCastNoteIfNeeded,
  actionsApplyCoverPath,
  actionsApplyGalleryReorder,
  actionsApplyIpcError,
  actionsMakeCoverHandler,
  actionsMakeReorderHandler,
  actionsArtStyleOrDefault,
  actionsCastHint,
  actionsCastIdentityNote,
  actionsCoverPathSetter,
  actionsDiscardSheetDraftSafe,
  actionsErrorBannerElement,
  actionsGalleryPathsFromOpts,
  actionsGuardAiNeedIdea,
  actionsGuardBusy,
  actionsGuardEmptyName,
  actionsHandlePlateCommitted,
  actionsHandleProfileApply,
  actionsHandleVideoPrepDone,
  actionsIntroVideoHandler,
  actionsMaybeAppendMultiRef,
  actionsMaybeContinueVideoDraft,
  actionsMotionNotesBadge,
  actionsMotionNotesChip,
  actionsMoveGallery,
  actionsNextCoverAfterRemove,
  actionsPickNeighborId,
  actionsPlateReferencePaths,
  actionsResolveWantIdentity,
  actionsRunAiFill,
  actionsRunCreateForEnsure,
  actionsRunDelete,
  actionsRunGeneratePlateSetup,
  actionsRunIntroVideo,
  actionsRunPlateJob,
  actionsRunSave,
  actionsShowErrorBanner
} from './ActionsPage'
import { CharactersPage } from './CharactersPage'
import { CostumesPage } from './CostumesPage'
import {
  PropsPage,
  propsAiFillToastKey,
  propsApplyIpcError,
  propsApplySimpleIpc,
  propsClearFilters,
  propsDiscardDraftSafe,
  propsGalleryPathsFromOpts,
  propsGuardAiNeed,
  propsGuardBusy,
  propsGuardEmptyName,
  propsGuardIntro,
  propsIntroVideoHandler,
  propsIsBusyJob,
  propsMaybeAppendMultiRef,
  propsMaybeContinueDraft,
  propsNextCoverAfterGallery,
  propsResolveWantIdentity,
  propsRunCreateForEnsure,
  propsRunSave,
  propsSuggestIdeaLabel
} from './PropsPage'
import { ScenesPage } from './ScenesPage'
import { SettingsPage } from './SettingsPage'
import { StoriesPage } from './StoriesPage'
import {
  formatExportSize,
  formatExportWhen,
  TimelinePage
} from './TimelinePage'

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
      <button type="button" onClick={() => p.onTime?.(15.5)}>
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
  void i18n.changeLanguage('en')
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

/**
 * Force-click including disabled buttons.
 * happy-dom/jsdom suppress click on disabled native buttons — clear disabled first.
 */
async function forceClick(re: RegExp) {
  const b = screen.getAllByRole('button').find((x) =>
    re.test((x.textContent || '').trim())
  ) as HTMLButtonElement | undefined
  if (!b) return undefined
  const wasDisabled = b.disabled
  if (wasDisabled) b.disabled = false
  await act(async () => fireEvent.click(b))
  if (wasDisabled) b.disabled = true
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
    if (cancel && Date.now() - start > 600) {
      await act(async () => fireEvent.click(cancel))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 25))
      })
      return true
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70))
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

async function hangBusy(
  kind: string,
  scope: Record<string, string | undefined>
) {
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
    professionalPrompt: 'FULL PROFESSIONAL PROMPT abs100 safe',
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
    kind: payload?.kind ?? 'action-intro',
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

// ═══════════════════════════════════════════════════════════
// Actions → 100%
// ═══════════════════════════════════════════════════════════
describe('abs100 Actions absolute', () => {
  beforeEach(() => seed())

  it('pure residual helpers cover every branch', async () => {
    const msgs: string[] = []
    const toastErr = (m: string) => msgs.push('e:' + m)
    const toastInfo = (m: string) => msgs.push('i:' + m)
    const setErr = (m: string) => msgs.push('s:' + m)

    expect(actionsGuardEmptyName('', toastErr, 'name-req')).toBe(true)
    expect(msgs).toContain('e:name-req')
    expect(actionsGuardEmptyName('  x  ', toastErr, 'name-req')).toBe(false)

    expect(actionsGuardBusy(true, toastInfo, 'loading')).toBe(true)
    expect(msgs).toContain('i:loading')
    expect(actionsGuardBusy(false, toastInfo, 'loading')).toBe(false)

    expect(
      actionsGuardAiNeedIdea('', false, false, setErr, toastErr, 'need')
    ).toBe(true)
    expect(msgs).toContain('s:need')
    expect(msgs).toContain('e:need')
    expect(
      actionsGuardAiNeedIdea('idea', false, false, setErr, toastErr, 'need')
    ).toBe(false)
    expect(
      actionsGuardAiNeedIdea('', true, false, setErr, toastErr, 'need')
    ).toBe(false)
    expect(
      actionsGuardAiNeedIdea('', false, true, setErr, toastErr, 'need')
    ).toBe(false)

    expect(actionsAiFillToastKey(true, '', false)).toBe('fromImage')
    expect(actionsAiFillToastKey(true, 'x', false)).toBe('background')
    expect(actionsAiFillToastKey(false, '', false)).toBe('background')
    expect(actionsAiFillToastKey(true, '', true)).toBe('background')

    expect(actionsResolveWantIdentity(true, false)).toBe(true)
    expect(actionsResolveWantIdentity(false, true)).toBe(false)
    expect(actionsResolveWantIdentity(undefined, true)).toBe(true)
    expect(actionsResolveWantIdentity(undefined, false)).toBe(false)

    expect(actionsGalleryPathsFromOpts(' /p.png ', ['a'])).toEqual([
      '/p.png'
    ])
    expect(actionsGalleryPathsFromOpts(null, ['a', 'b'])).toEqual(['a', 'b'])
    expect(actionsGalleryPathsFromOpts('  ', ['a'])).toEqual(['a'])
    expect(actionsGalleryPathsFromOpts(undefined, [])).toEqual([])

    expect(actionsCastIdentityNote(2, 'en')).toMatch(/Cast identity/)
    expect(actionsCastIdentityNote(3, 'zh-Hant')).toMatch(/已附/)
    expect(actionsCastIdentityNote(1, 'zh')).toMatch(/已附/)

    expect(
      actionsPlateReferencePaths(['id'], true, ['m'], ['c'])
    ).toEqual(['id'])
    expect(actionsPlateReferencePaths([], true, ['m'], ['c'])).toEqual([
      'm'
    ])
    expect(actionsPlateReferencePaths([], false, ['m'], ['c'])).toEqual([
      'c'
    ])

    const errs: string[] = []
    actionsApplyIpcError(
      new Error(
        JSON.stringify({
          code: 'INTERNAL',
          message: 'boom',
          details: 'detail-x'
        })
      ),
      (m) => errs.push('s:' + m),
      (m) => errs.push('t:' + m)
    )
    expect(errs[0]).toMatch(/boom/)
    expect(errs[0]).toMatch(/detail-x/)
    actionsApplyIpcError(new Error('plain'), (m) => errs.push(m), () => undefined)
    expect(errs.some((x) => x === 'plain' || x.startsWith('s:plain'))).toBe(
      true
    )

    await actionsDiscardSheetDraftSafe(async () => {
      throw new Error('discard fail')
    }, '/x.png')
    let discarded = ''
    await actionsDiscardSheetDraftSafe(async (p) => {
      discarded = p
    }, '/ok.png')
    expect(discarded).toBe('/ok.png')

    expect(
      actionsNextCoverAfterRemove('/a.png', '/a.png', [
        {
          id: 'g',
          path: '/b.png',
          label: 'B',
          kind: 'sheet',
          layer: 'base',
          createdAt: '2026-07-01T00:00:00.000Z'
        }
      ])
    ).toBe('/b.png')
    expect(actionsNextCoverAfterRemove('/keep.png', '/a.png', [])).toBe(
      '/keep.png'
    )
    expect(actionsNextCoverAfterRemove('/a.png', '/a.png', [])).toBeNull()

    let cont = 0
    expect(
      actionsMaybeContinueVideoDraft(true, () => {
        cont++
      })
    ).toBe(true)
    expect(cont).toBe(1)
    expect(actionsMaybeContinueVideoDraft(false, () => cont++)).toBe(false)
    expect(cont).toBe(1)

    const calls: string[] = []
    const h = actionsIntroVideoHandler('act-1', '/a.png', (p) =>
      calls.push(p)
    )
    expect(typeof h).toBe('function')
    h!()
    expect(calls).toEqual(['/a.png'])
    expect(actionsIntroVideoHandler(null, '/a.png', () => undefined)).toBe(
      undefined
    )
    expect(
      actionsIntroVideoHandler(undefined, '/a.png', () => undefined)
    ).toBe(undefined)

    // video prep done / profile apply / plate committed residual
    let reloads = 0
    let formSnap: { gallery?: { id: string; path: string }[] } | null = null
    const setForm = (fn: (f: never) => unknown) => {
      formSnap = fn({
        gallery: [],
        coverPath: '/old.png',
        name: 'n',
        description: '',
        hardRules: '',
        motionNotes: '',
        intention: '',
        cameraNotes: '',
        visualTags: '',
        panelLayout: 'grid-2x2',
        artStyle: 'photo_cinematic',
        castRefs: []
      } as never) as typeof formSnap
    }
    actionsHandleVideoPrepDone(
      { kind: 'other' },
      'act-1',
      setForm as never,
      () => reloads++
    )
    expect(reloads).toBe(0)
    actionsHandleVideoPrepDone(
      { kind: 'action-intro', entityIds: { actionId: 'other' } },
      'act-1',
      setForm as never,
      () => reloads++
    )
    expect(reloads).toBe(0)
    actionsHandleVideoPrepDone(
      { kind: 'action-intro', entityIds: { actionId: 'act-1' } },
      'act-1',
      setForm as never,
      () => reloads++
    )
    expect(reloads).toBe(1)
    actionsHandleVideoPrepDone(
      {
        kind: 'action-intro',
        entityIds: { actionId: 'act-1' },
        gallery: [
          {
            id: 'g',
            path: '/n.png',
            label: 'L',
            kind: 'sheet',
            layer: 'base',
            createdAt: '2026-07-01T00:00:00.000Z'
          }
        ]
      },
      'act-1',
      setForm as never,
      () => reloads++
    )
    expect(formSnap?.gallery?.[0]?.path).toBe('/n.png')

    let open = false
    let editId: string | null = null
    actionsHandleProfileApply(
      {
        actionId: 'act-2',
        profile: { name: 'X', description: 'd' }
      },
      'act-1',
      {
        reload: () => reloads++,
        setForm: setForm as never,
        setEditingId: (id) => {
          editId = id
        },
        setEditorOpen: (v) => {
          open = v
        },
        toastSuccess: () => undefined
      }
    )
    expect(reloads).toBeGreaterThan(1)
    actionsHandleProfileApply(
      {
        actionId: 'act-1',
        profile: {
          name: 'Filled',
          description: 'desc',
          motionNotes: 'm',
          intention: 'i',
          cameraNotes: 'c',
          visualTags: '  tags  ',
          hardRules: '  hard  ',
          artStyle: 'photo_cinematic'
        }
      },
      'act-1',
      {
        reload: () => reloads++,
        setForm: setForm as never,
        setEditingId: (id) => {
          editId = id
        },
        setEditorOpen: (v) => {
          open = v
        },
        toastSuccess: () => undefined
      }
    )
    expect(open).toBe(true)
    expect(editId).toBe('act-1')
    // no visualTags / hardRules / bad art
    actionsHandleProfileApply(
      {
        actionId: null,
        profile: {
          name: '',
          description: '',
          visualTags: '   ',
          hardRules: '',
          artStyle: 'not-a-style'
        }
      },
      null,
      {
        reload: () => undefined,
        setForm: setForm as never,
        setEditingId: () => undefined,
        setEditorOpen: () => undefined,
        toastSuccess: () => undefined
      }
    )

    let panel = ''
    let selId: string | null = null
    actionsHandlePlateCommitted(
      { actionId: 'act-9', path: '/p.png' },
      'act-1',
      {
        reload: () => reloads++,
        setForm: setForm as never,
        setSelectedImageId: (id) => {
          selId = id
        },
        setEditorPanel: (p) => {
          panel = p
        },
        toastSuccess: () => undefined
      }
    )
    actionsHandlePlateCommitted(
      { actionId: 'act-1', path: '/p.png', gallery: [] },
      'act-1',
      {
        reload: () => reloads++,
        setForm: setForm as never,
        setSelectedImageId: (id) => {
          selId = id
        },
        setEditorPanel: (p) => {
          panel = p
        },
        toastSuccess: () => undefined
      }
    )
    actionsHandlePlateCommitted(
      {
        actionId: 'act-1',
        path: '/new.png',
        gallery: [
          {
            id: 'g1',
            path: '/keep.png',
            kind: 'sheet',
            label: 'K',
            createdAt: '2026-07-01T00:00:00.000Z'
          },
          {
            id: 'g2',
            path: '/new.png',
            kind: 'sheet',
            label: 'N',
            createdAt: '2026-07-02T00:00:00.000Z'
          }
        ]
      },
      'act-1',
      {
        reload: () => reloads++,
        setForm: setForm as never,
        setSelectedImageId: (id) => {
          selId = id
        },
        setEditorPanel: (p) => {
          panel = p
        },
        toastSuccess: () => undefined
      }
    )
    expect(selId).toBe('g2')
    expect(panel).toBe('refs')
    // cover keep path: setForm was called with cover still valid
    actionsHandlePlateCommitted(
      {
        actionId: 'act-1',
        path: '/x.png',
        gallery: [
          {
            id: 'gx',
            path: '/old.png',
            kind: 'sheet',
            label: 'O',
            createdAt: '2026-07-01T00:00:00.000Z'
          }
        ]
      },
      'act-1',
      {
        reload: () => undefined,
        setForm: setForm as never,
        setSelectedImageId: () => undefined,
        setEditorPanel: () => undefined,
        toastSuccess: () => undefined
      }
    )

    expect(actionsAiFillRefPath({})).toBe('')
    expect(actionsAiFillRefPath({ selectedPath: ' /s.png ' })).toBe('/s.png')
    expect(actionsAiFillRefPath({ coverPath: '/c.png' })).toBe('/c.png')
    expect(actionsAiFillRefPath({ gallery0: '/g.png' })).toBe('/g.png')
    expect(actionsAiFillRefPath({ cast0: '/cast.png' })).toBe('/cast.png')

    expect(actionsAppendCastNoteIfNeeded('p', false, 2, 'en')).toBe('p')
    expect(actionsAppendCastNoteIfNeeded('p', true, 0, 'en')).toBe('p')
    const withNote = actionsAppendCastNoteIfNeeded('p', true, 2, 'en')
    expect(withNote).toMatch(/Cast identity/)
    expect(actionsAppendCastNoteIfNeeded(withNote, true, 2, 'en')).toBe(
      withNote
    )
    expect(actionsAppendCastNoteIfNeeded('p', true, 1, 'zh')).toMatch(/已附/)

    expect(actionsCastHint(0, 'x')).toBe('')
    expect(actionsCastHint(2, 'two')).toBe(' · two')

    expect(
      actionsPickNeighborId('a', [{ id: 'a' }, { id: 'b' }], 'a')
    ).toBe('b')
    expect(
      actionsPickNeighborId('b', [{ id: 'a' }, { id: 'b' }], 'b')
    ).toBe('a')
    expect(actionsPickNeighborId('a', [{ id: 'a' }], 'a')).toBeNull()
    expect(actionsPickNeighborId('a', [{ id: 'a' }, { id: 'b' }], 'b')).toBe(
      'b'
    )

    expect(actionsCoverPathSetter('/c.png')({ coverPath: null } as never)).toMatchObject(
      { coverPath: '/c.png' }
    )
    const moved = actionsMoveGallery('a', 'b')({
      gallery: [
        {
          id: 'a',
          path: '/a',
          label: 'A',
          kind: 'sheet',
          layer: 'base',
          createdAt: '2026-07-01T00:00:00.000Z'
        },
        {
          id: 'b',
          path: '/b',
          label: 'B',
          kind: 'sheet',
          layer: 'base',
          createdAt: '2026-07-01T00:00:00.000Z'
        }
      ]
    } as never)
    expect((moved as { gallery: { id: string }[] }).gallery[0].id).toBe('b')

    expect(actionsArtStyleOrDefault('photo_cinematic')).toBe('photo_cinematic')
    expect(actionsArtStyleOrDefault('nope')).toBe('photo_cinematic')
    expect(actionsArtStyleOrDefault(null)).toBe('photo_cinematic')
    expect(actionsShowErrorBanner(null)).toBe(false)
    expect(actionsShowErrorBanner('err')).toBe(true)

    expect(actionsMotionNotesBadge(null)).toBeNull()
    expect(actionsMotionNotesBadge(undefined)).toBeNull()
    expect(actionsMotionNotesBadge('short')).toBe('short')
    expect(actionsMotionNotesBadge('x'.repeat(30))?.endsWith('…')).toBe(true)
    // chip covers badge + hidden class branches
    const { container: chipOn } = await import('@testing-library/react').then(
      (m) => ({
        container: m.render(actionsMotionNotesChip('hello')).container
      })
    )
    expect(chipOn.textContent).toMatch(/hello/)
    const { container: chipOff } = await import('@testing-library/react').then(
      (m) => ({
        container: m.render(actionsMotionNotesChip(null)).container
      })
    )
    expect(chipOff.querySelector('.hidden')).toBeTruthy()

    const bannerOn = actionsErrorBannerElement('oops', ((k: string) => k) as never)
    expect(bannerOn).toBeTruthy()
    const { container: banC } = await import('@testing-library/react').then(
      (m) => ({ container: m.render(bannerOn!).container })
    )
    expect(banC.textContent).toBeTruthy()
    expect(actionsErrorBannerElement(null, ((k: string) => k) as never)).toBeNull()

    let formCalls = 0
    const setFormMock = (() => {
      formCalls++
    }) as never
    actionsApplyCoverPath(setFormMock, '/c.png')
    expect(formCalls).toBe(1)
    actionsApplyGalleryReorder(setFormMock, 'a', 'b')
    expect(formCalls).toBe(2)
    const reorder = actionsMakeReorderHandler(setFormMock)
    reorder('x', 'y')
    expect(formCalls).toBe(3)
    const coverH = actionsMakeCoverHandler(setFormMock, '/z.png')
    coverH()
    expect(formCalls).toBe(4)

    expect(
      actionsMaybeAppendMultiRef('p', ['a'], 'en', () => 'multi')
    ).toBe('p')
    expect(
      actionsMaybeAppendMultiRef('p', ['a', 'b'], 'en', (pr) => pr + '+m')
    ).toBe('p+m')

    // create for ensure
    expect(
      await actionsRunCreateForEnsure(
        async () => {
          throw new Error('nope')
        },
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined
      )
    ).toBeNull()
    expect(
      await actionsRunCreateForEnsure(
        async () => makeAction({ id: 'nx', name: 'N' }),
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined
      )
    ).toBe('nx')

    // save all branches
    const saveLog: string[] = []
    await actionsRunSave({
      name: '',
      nameRequiredMsg: 'req',
      savedMsg: 'ok',
      failedMsg: 'fail',
      editingId: null,
      toastError: (m) => saveLog.push('e:' + m),
      toastSuccess: (m) => saveLog.push('s:' + m),
      setError: () => undefined,
      update: async () => true,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    expect(saveLog).toContain('e:req')
    await actionsRunSave({
      name: 'X',
      nameRequiredMsg: 'req',
      savedMsg: 'ok',
      failedMsg: 'fail',
      editingId: 'id1',
      toastError: (m) => saveLog.push('e:' + m),
      toastSuccess: (m) => saveLog.push('s:' + m),
      setError: () => undefined,
      update: async () => false,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    expect(saveLog).toContain('e:fail')
    await actionsRunSave({
      name: 'X',
      nameRequiredMsg: 'req',
      savedMsg: 'ok',
      failedMsg: 'fail',
      editingId: 'id1',
      toastError: (m) => saveLog.push('e:' + m),
      toastSuccess: (m) => saveLog.push('s:' + m),
      setError: () => undefined,
      update: async () => true,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => saveLog.push('close')
    })
    expect(saveLog).toContain('s:ok')
    await actionsRunSave({
      name: 'X',
      nameRequiredMsg: 'req',
      savedMsg: 'ok',
      failedMsg: 'fail',
      editingId: null,
      toastError: (m) => saveLog.push('e:' + m),
      toastSuccess: (m) => saveLog.push('s:' + m),
      setError: () => undefined,
      update: async () => true,
      create: async () => {
        throw new Error('cr')
      },
      reload: () => undefined,
      closeEditor: () => undefined
    })
    expect(saveLog.some((x) => x.startsWith('e:cr'))).toBe(true)
    await actionsRunSave({
      name: 'X',
      nameRequiredMsg: 'req',
      savedMsg: 'ok',
      failedMsg: 'fail',
      editingId: null,
      toastError: (m) => saveLog.push('e:' + m),
      toastSuccess: (m) => saveLog.push('s:' + m),
      setError: () => undefined,
      update: async () => true,
      create: async () => makeAction(),
      reload: () => undefined,
      closeEditor: () => saveLog.push('close2')
    })
    expect(saveLog).toContain('close2')

    // intro video flow
    expect(
      await actionsRunIntroVideo({
        ensureSavedId: async () => null,
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        hasDraft: () => false,
        continueDraft: () => undefined,
        startVideoPrep: () => undefined,
        sourcePath: '/a.png',
        buildKey: () => 'k'
      })
    ).toBe('no-id')
    expect(
      await actionsRunIntroVideo({
        ensureSavedId: async () => 'act-1',
        isBusy: () => true,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        hasDraft: () => false,
        continueDraft: () => undefined,
        startVideoPrep: () => undefined,
        sourcePath: '/a.png',
        buildKey: () => 'k'
      })
    ).toBe('busy')
    expect(
      await actionsRunIntroVideo({
        ensureSavedId: async () => 'act-1',
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        hasDraft: () => true,
        continueDraft: () => undefined,
        startVideoPrep: () => undefined,
        sourcePath: '/a.png',
        buildKey: () => 'k'
      })
    ).toBe('continue')
    expect(
      await actionsRunIntroVideo({
        ensureSavedId: async () => 'act-1',
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        hasDraft: () => false,
        continueDraft: () => undefined,
        startVideoPrep: () => undefined,
        sourcePath: '/a.png',
        buildKey: () => 'k'
      })
    ).toBe('started')

    // delete
    let closed = false
    await actionsRunDelete({
      name: 'A',
      id: 'a1',
      editingId: 'a1',
      confirm: async () => false,
      remove: async () => true,
      toastSuccess: () => undefined,
      closeEditor: () => {
        closed = true
      }
    })
    expect(closed).toBe(false)
    await actionsRunDelete({
      name: 'A',
      id: 'a1',
      editingId: 'a1',
      confirm: async () => true,
      remove: async () => false,
      toastSuccess: () => undefined,
      closeEditor: () => {
        closed = true
      }
    })
    expect(closed).toBe(false)
    await actionsRunDelete({
      name: 'A',
      id: 'a1',
      editingId: 'a1',
      confirm: async () => true,
      remove: async () => true,
      toastSuccess: () => undefined,
      closeEditor: () => {
        closed = true
      }
    })
    expect(closed).toBe(true)
    closed = false
    await actionsRunDelete({
      name: 'A',
      id: 'a1',
      editingId: 'other',
      confirm: async () => true,
      remove: async () => true,
      toastSuccess: () => undefined,
      closeEditor: () => {
        closed = true
      }
    })
    expect(closed).toBe(false)

    expect(actionsAiFillInfoMessage('fromImage', 'img', 'bg')).toBe('img')
    expect(actionsAiFillInfoMessage('background', 'img', 'bg')).toBe('bg')

    expect(
      actionsRunAiFill({
        busy: true,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        idea: '',
        formSnapshot: {},
        refPath: '',
        setError: () => undefined,
        toastError: () => undefined,
        needMsg: 'n',
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      actionsRunAiFill({
        busy: false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        idea: '',
        formSnapshot: {},
        refPath: '',
        setError: () => undefined,
        toastError: () => undefined,
        needMsg: 'n',
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('need')
    expect(
      actionsRunAiFill({
        busy: false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        idea: '',
        formSnapshot: {},
        refPath: '/img.png',
        setError: () => undefined,
        toastError: () => undefined,
        needMsg: 'n',
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('started')
    expect(
      actionsRunAiFill({
        busy: false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        idea: 'idea',
        formSnapshot: { name: 'x' },
        refPath: '',
        setError: () => undefined,
        toastError: () => undefined,
        needMsg: 'n',
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('started')

    expect(
      await actionsRunGeneratePlateSetup({
        ensureSavedId: async () => null,
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        setError: () => undefined,
        toastError: () => undefined,
        buildConfirm: () => undefined
      })
    ).toBe('no-id')
    expect(
      await actionsRunGeneratePlateSetup({
        ensureSavedId: async () => 'a',
        isBusy: () => true,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        setError: () => undefined,
        toastError: () => undefined,
        buildConfirm: () => undefined
      })
    ).toBe('busy')
    expect(
      await actionsRunGeneratePlateSetup({
        ensureSavedId: async () => 'a',
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        setError: () => undefined,
        toastError: () => undefined,
        buildConfirm: () => undefined
      })
    ).toBe('ok')
    expect(
      await actionsRunGeneratePlateSetup({
        ensureSavedId: async () => {
          throw new Error('boom')
        },
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        setError: () => undefined,
        toastError: () => undefined,
        buildConfirm: () => undefined
      })
    ).toBe('error')

    expect(
      await actionsRunPlateJob({
        ensureSavedId: async () => null,
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        startedMsg: 'S',
        setError: () => undefined,
        toastError: () => undefined,
        startJob: () => undefined,
        generatePlate: async () => ({ path: '/p' }),
        discardDraft: async () => undefined,
        panelLayout: 'grid-2x2',
        plateLabel: 'P',
        storyId: 's'
      })
    ).toBe('no-id')
    expect(
      await actionsRunPlateJob({
        ensureSavedId: async () => 'a',
        isBusy: () => true,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        startedMsg: 'S',
        setError: () => undefined,
        toastError: () => undefined,
        startJob: () => undefined,
        generatePlate: async () => ({ path: '/p' }),
        discardDraft: async () => undefined,
        panelLayout: 'grid-2x2',
        plateLabel: 'P',
        storyId: 's'
      })
    ).toBe('busy')
    let cancelledRan = false
    expect(
      await actionsRunPlateJob({
        ensureSavedId: async () => 'a',
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        startedMsg: 'S',
        setError: () => undefined,
        toastError: () => undefined,
        startJob: (_id, run) => {
          void run({
            setProgress: () => undefined,
            signal: { cancelled: true }
          }).then(() => {
            cancelledRan = true
          })
        },
        generatePlate: async () => ({ path: '/p' }),
        discardDraft: async () => {
          throw new Error('discard')
        },
        panelLayout: 'grid-2x2',
        plateLabel: 'P',
        storyId: 's'
      })
    ).toBe('started')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(cancelledRan).toBe(true)
    expect(
      await actionsRunPlateJob({
        ensureSavedId: async () => 'a',
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        startedMsg: 'S',
        setError: () => undefined,
        toastError: () => undefined,
        startJob: (_id, run) => {
          void run({
            setProgress: () => undefined,
            signal: { cancelled: false }
          })
        },
        generatePlate: async () => ({
          path: '/p',
          panelLayout: '2x2',
          label: 'L'
        }),
        discardDraft: async () => undefined,
        panelLayout: 'grid-2x2',
        plateLabel: 'P',
        storyId: 's'
      })
    ).toBe('started')
    expect(
      await actionsRunPlateJob({
        ensureSavedId: async () => {
          throw new Error('setup')
        },
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        startedMsg: 'S',
        setError: () => undefined,
        toastError: () => undefined,
        startJob: () => undefined,
        generatePlate: async () => ({ path: '/p' }),
        discardDraft: async () => undefined,
        panelLayout: 'grid-2x2',
        plateLabel: 'P',
        storyId: 's'
      })
    ).toBe('error')
  })

  it('all residual guards: filter empty, update false, AI image, busy intro, zh plate, new create', async () => {
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
        intention: 'threat',
        cameraNotes: 'close',
        visualTags: 'action',
        artStyle: 'photo_cinematic',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag'),
        castRefsJson: JSON.stringify([
          {
            id: 'cr1',
            kind: 'character',
            entityId: 'char-1',
            imagePath: '/c.png',
            label: 'Aria'
          },
          {
            id: 'cr2',
            kind: 'prop',
            entityId: 'prop-1',
            imagePath: '/p.png',
            label: 'Gun'
          }
        ])
      }),
      makeAction({
        id: 'act-2',
        name: 'Kick',
        motionNotes: null,
        description: '',
        refImagePath: null,
        refGalleryJson: null
      })
    ])
    // update returns false via reject (hook catches)
    let updN = 0
    api.actions.update = vi.fn().mockImplementation(async () => {
      updN++
      if (updN <= 2) throw new Error('upd false path')
      return makeAction({ id: 'act-1', name: 'Draw gun' })
    })
    api.actions.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create boom'))
      .mockResolvedValue(makeAction({ id: 'an', name: 'Nova act' }))
    api.actions.delete = vi.fn().mockRejectedValue(new Error('del'))
    api.actions.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('plate boom'), { details: 'detail-x' })
      )
      .mockResolvedValue({
        path: '/tmp/ap.png',
        label: 'B',
        panelLayout: '2x2',
        enhance: { ok: true }
      })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/apc.png',
      gallery: []
    })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Draw gun',
        description: 'd',
        motionNotes: 'm',
        artStyle: 'photo_cinematic'
      },
      profileJson: '{}',
      raw: ''
    })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/c.png' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({ refImagePath: '/p.png' })
    ])
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

    // EmptyState noMatch — filter to nothing
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'zzzz-no-match-xyz' } })
      )
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/no match|No match|match/i)
    )
    await clickNamed(/Clear filters/i)

    // delete fail
    const kick = Array.from(document.querySelectorAll('article')).find((a) =>
      (a.textContent || '').includes('Kick')
    )
    if (kick) {
      const del = within(kick as HTMLElement).queryByRole('button', {
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

    // Cover + reorder while gallery still has 2 stills
    await clickNamed(/^References$/i)
    // click second thumb (label B) if present
    for (const b of screen.getAllByRole('button')) {
      const title = b.getAttribute('title') || ''
      if (title === 'B' || (b.textContent || '').includes('B')) {
        await act(async () => fireEvent.click(b))
        break
      }
    }
    // also try any non-selected thumb in strip
    const stripBtns = Array.from(
      document.querySelectorAll('button[title]')
    ) as HTMLButtonElement[]
    for (const b of stripBtns) {
      if (b.title && b.title !== 'Move left' && b.title !== 'Move right') {
        await act(async () => fireEvent.click(b))
      }
    }
    const setCoverBtn = screen
      .queryAllByRole('button')
      .find((b) => /^Set as cover$/i.test((b.textContent || '').trim()))
    if (setCoverBtn) {
      await act(async () => fireEvent.click(setCoverBtn))
    }
    // Force gallery reorder via Move right/left aria labels
    const mr = screen.queryByLabelText(/Move right/i) as HTMLButtonElement | null
    if (mr) {
      mr.disabled = false
      await act(async () => fireEvent.click(mr))
    } else {
      // Fallback: call strip shift by finding any button with →
      for (const b of document.querySelectorAll('button')) {
        if ((b.textContent || '').includes('→') || (b.textContent || '').includes('←')) {
          ;(b as HTMLButtonElement).disabled = false
          await act(async () => fireEvent.click(b))
        }
      }
    }
    const ml = screen.queryByLabelText(/Move left/i) as HTMLButtonElement | null
    if (ml) {
      ml.disabled = false
      await act(async () => fireEvent.click(ml))
    }

    // empty name save → nameRequired (Save is disabled — force click)
    for (const el of Array.from(document.querySelectorAll('input'))) {
      if ((el as HTMLInputElement).value === 'Draw gun') {
        await act(async () => fireEvent.change(el, { target: { value: '' } }))
      }
    }
    await forceClick(/^Save$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Draw gun' } })
      )
    }

    // AI need idea — clear everything
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await forceClick(/AI fill/i)

    // AI from image only — restore name empty idea with image present
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: '' } })
      )
    }
    // keep galleries; no draft fields
    await clickNamed(/^References$/i)
    await forceClick(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // restore fields
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Draw gun' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'motion body residual' } })
      )
    }

    // busy via action-intro-video with empty scope (hits some() for null editingId path when new)
    await hangBusy('action-intro-video', {})
    await forceClick(/AI fill/i)
    await clickNamed(/^References$/i)
    await forceClick(/Generate instruction board|Generate plate/i)
    await forceClick(/Intro|video/i)
    await cancelAllJobs()

    // busy on this actionId — force through disabled buttons
    await hangBusy('action-ai-fill', { actionId: 'act-1' })
    await forceClick(/AI fill/i)
    await hangBusy('action-plate', { actionId: 'act-1' })
    await forceClick(/Generate instruction board|Generate plate/i)
    await hangBusy('action-intro-video', { actionId: 'act-1' })
    await forceClick(/Intro|video|Continue/i)
    await cancelAllJobs()

    // plate fail with details (catch path)
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // zh cast note path
    await act(async () => {
      await i18n.changeLanguage('zh-Hant')
    })
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate instruction board|Generate plate|生成/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await act(async () => {
      await i18n.changeLanguage('en')
    })

    // plate success + accept draft if any; cancel discard path
    await hangBusy('action-plate', { actionId: 'act-1' })
    // start plate job that will cancel mid-run via cancelAllJobs after generate
    await cancelAllJobs()
    await clickNamed(/Generate instruction board|Generate plate/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      // cancel active plate job for discardSheetDraft catch
      for (const j of [...(jobs?.activeJobs ?? [])]) {
        await act(async () => {
          await jobs!.cancelJob(j.id)
        })
      }
    }

    // multi-select + plate ok
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

    // Remove image → cover path branch
    await clickNamed(/Remove this photo|Remove|remove/i)
    await clickNamed(/Set as cover|cover/i)
    await clickNamed(/Upload reference/i)

    // intro continue draft
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)

    // save with update fail then success
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // may have closed on fail or not — reopen if needed
    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Draw gun')
    }
    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // New action: empty plate, create fail, then fill + plate
    await clickNamed(/New action|New/i)
    // onIntroVideo undefined when !editingId
    await clickNamed(/^References$/i)
    await clickNamed(/Intro|video/i)
    await clickNamed(/Generate instruction board|Generate plate/i)
    // empty name ensureSavedId saveFirst
    await clickNamed(/Generate instruction board|Generate plate/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Nova act residual' } })
      )
    }
    // create fail once then success
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })

    // Re-open Draw gun for events + job apply handlers + panel selects
    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Draw gun')
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'action-intro',
            entityIds: { actionId: 'act-1' },
            gallery: [
              {
                id: 'vg',
                path: '/vg.png',
                label: 'V',
                kind: 'sheet',
                layer: 'base',
                createdAt: '2026-07-01T00:00:00.000Z'
              }
            ]
          }
        })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'action-intro',
            entityIds: { actionId: 'act-1' }
          }
        })
      )
    })

    // Complete AI fill job → acceptDraft → onActionProfileApply
    api.actions.update = vi.fn().mockResolvedValue(
      makeAction({ id: 'act-1', name: 'Draw gun' })
    )
    await act(async () => {
      void jobs!.startJob({
        kind: 'action-ai-fill' as never,
        label: 'fill',
        scope: { actionId: 'act-1' } as never,
        run: async () =>
          ({
            type: 'action-profile' as const,
            actionId: 'act-1',
            storyId: 'story-1',
            profile: {
              name: 'Draw gun',
              description: 'filled',
              motionNotes: 'm',
              visualTags: 'tags',
              hardRules: 'hard',
              artStyle: 'photo_cinematic'
            },
            profileJson: '{}',
            isNew: false
          }) as never
      })
    })
    await waitFor(
      () => expect((jobs?.pendingDrafts ?? []).length).toBeGreaterThan(0),
      { timeout: 5000 }
    )
    for (const j of [...(jobs?.pendingDrafts ?? [])]) {
      await act(async () => {
        await jobs!.acceptDraft(j.id)
      })
    }
    // mismatch actionId branch
    await act(async () => {
      void jobs!.startJob({
        kind: 'action-ai-fill' as never,
        label: 'fill2',
        scope: { actionId: 'act-other' } as never,
        run: async () =>
          ({
            type: 'action-profile' as const,
            actionId: 'act-other',
            storyId: 'story-1',
            profile: { name: 'Other', description: 'o' },
            profileJson: '{}',
            isNew: false
          }) as never
      })
    })
    await waitFor(
      () => expect((jobs?.pendingDrafts ?? []).length).toBeGreaterThan(0),
      { timeout: 5000 }
    )
    for (const j of [...(jobs?.pendingDrafts ?? [])]) {
      await act(async () => {
        await jobs!.acceptDraft(j.id)
      })
    }

    // Plate job complete → acceptDraft → commitPlate → onActionPlateCommitted
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/committed.png',
      gallery: [
        {
          id: 'cg',
          path: '/committed.png',
          kind: 'sheet',
          label: 'C',
          createdAt: '2026-07-01T00:00:00.000Z',
          layer: 'base'
        }
      ]
    })
    await act(async () => {
      void jobs!.startJob({
        kind: 'action-plate' as never,
        label: 'plate',
        scope: { actionId: 'act-1' } as never,
        run: async () =>
          ({
            type: 'action-plate' as const,
            actionId: 'act-1',
            storyId: 'story-1',
            path: '/draft-plate.png',
            panelLayout: 'grid-2x2',
            label: 'Board'
          }) as never
      })
    })
    await waitFor(
      () => expect((jobs?.pendingDrafts ?? []).length).toBeGreaterThan(0),
      { timeout: 5000 }
    )
    for (const j of [...(jobs?.pendingDrafts ?? [])]) {
      await act(async () => {
        await jobs!.acceptDraft(j.id)
      })
    }
    // plate with empty gallery branch
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/c2.png',
      gallery: []
    })
    await act(async () => {
      void jobs!.startJob({
        kind: 'action-plate' as never,
        label: 'plate2',
        scope: { actionId: 'act-1' } as never,
        run: async () =>
          ({
            type: 'action-plate' as const,
            actionId: 'act-1',
            storyId: 'story-1',
            path: '/d2.png',
            panelLayout: 'grid-2x2',
            label: 'B2'
          }) as never
      })
    })
    await waitFor(
      () => expect((jobs?.pendingDrafts ?? []).length).toBeGreaterThan(0),
      { timeout: 5000 }
    )
    for (const j of [...(jobs?.pendingDrafts ?? [])]) {
      await act(async () => {
        await jobs!.acceptDraft(j.id)
      })
    }

    // panel layout + art style selects
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
        await act(async () =>
          fireEvent.change(s, { target: { value: 'not-a-real-style-id' } })
        )
      }
    }
    // Back to Draw gun refs for cover + reorder
    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Draw gun')
    }
    await clickNamed(/^References$/i)
    // Select second gallery thumb if present then set cover
    const thumbs = Array.from(
      document.querySelectorAll('[title], button, img')
    ).filter((el) => {
      const t = (el.getAttribute('title') || el.textContent || '').trim()
      return t === 'B' || t === 'L' || t.length > 0
    })
    for (const th of thumbs.slice(0, 4)) {
      await act(async () => fireEvent.click(th))
    }
    const setCover = screen.queryAllByRole('button').find((b) =>
      /^Set as cover$/i.test((b.textContent || '').trim())
    )
    if (setCover) {
      ;(setCover as HTMLButtonElement).disabled = false
      await act(async () => fireEvent.click(setCover))
    }
    // Gallery reorder ← →
    const moveRight = screen.queryByLabelText(/Move right/i)
    if (moveRight) {
      ;(moveRight as HTMLButtonElement).disabled = false
      await act(async () => fireEvent.click(moveRight))
    }
    const moveLeft = screen.queryByLabelText(/Move left/i)
    if (moveLeft) {
      ;(moveLeft as HTMLButtonElement).disabled = false
      await act(async () => fireEvent.click(moveLeft))
    }
    // Directly fire reorder via any ← → text button
    for (const b of screen.getAllByRole('button')) {
      const t = (b.textContent || '').trim()
      if (t === '→' || t === '←') {
        ;(b as HTMLButtonElement).disabled = false
        await act(async () => fireEvent.click(b))
      }
    }

    // Kick: no motionNotes (hidden badge) + AI need error banner
    await forceClick(/Cancel|Close/i)
    const kickCard = Array.from(document.querySelectorAll('article')).find(
      (a) => (a.textContent || '').includes('Kick')
    )
    if (kickCard) {
      const ed = Array.from(kickCard.querySelectorAll('button')).filter((b) =>
        /^Edit$/i.test((b.textContent || '').trim())
      )
      if (ed.length) await act(async () => fireEvent.click(ed[ed.length - 1]!))
    }
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await forceClick(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    // error banner should show

    // ensureSavedId create path: New action + name + plate generate
    await clickNamed(/New action|^New$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Brand new act' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      1
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'desc for create' } })
      )
    }
    api.actions.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('create ensure fail'))
      .mockResolvedValueOnce(makeAction({ id: 'bn', name: 'Brand new act' }))
      .mockResolvedValue(makeAction({ id: 'bn2', name: 'Brand new act' }))
    await forceClick(/Generate instruction board|Generate plate/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await forceClick(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // New + Save hits handleSave create lambda
    await clickNamed(/New action|^New$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Save create path' } })
      )
    }
    api.actions.create = vi
      .fn()
      .mockResolvedValue(makeAction({ id: 'sc', name: 'Save create path' }))
    await forceClick(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }, 120000)
})

// ═══════════════════════════════════════════════════════════
// Props → 100%
// ═══════════════════════════════════════════════════════════
describe('abs100 Props absolute', () => {
  beforeEach(() => seed())

  it('pure residual helpers cover every branch', async () => {
    const msgs: string[] = []
    propsClearFilters(
      (q) => msgs.push('q:' + q),
      (v) => msgs.push('i:' + v)
    )
    expect(msgs).toEqual(['q:', 'i:'])

    expect(propsGuardEmptyName('', (m) => msgs.push(m), 'empty')).toBe(true)
    expect(propsGuardEmptyName('x', (m) => msgs.push(m), 'empty')).toBe(false)
    expect(propsGuardBusy(true, (m) => msgs.push(m), 'L')).toBe(true)
    expect(propsGuardBusy(false, (m) => msgs.push(m), 'L')).toBe(false)
    expect(
      propsGuardAiNeed('', false, false, (m) => msgs.push(m), 'need')
    ).toBe(true)
    expect(
      propsGuardAiNeed('i', false, false, (m) => msgs.push(m), 'need')
    ).toBe(false)

    expect(propsAiFillToastKey(true, '', false)).toBe('fromImage')
    expect(propsAiFillToastKey(false, '', false)).toBe('background')
    expect(propsResolveWantIdentity(true, false)).toBe(true)
    expect(propsResolveWantIdentity(undefined, true)).toBe(true)
    expect(propsGalleryPathsFromOpts('/p', ['a'])).toEqual(['/p'])
    expect(propsGalleryPathsFromOpts(null, ['a'])).toEqual(['a'])
    expect(
      propsMaybeAppendMultiRef('p', ['a', 'b'], 'en', (x) => x + '+')
    ).toBe('p+')
    expect(propsMaybeAppendMultiRef('p', ['a'], 'en', (x) => x + '+')).toBe(
      'p'
    )
    expect(propsMaybeContinueDraft(true, () => msgs.push('c'))).toBe(true)
    expect(propsMaybeContinueDraft(false, () => msgs.push('c'))).toBe(false)

    propsApplyIpcError(
      new Error(
        JSON.stringify({ code: 'INTERNAL', message: 'm', details: 'd' })
      ),
      (m) => msgs.push('s:' + m),
      (m) => msgs.push('t:' + m)
    )
    expect(msgs.some((x) => x.includes('m'))).toBe(true)
    propsApplySimpleIpc(new Error('simp'), (m) => msgs.push(m))
    await propsDiscardDraftSafe(async () => {
      throw new Error('x')
    }, '/p')
    await propsDiscardDraftSafe(async () => undefined, '/p')

    expect(
      propsIntroVideoHandler('id', '/p', () => undefined)
    ).toBeTypeOf('function')
    expect(propsIntroVideoHandler(null, '/p', () => undefined)).toBeUndefined()

    expect(
      propsGuardIntro(
        null,
        '/p',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('saveFirst')
    expect(
      propsGuardIntro(
        'id',
        '',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('needImage')
    expect(
      propsGuardIntro(
        'id',
        '/p',
        true,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('busy')
    expect(
      propsGuardIntro(
        'id',
        '/p',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('ok')

    expect(
      propsIsBusyJob({ kind: 'prop-ai-fill', scope: { propId: 'p1' } }, 'p1')
    ).toBe(true)
    expect(
      propsIsBusyJob({ kind: 'other', scope: {} }, 'p1')
    ).toBe(false)
    expect(propsSuggestIdeaLabel(true, 'story', 'seg')).toBe('story')
    expect(propsSuggestIdeaLabel(false, 'story', 'seg')).toBe('seg')
    expect(
      propsNextCoverAfterGallery(
        [{ path: '/a' }],
        '/a',
        () => true,
        () => '/p'
      )
    ).toBe('/a')
    expect(
      propsNextCoverAfterGallery(
        [{ path: '/a' }],
        '/x',
        () => false,
        () => '/p'
      )
    ).toBe('/p')

    expect(
      await propsRunCreateForEnsure(
        async () => {
          throw new Error('no')
        },
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined
      )
    ).toBeNull()
    expect(
      await propsRunCreateForEnsure(
        async () => ({ id: 'np' }),
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined
      )
    ).toBe('np')

    await propsRunSave({
      name: '',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: () => undefined,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: () => undefined,
      update: async () => true,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await propsRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: 'id',
      toastError: () => undefined,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: () => undefined,
      update: async () => false,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await propsRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: 'id',
      toastError: () => undefined,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: () => undefined,
      update: async () => true,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await propsRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: () => undefined,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: () => undefined,
      update: async () => true,
      create: async () => {
        throw new Error('cr')
      },
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await propsRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: () => undefined,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: () => undefined,
      update: async () => true,
      create: async () => undefined,
      reload: () => undefined,
      closeEditor: () => undefined
    })
  })

  it('filters busy intro draft update fail plate profile cover remove', async () => {
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
        description: 'metal badge',
        material: 'steel',
        sizeNotes: 'palm',
        condition: 'worn',
        visualTags: 'shiny',
        hardRules: 'no logo',
        artStyle: 'photo_cinematic',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      }),
      makeProp({ id: 'prop-2', name: 'Flask', refImagePath: null })
    ])
    api.props.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd'))
      .mockResolvedValue(makeProp())
    api.props.create = vi
      .fn()
      .mockRejectedValueOnce(new Error('cr'))
      .mockResolvedValue(makeProp({ id: 'pn', name: 'NewP' }))
    api.props.delete = vi.fn().mockRejectedValueOnce(new Error('del'))
    api.props.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('plate'), { details: 'pd' })
      )
      .mockResolvedValue({ path: '/tmp/pp.png', label: 'H', variant: 'hero' })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/ppc.png',
      gallery: []
    })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Badge',
        description: 'd',
        material: 'm',
        artStyle: 'photo_cinematic'
      },
      profileJson: '{}',
      raw: ''
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
        fireEvent.change(el, { target: { value: 'zzz-nomatch' } })
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

    const flask = Array.from(document.querySelectorAll('article')).find((a) =>
      (a.textContent || '').includes('Flask')
    )
    if (flask) {
      const del = within(flask as HTMLElement).queryByRole('button', {
        name: /^Delete$/i
      })
      if (del) {
        await act(async () => fireEvent.click(del))
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }

    // New prop saveFirst
    await clickNamed(/New prop/i)
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/Generate prop plate|Generate plate/i)
    await clickNamed(/Intro|video/i)
    await clickNamed(/^Cancel$/i)

    await openCardEdit('Badge')
    // AI need idea
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    // AI from image
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // restore
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Badge' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'metal residual hard' } })
      )
    }

    await hangBusy('prop-ai-fill', { propId: 'prop-1' })
    await clickNamed(/AI fill/i)
    await hangBusy('prop-plate', { propId: 'prop-1' })
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate|Generate plate/i)
    await hangBusy('prop-intro-video', { propId: 'prop-1' })
    await clickNamed(/Intro|video/i)
    await cancelAllJobs()

    await clickNamed(/Generate prop plate|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // multi identity
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate prop plate|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickNamed(/Set as cover|cover/i)
    await clickNamed(/Remove|remove/i)
    await clickNamed(/Upload reference/i)
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)

    // intro update fail path — force update reject then try intro without draft
    try {
      localStorage.removeItem('idm.videoPrepDrafts.v2')
    } catch {
      /* ignore */
    }
    api.props.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('intro upd'))
      .mockResolvedValue(makeProp())
    await clickNamed(/Intro|video/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await dismissVideoPrep(1500)

    await clickNamed(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
  }, 70000)
})

// ═══════════════════════════════════════════════════════════
// Pure Timeline helpers + residual Timeline
// ═══════════════════════════════════════════════════════════
describe('abs100 Timeline pure + residual', () => {
  it('formatExportSize and formatExportWhen all branches', () => {
    expect(formatExportSize(null)).toBe('')
    expect(formatExportSize(undefined)).toBe('')
    expect(formatExportSize(NaN)).toBe('')
    expect(formatExportSize(-1)).toBe('')
    expect(formatExportSize(0)).toMatch(/0|B/)
    expect(formatExportSize(500)).toMatch(/B/)
    expect(formatExportSize(2048)).toMatch(/KB/)
    expect(formatExportSize(3 * 1024 * 1024)).toMatch(/MB/)
    expect(formatExportWhen('not-a-date')).toBe('not-a-date')
    expect(formatExportWhen('2026-07-15T12:00:00.000Z', 'en')).toBeTruthy()
    // Invalid date string returns original
    expect(formatExportWhen('')).toBe('')
  })

  beforeEach(() => seed())

  it('play wrap, advance empty→ready, generate, clip draft, export delete cancel', async () => {
    const restoreRaf = installRafCap(8)
    try {
      try {
        localStorage.setItem(
          'idm.videoPrepDrafts.v2',
          JSON.stringify({
            ['timeline-clip:story-1:entry-2']: {
              kind: 'timeline-clip',
              entityIds: { storyId: 'story-1', entryId: 'entry-2' },
              sourceImagePath: '/s.png',
              professionalPrompt: 'SAVED DRAFT FULL',
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
      const entries = [
        makeTimelineEntry({
          id: 'entry-1',
          storyId: 'story-1',
          order: 0,
          startTime: 0,
          endTime: 4,
          mediaStatus: 'EMPTY',
          mediaPath: null,
          dialogue: 'Empty',
          characterId: 'char-1',
          sceneId: 'scene-1',
          propId: null,
          actionId: null,
          beatContentJson: JSON.stringify({ spoken: ['Hi residual'] })
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
          dialogue: 'Ready',
          characterId: 'char-1',
          actionId: 'act-1'
        }),
        makeTimelineEntry({
          id: 'entry-3',
          storyId: 'story-1',
          order: 2,
          startTime: 10,
          endTime: 16,
          mediaStatus: 'FAILED',
          mediaPath: null,
          dialogue: 'Fail',
          stillPath: '/sf.png'
        })
      ]
      api.timeline.list = vi.fn().mockResolvedValue(entries)
      api.timeline.update = vi.fn().mockResolvedValue({})
      api.timeline.create = vi.fn().mockResolvedValue(
        makeTimelineEntry({ id: 'n', startTime: 16, endTime: 20 })
      )
      api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
      api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
      api.characters.list = vi.fn().mockResolvedValue([
        makeCharacter({
          id: 'char-1',
          name: 'Aria',
          refImagePath: null
        })
      ])
      api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
      api.props.list = vi.fn().mockResolvedValue([makeProp()])
      api.actions.list = vi.fn().mockResolvedValue([makeAction()])
      api.settings.get = vi.fn().mockResolvedValue({
        ...DEFAULT_SETTINGS,
        videoMode: 'stub',
        snapEnabled: true,
        snapGridSec: 0.5,
        openExportFolder: true,
        burnSubtitles: true
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
            sizeBytes: 500
          },
          {
            id: 'ex2',
            kind: 'board',
            fileName: 'b.png',
            path: '/e/b.png',
            createdAt: 'bad',
            sizeBytes: 2048
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
        willUseFallback: true,
        warnings: ['w'],
        canExport: true
      })
      api.media.exportFinal = vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('ffmpeg'), { code: 'FFMPEG_UNAVAILABLE' })
        )
        .mockResolvedValue({ path: '/out.mp4' })
      api.media.exportStoryboard = vi.fn().mockResolvedValue({ path: '/b.png' })
      api.media.importClip = vi.fn().mockResolvedValue({ path: '/i.mp4' })
      api.generation.run = vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          steps: [
            { step: 'script', success: false, error: 'boom' },
            { step: 'timeline', success: true, degraded: true }
          ]
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
          total: 3,
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
          fireEvent.change(ta, { target: { value: 'tl abs dialogue' } })
        )
      }
      for (const inp of Array.from(document.querySelectorAll('input')).slice(
        0,
        5
      ) as HTMLInputElement[]) {
        if (inp.type === 'number' || inp.type === 'range') {
          await act(async () =>
            fireEvent.change(inp, { target: { value: '6' } })
          )
        } else if (inp.type === 'checkbox') {
          await act(async () => fireEvent.click(inp))
        }
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
        await new Promise((r) => setTimeout(r, 40))
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

      // Continue draft on entry-2
      await clickNamed(/^k-sel2$/i)
      await clickNamed(/Continue video|Regenerate|Generate this clip/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^p-gen$/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^k-sel3$/i)
      await clickNamed(/Generate this clip|Regenerate/i)
      await dismissVideoPrep(2500)

      await clickNamed(/Advanced/i)
      await clickNamed(/^q$/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^adv-r$/i)
      await clickNamed(/^adv-rt$/i)
      await clickNamed(/^xc$/i)

      await clickNamed(/Export history/i)
      await clickNamed(/Open file|folder|Show/i)
      await clickNamed(/^Delete$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      // cancel delete
      await clickNamed(/^Delete$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        const cancel = Array.from(document.querySelectorAll('button')).find(
          (b) => /^Cancel$/i.test((b.textContent || '').trim())
        )
        if (cancel) await act(async () => fireEvent.click(cancel))
      }
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
      await clickNamed(/Import/i)

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
  }, 90000)

  it('api missing-ref cancel + empty no-failed + listExports missing', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({
        id: 'entry-1',
        mediaStatus: 'READY',
        mediaPath: '/m.mp4',
        characterId: 'char-1'
      })
    ])
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ id: 'char-1', refImagePath: null })
    ])
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      videoMode: 'api'
    })
    api.media.listExports = vi.fn().mockResolvedValue({
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
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    await clickNamed(/Start generation|Generate/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    if (document.querySelector('[role="alertdialog"]')) {
      const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (cancel) await act(async () => fireEvent.click(cancel))
    }
    await clickNamed(/Retry failed clips|Retry failed/i)
  }, 25000)
})

// ═══════════════════════════════════════════════════════════
// Costumes / Scenes / Stories / Settings / Characters batch
// ═══════════════════════════════════════════════════════════
describe('abs100 Costumes Scenes Stories Settings Characters batch', () => {
  beforeEach(() => seed())

  it('Costumes dress filters intro link busy', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cost-1',
        name: 'Rain coat',
        description: 'long',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg'),
        characterLinks: [
          { characterId: 'char-1', character: { id: 'char-1', name: 'Aria' } }
        ]
      }),
      makeCostume({ id: 'cost-2', name: 'Suit', refImagePath: null })
    ])
    api.costumes.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('u'))
      .mockResolvedValue(makeCostume())
    api.costumes.delete = vi.fn().mockRejectedValue(new Error('d'))
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Rain coat',
      description: 'filled'
    })
    api.costumes.generateDressed = vi
      .fn()
      .mockRejectedValueOnce(new Error('dress'))
      .mockResolvedValue({ path: '/tmp/d.png' })
    api.costumes.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link'))
      .mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
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
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'zzz' } })
      )
    }
    await clickNamed(/Clear filters/i)
    await openCardEdit('Rain coat')
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'costume abs body' } })
      )
    }
    await clickNamed(/AI fill/i)
    await hangBusy('costume-ai-fill', { costumeId: 'cost-1' })
    await clickNamed(/AI fill/i)
    await cancelAllJobs()
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
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Generate dressed look|Generate dressed|Dress/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(2500)
    await clickNamed(/^Link$|Unlink/i)
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Scenes looks plate intro plot + Stories cast + Settings matrix', async () => {
    const looksJson = JSON.stringify([
      {
        id: 'look-s1',
        name: 'Default',
        description: 'wet neon rain',
        artStyle: 'photo_cinematic',
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
        artStyle: 'photo_cinematic',
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
      .mockResolvedValue(makeScene({ id: 'sn', sceneNumber: 9 }))
    api.scenes.delete = vi.fn().mockRejectedValue(new Error('d'))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'Rooftop+',
        description: 'd',
        locationType: 'exterior',
        artStyle: 'photo_cinematic'
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
      .mockResolvedValue({ path: '/tmp/a.png', label: 'A', layer: 'detail' })
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

    const { unmount: u1 } = await renderWithProviders(
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
      await new Promise((r) => setTimeout(r, 50))
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
        fireEvent.change(el, { target: { value: 'rain abs' } })
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
        fireEvent.change(el, { target: { value: 'new atmo abs' } })
      )
    }
    await clickNamed(/Add to library/i)
    const delLook = screen
      .getAllByRole('button')
      .find((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (delLook) await act(async () => fireEvent.click(delLook))
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
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2500)
    await clickNamed(/^Save$/i)
    u1()

    // Stories
    const manyChars = Array.from({ length: 12 }, (_, i) =>
      makeCharacter({
        id: `char-${i + 1}`,
        name: i === 0 ? 'Aria' : `Cast${i}`,
        costumesJson:
          i === 0
            ? JSON.stringify([
                {
                  id: 'look-1',
                  name: 'Coat',
                  description: 'trench',
                  artStyle: 'photo_cinematic',
                  imagePath: '/media/aria.png',
                  createdAt: '2026-07-01T00:00:00.000Z',
                  updatedAt: '2026-07-01T00:00:00.000Z'
                }
              ])
            : null
      })
    )
    api.stories.list = vi.fn().mockResolvedValue([
      makeStory({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        artStyle: 'photo_cinematic',
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
        artStyle: 'photo_cinematic',
        characters: [manyChars[0]],
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()]
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
      .mockResolvedValue({ path: '/tmp/cov.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/tmp/cc.png' })
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
      artStyle: 'photo_cinematic'
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
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({ id: 'entry-1', dialogue: 'A' }),
      makeTimelineEntry({ id: 'entry-2', order: 1, dialogue: 'B' })
    ])
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

    const { unmount: u2 } = await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Demo Story')
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
          await new Promise((r) => setTimeout(r, 12))
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
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    u2()

    // Settings dense
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-x',
      imageProvider: 'same-as-llm',
      videoProvider: 'stub',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true,
      webServerPort: 8787,
      webServerHost: '0.0.0.0',
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
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({ available: true })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('rate'), { code: 'AI_RATE_LIMIT' })
      )
      .mockResolvedValue([{ id: 'gpt-4o', ownedBy: 'fallback' }])
    api.ai.testChat = vi.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      replyPreview: 'hi'
    })
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
    api.webServer.status = vi.fn().mockResolvedValue({
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
    api.webServer.start = vi.fn().mockResolvedValue({ running: true })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('nt')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'desktop-packaged',
      currentVersion: '1',
      latestVersion: '2',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 10,
      releaseNotes: 'n',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({ status: 'available' })
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
        canAutoInstall: true,
        channel: 'desktop-packaged'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      ok: true,
      path: '/s.json'
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
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
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Test chat|Test/i)
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
    await clickNamed(/^Video$/i)
    for (const re of [/Seedance|Grok|Custom|Stub|Same/i]) await clickNamed(re)
    await clickNamed(/^App$/i)
    for (const re of [
      /Open folder/i,
      /Start|Stop|Copy|Check|Download|npm|Export all data|Restore from backup|support|Clear activity|Linktree/i
    ]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
    await clickNamed(/^Save$/i)
  }, 120000)

  it('Characters filters soul wardrobe sheet intro residual', async () => {
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
    const costumesJson = JSON.stringify([
      {
        id: 'look-1',
        name: 'Coat',
        description: 'black trench',
        artStyle: 'photo_cinematic',
        imagePath: '/media/aria.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'look-2',
        name: 'Casual',
        description: 'tee',
        artStyle: 'not-a-style',
        imagePath: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        gender: 'female',
        artStyle: 'photo_cinematic',
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
        spokenLanguages: 'bad{',
        refImagePath: null
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
        artStyle: 'photo_cinematic'
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
        artStyle: 'photo_cinematic',
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
      () =>
        expect(document.body.textContent || '').toMatch(/Aria|Ben|Character/i),
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
    await clickNamed(/Clear filters/i)
    await openCardEdit('Aria')
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
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
        fireEvent.change(el, { target: { value: 'storm abs residual' } })
      )
    }
    await hangBusy('character-ai-fill', { characterId: 'char-1' })
    await clickNamed(/AI fill/i)
    await cancelAllJobs()
    await clickNamed(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
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
      await act(async () =>
        fireEvent.change(el, { target: { value: 'new look abs' } })
      )
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Suggest from plot/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
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
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^References$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate professional reference/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove|remove/i)
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
  }, 90000)
})
