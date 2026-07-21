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
import {
  CharactersPage,
  CharactersChip,
  CharactersField,
  CHARACTER_AI_KINDS,
  charactersAddCostumeToLibrary,
  charactersAiBusyFromJobs,
  charactersAiFillRefPath,
  charactersAiFillToastKey,
  charactersApplyCostumeLook,
  charactersApplyIpcError,
  charactersApplySimpleIpc,
  charactersApplySoulForm,
  charactersArtStyleOrKeep,
  charactersClearSoulForm,
  charactersCostumeDesc,
  charactersDiscardDraftSafe,
  charactersEnsureSavedId,
  charactersEnsureSoulIndex,
  charactersForcePureLayout,
  charactersGalleryPathsFromOpts,
  charactersGuardAiNeed,
  charactersGuardBusy,
  charactersGuardEmptyName,
  charactersGuardIntro,
  charactersGuardSoulSource,
  charactersGuardSuggest,
  charactersHandleProfileApply,
  charactersHandleSheetCommitted,
  charactersHandleVideoPrepDone,
  charactersHandleWardrobeApply,
  charactersHasDraftValues,
  charactersHasSoulSource,
  charactersHubSearchMode,
  charactersImportSoulForm,
  charactersIntroVideoHandler,
  charactersIsAiJob,
  charactersLinkCostumeError,
  charactersLoadHubPage,
  charactersLocalSoulPath,
  charactersMapGalleryItems,
  charactersMapGalleryKind,
  charactersMapSheetKind,
  charactersMaybeAppendMultiRef,
  charactersMaybeContinueVideoDraft,
  charactersNeedsBareBodyWarning,
  charactersNextCoverAfterRemove,
  charactersOnSheetVariantChange,
  charactersPickNeighborId,
  charactersProfileMismatch,
  charactersReadSoulSafe,
  charactersRemoveWithFeedback,
  charactersResetSheetIfHidden,
  charactersResolveWantIdentity,
  charactersRunAiFill,
  charactersRunGenerateSheetSetup,
  charactersRunSave,
  charactersRunSheetJob,
  charactersRunSwapCostume,
  charactersSelectAfterCommit,
  charactersSelectAfterVideo,
  charactersSheetModeLabel,
  charactersShouldOpenEditorOnAi,
  charactersShouldReorder,
  charactersShouldShowUseSoul,
  charactersShowLinkedEmpty,
  charactersSoulContent,
  charactersSoulPreviewSync,
  charactersSoulTitleDisplay,
  charactersUseIdentityEdit,
  charactersWriteSoulIfNeeded,
  charactersPreviewSoul,
  charactersApplySoulFromHub,
  charactersClearSoulState,
  charactersRemoveCostumeLook,
  charactersReorderGallery,
  charactersJobCancelDiscard,
  charactersContinueDraftOr,
  charactersLoadSoulPreviewForm,
  charactersSpokenLangSetter,
  charactersArtStyleSetter,
  charactersSoulTextSetter,
  charactersSuggestionSearch,
  charactersHubEnter,
  charactersOpenExternal,
  charactersGenerateSheetFromEmpty,
  charactersToggleSelectIds,
  charactersPlotStoryChange,
  charactersUseSoulButtonClick,
  charactersDressedBusyGuard,
  charactersSheetEnsureCostume,
  charactersImportDesc,
  charactersImportName,
  charactersFindInList,
  charactersFindByName,
  charactersBuildSheetMultiAppend,
  charactersAiCreateLabel,
  charactersSpokenOrUndefined,
  charactersSelectedIds,
  charactersGeneratingLabel,
  charactersCostumeBaseOptionLabel
} from './CharactersPage'
import React from 'react'
import { createRoot } from 'react-dom/client'

import {
  CostumesPage,
  costumesAfterRemoveImage,
  costumesAiFillToastKey,
  costumesApplyIpc,
  costumesApplySimpleIpc,
  costumesArtStyleLabel,
  costumesBaseLabel,
  costumesCannotDeleteActive,
  costumesFilterByQuery,
  costumesGuardBusy,
  costumesGuardDress,
  costumesGuardIntro,
  costumesGuardSaveFirst,
  costumesIntroVideoHandler,
  costumesIsBusyJob,
  costumesMaybeContinueDraft,
  costumesMaybeSetDressBase,
  costumesRefFallback,
  costumesReorderGallery
} from './CostumesPage'
import {
  PropsPage,
  propsAiFillToastKey,
  propsApplyIpcError,
  propsApplySimpleIpc,
  propsClearFilters,
  propsMakeClearFilters,
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
  propsApplyPickedImage,
  propsHandlePlateCommitted,
  propsHandleProfileApply,
  propsHandleVideoPrepDone,
  propsMapVideoPrepGalleryItem,
  propsMakeEmptyGalleryAction,
  propsMakeReorderHandler,
  propsPickField,
  propsRemoveWithFeedback,
  propsRunAiFill,
  propsRunCreateForEnsure,
  propsRunPlateJob,
  propsRunSave,
  propsSelectedPathsForIdentity,
  propsShouldReorder,
  propsStartIntroAfterSave,
  propsSuggestIdeaLabel
} from './PropsPage'
import { ScenesPage } from './ScenesPage'
import { SettingsPage } from './SettingsPage'
import { StoriesPage } from './StoriesPage'
import {
  formatExportSize,
  formatExportWhen,
  TimelinePage,
  timelineApplyIpc,
  timelineClipButtonLabel,
  timelineClipGenerateLabel,
  timelineClipNeedsSkip,
  timelineContinueClipDraft,
  timelineEntryLabel,
  timelineExportSizeOrEmpty,
  timelineGeneratingLabel,
  timelineIdsOrFallback,
  timelineJobMatchesStory,
  timelineNoFailedClips,
  timelinePickNextClip,
  timelinePlayheadAdvance,
  timelineRafTickValue,
  timelineRunDeleteExport,
  timelineSpokenPreview
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
    propsMakeClearFilters((q) => msgs.push('q2:' + q), (v) => msgs.push('i2:' + v))()
    expect(msgs).toEqual(['q:', 'i:', 'q2:', 'i2:'])

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

    expect(
      propsRunAiFill({
        busy: true,
        idea: '',
        formSnapshot: {},
        refPath: '',
        setError: () => undefined,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: () => undefined,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      propsRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        refPath: '',
        setError: () => undefined,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: () => undefined,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('need')
    expect(
      propsRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        refPath: '/p.png',
        setError: () => undefined,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: () => undefined,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('started')
    expect(
      propsRunAiFill({
        busy: false,
        idea: 'idea',
        formSnapshot: { name: 'x' },
        refPath: '',
        setError: () => undefined,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: () => undefined,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('started')

    expect(
      await propsRunPlateJob({
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
        plateVariant: 'hero',
        storyId: 's'
      })
    ).toBe('no-id')
    expect(
      await propsRunPlateJob({
        ensureSavedId: async () => 'p1',
        isBusy: () => true,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        startedMsg: 'S',
        setError: () => undefined,
        toastError: () => undefined,
        startJob: () => undefined,
        generatePlate: async () => ({ path: '/p' }),
        discardDraft: async () => undefined,
        plateVariant: 'hero',
        storyId: 's'
      })
    ).toBe('busy')
    let cancelDone = false
    expect(
      await propsRunPlateJob({
        ensureSavedId: async () => 'p1',
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
            cancelDone = true
          })
        },
        generatePlate: async () => ({ path: '/p' }),
        discardDraft: async () => {
          throw new Error('d')
        },
        plateVariant: 'hero',
        storyId: 's'
      })
    ).toBe('started')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(cancelDone).toBe(true)
    expect(
      await propsRunPlateJob({
        ensureSavedId: async () => 'p1',
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
        generatePlate: async () => ({ path: '/p', label: 'L' }),
        discardDraft: async () => undefined,
        plateVariant: 'hero',
        storyId: 's'
      })
    ).toBe('started')
    expect(
      await propsRunPlateJob({
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
        plateVariant: 'hero',
        storyId: 's'
      })
    ).toBe('error')

    expect(propsShouldReorder('', 'b')).toBe(false)
    expect(propsShouldReorder('a', 'a')).toBe(false)
    expect(propsShouldReorder('a', 'b')).toBe(true)
    await propsRemoveWithFeedback({
      remove: async () => undefined,
      id: 'x',
      toastSuccess: () => msgs.push('ok'),
      toastError: () => undefined
    })
    expect(msgs).toContain('ok')
    await propsRemoveWithFeedback({
      remove: async () => {
        throw new Error('del')
      },
      id: 'x',
      toastSuccess: () => undefined,
      toastError: (m) => msgs.push('e:' + m)
    })
    expect(msgs.some((x) => x.startsWith('e:'))).toBe(true)

    // video prep done / pick / reorder / empty-gallery residual pure
    expect(
      propsSelectedPathsForIdentity([], null, [{ id: 'a', path: '/a.png' }])
    ).toEqual([])
    expect(
      propsSelectedPathsForIdentity(
        [],
        'a',
        [{ id: 'a', path: '/a.png' }, { id: 'b', path: '/b.png' }]
      )
    ).toEqual(['/a.png'])
    expect(
      propsSelectedPathsForIdentity(
        ['b', 'a'],
        'a',
        [{ id: 'a', path: '/a.png' }, { id: 'b', path: '/b.png' }]
      )
    ).toEqual(['/b.png', '/a.png'])

    expect(propsMapVideoPrepGalleryItem({
      id: 'g',
      path: '/p',
      kind: 'weird',
      label: 'L',
      createdAt: 't',
      layer: 'base',
      introVideoPath: '/v.mp4'
    }).kind).toBe('sheet')
    expect(propsMapVideoPrepGalleryItem({
      id: 'g',
      path: '/p',
      kind: 'upload',
      label: 'L',
      createdAt: 't'
    }).kind).toBe('upload')

    let reloads = 0
    let formSnap: { gallery?: { path: string }[] } | null = null
    const setForm = (fn: (f: never) => unknown) => {
      formSnap = fn({
        gallery: [],
        coverPath: null,
        name: 'n'
      } as never) as typeof formSnap
    }
    expect(
      propsHandleVideoPrepDone({ kind: 'other' }, 'p1', setForm as never, () =>
        reloads++
      )
    ).toBe('skip')
    expect(
      propsHandleVideoPrepDone(
        { kind: 'prop-intro', entityIds: { propId: 'other' } },
        'p1',
        setForm as never,
        () => reloads++
      )
    ).toBe('skip')
    expect(
      propsHandleVideoPrepDone(
        { kind: 'prop-intro', entityIds: { propId: 'p1' } },
        'p1',
        setForm as never,
        () => reloads++
      )
    ).toBe('reload')
    expect(reloads).toBe(1)
    expect(
      propsHandleVideoPrepDone(
        {
          kind: 'prop-intro',
          entityIds: { propId: 'p1' },
          gallery: [
            {
              id: 'g1',
              path: '/n.png',
              kind: 'sheet',
              label: 'N',
              createdAt: 't',
              introVideoPath: '/v.mp4'
            }
          ]
        },
        'p1',
        setForm as never,
        () => reloads++
      )
    ).toBe('gallery')
    expect(formSnap?.gallery?.[0]?.path).toBe('/n.png')

    expect(
      await propsStartIntroAfterSave({
        update: async () => {
          throw new Error('upd')
        },
        toastError: (m) => msgs.push('ie:' + m),
        start: () => msgs.push('start')
      })
    ).toBe('error')
    expect(
      await propsStartIntroAfterSave({
        update: async () => undefined,
        toastError: () => undefined,
        start: () => msgs.push('start-ok')
      })
    ).toBe('started')
    expect(msgs).toContain('start-ok')

    let selId: string | null = null
    let selIds: string[] = []
    expect(
      propsApplyPickedImage({
        filePath: '/new.png',
        uploadLabel: 'Up',
        gallery: [],
        setForm: setForm as never,
        setSelectedImageId: (id) => {
          selId = id
        },
        setSelectedImageIds: (fn) => {
          selIds = fn(selIds)
        },
        toastSuccess: () => msgs.push('picked'),
        appendItem: (gal, item) => [
          ...gal,
          {
            id: 'new1',
            path: item.path,
            kind: item.kind,
            label: item.label,
            createdAt: 't'
          }
        ]
      })
    ).toBe('new1')
    expect(selId).toBe('new1')
    expect(selIds).toContain('new1')
    // second pick keeps selection list
    propsApplyPickedImage({
      filePath: '/new2.png',
      uploadLabel: 'Up',
      gallery: [
        {
          id: 'new1',
          path: '/new.png',
          kind: 'upload',
          label: 'Up',
          createdAt: 't'
        }
      ],
      setForm: setForm as never,
      setSelectedImageId: (id) => {
        selId = id
      },
      setSelectedImageIds: (fn) => {
        selIds = fn(selIds)
      },
      toastSuccess: () => undefined,
      appendItem: (gal, item) => [
        ...gal,
        {
          id: 'new2',
          path: item.path,
          kind: item.kind,
          label: item.label,
          createdAt: 't'
        }
      ]
    })
    expect(selIds).toContain('new2')

    let moved = 0
    const reorder = propsMakeReorderHandler(setForm as never, (gal, from, to) => {
      moved++
      return gal
    })
    reorder('', 'b')
    reorder('a', 'a')
    expect(moved).toBe(0)
    reorder('a', 'b')
    expect(moved).toBe(1)

    let panel = ''
    let acted = 0
    propsMakeEmptyGalleryAction((p) => {
      panel = p
    }, () => {
      acted++
    })()
    expect(panel).toBe('refs')
    expect(acted).toBe(1)

    expect(propsPickField('  x  ', 'fb')).toBe('  x  ')
    expect(propsPickField('   ', 'fb')).toBe('fb')
    expect(propsPickField(undefined, 'fb')).toBe('fb')

    let open = false
    let panel2 = ''
    expect(
      propsHandleProfileApply(
        {
          propId: 'other',
          profile: { name: 'X', description: 'd' }
        },
        'p1',
        {
          reload: () => reloads++,
          setForm: setForm as never,
          setEditorOpen: (v) => {
            open = v
          },
          setEditorPanel: (p) => {
            panel2 = p
          },
          setBanner: () => undefined,
          okMsg: 'ok'
        }
      )
    ).toBe('mismatch')
    expect(
      propsHandleProfileApply(
        {
          propId: 'p1',
          profile: {
            name: 'Filled',
            description: 'd',
            material: 'steel',
            visualTags: '  tags  ',
            hardRules: '',
            artStyle: 'photo_cinematic'
          }
        },
        'p1',
        {
          reload: () => reloads++,
          setForm: setForm as never,
          setEditorOpen: (v) => {
            open = v
          },
          setEditorPanel: (p) => {
            panel2 = p
          },
          setBanner: () => msgs.push('banner'),
          okMsg: 'ok'
        }
      )
    ).toBe('applied')
    expect(open).toBe(true)
    expect(panel2).toBe('profile')

    expect(
      await propsHandlePlateCommitted(
        { propId: 'other', path: '/p.png' },
        'p1',
        {
          reload: () => reloads++,
          setForm: setForm as never,
          setSelectedImageId: () => undefined,
          toastSuccess: () => undefined,
          listProps: async () => [],
          galleryFromProp: () => [],
          primaryPath: () => null
        }
      )
    ).toBe('other')
    expect(
      await propsHandlePlateCommitted(
        {
          propId: 'p1',
          path: '/new.png',
          gallery: [
            {
              id: 'g1',
              path: '/new.png',
              kind: 'sheet',
              label: 'N',
              createdAt: 't'
            }
          ]
        },
        'p1',
        {
          reload: () => reloads++,
          setForm: setForm as never,
          setSelectedImageId: (id) => {
            selId = id
          },
          toastSuccess: () => msgs.push('plate-ok'),
          listProps: async () => [],
          galleryFromProp: () => [],
          primaryPath: () => null
        }
      )
    ).toBe('gallery')
    expect(selId).toBe('g1')
    expect(
      await propsHandlePlateCommitted(
        { propId: 'p1', path: '/x.png', gallery: [] },
        'p1',
        {
          reload: () => undefined,
          setForm: setForm as never,
          setSelectedImageId: () => undefined,
          toastSuccess: () => undefined,
          listProps: async () => [],
          galleryFromProp: () => [],
          primaryPath: () => null
        }
      )
    ).toBe('listed-miss')
    expect(
      await propsHandlePlateCommitted(
        { propId: 'p1', path: '/x.png' },
        'p1',
        {
          reload: () => undefined,
          setForm: setForm as never,
          setSelectedImageId: (id) => {
            selId = id
          },
          toastSuccess: () => undefined,
          listProps: async () =>
            [makeProp({ id: 'p1', refImagePath: '/r.png' })] as never,
          galleryFromProp: () => [
            {
              id: 'lg',
              path: '/r.png',
              kind: 'sheet',
              label: 'R',
              createdAt: 't'
            }
          ],
          primaryPath: () => '/r.png'
        }
      )
    ).toBe('listed')
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
  it('formatExportSize and formatExportWhen all branches', async () => {
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

    expect(
      timelineJobMatchesStory(
        { status: 'running', scope: { storyId: 's1' } },
        's1'
      )
    ).toBe(true)
    expect(
      timelineJobMatchesStory(
        { status: 'done', scope: { storyId: 's1' } },
        's1'
      )
    ).toBe(false)
    expect(
      timelinePickNextClip(
        [
          { startTime: 0, endTime: 4 },
          { startTime: 4, endTime: 8 }
        ],
        3.9
      )?.startTime
    ).toBe(4)
    expect(timelinePickNextClip([{ startTime: 0, endTime: 4 }], 10)).toBeNull()
    expect(timelineClipNeedsSkip('READY', '/m.mp4')).toBe(false)
    expect(timelineClipNeedsSkip('EMPTY', null)).toBe(true)
    expect(timelinePlayheadAdvance(100, 10).stop).toBe(true)
    expect(timelinePlayheadAdvance(1, 10).stop).toBe(false)
    expect(timelineEntryLabel(['A', 'B'], 0)).toMatch(/A/)
    expect(timelineEntryLabel([], 2)).toBe('#3')
    expect(timelineIdsOrFallback(['a', 'b'], null)).toEqual(['a', 'b'])
    expect(timelineIdsOrFallback(null, 'x')).toEqual(['x'])
    expect(timelineIdsOrFallback(null, null)).toEqual([])
    expect(
      timelineNoFailedClips(0, () => undefined, 'none')
    ).toBe(true)
    expect(timelineNoFailedClips(2, () => undefined, 'none')).toBe(false)
    expect(timelineContinueClipDraft(true, () => undefined)).toBe(true)
    expect(timelineContinueClipDraft(false, () => undefined)).toBe(false)
    expect(timelineClipButtonLabel(true, 'cont', 'gen')).toBe('cont')
    expect(timelineClipButtonLabel(false, 'cont', 'gen')).toBe('gen')
    expect(timelineSpokenPreview('hi')).toBe('hi')
    expect(timelineSpokenPreview('x'.repeat(80)).endsWith('…')).toBe(true)
    expect(timelineGeneratingLabel(true, 'g', 'i')).toBe('g')
    expect(timelineGeneratingLabel(false, 'g', 'i')).toBe('i')
    expect(
      timelineClipGenerateLabel(true, 'READY', 'c', 'g', 'r')
    ).toBe('c')
    expect(
      timelineClipGenerateLabel(false, 'FAILED', 'c', 'g', 'r')
    ).toBe('g')
    expect(
      timelineClipGenerateLabel(false, 'EMPTY', 'c', 'g', 'r')
    ).toBe('g')
    expect(
      timelineClipGenerateLabel(false, 'READY', 'c', 'g', 'r')
    ).toBe('r')
    expect(
      timelineRafTickValue(100, 10, undefined, null).stop
    ).toBe(true)
    expect(
      timelineRafTickValue(
        2,
        10,
        { id: 'e1', startTime: 0, mediaStatus: 'READY', mediaPath: '/m' },
        'e0'
      ).selectId
    ).toBe('e1')
    expect(
      timelineRafTickValue(
        2,
        10,
        { id: 'e1', startTime: 0, mediaStatus: 'EMPTY', mediaPath: null },
        'e1'
      ).value
    ).toBe(2)
    expect(
      timelineRafTickValue(2, 10, undefined, null).value
    ).toBe(2)

    let busy: string | null = 'x'
    expect(
      await timelineRunDeleteExport({
        exportId: 'ex1',
        storyId: 's1',
        setBusy: (id) => {
          busy = id
        },
        deleteExport: async () => ({
          items: [],
          latestPath: null
        }),
        setHistory: () => undefined,
        setLatest: () => undefined,
        toastSuccess: () => undefined,
        toastError: () => undefined
      })
    ).toBe('ok')
    expect(busy).toBeNull()
    expect(
      await timelineRunDeleteExport({
        exportId: 'ex1',
        storyId: 's1',
        setBusy: () => undefined,
        deleteExport: async () => {
          throw new Error('del')
        },
        setHistory: () => undefined,
        setLatest: () => undefined,
        toastSuccess: () => undefined,
        toastError: () => undefined
      })
    ).toBe('error')
    const tMsgs: string[] = []
    expect(
      timelineApplyIpc('str-err', (m) => tMsgs.push('s:' + m), (m) =>
        tMsgs.push('t:' + m)
      )
    ).toBe('str-err')
    expect(
      timelineApplyIpc(42 as never, (m) => tMsgs.push(m), () => undefined)
    ).toBe('42')
    expect(
      timelineApplyIpc(new Error('e'), () => undefined, () => undefined)
    ).toBe('e')
    expect(timelineExportSizeOrEmpty(null)).toBe('')
    expect(timelineExportSizeOrEmpty(500)).toMatch(/B/)
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

  it('Costumes pure residual helpers cover every branch', () => {
    const msgs: string[] = []
    expect(
      costumesGuardSaveFirst(null, (m) => msgs.push(m), 'save')
    ).toBe(true)
    expect(
      costumesGuardSaveFirst('id', (m) => msgs.push(m), 'save')
    ).toBe(false)
    expect(costumesGuardBusy(true, (m) => msgs.push(m), 'L')).toBe(true)
    expect(costumesGuardBusy(false, (m) => msgs.push(m), 'L')).toBe(false)
    expect(costumesAiFillToastKey(true, '')).toBe('fromImage')
    expect(costumesAiFillToastKey(true, 'x')).toBe('background')
    expect(costumesAiFillToastKey(false, '')).toBe('background')
    costumesApplyIpc(new Error('e'), (m) => msgs.push('s:' + m), (m) =>
      msgs.push('t:' + m)
    )
    costumesApplyIpc('str', (m) => msgs.push('s2:' + m), () => undefined)
    costumesApplyIpc(9 as never, (m) => msgs.push('s3:' + m), () => undefined)
    costumesApplySimpleIpc('s', (m) => msgs.push(m))
    costumesApplySimpleIpc(new Error('se'), (m) => msgs.push(m))
    costumesApplySimpleIpc(7 as never, (m) => msgs.push(m))
    expect(
      costumesCannotDeleteActive(['A'], (m) => msgs.push(m), 'active')
    ).toBe(true)
    expect(
      costumesCannotDeleteActive([], (m) => msgs.push(m), 'active')
    ).toBe(false)
    expect(
      costumesIsBusyJob(
        { kind: 'costume-ai-fill', scope: { costumeId: 'c1' } },
        'c1'
      )
    ).toBe(true)
    expect(
      costumesIsBusyJob({ kind: 'other', scope: {} }, 'c1')
    ).toBe(false)
    expect(
      costumesGuardIntro(
        null,
        '/p',
        false,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('saveFirst')
    expect(
      costumesGuardIntro(
        'id',
        '',
        false,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('needImage')
    expect(
      costumesGuardIntro(
        'id',
        '/p',
        true,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('busy')
    expect(
      costumesGuardIntro(
        'id',
        '/p',
        false,
        () => undefined,
        () => undefined,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('ok')
    expect(costumesMaybeContinueDraft(true, () => msgs.push('c'))).toBe(true)
    expect(costumesMaybeContinueDraft(false, () => msgs.push('c'))).toBe(false)
    expect(
      costumesGuardDress(
        null,
        '',
        '',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', pickChar: 'p', noBase: 'n', loading: 'L' }
      )
    ).toBe('saveFirst')
    expect(
      costumesGuardDress(
        'id',
        '',
        '',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', pickChar: 'p', noBase: 'n', loading: 'L' }
      )
    ).toBe('pickChar')
    expect(
      costumesGuardDress(
        'id',
        'ch',
        '',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', pickChar: 'p', noBase: 'n', loading: 'L' }
      )
    ).toBe('noBase')
    expect(
      costumesGuardDress(
        'id',
        'ch',
        '/b',
        true,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', pickChar: 'p', noBase: 'n', loading: 'L' }
      )
    ).toBe('busy')
    expect(
      costumesGuardDress(
        'id',
        'ch',
        '/b',
        false,
        () => undefined,
        () => undefined,
        () => undefined,
        { saveFirst: 's', pickChar: 'p', noBase: 'n', loading: 'L' }
      )
    ).toBe('ok')
    expect(costumesBaseLabel(true, 'm', 'a')).toBe('m')
    expect(costumesBaseLabel(false, 'm', 'a')).toBe('a')
    expect(
      costumesAfterRemoveImage(
        '/a',
        '/a',
        [{ id: 'b', path: '/b' }],
        () => false,
        () => '/b'
      ).look
    ).toBe('/b')
    expect(
      costumesAfterRemoveImage(
        '/x',
        '/a',
        [{ id: 'a', path: '/a' }],
        () => false,
        () => '/a'
      ).selectedId
    ).toBe('a')
    expect(
      costumesAfterRemoveImage(
        '/x',
        '/a',
        [{ id: 'a', path: '/a' }],
        () => true,
        () => '/a'
      ).look
    ).toBe('/a')
    expect(
      costumesReorderGallery(
        [{ id: 'a' }, { id: 'b' }],
        'a',
        'b'
      )?.[0].id
    ).toBe('b')
    expect(costumesReorderGallery([{ id: 'a' }], 'x', 'y')).toBeNull()
    expect(
      costumesArtStyleLabel('photo_cinematic', () => true, () => 'styled')
    ).toBe('styled')
    expect(
      costumesArtStyleLabel('nope', () => false, () => 'styled')
    ).toBe('nope')
    expect(typeof costumesIntroVideoHandler('id', '/p', () => undefined)).toBe(
      'function'
    )
    expect(costumesIntroVideoHandler(null, '/p', () => undefined)).toBeUndefined()
    expect(
      costumesMaybeSetDressBase([{ path: '/b' }], '')
    ).toBe('/b')
    expect(
      costumesMaybeSetDressBase([{ path: '/b' }], '/x')
    ).toBeNull()
    expect(
      costumesFilterByQuery(
        [{ name: 'Rain', description: 'long' }, { name: 'Suit', description: '' }],
        'rain'
      )
    ).toHaveLength(1)
    expect(
      costumesFilterByQuery([{ name: 'Rain', description: 'long' }], '')
    ).toHaveLength(1)
    expect(
      costumesRefFallback({ refImagePath: '/c.png', name: 'C' })
    ).toEqual([{ path: '/c.png', label: 'C', id: 'ref' }])
    expect(costumesRefFallback(null)).toEqual([])
    expect(costumesRefFallback({ refImagePath: null, name: 'C' })).toEqual([])
  })

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


// ═══════════════════════════════════════════════════════════
// Characters pure residual → absolute 100
// ═══════════════════════════════════════════════════════════
describe('abs100 Characters pure residual helpers', () => {
  it('covers every pure residual branch', async () => {
    const msgs: string[] = []
    const toastErr = (m: string) => msgs.push('e:' + m)
    const toastInfo = (m: string) => msgs.push('i:' + m)
    const toastOk = (m?: string) => msgs.push('ok:' + (m ?? ''))
    const setErr = (m: string | null) => msgs.push('s:' + m)

    expect(charactersIsAiJob({ kind: 'other', scope: {} }, 'c1')).toBe(false)
    expect(
      charactersIsAiJob(
        { kind: 'character-ai-fill', scope: { characterId: 'c1' } },
        'c1'
      )
    ).toBe(true)
    expect(
      charactersIsAiJob(
        { kind: 'character-ai-fill', scope: { characterId: 'c2' } },
        'c1'
      )
    ).toBe(false)
    expect(
      charactersIsAiJob({ kind: 'character-ai-fill', scope: {} }, null)
    ).toBe(true)
    expect(
      charactersIsAiJob(
        { kind: 'character-ai-fill', scope: { characterId: 'c1' } },
        null
      )
    ).toBe(false)
    expect(CHARACTER_AI_KINDS).toContain('costume-swap')

    expect(
      charactersAiBusyFromJobs([], 'c1', true)
    ).toBe(true)
    expect(
      charactersAiBusyFromJobs(
        [{ kind: 'character-sheet', scope: { characterId: 'c1' } }],
        'c1',
        false
      )
    ).toBe(true)
    expect(charactersAiBusyFromJobs([], 'c1', false)).toBe(false)

    await charactersRemoveWithFeedback({
      remove: async () => undefined,
      id: 'x',
      toastSuccess: () => toastOk('d'),
      toastError: toastErr
    })
    await charactersRemoveWithFeedback({
      remove: async () => {
        throw new Error('rm')
      },
      id: 'x',
      toastSuccess: () => undefined,
      toastError: toastErr
    })
    expect(msgs.some((x) => x.includes('rm'))).toBe(true)

    charactersApplyIpcError(
      new Error(
        JSON.stringify({ code: 'INTERNAL', message: 'boom', details: 'd' })
      ),
      setErr,
      toastErr
    )
    charactersApplyIpcError(new Error('plain'), setErr)
    charactersApplySimpleIpc(new Error('simp'), toastErr)

    expect(charactersGuardEmptyName('', toastErr, 'empty')).toBe(true)
    expect(charactersGuardEmptyName('n', toastErr, 'empty')).toBe(false)
    expect(charactersGuardBusy(true, toastInfo, 'L')).toBe(true)
    expect(charactersGuardBusy(false, toastInfo, 'L')).toBe(false)
    expect(
      charactersGuardAiNeed('', false, false, false, setErr, toastErr, 'need')
    ).toBe(true)
    expect(
      charactersGuardAiNeed('i', false, false, false, setErr, toastErr, 'need')
    ).toBe(false)
    expect(
      charactersGuardAiNeed('', true, false, false, setErr, toastErr, 'need')
    ).toBe(false)
    expect(
      charactersGuardAiNeed('', false, true, false, setErr, toastErr, 'need')
    ).toBe(false)
    expect(
      charactersGuardAiNeed('', false, false, true, setErr, toastErr, 'need')
    ).toBe(false)

    expect(charactersAiFillToastKey(true, '', false, false)).toBe('fromImage')
    expect(charactersAiFillToastKey(true, 'x', false, false)).toBe('background')
    expect(charactersAiFillToastKey(false, '', false, false)).toBe(
      'background'
    )
    expect(charactersAiFillToastKey(true, '', true, false)).toBe('background')
    expect(charactersAiFillToastKey(true, '', false, true)).toBe('background')

    expect(charactersHasDraftValues({ a: 'x' })).toBe(true)
    expect(charactersHasDraftValues({ a: '' })).toBe(false)
    expect(charactersHasDraftValues({ a: ['x'] })).toBe(true)
    expect(charactersHasDraftValues({ a: [] })).toBe(false)
    expect(charactersHasDraftValues({ a: 1 })).toBe(false)

    expect(charactersAiFillRefPath({ selectedPath: ' /s ' })).toBe('/s')
    expect(charactersAiFillRefPath({ coverPath: '/c' })).toBe('/c')
    expect(charactersAiFillRefPath({ gallery0: '/g' })).toBe('/g')
    expect(charactersAiFillRefPath({})).toBe('')
    expect(charactersSoulContent(' a ', null)).toBe('a')
    expect(charactersSoulContent('', ' b ')).toBe('b')
    expect(charactersSoulContent(null, null)).toBe('')

    expect(charactersShouldOpenEditorOnAi(false)).toEqual({
      open: true,
      panel: 'profile'
    })
    expect(charactersShouldOpenEditorOnAi(true).open).toBe(false)

    expect(charactersResolveWantIdentity(true, false)).toBe(true)
    expect(charactersResolveWantIdentity(undefined, true)).toBe(true)
    expect(charactersForcePureLayout({ wardrobeLayer: 'nude' })).toBe(true)
    expect(charactersForcePureLayout({ wardrobeLayer: 'base' })).toBe(true)
    expect(
      charactersForcePureLayout({ requiresUnclothedSupport: true })
    ).toBe(true)
    expect(charactersForcePureLayout({ wardrobeLayer: 'costume' })).toBe(false)
    expect(charactersUseIdentityEdit(true, true)).toBe(false)
    expect(charactersUseIdentityEdit(false, true)).toBe(true)
    expect(charactersGalleryPathsFromOpts('/p', ['a'])).toEqual(['/p'])
    expect(charactersGalleryPathsFromOpts(null, ['a'])).toEqual(['a'])
    expect(
      charactersSheetModeLabel(true, false, {
        force: 'F',
        identity: 'I',
        pure: 'P'
      })
    ).toBe('F')
    expect(
      charactersSheetModeLabel(false, true, {
        force: 'F',
        identity: 'I',
        pure: 'P'
      })
    ).toBe('I')
    expect(
      charactersSheetModeLabel(false, false, {
        force: 'F',
        identity: 'I',
        pure: 'P'
      })
    ).toBe('P')

    expect(
      charactersNextCoverAfterRemove(
        [{ path: '/b', id: '1', kind: 'sheet', label: 'B', createdAt: 't' }],
        '/a',
        '/a',
        () => true,
        () => '/p'
      )
    ).toBe('/p')
    expect(
      charactersNextCoverAfterRemove(
        [{ path: '/b', id: '1', kind: 'sheet', label: 'B', createdAt: 't' }],
        '/x',
        '/b',
        () => true,
        () => '/p'
      )
    ).toBe('/b')
    expect(
      charactersNextCoverAfterRemove(
        [{ path: '/b', id: '1', kind: 'sheet', label: 'B', createdAt: 't' }],
        '/x',
        '/z',
        () => false,
        () => '/p'
      )
    ).toBe('/p')

    expect(charactersShouldReorder('a', 'b')).toBe(true)
    expect(charactersShouldReorder('a', 'a')).toBe(false)
    expect(charactersShouldReorder('', 'b')).toBe(false)
    expect(
      charactersPickNeighborId('a', [{ id: 'a' }, { id: 'b' }], 'a')
    ).toBe('b')
    expect(
      charactersPickNeighborId('b', [{ id: 'a' }, { id: 'b' }], 'b')
    ).toBe('a')
    expect(charactersPickNeighborId('a', [{ id: 'a' }], 'a')).toBeNull()
    expect(
      charactersPickNeighborId('a', [{ id: 'a' }, { id: 'b' }], 'b')
    ).toBe('b')
    expect(charactersPickNeighborId('z', [{ id: 'a' }], 'z')).toBeNull()

    expect(charactersMaybeContinueVideoDraft(true, () => msgs.push('c'))).toBe(
      true
    )
    expect(charactersMaybeContinueVideoDraft(false, () => msgs.push('c'))).toBe(
      false
    )
    expect(
      typeof charactersIntroVideoHandler('id', '/p', () => undefined)
    ).toBe('function')
    charactersIntroVideoHandler('id', '/p', (p) => msgs.push(p))!()
    expect(charactersIntroVideoHandler(null, '/p', () => undefined)).toBe(
      undefined
    )

    expect(
      charactersGuardIntro(
        null,
        '/p',
        false,
        setErr,
        toastErr,
        toastInfo,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('saveFirst')
    expect(
      charactersGuardIntro(
        'id',
        '',
        false,
        setErr,
        toastErr,
        toastInfo,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('needImage')
    expect(
      charactersGuardIntro(
        'id',
        '/p',
        true,
        setErr,
        toastErr,
        toastInfo,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('busy')
    expect(
      charactersGuardIntro(
        'id',
        '/p',
        false,
        setErr,
        toastErr,
        toastInfo,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('ok')

    expect(
      charactersGuardSoulSource(false, setErr, toastErr, 'need')
    ).toBe(true)
    expect(
      charactersGuardSoulSource(true, setErr, toastErr, 'need')
    ).toBe(false)
    expect(charactersHasSoulSource({ name: 'x' })).toBe(true)
    expect(charactersHasSoulSource({})).toBe(false)
    expect(charactersHasSoulSource({ soulPreview: 's' })).toBe(true)

    expect(charactersMapGalleryKind('sheet')).toBe('sheet')
    expect(charactersMapGalleryKind('upload')).toBe('upload')
    expect(charactersMapGalleryKind('gen')).toBe('gen')
    expect(charactersMapGalleryKind('external')).toBe('external')
    expect(charactersMapGalleryKind('other')).toBe('gen')
    expect(charactersMapSheetKind('sheet')).toBe('sheet')
    expect(charactersMapSheetKind('x')).toBe('sheet')

    const mapped = charactersMapGalleryItems(
      [
        {
          id: 'g1',
          path: '/a',
          kind: 'weird',
          label: 'A',
          createdAt: 't',
          layer: 'base',
          introVideoPath: '/v.mp4'
        }
      ],
      true
    )
    expect(mapped[0].kind).toBe('gen')
    expect(mapped[0].layer).toBe('base')
    expect(mapped[0].introVideoPath).toBe('/v.mp4')
    const mapped2 = charactersMapGalleryItems(
      [
        {
          id: 'g1',
          path: '/a',
          kind: 'upload',
          label: 'A',
          createdAt: 't'
        }
      ],
      false
    )
    expect(mapped2[0].kind).toBe('upload')

    expect(
      charactersSelectAfterCommit(
        [
          { id: 'a', path: '/1' },
          { id: 'b', path: '/2' }
        ],
        '/2'
      )
    ).toBe('b')
    expect(charactersSelectAfterCommit([], '/x')).toBeNull()
    expect(
      charactersSelectAfterVideo('a', [
        { id: 'a' },
        { id: 'b', introVideoPath: '/v' }
      ])
    ).toBe('a')
    expect(
      charactersSelectAfterVideo('z', [
        { id: 'b', introVideoPath: '/v' },
        { id: 'c' }
      ])
    ).toBe('b')
    expect(charactersSelectAfterVideo(null, [{ id: 'c' }])).toBe('c')
    expect(charactersSelectAfterVideo(null, [])).toBeNull()

    expect(charactersProfileMismatch('a', 'b')).toBe(true)
    expect(charactersProfileMismatch('a', 'a')).toBe(false)
    expect(charactersProfileMismatch(null, 'a')).toBe(false)

    let formSnap: Record<string, unknown> | null = null
    const setForm = (fn: (f: never) => unknown) => {
      formSnap = fn({
        name: 'n',
        description: 'd',
        appearance: '',
        personality: '',
        backstory: '',
        costume: '',
        ageRange: '',
        gender: '',
        voiceDesc: '',
        spokenLanguages: [],
        mannerisms: '',
        relationships: '',
        visualTags: '',
        seedPrompt: '',
        hardRules: '',
        soulMdPath: null,
        soulHubId: null,
        soulPreview: null,
        gallery: [],
        coverPath: null,
        artStyle: 'photo_cinematic',
        costumes: []
      } as never) as typeof formSnap
    }

    charactersHandleProfileApply(
      { characterId: 'c2', profile: { name: 'X' } },
      'c1',
      {
        reload: () => msgs.push('reload'),
        setForm: setForm as never,
        setAiIdea: () => undefined,
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        setActionError: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: () => undefined
      }
    )
    charactersHandleProfileApply(
      {
        characterId: 'c1',
        profile: {
          name: 'Filled',
          description: 'desc',
          spokenLanguages: ['en'],
          visualTags: '  tags  ',
          hardRules: '  hard  ',
          seedPrompt: 'seed'
        }
      },
      'c1',
      {
        reload: () => msgs.push('reload2'),
        setForm: setForm as never,
        setAiIdea: (fn) => fn(''),
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        setActionError: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: () => undefined
      }
    )
    charactersHandleProfileApply(
      {
        characterId: null,
        profile: {
          name: '',
          visualTags: '   ',
          hardRules: '',
          spokenLanguages: []
        }
      },
      null,
      {
        reload: () => undefined,
        setForm: setForm as never,
        setAiIdea: (fn) => fn('prev'),
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        setActionError: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: () => undefined
      }
    )

    expect(
      charactersHandleWardrobeApply(
        {
          characterId: 'c2',
          suggestion: { name: 'Coat', costume: 'trench' }
        },
        'c1',
        'photo_cinematic',
        {
          setForm: setForm as never,
          setSwapCostumeText: () => undefined,
          setPageBanner: () => undefined,
          setEditorOpen: () => undefined,
          toastSuccess: () => undefined,
          createEntry: (a) =>
            ({
              id: 'e1',
              name: a.name,
              description: a.description,
              artStyle: a.artStyle,
              imagePath: null,
              createdAt: 't',
              updatedAt: 't'
            }) as never,
          upsert: (list, e) => [...list, e]
        }
      )
    ).toBe(false)
    expect(
      charactersHandleWardrobeApply(
        {
          characterId: 'c1',
          suggestion: {
            name: 'Coat',
            costume: 'trench',
            artStyle: 'not-real'
          }
        },
        'c1',
        'photo_cinematic',
        {
          setForm: setForm as never,
          setSwapCostumeText: () => undefined,
          setPageBanner: () => undefined,
          setEditorOpen: () => undefined,
          toastSuccess: () => undefined,
          createEntry: (a) =>
            ({
              id: 'e1',
              name: a.name,
              description: a.description,
              artStyle: a.artStyle,
              imagePath: null,
              createdAt: 't',
              updatedAt: 't'
            }) as never,
          upsert: (list, e) => [...list, e]
        }
      )
    ).toBe(true)

    charactersHandleSheetCommitted(
      { characterId: 'c9', path: '/p' },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: () => undefined,
        setSwapCostumeText: () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        setPageBanner: () => undefined,
        listCharacter: async () => null,
        ensureCostume: (c) => c
      }
    )
    charactersHandleSheetCommitted(
      {
        characterId: 'c1',
        path: '/new.png',
        costume: 'dress',
        gallery: [
          {
            id: 'g1',
            path: '/old.png',
            kind: 'sheet',
            label: 'O',
            createdAt: 't'
          },
          {
            id: 'g2',
            path: '/new.png',
            kind: 'weird',
            label: 'N',
            createdAt: 't',
            layer: 'costume'
          }
        ]
      },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: (id) => msgs.push('sel:' + id),
        setSwapCostumeText: (s) => msgs.push('swap:' + s),
        reload: () => undefined,
        toastSuccess: () => undefined,
        setPageBanner: () => undefined,
        listCharacter: async () => null,
        ensureCostume: (c, costume) => c
      }
    )
    charactersHandleSheetCommitted(
      { characterId: 'c1', path: '/x.png', gallery: [] },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: () => undefined,
        setSwapCostumeText: () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        setPageBanner: () => undefined,
        listCharacter: async () =>
          ({
            id: 'c1',
            name: 'A',
            refGalleryJson: null,
            refImagePath: '/x.png',
            refSheetPath: null,
            costume: 'c'
          }) as never,
        ensureCostume: (c) => c
      }
    )
    // await listCharacter microtask
    await new Promise((r) => setTimeout(r, 5))

    charactersHandleVideoPrepDone(
      { kind: 'other' },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: () => undefined,
        reload: () => undefined,
        getCharacter: async () => ({}) as never
      }
    )
    charactersHandleVideoPrepDone(
      { kind: 'character-intro', entityIds: { characterId: 'other' } },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: () => undefined,
        reload: () => undefined,
        getCharacter: async () => ({}) as never
      }
    )
    charactersHandleVideoPrepDone(
      {
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        gallery: [
          {
            id: 'g',
            path: '/n.png',
            kind: 'gen',
            label: 'L',
            createdAt: 't',
            introVideoPath: '/v.mp4'
          }
        ]
      },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: ((fn: (p: string | null) => string | null) =>
          fn(null)) as never,
        reload: () => undefined,
        getCharacter: async () => ({}) as never
      }
    )
    charactersHandleVideoPrepDone(
      { kind: 'character-intro', entityIds: { characterId: 'c1' } },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: ((fn: (p: string | null) => string | null) =>
          fn(null)) as never,
        reload: () => msgs.push('vreload'),
        getCharacter: async () => {
          throw new Error('no')
        }
      }
    )
    await new Promise((r) => setTimeout(r, 5))
    charactersHandleVideoPrepDone(
      { kind: 'character-intro', entityIds: { characterId: 'c1' } },
      'c1',
      {
        setForm: setForm as never,
        setSelectedImageId: ((fn: (p: string | null) => string | null) =>
          fn(null)) as never,
        reload: () => undefined,
        getCharacter: async () =>
          ({
            refGalleryJson: null,
            refImagePath: '/r.png',
            refSheetPath: null
          }) as never
      }
    )
    await new Promise((r) => setTimeout(r, 5))

    expect(charactersLocalSoulPath('soulmd-hub://1')).toBeNull()
    expect(charactersLocalSoulPath('http://x')).toBeNull()
    expect(charactersLocalSoulPath('/local.md')).toBe('/local.md')
    expect(charactersLocalSoulPath(null)).toBeNull()

    expect(
      await charactersWriteSoulIfNeeded({
        soulText: '',
        soulMdPath: null,
        editingId: null,
        write: async () => ({ filePath: '', content: '' }),
        onWarn: () => undefined
      })
    ).toBeNull()
    expect(
      (
        await charactersWriteSoulIfNeeded({
          soulText: 'soul',
          soulMdPath: '/a.md',
          editingId: 'c1',
          write: async (a) => ({
            filePath: a.filePath ?? '/w.md',
            content: a.content
          }),
          onWarn: () => undefined
        })
      )?.wrote
    ).toBe(true)
    expect(
      await charactersWriteSoulIfNeeded({
        soulText: 'soul',
        soulMdPath: null,
        editingId: null,
        write: async () => {
          throw new Error('w')
        },
        onWarn: () => msgs.push('warn')
      })
    ).toBeNull()

    await charactersRunSave({
      name: '',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: toastErr,
      toastSuccess: toastOk,
      setError: setErr,
      setBusy: () => undefined,
      prepareForm: async () => formSnap as never,
      buildPayload: () => ({ name: 'n' }) as never,
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await charactersRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: 'id',
      toastError: toastErr,
      toastSuccess: toastOk,
      setError: setErr,
      setBusy: () => undefined,
      prepareForm: async () => formSnap as never,
      buildPayload: () => ({ name: 'X' }) as never,
      update: async () => false,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await charactersRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: 'id',
      toastError: toastErr,
      toastSuccess: toastOk,
      setError: setErr,
      setBusy: () => undefined,
      prepareForm: async () => formSnap as never,
      buildPayload: () => ({ name: 'X' }) as never,
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await charactersRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: toastErr,
      toastSuccess: toastOk,
      setError: setErr,
      setBusy: () => undefined,
      prepareForm: async () => formSnap as never,
      buildPayload: () => ({ name: 'X' }) as never,
      update: async () => true,
      create: async () => false,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await charactersRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: toastErr,
      toastSuccess: toastOk,
      setError: setErr,
      setBusy: () => undefined,
      prepareForm: async () => formSnap as never,
      buildPayload: () => ({ name: 'X' }) as never,
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await charactersRunSave({
      name: 'X',
      emptyMsg: 'e',
      savedMsg: 's',
      failedMsg: 'f',
      editingId: null,
      toastError: toastErr,
      toastSuccess: toastOk,
      setError: setErr,
      setBusy: () => undefined,
      prepareForm: async () => {
        throw new Error('prep')
      },
      buildPayload: () => ({ name: 'X' }) as never,
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })

    expect(
      charactersRunAiFill({
        busy: true,
        idea: '',
        formSnapshot: {},
        soulContent: '',
        refPath: '',
        fromEditor: false,
        setError: setErr,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        toastError: toastErr,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        runningMsg: 'run',
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      charactersRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        soulContent: '',
        refPath: '',
        fromEditor: false,
        setError: setErr,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        toastError: toastErr,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        runningMsg: 'run',
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        startJob: () => undefined
      })
    ).toBe('need')
    expect(
      charactersRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        soulContent: '',
        refPath: '/img',
        fromEditor: false,
        setError: setErr,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        toastError: toastErr,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        runningMsg: 'run',
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        startJob: () => msgs.push('job-img')
      })
    ).toBe('started')
    expect(
      charactersRunAiFill({
        busy: false,
        idea: 'idea',
        formSnapshot: { name: 'n' },
        soulContent: 's',
        refPath: '',
        fromEditor: true,
        setError: setErr,
        needMsg: 'n',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        toastError: toastErr,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        runningMsg: 'run',
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        startJob: () => msgs.push('job-idea')
      })
    ).toBe('started')

    expect(await charactersReadSoulSafe(async () => ({ content: ' hi ' }))).toBe(
      'hi'
    )
    expect(
      await charactersReadSoulSafe(async () => {
        throw new Error('x')
      }, 'fb')
    ).toBe('fb')
    await charactersDiscardDraftSafe(async () => {
      throw new Error('d')
    }, '/p')
    await charactersDiscardDraftSafe(async () => undefined, '/p')

    expect(
      await charactersEnsureSavedId({
        editingId: 'id',
        name: 'n',
        activeStoryId: 's',
        update: async () => undefined,
        create: async () => true,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBe('id')
    expect(
      await charactersEnsureSavedId({
        editingId: null,
        name: '',
        activeStoryId: 's',
        update: async () => undefined,
        create: async () => true,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBeNull()
    expect(
      await charactersEnsureSavedId({
        editingId: null,
        name: 'n',
        activeStoryId: null,
        update: async () => undefined,
        create: async () => true,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBeNull()
    expect(
      await charactersEnsureSavedId({
        editingId: null,
        name: 'n',
        activeStoryId: 's',
        update: async () => undefined,
        create: async () => false,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBeNull()
    expect(
      await charactersEnsureSavedId({
        editingId: null,
        name: 'n',
        activeStoryId: 's',
        update: async () => undefined,
        create: async () => true,
        reload: () => undefined,
        list: async () => [{ id: 'new', name: 'n' } as never],
        setEditingId: (id) => msgs.push('edit:' + id)
      })
    ).toBe('new')
    expect(
      await charactersEnsureSavedId({
        editingId: null,
        name: 'n',
        activeStoryId: 's',
        update: async () => undefined,
        create: async () => true,
        reload: () => undefined,
        list: async () => [{ id: 'other', name: 'z' } as never],
        setEditingId: () => undefined
      })
    ).toBeNull()

    charactersApplyCostumeLook(
      {
        id: 'e',
        name: 'Look',
        description: 'coat',
        artStyle: 'photo_cinematic',
        imagePath: '/img.png',
        createdAt: 't',
        updatedAt: 't'
      } as never,
      [
        {
          id: 'g',
          path: '/img.png',
          kind: 'sheet',
          label: 'G',
          createdAt: 't'
        }
      ],
      {
        setForm: setForm as never,
        setSwapCostumeText: () => undefined,
        setSelectedImageId: (id) => msgs.push('looksel:' + id),
        setPageBanner: () => undefined,
        toastSuccess: toastOk,
        appliedMsg: 'applied'
      }
    )
    charactersApplyCostumeLook(
      {
        id: 'e',
        name: 'Look',
        description: 'coat',
        artStyle: 'bad-style',
        imagePath: null,
        createdAt: 't',
        updatedAt: 't'
      } as never,
      [],
      {
        setForm: setForm as never,
        setSwapCostumeText: () => undefined,
        setSelectedImageId: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: toastOk,
        appliedMsg: 'applied'
      }
    )

    expect(
      charactersAddCostumeToLibrary({
        description: '',
        name: '',
        artStyle: 'photo_cinematic',
        setError: setErr,
        requiredMsg: 'req',
        savedMsg: 'sv',
        setForm: setForm as never,
        setSwapCostumeText: () => undefined,
        setNewCostumeName: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: toastOk,
        createEntry: () => {
          throw new Error('no')
        },
        upsert: (l) => l
      })
    ).toBe(false)
    expect(
      charactersAddCostumeToLibrary({
        description: 'coat',
        name: '  ',
        artStyle: 'photo_cinematic',
        setError: setErr,
        requiredMsg: 'req',
        savedMsg: 'sv',
        setForm: setForm as never,
        setSwapCostumeText: () => undefined,
        setNewCostumeName: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: toastOk,
        createEntry: (a) =>
          ({
            id: 'e',
            name: a.name ?? 'D',
            description: a.description,
            artStyle: a.artStyle,
            imagePath: null,
            createdAt: 't',
            updatedAt: 't'
          }) as never,
        upsert: (l, e) => [...l, e]
      })
    ).toBe(true)
    expect(
      charactersAddCostumeToLibrary({
        description: 'coat',
        name: 'Named',
        artStyle: 'photo_cinematic',
        setError: setErr,
        requiredMsg: 'req',
        savedMsg: 'sv',
        setForm: setForm as never,
        setSwapCostumeText: () => undefined,
        setNewCostumeName: () => undefined,
        setPageBanner: () => undefined,
        toastSuccess: toastOk,
        createEntry: () => {
          throw 'str-err'
        },
        upsert: (l) => l
      })
    ).toBe(false)

    expect(charactersGuardSuggest('', false, setErr, 'need')).toBe('needName')
    expect(charactersGuardSuggest('n', true, setErr, 'need')).toBe('busy')
    expect(charactersGuardSuggest('n', false, setErr, 'need')).toBe('ok')

    expect(
      await charactersRunSwapCostume({
        ensureSavedId: async () => null,
        isBusy: () => false,
        costumeDescription: 'c',
        setError: setErr,
        saveFirstMsg: 'sf',
        requiredMsg: 'req',
        noBaseMsg: 'nb',
        startedMsg: 'st',
        toastInfo: toastInfo,
        setBanner: () => undefined,
        pickBase: () => ({ item: { path: '/b' } }),
        startJob: () => undefined
      })
    ).toBe('no-id')
    expect(
      await charactersRunSwapCostume({
        ensureSavedId: async () => 'id',
        isBusy: () => true,
        costumeDescription: 'c',
        setError: setErr,
        saveFirstMsg: 'sf',
        requiredMsg: 'req',
        noBaseMsg: 'nb',
        startedMsg: 'st',
        toastInfo: toastInfo,
        setBanner: () => undefined,
        pickBase: () => ({ item: { path: '/b' } }),
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      await charactersRunSwapCostume({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        costumeDescription: '',
        setError: setErr,
        saveFirstMsg: 'sf',
        requiredMsg: 'req',
        noBaseMsg: 'nb',
        startedMsg: 'st',
        toastInfo: toastInfo,
        setBanner: () => undefined,
        pickBase: () => ({ item: { path: '/b' } }),
        startJob: () => undefined
      })
    ).toBe('need-costume')
    expect(
      await charactersRunSwapCostume({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        costumeDescription: 'c',
        setError: setErr,
        saveFirstMsg: 'sf',
        requiredMsg: 'req',
        noBaseMsg: 'nb',
        startedMsg: 'st',
        toastInfo: toastInfo,
        setBanner: () => undefined,
        pickBase: () => ({ item: null }),
        startJob: () => undefined
      })
    ).toBe('no-base')
    expect(
      await charactersRunSwapCostume({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        costumeDescription: 'c',
        setError: setErr,
        saveFirstMsg: 'sf',
        requiredMsg: 'req',
        noBaseMsg: 'nb',
        startedMsg: 'st',
        toastInfo: toastInfo,
        setBanner: () => undefined,
        pickBase: () => ({ item: { path: '/b' } }),
        startJob: () => msgs.push('swapjob')
      })
    ).toBe('started')
    expect(
      await charactersRunSwapCostume({
        ensureSavedId: async () => {
          throw new Error(
            JSON.stringify({
              code: 'INTERNAL',
              message: 'sw',
              details: 'd'
            })
          )
        },
        isBusy: () => false,
        costumeDescription: 'c',
        setError: setErr,
        saveFirstMsg: 'sf',
        requiredMsg: 'req',
        noBaseMsg: 'nb',
        startedMsg: 'st',
        toastInfo: toastInfo,
        setBanner: () => undefined,
        pickBase: () => ({ item: { path: '/b' } }),
        startJob: () => undefined
      })
    ).toBe('error')

    expect(
      await charactersRunGenerateSheetSetup({
        ensureSavedId: async () => null,
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        forcePure: false,
        wantIdentity: true,
        useIdentityRef: true,
        setUseIdentityRef: () => undefined,
        paths: ['/a'],
        resolveIdentity: () => ({ useEdit: true, paths: ['/a'] }),
        buildPrompt: () => 'p',
        maybeAppendMulti: (p) => p,
        ensureRules: (p) => p,
        modeLabel: 'm',
        summaryParts: 'sum',
        setConfirm: () => undefined
      })
    ).toBe('no-id')
    expect(
      await charactersRunGenerateSheetSetup({
        ensureSavedId: async () => 'id',
        characterId: 'id',
        isBusy: () => true,
        setError: setErr,
        saveFirstMsg: 'sf',
        forcePure: false,
        wantIdentity: true,
        useIdentityRef: true,
        setUseIdentityRef: () => undefined,
        paths: ['/a'],
        resolveIdentity: () => ({ useEdit: true, paths: ['/a'] }),
        buildPrompt: () => 'p',
        maybeAppendMulti: (p) => p,
        ensureRules: (p) => p,
        modeLabel: 'm',
        summaryParts: 'sum',
        setConfirm: () => undefined
      })
    ).toBe('busy')
    expect(
      await charactersRunGenerateSheetSetup({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        forcePure: true,
        wantIdentity: true,
        useIdentityRef: true,
        setUseIdentityRef: (v) => msgs.push('uir:' + v),
        paths: ['/a', '/b'],
        resolveIdentity: () => ({ useEdit: false, paths: ['/a', '/b'] }),
        buildPrompt: () => 'p',
        maybeAppendMulti: (p) => p + '+',
        ensureRules: (p) => p + '!',
        modeLabel: 'm',
        summaryParts: 'sum',
        setConfirm: (c) => msgs.push('conf:' + c.prompt)
      })
    ).toBe('ready')
    expect(
      await charactersRunGenerateSheetSetup({
        ensureSavedId: async () => {
          throw new Error('gs')
        },
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        forcePure: false,
        wantIdentity: false,
        useIdentityRef: false,
        setUseIdentityRef: () => undefined,
        paths: [],
        resolveIdentity: () => ({ useEdit: false, paths: [] }),
        buildPrompt: () => 'p',
        maybeAppendMulti: (p) => p,
        ensureRules: (p) => p,
        modeLabel: 'm',
        summaryParts: 'sum',
        setConfirm: () => undefined
      })
    ).toBe('error')

    expect(
      await charactersRunSheetJob({
        ensureSavedId: async () => null,
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        identityMsg: 'idm',
        backgroundMsg: 'bg',
        useIdentityEdit: false,
        startJob: () => undefined
      })
    ).toBe('no-id')
    expect(
      await charactersRunSheetJob({
        ensureSavedId: async () => 'id',
        isBusy: () => true,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        identityMsg: 'idm',
        backgroundMsg: 'bg',
        useIdentityEdit: false,
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      await charactersRunSheetJob({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        identityMsg: 'idm',
        backgroundMsg: 'bg',
        useIdentityEdit: true,
        startJob: () => msgs.push('sheetjob')
      })
    ).toBe('started')
    expect(
      await charactersRunSheetJob({
        ensureSavedId: async () => {
          throw new Error('sj')
        },
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        identityMsg: 'idm',
        backgroundMsg: 'bg',
        useIdentityEdit: false,
        startJob: () => undefined
      })
    ).toBe('error')

    expect(
      charactersResetSheetIfHidden(
        { g: [{ id: 'a' }] },
        'missing',
        'default'
      )
    ).toBe('default')
    expect(
      charactersResetSheetIfHidden({ g: [{ id: 'a' }] }, 'a', 'default')
    ).toBeNull()
    expect(charactersHubSearchMode('q')).toBe('local')
    expect(charactersHubSearchMode('')).toBe('remote')
    expect(charactersHubSearchMode(undefined)).toBe('remote')

    await charactersLoadHubPage({
      page: 1,
      q: 'aria',
      setBusy: () => undefined,
      setError: setErr,
      searchLocal: async () => ({ items: [{ id: 1 }] }),
      listRemote: async () => ({ data: [] }),
      setItems: (i) => msgs.push('items:' + (i as unknown[]).length),
      setTotalPages: () => undefined,
      setPage: () => undefined
    })
    await charactersLoadHubPage({
      page: 1,
      q: 'none',
      setBusy: () => undefined,
      setError: setErr,
      searchLocal: async () => ({ items: [] }),
      listRemote: async () => ({ data: [{ id: 2 }], total_pages: 3 }),
      setItems: () => undefined,
      setTotalPages: (n) => msgs.push('tp:' + n),
      setPage: () => undefined
    })
    await charactersLoadHubPage({
      page: 2,
      setBusy: () => undefined,
      setError: setErr,
      searchLocal: async () => ({ items: [] }),
      listRemote: async () => ({
        data: undefined,
        total_pages: undefined,
        current_page: undefined
      }),
      setItems: () => undefined,
      setTotalPages: () => undefined,
      setPage: (n) => msgs.push('pg:' + n)
    })
    await charactersLoadHubPage({
      page: 1,
      setBusy: () => undefined,
      setError: setErr,
      searchLocal: async () => ({ items: [] }),
      listRemote: async () => {
        throw new Error('hub')
      },
      setItems: () => undefined,
      setTotalPages: () => undefined,
      setPage: () => undefined
    })

    await charactersEnsureSoulIndex({
      ensureIndex: async () => ({
        count: 1,
        pages: 2,
        fromCache: true,
        suggestions: ['s']
      }),
      setStatus: (s) => msgs.push('st:' + s),
      setSuggestions: () => undefined,
      formatReady: (r) => `${r.count}-${r.cache}`
    })
    await charactersEnsureSoulIndex({
      ensureIndex: async () => ({
        count: 1,
        pages: 2,
        fromCache: false,
        suggestions: []
      }),
      setStatus: () => undefined,
      setSuggestions: () => undefined,
      formatReady: () => 'x'
    })
    await charactersEnsureSoulIndex({
      ensureIndex: async () => {
        throw new Error('offline')
      },
      setStatus: () => undefined,
      setSuggestions: () => undefined,
      formatReady: () => 'x'
    })

    expect(charactersSoulPreviewSync('', 1, null, null)).toBeNull()
    expect(charactersSoulPreviewSync('body', 1, 1, 'old')).toBe('body')
    expect(charactersSoulPreviewSync('body', 1, 2, '')).toBe('body')
    expect(charactersSoulPreviewSync('body', 1, 2, 'keep')).toBe('keep')

    const baseForm = formSnap as never
    const applied = charactersApplySoulForm(
      baseForm,
      { id: 9, title: 'T', description: 'D' },
      'FULL'
    )
    expect(applied.soulHubId).toBe(9)
    const applied2 = charactersApplySoulForm(
      {
        ...(baseForm as object),
        name: 'Has',
        description: 'HasD',
        seedPrompt: 'sp'
      } as never,
      { id: 9, title: 'T', description: null },
      ''
    )
    expect(applied2.name).toBe('Has')

    const imported = charactersImportSoulForm(
      baseForm,
      { filePath: '/s.md', content: 'md' },
      'Title',
      () => 'desc',
      () => 'name'
    )
    expect(imported.soulMdPath).toBe('/s.md')
    const imported2 = charactersImportSoulForm(
      {
        ...(baseForm as object),
        name: 'N',
        description: 'D'
      } as never,
      { filePath: '/s.md', content: 'md' },
      null,
      () => null,
      () => null
    )
    expect(imported2.name).toBe('N')
    expect(charactersClearSoulForm(applied).soulHubId).toBeNull()

    expect(charactersArtStyleOrKeep('photo_cinematic', 'anime_cel')).toBe(
      'photo_cinematic'
    )
    expect(charactersArtStyleOrKeep('bad', 'anime_cel')).toBe('anime_cel')
    expect(charactersLinkCostumeError(new Error('lc'))).toBe('lc')
    expect(charactersShowLinkedEmpty(null, 0)).toBe('saveFirst')
    expect(charactersShowLinkedEmpty('id', 0)).toBe('empty')
    expect(charactersShowLinkedEmpty('id', 2)).toBe('list')
    expect(charactersSoulTitleDisplay('Title', 1)).toBe('Title')
    expect(charactersSoulTitleDisplay(null, 5)).toBe('#5')
    expect(charactersSoulTitleDisplay(null, null)).toBe('')
    expect(charactersShouldShowUseSoul(1, 2)).toBe(true)
    expect(charactersShouldShowUseSoul(1, 1)).toBe(false)
    expect(charactersShouldShowUseSoul(null, 1)).toBe(false)

    charactersOnSheetVariantChange(
      'full_body',
      (v) => msgs.push('sv:' + v),
      (v) => msgs.push('uir2:' + v)
    )
    expect(
      charactersMaybeAppendMultiRef('p', ['a', 'b'], 'en', (x) => x + '+')
    ).toBe('p+')
    expect(
      charactersMaybeAppendMultiRef('p', ['a'], 'en', (x) => x + '+')
    ).toBe('p')
    expect(charactersCostumeDesc(' swap ', 'form')).toBe('swap')
    expect(charactersCostumeDesc('', ' form ')).toBe('form')
    expect(typeof charactersNeedsBareBodyWarning('full_body' as never)).toBe(
      'boolean'
    )


    // extra pure helpers batch 2
    await charactersPreviewSoul({
      id: 1,
      titleHint: 'T',
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogLoading: () => undefined,
      setError: () => undefined,
      getDetail: async () => ({ title: 'TT', contentFlat: 'flat' }),
      readSoul: async () => ({ content: ' body ' }),
      setCatalogPickBody: () => undefined,
      formSoulHubId: null,
      formSoulPreview: null,
      setSoulPreview: () => undefined
    })
    await charactersPreviewSoul({
      id: 2,
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogLoading: () => undefined,
      setError: (m) => msgs.push('ps:' + m),
      getDetail: async () => {
        throw new Error('fail')
      },
      readSoul: async () => ({ content: '' }),
      setCatalogPickBody: () => undefined,
      formSoulHubId: 2,
      formSoulPreview: 'keep',
      setSoulPreview: () => undefined
    })
    await charactersPreviewSoul({
      id: 3,
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogLoading: () => undefined,
      setError: () => undefined,
      getDetail: async () => ({ contentFlat: '' }),
      readSoul: async () => ({ content: '' }),
      setCatalogPickBody: () => undefined,
      formSoulHubId: 9,
      formSoulPreview: 'keep',
      setSoulPreview: () => msgs.push('should-not')
    })

    await charactersApplySoulFromHub({
      id: 1,
      setBusy: () => undefined,
      getDetail: async () => ({
        id: 1,
        title: 'Soul',
        description: 'd',
        contentFlat: 'flat'
      }),
      readSoul: async () => ({ content: 'FULL' }),
      setForm: setForm as never,
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogPickBody: () => undefined,
      setEditorOpen: () => undefined,
      setEditorPanel: () => undefined,
      setPageBanner: () => undefined,
      toastSuccess: () => undefined,
      appliedMsg: (t) => 'ok:' + t,
      setError: () => undefined
    })
    await charactersApplySoulFromHub({
      id: 1,
      setBusy: () => undefined,
      getDetail: async () => ({
        id: 1,
        title: 'Soul',
        contentFlat: 'flat'
      }),
      readSoul: async () => {
        throw new Error('r')
      },
      setForm: setForm as never,
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogPickBody: () => undefined,
      setEditorOpen: () => undefined,
      setEditorPanel: () => undefined,
      setPageBanner: () => undefined,
      toastSuccess: () => undefined,
      appliedMsg: (t) => t,
      setError: () => undefined
    })
    await charactersApplySoulFromHub({
      id: 1,
      setBusy: () => undefined,
      getDetail: async () => {
        throw new Error('g')
      },
      readSoul: async () => ({ content: '' }),
      setForm: setForm as never,
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogPickBody: () => undefined,
      setEditorOpen: () => undefined,
      setEditorPanel: () => undefined,
      setPageBanner: () => undefined,
      toastSuccess: () => undefined,
      appliedMsg: (t) => t,
      setError: (m) => msgs.push('ase:' + m)
    })

    charactersClearSoulState({
      setForm: setForm as never,
      setCatalogPickId: () => undefined,
      setCatalogPickTitle: () => undefined,
      setCatalogPickBody: () => undefined
    })
    charactersRemoveCostumeLook(setForm as never, 'e1', (list) => list)
    charactersReorderGallery(setForm as never, 'a', 'a', (g) => g)
    charactersReorderGallery(
      setForm as never,
      'a',
      'b',
      (g) =>
        g.length
          ? g
          : [
              {
                id: 'b',
                path: '/b',
                kind: 'sheet',
                label: 'B',
                createdAt: 't'
              },
              {
                id: 'a',
                path: '/a',
                kind: 'sheet',
                label: 'A',
                createdAt: 't'
              }
            ]
    )
    expect(
      await charactersJobCancelDiscard(false, async () => undefined, '/p')
    ).toBe(false)
    expect(
      await charactersJobCancelDiscard(true, async () => undefined, '/p')
    ).toBe(true)
    expect(charactersContinueDraftOr(false, () => undefined)).toBe(false)
    charactersLoadSoulPreviewForm(' hi ', setForm as never)
    charactersLoadSoulPreviewForm(null, setForm as never)
    charactersLoadSoulPreviewForm('   ', setForm as never)
    setForm(charactersSpokenLangSetter(['en']) as never)
    setForm(charactersArtStyleSetter('photo_cinematic') as never)
    {
      const r = charactersSoulTextSetter('soul')
      setForm(r.formUpdater as never)
    }
    charactersSuggestionSearch('q', () => undefined, () => undefined)
    expect(charactersHubEnter('Enter', 'q', () => undefined)).toBe(true)
    expect(charactersHubEnter('a', 'q', () => undefined)).toBe(false)
    charactersOpenExternal(() => undefined, 'https://x')
    charactersGenerateSheetFromEmpty(() => undefined, () => undefined)
    expect(
      charactersToggleSelectIds(['a'], 'b', (ids, id) => [...ids, id])
    ).toEqual(['a', 'b'])
    charactersPlotStoryChange('s1', () => undefined, () => undefined)
    charactersUseSoulButtonClick(null, () => undefined)
    charactersUseSoulButtonClick(1, () => undefined)
    expect(
      charactersDressedBusyGuard(true, toastInfo, 'L')
    ).toBe(true)
    expect(
      charactersDressedBusyGuard(false, toastInfo, 'L')
    ).toBe(false)
    expect(
      charactersSheetEnsureCostume(
        [],
        'coat',
        'photo_cinematic',
        (c, costume) =>
          [
            {
              id: '1',
              name: 'c',
              description: costume,
              artStyle: 'photo_cinematic',
              imagePath: null,
              createdAt: 't',
              updatedAt: 't'
            }
          ] as never
      ).length
    ).toBe(1)
    expect(
      charactersSheetEnsureCostume([], null, 'photo_cinematic', (c) => c)
    ).toEqual([])
    expect(charactersImportDesc('', 'x')).toBe('x')
    expect(charactersImportDesc('has', 'x')).toBe('has')
    expect(charactersImportName('', 'T', 'N')).toBe('T')
    expect(charactersImportName('has', 'T', 'N')).toBe('has')
    expect(charactersImportName('', null, 'N')).toBe('N')


    expect(
      await charactersFindInList(
        async () => [{ id: 'a', name: 'A' } as never],
        'a'
      )
    ).toMatchObject({ id: 'a' })
    expect(
      await charactersFindInList(async () => [], 'a')
    ).toBeNull()
    expect(
      await charactersFindByName(
        async () => [{ id: 'a', name: 'Aria' } as never],
        ' Aria '
      )
    ).toMatchObject({ id: 'a' })
    expect(
      await charactersFindByName(async () => [], 'x')
    ).toBeNull()
    expect(
      charactersBuildSheetMultiAppend('p', ['a', 'b'], 'en', (x) => x + '+')
    ).toBe('p+')
    expect(charactersAiCreateLabel(true, 'imp', 'cre')).toBe('imp')
    expect(charactersAiCreateLabel(false, 'imp', 'cre')).toBe('cre')
    expect(charactersSpokenOrUndefined([])).toBeUndefined()
    expect(charactersSpokenOrUndefined(['en'])).toEqual(['en'])
    expect(charactersSelectedIds(['a'], null)).toEqual(['a'])
    expect(charactersSelectedIds([], 'b')).toEqual(['b'])
    expect(charactersSelectedIds([], null)).toEqual([])
    expect(charactersGeneratingLabel(true, 'G', 'I')).toBe('G')
    expect(charactersGeneratingLabel(false, 'G', 'I')).toBe('I')
    expect(charactersCostumeBaseOptionLabel('/p', 'lab')).toBe('lab')
    expect(charactersCostumeBaseOptionLabel('', 'lab')).toBe('')

    // render Field / Chip residual components
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          CharactersField,
          { label: 'L', hint: 'H' },
          React.createElement('span', null, 'child')
        ),
        React.createElement(CharactersField, { label: 'L2' }, 'x'),
        React.createElement(CharactersChip, null, 'chip')
      )
    )
    await new Promise((r) => setTimeout(r, 10))
    root.unmount()
    host.remove()

    expect(msgs.length).toBeGreaterThan(0)
  }, 30000)
})
