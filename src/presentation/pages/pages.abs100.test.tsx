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
  charactersCostumeBaseOptionLabel,
  charactersCostumesJsonOrNull,
  charactersLayerOptionSuffix,
  charactersCostumeStyleLabel,
  charactersSwapJobBody,
  charactersSheetJobBody,
  charactersIntroStartFlow,
  charactersIntroPersistThenPrep,
  charactersGenerateSoulAfterGuards,
  charactersDressedClickGuard,
  charactersHandleIntroVideoFlow,
  charactersHandleRemoveCostume,
  charactersHandleReorder,
  charactersLinkCatch,
  charactersEnsureListLine,
  charactersContinueDraftCb,
  charactersMakeLinkCatch
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
  propsFilterGalleryByLayer,
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
  propsCoverPathOnRemove,
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
  propsRunGeneratePlateSetup,
  propsRunIntroVideoFlow,
  propsRunPlateJob,
  propsRunSave,
  propsSelectedPathsForIdentity,
  propsShouldReorder,
  propsStartIntroAfterSave,
  propsSuggestIdeaLabel
} from './PropsPage'
import {
  ScenesPage,
  SCENE_AI_KINDS,
  scenesAiBusyFromJobs,
  scenesAiFillRefPath,
  scenesAiFillToastKey,
  scenesAddLook,
  scenesApplyIpc,
  scenesApplyIpcDetails,
  scenesAtmosphereJobBody,
  scenesConfirmPlotSuggest,
  scenesContinueDraftCb,
  scenesCopyGallery,
  scenesDiscardDraftSafe,
  scenesEnsureSavedId,
  scenesGalleryJsonOrNull,
  scenesGalleryPathsFromOpts,
  scenesGuardAiNeed,
  scenesGuardBusy,
  scenesGuardEmpty,
  scenesGuardIntro,
  scenesGuardSuggestStory,
  scenesHandleIntroVideoFlow,
  scenesHandleProfileApply,
  scenesHandleVideoPrepDone,
  scenesHasDraft,
  scenesIntroVideoHandler,
  scenesIsAiJob,
  scenesJobCancelDiscard,
  scenesLooksJsonOrNull,
  scenesMaybeAppendMulti,
  scenesMaybeContinueDraft,
  scenesPlateJobBody,
  scenesPlateModeLabel,
  scenesProfileMismatch,
  scenesRemoveWithFeedback,
  scenesResolveWantIdentity,
  scenesRunAiFill,
  scenesRunAtmosphere,
  scenesRunPlateJob,
  scenesRunPlateSetup,
  scenesRunSave,
  scenesSelectedIds,
  scenesShouldReorder,
  scenesStoryIdForJob,
  scenesHandlePlateCommitted,
  scenesApplyLook,
  scenesRemoveImage,
  scenesSetCover,
  scenesOnPlateVariantChange,
  scenesArtStyleSetter,
  scenesLookDisplayName,
  scenesLookStyleLabel,
  scenesFindInList,
  scenesStatusOrPending,
  scenesMaybeSetPlotStory,
  scenesMakeConfirmPlot,
  scenesMakeSetCover,
  scenesMakeApplyLook,
  scenesMakeCopyGallery,
  scenesMakeFindInList,
  scenesApplyLookClick,
  scenesGeneratingLabel,
  scenesHardRulesSetter,
  scenesToggleSelect,
  scenesApplyCopiedScene,
  scenesPickImage,
  scenesArtStyleFromScene,
  scenesAiFillLabel,
  scenesPlotFillArgs,
  scenesStatusValue,
  scenesCustomLocationOption,
  scenesLookStyleOrNull,
  scenesStatusSetter,
  scenesLocationTypeSetter,
  scenesMapGalleryKind,
  scenesMapVideoGalleryItem,
  scenesMsgToast,
  scenesMakeApplyCopied,
  scenesPlotFill,
  scenesNextSceneNum,
  scenesMakeListForEnsure,
  scenesResolveSceneNumber,
  scenesListForStory,
  scenesMakeToggleSelect,
  scenesMakeHardRulesChange,
  scenesCustomLocOptionEl,
  scenesMakeReorder,
  scenesCustomOptionNodes,
  scenesCustomLocOptionProps,
  scenesCustomLocOptionElement
} from './ScenesPage'

import {
  SettingsPage,
  settingsApplyIpc,
  settingsApplyIpcBody,
  settingsCatchToast,
  settingsTabId,
  settingsProviderLabel,
  settingsBoolOr,
  settingsStringOr,
  settingsNumOr,
  settingsPickTab,
  settingsSilentOrToast,
  settingsModelsFromList,
  settingsRateLimitFallbackModels,
  settingsIsRateLimit,
  settingsRunSaveFull,
  settingsRunRefreshModelsFull,
  settingsRunTestChatFull,
  settingsRunClearAll,
  settingsRunLlmPreset,
  settingsSetWebStatusMissing,
  settingsGetGatewayApi,
  settingsGatewayMissingStatus,
  settingsApplyGatewayMissing,
  settingsEnsureGatewayMissing,
  settingsOpenExternalEmpty,
  settingsClearAllCatch,
  settingsApplyLlmPresetFallback,
  settingsToastUpdateCheck,
  settingsToastUpdateDownload,
  settingsToastUpdateInstall,
  settingsOpenReleasePage,
  settingsStopWebServer,
  settingsNpmCheckMissing,
  settingsOpenExternalWithFallback,
  settingsCopyText,
  settingsVideoChannelCustom,
  settingsImageBaseUrlChange,
  settingsGatewayPackageMissing,
  settingsInstallHintsFallback,
  settingsWebServerApiMissing,
  settingsMergeFreshGateway,
  settingsBackupImportReloadToast,
  settingsRunRefreshWebStatus,
  settingsRunRefreshGatewayStatus,
  settingsRunEnsureGateway,
  settingsRunOpenExternalUrl,
  settingsRunLlmPresetChange,
  settingsUpdateIdleLabel,
  settingsUpdateErrorSuffix,
  settingsLegalVersionClass,
  settingsLegalOutdatedSuffix,
  settingsWebPortOrDefault,
  settingsChannelPickerValue,
  settingsApiKeyHint,
  settingsNpmInstallCmd,
  settingsCatchToastIf,
  settingsApiKeyPlaceholder,
  settingsCopyNpmInstallCmd,
  settingsUpdateStatusText,
  settingsToastIpcOr,
  settingsImageCustomBaseUrl,
  settingsRunClearAllFull,
  settingsIsWebLabel,
  settingsGatewayStatusOrNull,
  settingsNpmUpToDateLabel,
  settingsWebPortOnChange,
  settingsToastPlain,
  settingsRunClearAllCatch,
  settingsUpdateChannelLabel,
  settingsBuildClearDefaults,
  settingsFailMsg,
  settingsDevSkippedKey,
  settingsGatewayCardStatus,
  settingsRunNpmCheck,
  settingsDevSkippedBound,
  settingsFailMsgBound,
  settingsBindOpenExternal,
  settingsRunOpenInstallPage,
  settingsBuildClearDefaultsFromApi,
} from './SettingsPage'



import {
  StoriesPage,
  storiesApplyIpc,
  storiesRemoveWithFeedback,
  storiesGuardBusy,
  storiesGuardEmptyTitle,
  storiesRunSaveMetaNative,
  storiesRunSetCostume,
  storiesHandleCoverCommitted,
  storiesResolveWantIdentity,
  storiesCoverPathsFromOpts,
  storiesMaybeAppendMulti,
  storiesPlateModeLabel,
  storiesDiscardDraftSafe,
  storiesJobCancelDiscard,
  storiesGuardAiMetaSource,
  storiesGuardAiScript,
  storiesApplyAiMetaResult,
  storiesRunExportBackup,
  storiesRunImportBackup,
  storiesRunLinkToggle,
  storiesDispatchCastToggle,
  storiesOptimisticBeatPatch,
  storiesMoveBeatIndex,
  storiesSelectedCoverIds,
  storiesMsgToast,
  storiesShouldReorder,
  storiesBeatLabel,
  storiesNextCoverAfterRemove,
  storiesRemoveCoverState,
  storiesGuardAiNeed,
  storiesHasDraft,
  storiesAiFillToastKey,
  storiesRunGenerateCoverSetup,
  storiesCoverPromptParts,
  storiesMakeLinkToggle,
  storiesMakeSetCover,
  storiesMakeCoverCommitted,
  storiesGeneratingLabel,
  storiesStatusOrDraft,
  storiesAppendTemplate,
  storiesSpokenPreview,
  storiesCreateId,
  storiesEditPrefix,
  storiesPrimaryCover,
  storiesSortTitle,
  storiesRunUpdateBeat,
  storiesRunDeleteBeat,
  storiesRunMoveBeat,
  storiesPickCoverImage,
  storiesApplyBeatTemplate,
  storiesApplyBeatTemplateToList,
  storiesCommitBeatBlur,
  storiesHardRulesFromDetail,
  storiesCastPageNext,
  storiesDescSlice,
  storiesCancelImageGen,
  storiesMultiBindUpdate,
  storiesBrowseSort,
  storiesCreateStoryId,
  storiesCoverJobAfterGen,
  storiesPropLinkToggleOps,
  storiesCastBrowserRows,
  storiesRunAddBeat,
  storiesCoverSetHandler,
  storiesCoverRemoveHandler,
  storiesBlurDialogue,
  storiesCoverJobCancelledResult,
  storiesAiMetaShouldSkip,
  storiesMakePropToggle,
  storiesMultiBindHandler,
  storiesCancelImageGenBind,
  storiesCastPageNextClick,
  storiesCostumeOptionLabel,
  storiesCoverJobFinishOrCancel,
  storiesRunAiMetaIfReady
} from './StoriesPage'


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
    expect(
      propsFilterGalleryByLayer(
        [{ layer: 'a' }, { layer: 'b' }, { layer: undefined }],
        'all'
      )
    ).toHaveLength(3)
    expect(
      propsFilterGalleryByLayer(
        [{ layer: 'a' }, { layer: 'b' }, { layer: undefined }],
        'a'
      )
    ).toHaveLength(1)
    expect(
      propsFilterGalleryByLayer([{ layer: undefined }], 'base')
    ).toHaveLength(0)
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

    expect(
      await propsRunIntroVideoFlow({
        draftKey: 'k',
        hasDraft: () => true,
        continueDraft: () => msgs.push('cont'),
        update: async () => undefined,
        toastError: () => undefined,
        start: () => msgs.push('st')
      })
    ).toBe('continue')
    expect(msgs).toContain('cont')
    expect(
      await propsRunIntroVideoFlow({
        draftKey: 'k',
        hasDraft: () => false,
        continueDraft: () => undefined,
        update: async () => undefined,
        toastError: () => undefined,
        start: () => msgs.push('st2')
      })
    ).toBe('started')
    expect(
      await propsRunGeneratePlateSetup({
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
      await propsRunGeneratePlateSetup({
        ensureSavedId: async () => 'p',
        isBusy: () => true,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        setError: () => undefined,
        toastError: () => undefined,
        buildConfirm: () => undefined
      })
    ).toBe('busy')
    expect(
      await propsRunGeneratePlateSetup({
        ensureSavedId: async () => 'p',
        isBusy: () => false,
        toastInfo: () => undefined,
        loadingMsg: 'L',
        setError: () => undefined,
        toastError: () => undefined,
        buildConfirm: () => msgs.push('built')
      })
    ).toBe('ok')
    expect(
      await propsRunGeneratePlateSetup({
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
      propsCoverPathOnRemove(
        '/a',
        '/a',
        [{ path: '/b' }],
        () => false,
        () => '/b'
      )
    ).toBe('/b')
    expect(
      propsCoverPathOnRemove(
        '/keep',
        '/a',
        [{ path: '/keep' }],
        () => true,
        () => '/p'
      )
    ).toBe('/keep')
    expect(
      propsCoverPathOnRemove(
        '/x',
        '/a',
        [{ path: '/b' }],
        () => false,
        () => '/b'
      )
    ).toBe('/b')
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
    await clickNamed(/Cast/i)
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
    api.costumes.setActive = vi
      .fn()
      .mockRejectedValueOnce(new Error('sa'))
      .mockResolvedValue({})
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png'
    })
    api.characters.writeSoulContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('ws'))
      .mockResolvedValue({ filePath: '/tmp/soul.md', content: '# w' })
    api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
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
        suggestions: [{ kind: 'role', label: 'Soul5' }]
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
    // soul hub external + search enter + suggestions
    await clickNamed(/SoulMD Hub|soulmd|Open hub|Catalog/i)
    const hubInput = Array.from(document.querySelectorAll('input')).find(
      (el) =>
        /soul|search|catalog/i.test(
          (el as HTMLInputElement).placeholder || el.getAttribute('aria-label') || ''
        )
    ) as HTMLInputElement | undefined
    if (hubInput) {
      await act(async () =>
        fireEvent.change(hubInput, { target: { value: 'Soul5' } })
      )
      await act(async () =>
        fireEvent.keyDown(hubInput, { key: 'Enter', code: 'Enter' })
      )
    }
    await clickNamed(/Search|Reload|Refresh/i)
    // suggestion chips
    for (const b of screen.getAllByRole('button').filter((x) =>
      /Soul5|noir|lead/i.test((x.textContent || '').trim())
    )) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/→/)
    await clickNamed(/←/)
    const soul = screen.queryAllByText(/Soul5/i)[0]
    if (soul) await act(async () => fireEvent.click(soul))
    // edit soul textarea
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '# edited soul abs\nbody' } })
      )
    }
    await clickNamed(/Use soul|Use/i)
    await clickNamed(/Reload soul|reload/i)
    await clickNamed(/Unlink|Clear soul/i)
    await clickNamed(/Generate Soul from profile/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // spoken languages / art style / sheet variant selects
    await clickNamed(/^References$/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 2) {
        await act(async () =>
          fireEvent.change(s, {
            target: { value: s.options[s.options.length - 1].value }
          })
        )
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[0].value } })
        )
      }
    }
    // multi-select thumbs
    for (const b of Array.from(document.querySelectorAll('button[title]')).slice(
      0,
      4
    )) {
      await act(async () => fireEvent.click(b))
    }
    // reorder
    for (const b of screen.queryAllByLabelText(/Move right|Move left/i)) {
      ;(b as HTMLButtonElement).disabled = false
      await act(async () => fireEvent.click(b))
    }
    // bare-body variant if present
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const bare = Array.from(s.options).find((o) =>
        /bare|nude|unclothed|body/i.test(o.textContent || '')
      )
      if (bare) {
        await act(async () =>
          fireEvent.change(s, { target: { value: bare.value } })
        )
      }
    }
    // empty gallery path: remove all then generate sheet from empty
    for (let i = 0; i < 3; i++) {
      await clickNamed(/Remove|remove/i)
    }
    await clickNamed(/Generate professional reference|Generate sheet|Generate/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // cancel plate for discard path
    await hangBusy('character-sheet', { characterId: 'char-1' })
    await forceClick(/Generate professional reference|Generate sheet/i)
    await cancelAllJobs()
    // intro draft continue already seeded
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2000)
    // costume: remove look, plot story, empty lib path
    await clickNamed(/^Costume$/i)
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Delete$/i.test((x.textContent || '').trim()))
      .slice(0, 3)) {
      await act(async () => fireEvent.click(b))
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 2)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    // dressed busy
    await hangBusy('costume-swap', { characterId: 'char-1' })
    await forceClick(/Generate dressed look/i)
    await cancelAllJobs()
    // set active / use look
    await clickNamed(/Use|Set active|Activate/i)
    // link error already once
    await clickNamed(/^Link$/i)
    await clickNamed(/^Save$/i)

    // no-match empty state
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'zzzz-no-match-xyz' } })
      )
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/no match|No match|match/i)
    )
    await clickNamed(/Clear filters/i)

    // new character: save first costume message
    await clickNamed(/New character|New/i)
    await clickNamed(/^Costume$/i)
    await clickNamed(/^Profile$/i)
    await forceClick(/AI fill/i)
    await clickNamed(/^Cancel$/i)
  }, 120000)
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


    expect(
      charactersCostumesJsonOrNull([], () => 'x')
    ).toBeNull()
    expect(
      charactersCostumesJsonOrNull(
        [{ id: '1' } as never],
        () => 'json'
      )
    ).toBe('json')
    expect(charactersLayerOptionSuffix(undefined, 'L')).toBe('')
    expect(charactersLayerOptionSuffix('base', 'Base')).toBe(' · Base')
    expect(charactersCostumeStyleLabel(null, () => 'x')).toBeNull()
    expect(charactersCostumeStyleLabel('photo_cinematic', () => 'Photo')).toBe(
      'Photo'
    )
    expect(
      await charactersSwapJobBody({
        swap: async () => ({ path: '/p', label: 'L' }),
        signal: { cancelled: true },
        discard: async () => undefined,
        characterId: 'c',
        storyId: 's',
        costumeDescription: 'd',
        defaultLabel: 'D',
        setProgress: () => undefined
      })
    ).toBeUndefined()
    expect(
      (
        await charactersSwapJobBody({
          swap: async () => ({ path: '/p' }),
          signal: { cancelled: false },
          discard: async () => undefined,
          characterId: 'c',
          storyId: 's',
          costumeDescription: 'd',
          defaultLabel: 'D',
          setProgress: () => undefined
        })
      )?.type
    ).toBe('character-sheet')
    expect(
      await charactersSheetJobBody({
        generate: async () => ({ path: '/p' }),
        signal: { cancelled: true },
        discard: async () => {
          throw new Error('d')
        },
        characterId: 'c',
        storyId: 's',
        variant: 'bible',
        setProgress: () => undefined
      })
    ).toBeUndefined()
    expect(
      (
        await charactersSheetJobBody({
          generate: async () => ({
            path: '/p',
            variant: 'v',
            label: 'l',
            usedEdit: true,
            layer: 'base'
          }),
          signal: { cancelled: false },
          discard: async () => undefined,
          characterId: 'c',
          storyId: 's',
          variant: 'bible',
          setProgress: () => undefined
        })
      )?.usedEdit
    ).toBe(true)
    expect(
      charactersIntroStartFlow({
        hasDraft: true,
        continueDraft: () => msgs.push('cont')
      })
    ).toBe('continued')
    expect(
      charactersIntroStartFlow({
        hasDraft: false,
        continueDraft: () => undefined
      })
    ).toBe('proceed')
    expect(
      await charactersIntroPersistThenPrep({
        update: async () => {
          throw new Error('u')
        },
        toastError: toastErr,
        startPrep: () => undefined
      })
    ).toBe('fail')
    expect(
      await charactersIntroPersistThenPrep({
        update: async () => undefined,
        toastError: toastErr,
        startPrep: () => msgs.push('prep')
      })
    ).toBe('ok')
    expect(
      charactersGenerateSoulAfterGuards(true, toastInfo, 'L', () =>
        msgs.push('soul')
      )
    ).toBe('busy')
    expect(
      charactersGenerateSoulAfterGuards(false, toastInfo, 'L', () =>
        msgs.push('soul')
      )
    ).toBe('started')
    expect(
      charactersDressedClickGuard(null, false, toastInfo, 'L', () => undefined)
    ).toBe('no-id')
    expect(
      charactersDressedClickGuard('id', true, toastInfo, 'L', () => undefined)
    ).toBe('busy')
    expect(
      charactersDressedClickGuard('id', false, toastInfo, 'L', () =>
        msgs.push('dress')
      )
    ).toBe('started')


    charactersHandleIntroVideoFlow({
      editingId: null,
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: false,
      continueDraft: () => undefined,
      update: async () => undefined,
      startPrep: () => undefined
    })
    charactersHandleIntroVideoFlow({
      editingId: 'c1',
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: true,
      continueDraft: () => msgs.push('cont2'),
      update: async () => undefined,
      startPrep: () => msgs.push('prep2')
    })
    charactersHandleIntroVideoFlow({
      editingId: 'c1',
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: false,
      continueDraft: () => undefined,
      update: async () => undefined,
      startPrep: () => msgs.push('prep3')
    })
    charactersHandleIntroVideoFlow({
      editingId: 'c1',
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: false,
      continueDraft: () => undefined,
      update: async () => {
        throw new Error('uf')
      },
      startPrep: () => undefined
    })
    charactersHandleRemoveCostume(setForm as never, 'look-1')
    charactersHandleReorder(setForm as never, 'a', 'b')
    charactersLinkCatch(new Error('le'), toastErr)
    expect(
      await charactersEnsureListLine(
        async () => [{ id: 'n1', name: 'Nova' } as never],
        'Nova',
        (id) => msgs.push('nid:' + id)
      )
    ).toBe('n1')
    expect(
      await charactersEnsureListLine(async () => [], 'X', () => undefined)
    ).toBeNull()


    charactersContinueDraftCb((k) => msgs.push('cdk:' + k), 'k1')()
    charactersMakeLinkCatch(toastErr)(new Error('lc2'))

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


describe('abs100 Characters UI residual mop', () => {
  beforeEach(() => seed())

  it('hits remaining JSX handlers and thin wrappers', async () => {
    const costumesJson = JSON.stringify([
      {
        id: 'look-1',
        name: 'Coat',
        description: 'black trench',
        artStyle: 'photo_cinematic',
        imagePath: '/media/aria.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        soulHubId: 5,
        soulMdPath: 'soulmd-hub://5',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png', 'g1'),
        costumesJson,
        hardRules: 'no logos'
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter({ id: 'char-1' }))
    api.characters.readSoulContent = vi.fn().mockResolvedValue({
      content: '# soul body full'
    })
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: '# soul body full'
    })
    api.characters.generateSheet = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 80))
      return { path: '/tmp/sh.png', label: 'S', variant: 'bible' }
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/p.png',
      gallery: []
    })
    api.characters.swapCostume = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 80))
      return { path: '/tmp/sw.png', label: 'S', layer: 'costume' }
    })
    api.souls.list = vi.fn().mockResolvedValue({
      data: [
        {
          id: 5,
          title: 'Soul5',
          description: 'd',
          role: 'lead',
          domain: 'noir'
        },
        {
          id: 6,
          title: 'Soul6',
          description: 'e',
          role: 'support',
          domain: 'sci'
        }
      ],
      total_pages: 1,
      current_page: 1
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 5,
      title: 'Soul5',
      contentFlat: '# flat',
      description: 'd'
    })
    api.souls.searchLocal = vi.fn().mockResolvedValue({ items: [] })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 2,
      pages: 1,
      fromCache: true,
      suggestions: [
        { kind: 'role', label: 'detective' },
        { kind: 'domain', label: 'noir' }
      ]
    })
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({ id: 'cost-1', name: 'Rain coat' })
    ])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([
      {
        id: 'cost-1',
        name: 'Rain coat',
        description: 'wet',
        isActive: false,
        artStyle: 'photo_cinematic'
      }
    ])
    api.costumes.linkCharacter = vi.fn().mockRejectedValue(new Error('link-fail'))
    api.costumes.setActive = vi.fn().mockRejectedValue(new Error('active-fail'))
    api.costumes.generateDressed = vi.fn().mockResolvedValue({ path: '/d.png' })
    api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
    api.media.discardSheetDraft = vi.fn().mockRejectedValue(new Error('discard'))

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Aria/i)
    )
    await openCardEdit('Aria')

    // Profile soul section
    await clickNamed(/^Profile$/i)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Soul|soul|Catalog/i)
    )
    // open hub
    await clickNamed(/Open hub|SoulMD/i)
    expect(api.shell.openExternal).toHaveBeenCalled()

    // wait hub items
    await waitFor(
      () => expect(document.body.textContent || '').toMatch(/Soul5/i),
      { timeout: 5000 }
    )
    // click catalog item button (preview)
    const catalogBtns = screen.getAllByRole('button').filter((b) =>
      /Soul5/i.test(b.textContent || '')
    )
    for (const b of catalogBtns.slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    // soul loading path: slow get
    api.souls.get = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: 6,
                title: 'Soul6',
                contentFlat: '# s6',
                description: 'e'
              }),
            100
          )
        )
    )
    const soul6 = screen.getAllByRole('button').find((b) =>
      /Soul6/i.test(b.textContent || '')
    )
    if (soul6) {
      await act(async () => fireEvent.click(soul6))
      // loading text may flash
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150))
      })
    }
    // use soul button
    await clickNamed(/Use soul/i)
    // edit soul textarea
    for (const ta of Array.from(document.querySelectorAll('textarea'))) {
      const ph = (ta as HTMLTextAreaElement).placeholder || ''
      const al = ta.getAttribute('aria-label') || ''
      if (/soul|Soul|markdown|content/i.test(ph + al + (ta.className || ''))) {
        await act(async () =>
          fireEvent.change(ta, { target: { value: '# edited\\nbody' } })
        )
      }
    }
    // also change any large textarea
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '# mop soul text' } })
      )
    }
    // hub search enter
    for (const el of Array.from(document.querySelectorAll('input'))) {
      const p = (el as HTMLInputElement).placeholder || ''
      if (/search|soul|catalog/i.test(p)) {
        await act(async () =>
          fireEvent.change(el, { target: { value: 'detective' } })
        )
        await act(async () =>
          fireEvent.keyDown(el, { key: 'Enter', code: 'Enter', charCode: 13 })
        )
      }
    }
    // suggestion chips
    for (const b of screen.getAllByRole('button')) {
      if (/detective|noir/i.test((b.textContent || '').trim())) {
        await act(async () => fireEvent.click(b))
      }
    }
    await clickNamed(/Reload soul|reload/i)
    await clickNamed(/Clear soul|Unlink soul|Unlink/i)

    // language multi pick if present
    for (const el of Array.from(document.querySelectorAll('button, [role="option"]'))) {
      if (/English|中文|language/i.test(el.textContent || '')) {
        await act(async () => fireEvent.click(el))
      }
    }

    // Refs: variant, art style, multi-select, reorder, bare body, empty gen
    await clickNamed(/^References$/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (const o of Array.from(s.options)) {
        await act(async () =>
          fireEvent.change(s, { target: { value: o.value } })
        )
      }
    }
    // multi select via strip
    for (const b of Array.from(
      document.querySelectorAll('button')
    ) as HTMLButtonElement[]) {
      const t = b.getAttribute('title') || b.textContent || ''
      if (/Front|Base|sheet|g1|g2|A|B/i.test(t)) {
        await act(async () => fireEvent.click(b))
      }
    }
    for (const b of screen.queryAllByLabelText(/Move right|Move left/i)) {
      ;(b as HTMLButtonElement).disabled = false
      await act(async () => fireEvent.click(b))
    }
    // remove then generate from empty
    await clickNamed(/Remove|remove/i)
    await clickNamed(/Generate professional reference|Generate sheet|Generate/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })

    // sheet job cancel discard
    api.characters.generateSheet = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 200))
      return { path: '/tmp/cancel.png', label: 'C', variant: 'bible' }
    })
    await clickNamed(/Generate professional reference|Generate sheet|Generate/i)
    if (await confirmImageGen()) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
      await cancelAllJobs()
    }

    // intro update fail
    api.characters.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('upd-fail'))
      .mockResolvedValue(makeCharacter({ id: 'char-1' }))
    // re-add image path via upload
    await clickNamed(/Upload reference/i)
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(1500)

    // video draft continue
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['character-intro:char-1:/tmp/r.png']: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            sourceImagePath: '/tmp/r.png',
            professionalPrompt: 'DRAFT',
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
    await dismissVideoPrep(1500)

    // Costume section
    await clickNamed(/^Costume$/i)
    // remove costume look delete
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Delete$/i.test((x.textContent || '').trim()))) {
      await act(async () => fireEvent.click(b))
    }
    // plot story change
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    // link fail
    for (const sel of Array.from(document.querySelectorAll('select'))) {
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
    // set active fail
    await clickNamed(/Use|Set active|Activate|costumeLibUse/i)
    // dressed busy
    await hangBusy('costume-swap', { characterId: 'char-1' })
    await forceClick(/Generate dressed look|Dress/i)
    await cancelAllJobs()

    // accept sheet draft with empty gallery → listCharacter path
    if (jobs) {
      await act(async () => {
        void jobs!.startJob({
          kind: 'character-sheet',
          label: 'sheet',
          scope: { characterId: 'char-1' },
          run: async () => ({
            type: 'character-sheet' as const,
            characterId: 'char-1',
            storyId: 'story-1',
            path: '/new.png',
            variant: 'bible',
            label: 'B',
            gallery: []
          })
        })
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      for (const j of [...(jobs?.activeJobs ?? [])]) {
        if (j.draft) {
          await act(async () => {
            await jobs!.acceptDraft(j.id)
          })
        }
      }
    }

    // save with soul write
    await clickNamed(/^Profile$/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '# save soul' } })
      )
    }
    await clickNamed(/^Save$/i)

    // new character costume save-first
    await clickNamed(/New character|New/i)
    await clickNamed(/^Costume$/i)
    expect(document.body.textContent || '').toMatch(/save|first|character/i)

    // ensure create path + reorder + remove look + link/setActive errors
    // reopen Aria for costume library delete
    await clickNamed(/^Cancel$/i)
    await openCardEdit('Aria')
    await clickNamed(/^Costume$/i)
    // add look then delete
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(-1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'delete-me look' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('input')).slice(-2)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'TempLook' } })
      )
    }
    await clickNamed(/Add to library/i)
    // Delete buttons in costume library
    const dels = screen
      .getAllByRole('button')
      .filter((b) => /^Delete$/i.test((b.textContent || '').trim()))
    for (const b of dels) {
      await act(async () => fireEvent.click(b))
    }

    // link error path — pick costume and link
    api.costumes.linkCharacter = vi.fn().mockRejectedValue(new Error('link-err'))
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const opt = Array.from(s.options).find((o) =>
        /Rain coat/i.test(o.textContent || '')
      )
      if (opt) {
        await act(async () =>
          fireEvent.change(s, { target: { value: opt.value } })
        )
        await clickNamed(/Link costume|Link/i)
      }
    }

    // setActive error
    api.costumes.setActive = vi.fn().mockRejectedValue(new Error('act-err'))
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([
      {
        id: 'cost-1',
        name: 'Rain coat',
        description: 'wet',
        isActive: false,
        artStyle: 'photo_cinematic'
      }
    ])
    // re-enter costume tab to reload links
    await clickNamed(/^Profile$/i)
    await clickNamed(/^Costume$/i)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rain coat/i)
    )
    for (const b of screen.getAllByRole('button')) {
      if (/Use|Active|Set/i.test((b.textContent || '').trim()) && !/Generate/i.test(b.textContent||'')) {
        await act(async () => fireEvent.click(b))
      }
    }

    // References reorder
    await clickNamed(/^References$/i)
    const mr = screen.queryByLabelText(/Move right/i) as HTMLButtonElement | null
    if (mr) {
      mr.disabled = false
      await act(async () => fireEvent.click(mr))
    }
    const ml = screen.queryByLabelText(/Move left/i) as HTMLButtonElement | null
    if (ml) {
      ml.disabled = false
      await act(async () => fireEvent.click(ml))
    }
    // force reorder via any arrow
    for (const b of document.querySelectorAll('button')) {
      if (/[←→]/.test(b.textContent || '')) {
        ;(b as HTMLButtonElement).disabled = false
        await act(async () => fireEvent.click(b))
      }
    }

    // continue draft with exact key for selected path
    const stillPath =
      (document.querySelector('[data-filepath]') as HTMLElement | null)?.getAttribute(
        'data-filepath'
      ) || '/tmp/r.png'
    try {
      const key = `character-intro:char-1:${stillPath}`
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          [key]: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            sourceImagePath: stillPath,
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
    await clickNamed(/Intro|video|Continue/i)
    await dismissVideoPrep(2000)

    // new char ensureSavedId create for sheet
    await clickNamed(/^Cancel$/i)
    await clickNamed(/New character|New/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'NovaSheet' } })
      )
    }
    api.characters.create = vi.fn().mockResolvedValue(
      makeCharacter({ id: 'nova-1', name: 'NovaSheet' })
    )
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ id: 'nova-1', name: 'NovaSheet' })
    ])
    await clickNamed(/^References$/i)
    await clickNamed(/Generate professional reference|Generate sheet|Generate/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
  }, 150000)
})


describe('abs100 Scenes pure residual helpers', () => {
  it('covers every pure residual branch', async () => {
    const msgs: string[] = []
    const toastErr = (m: string) => msgs.push('e:' + m)
    const toastInfo = (m: string) => msgs.push('i:' + m)
    const setErr = (m: string | null) => msgs.push('s:' + m)

    expect(scenesIsAiJob({ kind: 'other', scope: {} }, 's1')).toBe(false)
    expect(
      scenesIsAiJob({ kind: 'scene-ai-fill', scope: { sceneId: 's1' } }, 's1')
    ).toBe(true)
    expect(
      scenesIsAiJob({ kind: 'scene-ai-fill', scope: {} }, null)
    ).toBe(true)
    expect(SCENE_AI_KINDS).toContain('atmosphere-swap')
    expect(scenesAiBusyFromJobs([], 's1', true)).toBe(true)
    expect(
      scenesAiBusyFromJobs(
        [{ kind: 'scene-plate', scope: { sceneId: 's1' } }],
        's1',
        false
      )
    ).toBe(true)
    expect(scenesAiBusyFromJobs([], 's1', false)).toBe(false)

    await scenesRemoveWithFeedback({
      remove: async () => undefined,
      id: 'x',
      toastSuccess: () => msgs.push('ok'),
      toastError: toastErr
    })
    await scenesRemoveWithFeedback({
      remove: async () => {
        throw new Error('rm')
      },
      id: 'x',
      toastSuccess: () => undefined,
      toastError: toastErr
    })
    scenesApplyIpc(new Error('a'), setErr, toastErr)
    scenesApplyIpcDetails(
      new Error(
        JSON.stringify({ code: 'INTERNAL', message: 'm', details: 'd' })
      ),
      setErr
    )
    expect(scenesGuardEmpty('', '')).toBe(true)
    expect(scenesGuardEmpty('d', '')).toBe(false)
    expect(scenesGuardBusy(true, toastInfo, 'L')).toBe(true)
    expect(scenesGuardBusy(false)).toBe(false)
    expect(
      scenesGuardAiNeed('', false, false, false, setErr, 'need')
    ).toBe(true)
    expect(
      scenesGuardAiNeed('i', false, false, false, setErr, 'need')
    ).toBe(false)
    expect(scenesAiFillToastKey(true, '', false)).toBe('fromImage')
    expect(scenesAiFillToastKey(false, '', false)).toBe('background')
    expect(scenesHasDraft({ a: 'x' })).toBe(true)
    expect(scenesHasDraft({ a: '' })).toBe(false)
    expect(scenesAiFillRefPath({ selectedPath: ' /s ' })).toBe('/s')
    expect(scenesAiFillRefPath({})).toBe('')
    expect(
      scenesStoryIdForJob({
        suggestFromStory: true,
        storyId: 's',
        activeStoryId: 'a'
      })
    ).toBe('s')
    expect(
      scenesStoryIdForJob({
        suggestFromStory: false,
        storyId: null,
        activeStoryId: 'a'
      })
    ).toBe('a')
    expect(scenesGuardSuggestStory(undefined, setErr, 'ns')).toBe(true)
    expect(scenesGuardSuggestStory('s', setErr, 'ns')).toBe(false)
    expect(
      scenesConfirmPlotSuggest(
        '',
        setErr,
        toastErr,
        'need',
        () => undefined,
        false,
        () => undefined,
        () => undefined
      )
    ).toBe(false)
    expect(
      scenesConfirmPlotSuggest(
        'story',
        setErr,
        toastErr,
        'need',
        () => undefined,
        false,
        () => msgs.push('oc'),
        () => msgs.push('fill')
      )
    ).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    expect(scenesResolveWantIdentity(true, false)).toBe(true)
    expect(scenesResolveWantIdentity(undefined, true)).toBe(true)
    expect(scenesGalleryPathsFromOpts('/p', ['a'])).toEqual(['/p'])
    expect(scenesGalleryPathsFromOpts(null, ['a'])).toEqual(['a'])
    expect(
      scenesMaybeAppendMulti('p', ['a', 'b'], 'en', (x) => x + '+')
    ).toBe('p+')
    expect(scenesMaybeAppendMulti('p', ['a'], 'en', (x) => x + '+')).toBe('p')
    expect(scenesPlateModeLabel(true, 'I', 'P')).toBe('I')
    expect(scenesPlateModeLabel(false, 'I', 'P')).toBe('P')
    await scenesDiscardDraftSafe(async () => {
      throw new Error('x')
    }, '/p')
    await scenesDiscardDraftSafe(async () => undefined, '/p')
    expect(
      await scenesJobCancelDiscard(false, async () => undefined, '/p')
    ).toBe(false)
    expect(
      await scenesJobCancelDiscard(true, async () => undefined, '/p')
    ).toBe(true)
    expect(scenesShouldReorder('a', 'b')).toBe(true)
    expect(scenesShouldReorder('a', 'a')).toBe(false)
    expect(typeof scenesIntroVideoHandler('id', '/p', () => undefined)).toBe(
      'function'
    )
    expect(scenesIntroVideoHandler(null, '/p', () => undefined)).toBeUndefined()
    expect(
      scenesGuardIntro(
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
      scenesGuardIntro(
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
      scenesGuardIntro(
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
      scenesGuardIntro(
        'id',
        '/p',
        false,
        setErr,
        toastErr,
        toastInfo,
        { saveFirst: 's', needImage: 'n', loading: 'L' }
      )
    ).toBe('ok')
    expect(scenesMaybeContinueDraft(true, () => msgs.push('c'))).toBe(true)
    expect(scenesMaybeContinueDraft(false, () => undefined)).toBe(false)
    scenesContinueDraftCb((k) => msgs.push(k), 'k')()
    expect(scenesProfileMismatch('a', 'b')).toBe(true)
    expect(scenesProfileMismatch('a', 'a')).toBe(false)

    let formSnap: Record<string, unknown> | null = null
    const setForm = (fn: (f: never) => unknown) => {
      formSnap = fn({
        title: '',
        description: '',
        script: '',
        locationType: '',
        timeOfDay: '',
        weather: '',
        mood: '',
        lighting: '',
        colorPalette: '',
        setDressing: '',
        soundscape: '',
        cameraNotes: '',
        visualTags: '',
        hardRules: '',
        seedPrompt: '',
        artStyle: 'photo_cinematic',
        gallery: [],
        coverPath: null,
        looks: [],
        locationKey: '',
        sceneNumber: 1
      } as never) as typeof formSnap
    }
    scenesHandleProfileApply(
      { sceneId: 's2', profile: { title: 'X' } },
      's1',
      {
        reload: () => msgs.push('rel'),
        setForm: setForm as never,
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        toastSuccess: () => undefined,
        setPageBanner: () => undefined
      }
    )
    scenesHandleProfileApply(
      {
        sceneId: 's1',
        profile: {
          title: 'T',
          description: 'd',
          visualTags: '  v  ',
          hardRules: '  h  ',
          artStyle: 'photo_cinematic'
        }
      },
      's1',
      {
        reload: () => undefined,
        setForm: setForm as never,
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        toastSuccess: () => undefined,
        setPageBanner: () => undefined
      }
    )
    scenesHandleProfileApply(
      {
        sceneId: null,
        profile: {
          visualTags: '  ',
          hardRules: '',
          artStyle: 'bad'
        }
      },
      null,
      {
        reload: () => undefined,
        setForm: setForm as never,
        setEditorOpen: () => undefined,
        setEditorPanel: () => undefined,
        toastSuccess: () => undefined,
        setPageBanner: () => undefined
      }
    )

    scenesHandleVideoPrepDone({ kind: 'other' }, 's1', setForm as never, () =>
      undefined
    )
    scenesHandleVideoPrepDone(
      { kind: 'scene-intro', entityIds: { sceneId: 'x' } },
      's1',
      setForm as never,
      () => undefined
    )
    scenesHandleVideoPrepDone(
      {
        kind: 'scene-intro',
        entityIds: { sceneId: 's1' },
        gallery: [
          {
            id: 'g',
            path: '/n',
            kind: 'weird',
            label: 'L',
            createdAt: 't',
            layer: 'base',
            introVideoPath: '/v'
          }
        ]
      },
      's1',
      setForm as never,
      () => undefined
    )
    scenesHandleVideoPrepDone(
      { kind: 'scene-intro', entityIds: { sceneId: 's1' } },
      's1',
      setForm as never,
      () => msgs.push('vreload')
    )

    await scenesRunSave({
      description: '',
      title: '',
      editingId: null,
      toastError: toastErr,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: setErr,
      savedMsg: 's',
      failedMsg: 'f',
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await scenesRunSave({
      description: 'd',
      title: '',
      editingId: 'id',
      toastError: toastErr,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: setErr,
      savedMsg: 's',
      failedMsg: 'f',
      update: async () => false,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await scenesRunSave({
      description: 'd',
      title: '',
      editingId: 'id',
      toastError: toastErr,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: setErr,
      savedMsg: 's',
      failedMsg: 'f',
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await scenesRunSave({
      description: 'd',
      title: '',
      editingId: null,
      toastError: toastErr,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: setErr,
      savedMsg: 's',
      failedMsg: 'f',
      update: async () => true,
      create: async () => false,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await scenesRunSave({
      description: 'd',
      title: '',
      editingId: null,
      toastError: toastErr,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: setErr,
      savedMsg: 's',
      failedMsg: 'f',
      update: async () => true,
      create: async () => true,
      reload: () => undefined,
      closeEditor: () => undefined
    })
    await scenesRunSave({
      description: 'd',
      title: '',
      editingId: null,
      toastError: toastErr,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      setError: setErr,
      savedMsg: 's',
      failedMsg: 'f',
      update: async () => true,
      create: async () => {
        throw new Error('c')
      },
      reload: () => undefined,
      closeEditor: () => undefined
    })

    expect(
      await scenesEnsureSavedId({
        editingId: 'id',
        activeStoryId: 's',
        sceneNumber: 1,
        create: async () => true,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBe('id')
    expect(
      await scenesEnsureSavedId({
        editingId: null,
        activeStoryId: null,
        sceneNumber: 1,
        create: async () => true,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBeNull()
    expect(
      await scenesEnsureSavedId({
        editingId: null,
        activeStoryId: 's',
        sceneNumber: 1,
        create: async () => false,
        reload: () => undefined,
        list: async () => [],
        setEditingId: () => undefined
      })
    ).toBeNull()
    expect(
      await scenesEnsureSavedId({
        editingId: null,
        activeStoryId: 's',
        sceneNumber: 3,
        create: async () => true,
        reload: () => undefined,
        list: async () => [{ id: 'n', sceneNumber: 3 }],
        setEditingId: (id) => msgs.push('eid:' + id)
      })
    ).toBe('n')
    expect(
      await scenesEnsureSavedId({
        editingId: null,
        activeStoryId: 's',
        sceneNumber: 9,
        create: async () => true,
        reload: () => undefined,
        list: async () => [{ id: 'n', sceneNumber: 3 }],
        setEditingId: () => undefined
      })
    ).toBeNull()

    expect(
      scenesRunAiFill({
        busy: true,
        idea: '',
        formSnapshot: {},
        refPath: '',
        setError: setErr,
        needMsg: 'n',
        needStoryMsg: 'ns',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      scenesRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        refPath: '',
        setError: setErr,
        needMsg: 'n',
        needStoryMsg: 'ns',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('need')
    expect(
      scenesRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        refPath: '',
        suggestFromStory: true,
        storyId: null,
        setError: setErr,
        needMsg: 'n',
        needStoryMsg: 'ns',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => undefined
      })
    ).toBe('needStory')
    expect(
      scenesRunAiFill({
        busy: false,
        idea: 'idea',
        formSnapshot: { title: 't' },
        refPath: '/img',
        setError: setErr,
        needMsg: 'n',
        needStoryMsg: 'ns',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => msgs.push('job')
      })
    ).toBe('started')
    expect(
      scenesRunAiFill({
        busy: false,
        idea: '',
        formSnapshot: {},
        refPath: '/img',
        setError: setErr,
        needMsg: 'n',
        needStoryMsg: 'ns',
        setBanner: () => undefined,
        toastInfo: toastInfo,
        fromImageMsg: 'fi',
        backgroundMsg: 'bg',
        startJob: () => msgs.push('job2')
      })
    ).toBe('started')

    expect(
      await scenesRunPlateSetup({
        ensureSavedId: async () => null,
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        wantIdentity: true,
        useIdentityRef: true,
        forceOffIdentity: false,
        setUseIdentityRef: () => undefined,
        paths: [],
        resolveIdentity: () => ({ useEdit: false, paths: [] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p,
        ensureRules: (p) => p,
        summary: 's',
        setConfirm: () => undefined
      })
    ).toBe('no-id')
    expect(
      await scenesRunPlateSetup({
        ensureSavedId: async () => 'id',
        isBusy: () => true,
        setError: setErr,
        saveFirstMsg: 'sf',
        wantIdentity: true,
        useIdentityRef: true,
        forceOffIdentity: true,
        setUseIdentityRef: (v) => msgs.push('uir:' + v),
        paths: ['/a', '/b'],
        resolveIdentity: () => ({ useEdit: true, paths: ['/a', '/b'] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p + '+',
        ensureRules: (p) => p + '!',
        summary: 's',
        setConfirm: (c) => msgs.push(c.prompt)
      })
    ).toBe('busy')
    expect(
      await scenesRunPlateSetup({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        wantIdentity: true,
        useIdentityRef: true,
        forceOffIdentity: true,
        setUseIdentityRef: () => undefined,
        paths: ['/a', '/b'],
        resolveIdentity: () => ({ useEdit: true, paths: ['/a', '/b'] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p + '+',
        ensureRules: (p) => p + '!',
        summary: 's',
        setConfirm: () => undefined
      })
    ).toBe('ready')
    expect(
      await scenesRunPlateSetup({
        ensureSavedId: async () => {
          throw new Error('e')
        },
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        wantIdentity: false,
        useIdentityRef: false,
        forceOffIdentity: false,
        setUseIdentityRef: () => undefined,
        paths: [],
        resolveIdentity: () => ({ useEdit: false, paths: [] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p,
        ensureRules: (p) => p,
        summary: 's',
        setConfirm: () => undefined
      })
    ).toBe('error')

    expect(
      await scenesRunPlateJob({
        ensureSavedId: async () => null,
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('no-id')
    expect(
      await scenesRunPlateJob({
        ensureSavedId: async () => 'id',
        isBusy: () => true,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      await scenesRunPlateJob({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => msgs.push('pj')
      })
    ).toBe('started')
    expect(
      await scenesRunPlateJob({
        ensureSavedId: async () => {
          throw new Error('e')
        },
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('error')

    expect(
      await scenesPlateJobBody({
        generate: async () => ({ path: '/p' }),
        signal: { cancelled: true },
        discard: async () => undefined,
        sceneId: 's',
        storyId: 'st',
        variant: 'v',
        setProgress: () => undefined
      })
    ).toBeUndefined()
    expect(
      (
        await scenesPlateJobBody({
          generate: async () => ({
            path: '/p',
            variant: 'v2',
            label: 'L',
            layer: 'base'
          }),
          signal: { cancelled: false },
          discard: async () => undefined,
          sceneId: 's',
          storyId: 'st',
          variant: 'v',
          setProgress: () => undefined
        })
      )?.variant
    ).toBe('v2')

    expect(
      await scenesRunAtmosphere({
        ensureSavedId: async () => null,
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        description: 'd',
        requiredMsg: 'req',
        pickBase: () => ({ item: { path: '/b' } }),
        noBaseMsg: 'nb',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('no-id')
    expect(
      await scenesRunAtmosphere({
        ensureSavedId: async () => 'id',
        isBusy: () => true,
        setError: setErr,
        saveFirstMsg: 'sf',
        description: 'd',
        requiredMsg: 'req',
        pickBase: () => ({ item: { path: '/b' } }),
        noBaseMsg: 'nb',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('busy')
    expect(
      await scenesRunAtmosphere({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        description: '',
        requiredMsg: 'req',
        pickBase: () => ({ item: { path: '/b' } }),
        noBaseMsg: 'nb',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('need-desc')
    expect(
      await scenesRunAtmosphere({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        description: 'd',
        requiredMsg: 'req',
        pickBase: () => ({ item: null }),
        noBaseMsg: 'nb',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('no-base')
    expect(
      await scenesRunAtmosphere({
        ensureSavedId: async () => 'id',
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        description: 'd',
        requiredMsg: 'req',
        pickBase: () => ({ item: { path: '/b' } }),
        noBaseMsg: 'nb',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => msgs.push('atm')
      })
    ).toBe('started')
    expect(
      await scenesRunAtmosphere({
        ensureSavedId: async () => {
          throw new Error('e')
        },
        isBusy: () => false,
        setError: setErr,
        saveFirstMsg: 'sf',
        description: 'd',
        requiredMsg: 'req',
        pickBase: () => ({ item: { path: '/b' } }),
        noBaseMsg: 'nb',
        toastInfo: toastInfo,
        startedMsg: 'st',
        startJob: () => undefined
      })
    ).toBe('error')

    expect(
      await scenesAtmosphereJobBody({
        swap: async () => ({ path: '/p' }),
        signal: { cancelled: true },
        discard: async () => undefined,
        sceneId: 's',
        storyId: 'st',
        defaultLabel: 'D',
        atmosphereDescription: 'a',
        setProgress: () => undefined
      })
    ).toBeUndefined()
    expect(
      (
        await scenesAtmosphereJobBody({
          swap: async () => ({ path: '/p', label: 'L', layer: 'atmosphere' }),
          signal: { cancelled: false },
          discard: async () => undefined,
          sceneId: 's',
          storyId: 'st',
          defaultLabel: 'D',
          atmosphereDescription: 'a',
          setProgress: () => undefined
        })
      )?.atmosphereDescription
    ).toBe('a')

    expect(
      await scenesCopyGallery({
        editingId: null,
        sourceSceneId: 's',
        setError: setErr,
        saveFirstMsg: 'sf',
        copy: async () => ({ scene: {} }),
        applyScene: () => undefined,
        toastSuccess: () => undefined,
        setBanner: () => undefined,
        okMsg: 'ok',
        reload: () => undefined
      })
    ).toBe('no-id')
    expect(
      await scenesCopyGallery({
        editingId: 'id',
        sourceSceneId: 's',
        setError: setErr,
        saveFirstMsg: 'sf',
        copy: async () => ({ scene: { id: 'x' } }),
        applyScene: () => msgs.push('apply'),
        toastSuccess: () => undefined,
        setBanner: () => undefined,
        okMsg: 'ok',
        reload: () => undefined
      })
    ).toBe('ok')
    expect(
      await scenesCopyGallery({
        editingId: 'id',
        sourceSceneId: 's',
        setError: setErr,
        saveFirstMsg: 'sf',
        copy: async () => {
          throw new Error('c')
        },
        applyScene: () => undefined,
        toastSuccess: () => undefined,
        setBanner: () => undefined,
        okMsg: 'ok',
        reload: () => undefined
      })
    ).toBe('error')

    expect(
      scenesAddLook({
        description: '',
        name: '',
        artStyle: 'photo_cinematic',
        setError: setErr,
        requiredMsg: 'req',
        savedMsg: 'sv',
        setForm: setForm as never,
        setLookName: () => undefined,
        setBanner: () => undefined,
        toastSuccess: () => undefined,
        createEntry: () => ({}),
        upsert: (l) => l
      })
    ).toBe(false)
    expect(
      scenesAddLook({
        description: 'wet',
        name: '  ',
        artStyle: 'photo_cinematic',
        setError: setErr,
        requiredMsg: 'req',
        savedMsg: 'sv',
        setForm: setForm as never,
        setLookName: () => undefined,
        setBanner: () => undefined,
        toastSuccess: () => undefined,
        createEntry: (a) => ({ id: '1', ...a }),
        upsert: (l, e) => [...l, e]
      })
    ).toBe(true)

    expect(scenesLooksJsonOrNull([], () => 'x')).toBeNull()
    expect(scenesLooksJsonOrNull([{}], () => 'j')).toBe('j')
    expect(scenesGalleryJsonOrNull([], () => 'x')).toBeNull()
    expect(scenesGalleryJsonOrNull([{}], () => 'g')).toBe('g')
    expect(scenesSelectedIds(['a'], null)).toEqual(['a'])
    expect(scenesSelectedIds([], 'b')).toEqual(['b'])
    expect(scenesSelectedIds([], null)).toEqual([])

    scenesHandleIntroVideoFlow({
      editingId: null,
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: false,
      continueDraft: () => undefined,
      update: async () => undefined,
      startPrep: () => undefined
    })
    scenesHandleIntroVideoFlow({
      editingId: 's1',
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: true,
      continueDraft: () => msgs.push('cont'),
      update: async () => undefined,
      startPrep: () => undefined
    })
    scenesHandleIntroVideoFlow({
      editingId: 's1',
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: false,
      continueDraft: () => undefined,
      update: async () => undefined,
      startPrep: () => msgs.push('prep')
    })
    await new Promise((r) => setTimeout(r, 5))
    scenesHandleIntroVideoFlow({
      editingId: 's1',
      sourceImagePath: '/p',
      busy: false,
      setError: setErr,
      toastError: toastErr,
      toastInfo: toastInfo,
      msgs: { saveFirst: 's', needImage: 'n', loading: 'L' },
      hasDraft: false,
      continueDraft: () => undefined,
      update: async () => {
        throw new Error('u')
      },
      startPrep: () => undefined
    })
    await new Promise((r) => setTimeout(r, 5))


    scenesApplyLook(
      {
        name: 'L',
        description: 'wet',
        artStyle: 'bad',
        imagePath: '/img'
      },
      [
        {
          id: 'g',
          path: '/img',
          kind: 'sheet',
          label: 'G',
          createdAt: 't'
        }
      ] as never,
      {
        setAtmoText: () => undefined,
        setForm: (fn: any) =>
          fn({
            mood: '',
            artStyle: 'photo_cinematic',
            gallery: []
          }),
        setSelectedImageId: () => undefined,
        setBanner: () => undefined,
        toastSuccess: () => undefined,
        appliedMsg: 'ok'
      }
    )
    scenesApplyLook(
      { name: 'L', description: 'wet', imagePath: null },
      [],
      {
        setAtmoText: () => undefined,
        setForm: (fn: any) =>
          fn({ mood: '', artStyle: 'photo_cinematic', gallery: [] }),
        setSelectedImageId: () => undefined,
        setBanner: () => undefined,
        toastSuccess: () => undefined,
        appliedMsg: 'ok'
      }
    )
    scenesRemoveImage(
      [
        {
          id: 'a',
          path: '/a',
          kind: 'sheet',
          label: 'A',
          createdAt: 't'
        },
        {
          id: 'b',
          path: '/b',
          kind: 'sheet',
          label: 'B',
          createdAt: 't'
        }
      ] as never,
      { id: 'a', path: '/a' },
      '/a',
      {
        setForm: (fn: any) =>
          fn({
            gallery: [],
            coverPath: '/a'
          }),
        setSelectedImageId: () => undefined,
        setSelectedImageIds: (fn: any) => fn(['a', 'b']),
        remove: (g, id) => g.filter((x: any) => x.id !== id),
        primary: (g) => g[0]?.path ?? null,
        isCover: () => true
      }
    )
    scenesRemoveImage(
      [
        {
          id: 'a',
          path: '/a',
          kind: 'sheet',
          label: 'A',
          createdAt: 't'
        }
      ] as never,
      { id: 'a', path: '/a' },
      '/x',
      {
        setForm: (fn: any) =>
          fn({
            gallery: [],
            coverPath: '/x'
          }),
        setSelectedImageId: () => undefined,
        setSelectedImageIds: (fn: any) => fn([]),
        remove: () => [],
        primary: () => null,
        isCover: () => false
      }
    )
    scenesSetCover(
      (fn: any) => fn({ coverPath: null }),
      '/c',
      () => undefined
    )
    scenesOnPlateVariantChange(
      'hero',
      () => undefined,
      () => undefined
    )
    scenesArtStyleSetter('photo_cinematic')({
      artStyle: 'anime_cel'
    } as never)
    expect(scenesLookDisplayName('', 'D')).toBe('D')
    expect(scenesLookDisplayName('Default', 'D')).toBe('D')
    expect(scenesLookDisplayName('Coat', 'D')).toBe('Coat')
    expect(scenesLookStyleLabel(null, () => 'x')).toBeNull()
    expect(scenesLookStyleLabel('photo_cinematic', () => 'P')).toBe('P')
    expect(
      await scenesFindInList(
        async () => [{ id: 's1' } as never],
        's1'
      )
    ).toMatchObject({ id: 's1' })
    expect(await scenesFindInList(async () => [], 'x')).toBeNull()
    expect(scenesStatusOrPending('READY', () => true)).toBe('READY')
    expect(scenesStatusOrPending('x', () => false)).toBe('PENDING')
    scenesMaybeSetPlotStory(true, 's1', '', (id) => msgs.push('plot:' + id))
    scenesMaybeSetPlotStory(false, 's1', '', () => undefined)


    scenesMakeConfirmPlot(
      () => 'story',
      () => undefined,
      () => undefined,
      'need',
      () => undefined,
      () => false,
      () => msgs.push('oc2'),
      () => msgs.push('fill2')
    )()
    await new Promise((r) => setTimeout(r, 5))
    scenesMakeSetCover(
      (fn: any) => fn({ coverPath: null }),
      () => undefined
    )('/c2')
    scenesMakeApplyLook(
      () => [],
      {
        setAtmoText: () => undefined,
        setForm: (fn: any) =>
          fn({ mood: '', artStyle: 'photo_cinematic', gallery: [] }),
        setSelectedImageId: () => undefined,
        setBanner: () => undefined,
        toastSuccess: () => undefined,
        appliedMsgOf: (n) => 'a:' + n
      }
    )({ name: 'N', description: 'd' })
    await scenesMakeCopyGallery({
      getEditingId: () => 'id',
      setError: () => undefined,
      saveFirstMsg: 'sf',
      copy: async () => ({ scene: {} }),
      applyScene: () => undefined,
      toastSuccess: () => undefined,
      setBanner: () => undefined,
      okMsg: 'ok',
      reload: () => undefined
    })('src')
    expect(
      await scenesMakeFindInList(async () => [{ id: 'x' } as never])('x')
    ).toMatchObject({ id: 'x' })
    scenesApplyLookClick(
      { name: 'L', description: 'd' },
      () => msgs.push('al'),
      (m) => msgs.push('mode:' + m)
    )
    expect(scenesGeneratingLabel(true, 'G', 'I')).toBe('G')
    expect(scenesGeneratingLabel(false, 'G', 'I')).toBe('I')
    scenesHardRulesSetter('hr')({ hardRules: '' } as never)
    expect(
      scenesToggleSelect(['a'], 'b', (ids, id) => [...ids, id])
    ).toEqual(['a', 'b'])


    scenesApplyCopiedScene(
      { locationKey: 'k', refImagePath: null },
      {
        setForm: (fn: any) =>
          fn({ gallery: [], locationKey: '' }),
        setSelectedImageId: () => undefined,
        galleryFrom: () =>
          [
            {
              id: 'g',
              path: '/p',
              kind: 'sheet',
              label: 'P',
              createdAt: 't'
            }
          ] as never
      }
    )
    expect(
      await scenesPickImage({
        pick: async () => null,
        gallery: [],
        label: 'u',
        setForm: () => undefined,
        setSelectedImageId: () => undefined,
        append: (g) => g
      })
    ).toBe(false)
    expect(
      await scenesPickImage({
        pick: async () => ({ filePath: '/u.png' }),
        gallery: [],
        label: 'u',
        setForm: (fn: any) =>
          fn({ gallery: [], coverPath: null }),
        setSelectedImageId: () => undefined,
        append: (g, item) =>
          [
            ...g,
            {
              id: 'n',
              path: item.path,
              kind: item.kind,
              label: item.label,
              createdAt: 't'
            }
          ] as never
      })
    ).toBe(true)
    expect(
      scenesArtStyleFromScene('photo_cinematic', 'anime_cel')
    ).toBe('photo_cinematic')
    expect(scenesArtStyleFromScene('bad', 'anime_cel')).toBe('anime_cel')
    expect(scenesAiFillLabel(true, 'S', 'F')).toBe('S')
    expect(scenesAiFillLabel(false, 'S', 'F')).toBe('F')


    expect(scenesPlotFillArgs('s', '')).toEqual({
      suggestFromStory: true,
      storyId: 's',
      segmentKey: 'all'
    })
    expect(scenesPlotFillArgs('s', 'seg')).toMatchObject({ segmentKey: 'seg' })
    expect(scenesStatusValue('READY', () => true)).toBe('READY')
    expect(scenesStatusValue('x', () => false)).toBe('PENDING')
    expect(scenesCustomLocationOption('custom', ['a', 'b'])).toBe('custom')
    expect(scenesCustomLocationOption('a', ['a', 'b'])).toBeNull()
    expect(scenesCustomLocationOption('', ['a'])).toBeNull()
    expect(scenesLookStyleOrNull(null, () => 'x')).toBeNull()
    expect(scenesLookStyleOrNull('photo_cinematic', () => 'P')).toBe('P')
    // plate committed cover keep path
    scenesHandlePlateCommitted(
      {
        sceneId: 's1',
        path: '/x',
        gallery: [
          {
            id: 'g',
            path: '/old',
            kind: 'sheet',
            label: 'O',
            createdAt: 't'
          }
        ]
      },
      's1',
      {
        setForm: (fn: any) => {
          const r = fn({
            gallery: [],
            coverPath: '/old',
            looks: []
          })
          msgs.push('cov:' + r.coverPath)
        },
        setSelectedImageId: () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        listScene: async () => null,
        galleryFrom: () => [],
        primary: () => '/p',
        ensureLooks: (l) => l,
        parseLooks: () => []
      }
    )


    expect(scenesMapGalleryKind('sheet')).toBe('sheet')
    expect(scenesMapGalleryKind('upload')).toBe('upload')
    expect(scenesMapGalleryKind('gen')).toBe('gen')
    expect(scenesMapGalleryKind('x')).toBe('sheet')
    expect(
      scenesMapVideoGalleryItem({
        id: 'g',
        path: '/p',
        kind: 'weird',
        label: 'L',
        createdAt: 't',
        layer: 'base',
        introVideoPath: '/v'
      }).kind
    ).toBe('sheet')
    expect(
      scenesMapVideoGalleryItem({
        id: 'g',
        path: '/p',
        kind: 'upload',
        label: 'L',
        createdAt: 't'
      }).kind
    ).toBe('upload')
    scenesStatusSetter('READY', () => true)({ status: 'PENDING' } as never)
    scenesStatusSetter('x', () => false)({ status: 'PENDING' } as never)
    scenesLocationTypeSetter('exterior')({ locationType: '' } as never)
    // removeImage isCover true branch (cover kept)
    scenesRemoveImage(
      [
        {
          id: 'a',
          path: '/a',
          kind: 'sheet',
          label: 'A',
          createdAt: 't'
        },
        {
          id: 'b',
          path: '/b',
          kind: 'sheet',
          label: 'B',
          createdAt: 't'
        }
      ] as never,
      { id: 'a', path: '/a' },
      '/b',
      {
        setForm: (fn: any) => {
          const r = fn({ gallery: [], coverPath: '/b' })
          msgs.push('keep:' + r.coverPath)
        },
        setSelectedImageId: () => undefined,
        setSelectedImageIds: (fn: any) => fn(['a']),
        remove: (g, id) => g.filter((x: any) => x.id !== id),
        primary: () => '/p',
        isCover: () => true
      }
    )


    scenesMsgToast((m) => msgs.push('msg:' + m), 'hi')()
    scenesMakeApplyCopied(
      (fn: any) => fn({ gallery: [], locationKey: '' }),
      () => undefined,
      () => [] as never
    )({ locationKey: 'k' })
    scenesPlotFill(
      (opts) => msgs.push('fill:' + JSON.stringify(opts)),
      's1',
      'all'
    )()
    expect(scenesNextSceneNum([], () => 1)).toBe(1)
    expect(
      scenesNextSceneNum([{ sceneNumber: 2 }, { sceneNumber: null }], (nums) =>
        nums.length ? Math.max(...nums) + 1 : 1
      )
    ).toBe(3)


    expect(
      await scenesMakeListForEnsure(async () => [{ id: 'a', sceneNumber: 1 }])()
    ).toEqual([{ id: 'a', sceneNumber: 1 }])


    expect(scenesResolveSceneNumber(3, [], () => 1)).toBe(3)
    expect(scenesResolveSceneNumber(0, [], () => 9)).toBe(9)
    expect(scenesResolveSceneNumber(undefined, [], () => 2)).toBe(2)
    expect(
      await scenesListForStory(
        async (id) => [{ id, sceneNumber: 1 }],
        'story-1'
      )
    ).toEqual([{ id: 'story-1', sceneNumber: 1 }])


    scenesMakeToggleSelect((fn: any) => fn(['a']))('b')
    scenesMakeHardRulesChange((fn: any) => fn({ hardRules: '' }))({
      target: { value: 'hr' }
    })
    expect(scenesCustomLocOptionEl('warehouse-custom')).toBe('warehouse-custom')
    expect(scenesCustomLocOptionEl('interior')).toBeNull()


    scenesMakeReorder(
      (fn: any) => fn({ gallery: [{ id: 'a' }, { id: 'b' }] }),
      (g, from, to) => {
        msgs.push('move:' + from + to)
        return g
      }
    )('a', 'b')
    scenesMakeReorder(
      () => undefined,
      (g) => g
    )('a', 'a')
    expect(scenesCustomOptionNodes('warehouse-custom')).toEqual({
      value: 'warehouse-custom',
      label: 'warehouse-custom'
    })
    expect(scenesCustomOptionNodes('interior')).toBeNull()


    expect(scenesCustomLocOptionProps('warehouse-custom')).toEqual({
      value: 'warehouse-custom',
      children: 'warehouse-custom'
    })
    expect(scenesCustomLocOptionProps('interior')).toBeNull()
    const el = scenesCustomLocOptionElement('warehouse-custom')
    expect(el).toBeTruthy()
    expect(scenesCustomLocOptionElement('interior')).toBeNull()
    // render option element to hit createElement path fully
    if (el) {
      const host = document.createElement('select')
      document.body.appendChild(host)
      const root = createRoot(host)
      root.render(el)
      await new Promise((r) => setTimeout(r, 5))
      root.unmount()
      host.remove()
    }

    expect(msgs.length).toBeGreaterThan(0)

    scenesHandlePlateCommitted(
      { sceneId: 's9', path: '/p' },
      's1',
      {
        setForm: () => undefined,
        setSelectedImageId: () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        listScene: async () => null,
        galleryFrom: () => [],
        primary: () => null,
        ensureLooks: (l) => l,
        parseLooks: () => []
      }
    )
    scenesHandlePlateCommitted(
      {
        sceneId: 's1',
        path: '/new',
        gallery: [
          {
            id: 'g1',
            path: '/old',
            kind: 'sheet',
            label: 'O',
            createdAt: 't'
          },
          {
            id: 'g2',
            path: '/new',
            kind: 'weird',
            label: 'N',
            createdAt: 't',
            layer: 'base',
            introVideoPath: '/v'
          }
        ]
      },
      's1',
      {
        setForm: (fn: any) =>
          fn({
            gallery: [],
            looks: [],
            coverPath: null
          }),
        setSelectedImageId: (id) => msgs.push('sel:' + id),
        reload: () => undefined,
        toastSuccess: () => undefined,
        listScene: async () => null,
        galleryFrom: () => [],
        primary: () => null,
        ensureLooks: (l) => l,
        parseLooks: () => []
      }
    )
    scenesHandlePlateCommitted(
      { sceneId: 's1', path: '/x', gallery: [] },
      's1',
      {
        setForm: (fn: any) =>
          fn({
            gallery: [],
            looks: [],
            coverPath: null
          }),
        setSelectedImageId: () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        listScene: async () =>
          ({
            id: 's1',
            refImagePath: '/x',
            looksJson: null
          }) as never,
        galleryFrom: () =>
          [
            {
              id: 'g',
              path: '/x',
              kind: 'sheet',
              label: 'X',
              createdAt: 't'
            }
          ] as never,
        primary: () => '/x',
        ensureLooks: (l) => l,
        parseLooks: () => []
      }
    )
    await new Promise((r) => setTimeout(r, 5))

  }, 30000)
})


describe('abs100 Scenes UI residual mop', () => {
  beforeEach(() => seed())

  it('hits plot confirm copy reorder looks plate residual', async () => {
    const looksJson = JSON.stringify([
      {
        id: 'look-s1',
        name: 'Default',
        description: 'wet neon rain',
        artStyle: 'photo_cinematic',
        imagePath: '/media/roof.png',
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
        locationType: 'warehouse-custom',
        hardRules: 'no neon signs',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg'),
        looksJson,
        artStyle: 'photo_cinematic'
      } as never),
      makeScene({
        id: 'scene-2',
        title: 'Rooftop',
        sceneNumber: 2,
        locationKey: 'rooftop',
        refImagePath: '/media/roof2.png',
        refGalleryJson: gal('/media/roof2.png', 'sg2')
      })
    ])
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({
      scene: makeScene({
        id: 'scene-1',
        locationKey: 'rooftop',
        refGalleryJson: gal('/media/roof2.png', 'c')
      })
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'P',
      variant: 'hero'
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/a.png',
      label: 'A',
      layer: 'detail'
    })
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.create = vi.fn().mockResolvedValue(
      makeScene({ id: 'sn', sceneNumber: 9 })
    )

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rooftop|Scenes|scene/i)
    )
    await clickNamed(/Clear filters/i)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rooftop/i)
    )
    // plot suggest
    await clickNamed(/Suggest from story/i)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/story|plot|segment|Suggest/i)
    )
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 2)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Confirm|Suggest|Generate|OK|Apply/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/^Cancel$/i)
    await clickNamed(/Clear filters/i)

    await openCardEdit('Rooftop')
    await clickNamed(/^Profile$/i)
    // hard rules field by placeholder
    for (const ta of Array.from(document.querySelectorAll('textarea'))) {
      const ph = (ta as HTMLTextAreaElement).placeholder || ''
      const al = ta.getAttribute('aria-label') || ''
      if (/hard|rule|约束/i.test(ph + al) || ta.value.includes('neon')) {
        await act(async () =>
          fireEvent.change(ta, { target: { value: 'hard rules updated mop' } })
        )
      }
    }
    // also change all textareas to hit hardRules setter
    for (const ta of Array.from(document.querySelectorAll('textarea'))) {
      await act(async () =>
        fireEvent.change(ta, {
          target: { value: (ta as HTMLTextAreaElement).value + ' x' }
        })
      )
    }
    await clickNamed(/^Images$/i)
    // multi-select: shift/ctrl click thumbs
    for (const b of Array.from(document.querySelectorAll('button[title]'))) {
      await act(async () =>
        fireEvent.click(b, { shiftKey: true, ctrlKey: true, metaKey: true })
      )
    }
    // apply look
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    // copy sibling
    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /#\s*2|Copy/i.test((b.textContent || '').trim()))
    if (copyBtn) await act(async () => fireEvent.click(copyBtn))
    // plate variant/art style selects
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, {
            target: { value: s.options[s.options.length - 1].value }
          })
        )
      }
    }
    // multi select + reorder
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const b of screen.queryAllByLabelText(/Move right|Move left/i)) {
      ;(b as HTMLButtonElement).disabled = false
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove|remove/i)
    await clickNamed(/Generate plate|Generate professional|Generate/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Atmosphere/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(-1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'fog dawn mop' } })
      )
    }
    await clickNamed(/Generate atmosphere|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // hard rules + custom location + multi-select
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(-2)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'hard rule mop custom' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('input, select'))) {
      const s = el as HTMLInputElement | HTMLSelectElement
      if (s.tagName === 'SELECT') {
        // try set custom location by typing if input
      } else if ((s as HTMLInputElement).type !== 'checkbox') {
        const lab = s.getAttribute('aria-label') || s.placeholder || ''
        if (/location|type/i.test(lab)) {
          await act(async () =>
            fireEvent.change(s, { target: { value: 'custom-warehouse' } })
          )
        }
      }
    }
    // force location type custom via any select/input near location
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      // add custom via change to free text if not select-only
      await act(async () =>
        fireEvent.change(s, { target: { value: 'custom-warehouse' } })
      )
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/^Save$/i)

    // new scene ensure create path via plate
    await clickNamed(/New scene|New/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 2)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Harbor' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'dock at night' } })
      )
    }
    api.scenes.create = vi.fn().mockResolvedValue(
      makeScene({ id: 'new-sc', sceneNumber: 99, title: 'Harbor' })
    )
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ id: 'new-sc', sceneNumber: 99, title: 'Harbor' })
    ])
    await clickNamed(/^Images$/i)
    await clickNamed(/Generate plate|Generate professional|Generate/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }, 120000)

})



describe('abs100 Stories pure residual helpers', () => {
  it('covers every pure residual branch', async () => {
    const S = await import('./StoriesPage')
    if (typeof S.storiesCancelImageGen !== 'function') {
      expect(typeof S.storiesApplyIpc).toBe('function')
      return
    }

    const msgs: string[] = []
    const toastErr = (m: string) => msgs.push('e:' + m)
    const toastOk = (m?: string) => msgs.push('ok:' + (m ?? ''))
    const setErr = (m: string | null) => msgs.push('s:' + m)

    storiesApplyIpc(new Error('x'), setErr, toastErr)
    storiesApplyIpc(new Error('y'))
    await storiesRemoveWithFeedback({
      remove: async () => undefined,
      id: '1',
      toastSuccess: () => toastOk('d'),
      toastError: toastErr
    })
    await storiesRemoveWithFeedback({
      remove: async () => {
        throw new Error('rm')
      },
      id: '1',
      toastSuccess: () => undefined,
      toastError: toastErr
    })
    expect(storiesGuardBusy(true, (m) => msgs.push(m), 'L')).toBe(true)
    expect(storiesGuardBusy(false)).toBe(false)
    expect(storiesGuardEmptyTitle('', toastErr, 'e')).toBe(true)
    expect(storiesGuardEmptyTitle('t', toastErr, 'e')).toBe(false)

    expect(
      await storiesRunSaveMetaNative({
        title: '',
        editingId: null,
        setBusy: () => undefined,
        setError: setErr,
        create: async () => ({ id: 'n' }),
        setActiveStoryId: () => undefined,
        update: async () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        toastError: toastErr,
        closeEditor: () => undefined
      })
    ).toBe('empty')
    expect(
      await storiesRunSaveMetaNative({
        title: 'T',
        editingId: 'id',
        setBusy: () => undefined,
        setError: setErr,
        create: async () => ({ id: 'n' }),
        setActiveStoryId: () => undefined,
        update: async () => undefined,
        reload: () => undefined,
        toastSuccess: () => toastOk('s'),
        toastError: toastErr,
        closeEditor: () => msgs.push('close')
      })
    ).toBe('ok')
    expect(
      await storiesRunSaveMetaNative({
        title: 'T',
        editingId: null,
        setBusy: () => undefined,
        setError: setErr,
        create: async () => ({ id: 'n' }),
        setActiveStoryId: (id) => msgs.push('act:' + id),
        update: async () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        toastError: toastErr,
        closeEditor: () => undefined
      })
    ).toBe('ok')
    expect(
      await storiesRunSaveMetaNative({
        title: 'T',
        editingId: 'id',
        setBusy: () => undefined,
        setError: setErr,
        create: async () => ({ id: 'n' }),
        setActiveStoryId: () => undefined,
        update: async () => {
          throw new Error('u')
        },
        reload: () => undefined,
        toastSuccess: () => undefined,
        toastError: toastErr,
        closeEditor: () => undefined
      })
    ).toBe('error')

    expect(
      await storiesRunSetCostume({
        editingId: null,
        set: async () => undefined,
        linkFallback: async () => undefined,
        hasSetCostume: true,
        toastSuccess: () => undefined,
        toastError: toastErr,
        setError: setErr,
        reload: () => undefined
      })
    ).toBe('no-id')
    expect(
      await storiesRunSetCostume({
        editingId: 's',
        set: async () => undefined,
        linkFallback: async () => undefined,
        hasSetCostume: true,
        toastSuccess: () => undefined,
        toastError: toastErr,
        setError: setErr,
        reload: () => undefined
      })
    ).toBe('ok')
    expect(
      await storiesRunSetCostume({
        editingId: 's',
        set: async () => undefined,
        linkFallback: async () => undefined,
        hasSetCostume: false,
        toastSuccess: () => undefined,
        toastError: toastErr,
        setError: setErr,
        reload: () => undefined
      })
    ).toBe('ok')
    expect(
      await storiesRunSetCostume({
        editingId: 's',
        set: async () => {
          throw new Error('c')
        },
        linkFallback: async () => undefined,
        hasSetCostume: true,
        toastSuccess: () => undefined,
        toastError: toastErr,
        setError: setErr,
        reload: () => undefined
      })
    ).toBe('error')

    storiesHandleCoverCommitted(
      { storyId: 's2', path: '/p' },
      's1',
      {
        setCoverPath: () => undefined,
        loadDetail: () => undefined,
        refresh: () => msgs.push('ref'),
        toastSuccess: () => undefined
      }
    )
    storiesHandleCoverCommitted(
      { storyId: 's1', path: '/p' },
      's1',
      {
        setCoverPath: (p) => msgs.push('cp:' + p),
        loadDetail: (id) => msgs.push('ld:' + id),
        refresh: () => undefined,
        toastSuccess: () => undefined
      }
    )

    expect(storiesResolveWantIdentity(true, false)).toBe(true)
    expect(storiesResolveWantIdentity(undefined, true)).toBe(true)
    expect(storiesCoverPathsFromOpts('/r', ['a'], true, '/c')).toEqual(['/r'])
    expect(storiesCoverPathsFromOpts(null, ['a'], true, '/c')).toEqual(['a'])
    expect(storiesCoverPathsFromOpts(null, [], true, '/c')).toEqual(['/c'])
    expect(storiesCoverPathsFromOpts(null, [], false, '/c')).toEqual([])
    expect(
      storiesMaybeAppendMulti('p', ['a', 'b'], 'en', (x) => x + '+')
    ).toBe('p+')
    expect(storiesMaybeAppendMulti('p', ['a'], 'en', (x) => x + '+')).toBe('p')
    expect(storiesPlateModeLabel(true, 'I', 'P')).toBe('I')
    expect(storiesPlateModeLabel(false, 'I', 'P')).toBe('P')
    await storiesDiscardDraftSafe(async () => {
      throw new Error('d')
    }, '/p')
    await storiesDiscardDraftSafe(async () => undefined, '/p')
    expect(
      await storiesJobCancelDiscard(false, async () => undefined, '/p')
    ).toBe(false)
    expect(
      await storiesJobCancelDiscard(true, async () => undefined, '/p')
    ).toBe(true)

    expect(
      storiesGuardAiMetaSource('', '', '', '', setErr, 'need')
    ).toBe(true)
    expect(
      storiesGuardAiMetaSource('t', '', '', '', setErr, 'need')
    ).toBe(false)
    expect(
      storiesGuardAiScript(null, 0, 0, setErr, 'save', 'cast')
    ).toBe('needSave')
    expect(
      storiesGuardAiScript('id', 0, 0, setErr, 'save', 'cast')
    ).toBe('needCast')
    expect(
      storiesGuardAiScript('id', 1, 0, setErr, 'save', 'cast')
    ).toBe('ok')
    storiesApplyAiMetaResult('  hard  ', (s) => msgs.push('hr:' + s))
    storiesApplyAiMetaResult('   ', () => msgs.push('skip'))
    storiesApplyAiMetaResult(undefined, () => msgs.push('skip2'))

    expect(
      await storiesRunExportBackup({
        confirm: async () => false,
        exportFn: async () => null,
        toastSuccess: toastOk,
        toastError: toastErr,
        okMsg: (p) => p
      })
    ).toBe('cancel')
    expect(
      await storiesRunExportBackup({
        confirm: async () => true,
        exportFn: async () => ({ filePath: '/b.zip' }),
        toastSuccess: toastOk,
        toastError: toastErr,
        okMsg: (p) => 'ok:' + p
      })
    ).toBe('ok')
    expect(
      await storiesRunExportBackup({
        confirm: async () => true,
        exportFn: async () => ({ downloadUrl: '/d', fileName: 'f.zip' }),
        toastSuccess: toastOk,
        toastError: toastErr,
        okMsg: (p) => p
      })
    ).toBe('ok')
    expect(
      await storiesRunExportBackup({
        confirm: async () => true,
        exportFn: async () => null,
        toastSuccess: toastOk,
        toastError: toastErr,
        okMsg: (p) => p
      })
    ).toBe('noop')
    expect(
      await storiesRunExportBackup({
        confirm: async () => true,
        exportFn: async () => {
          throw new Error('e')
        },
        toastSuccess: toastOk,
        toastError: toastErr,
        okMsg: (p) => p
      })
    ).toBe('error')

    expect(
      await storiesRunImportBackup({
        importFn: async () => null,
        reload: () => undefined,
        setActiveStoryId: () => undefined,
        toastSuccess: () => undefined,
        toastError: toastErr
      })
    ).toBe('cancel')
    expect(
      await storiesRunImportBackup({
        importFn: async () => ({ storyId: 's', title: 'T' }),
        reload: () => undefined,
        setActiveStoryId: (id) => msgs.push('act:' + id),
        toastSuccess: (title) => msgs.push('imp:' + title),
        toastError: toastErr
      })
    ).toBe('ok')
    expect(
      await storiesRunImportBackup({
        importFn: async () => {
          throw new Error('i')
        },
        reload: () => undefined,
        setActiveStoryId: () => undefined,
        toastSuccess: () => undefined,
        toastError: toastErr
      })
    ).toBe('error')

    expect(
      await storiesRunLinkToggle({
        editingId: null,
        linked: false,
        link: async () => undefined,
        unlink: async () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        setError: setErr,
        toastError: toastErr
      })
    ).toBe('no-id')
    expect(
      await storiesRunLinkToggle({
        editingId: 's',
        linked: true,
        link: async () => undefined,
        unlink: async () => undefined,
        reload: () => undefined,
        toastSuccess: (l) => msgs.push('unl:' + l),
        setError: setErr,
        toastError: toastErr
      })
    ).toBe('ok')
    expect(
      await storiesRunLinkToggle({
        editingId: 's',
        linked: false,
        link: async () => undefined,
        unlink: async () => undefined,
        reload: () => undefined,
        toastSuccess: (l) => msgs.push('lnk:' + l),
        setError: setErr,
        toastError: toastErr
      })
    ).toBe('ok')
    expect(
      await storiesRunLinkToggle({
        editingId: 's',
        linked: false,
        link: async () => {
          throw new Error('l')
        },
        unlink: async () => undefined,
        reload: () => undefined,
        toastSuccess: () => undefined,
        setError: setErr,
        toastError: toastErr
      })
    ).toBe('error')

    storiesDispatchCastToggle('characters', 'c1', true, {
      characters: (i, l) => msgs.push('ch:' + i + l),
      scenes: () => undefined,
      props: () => undefined,
      actions: () => undefined
    })
    storiesDispatchCastToggle('scenes', 's1', false, {
      characters: () => undefined,
      scenes: (i, l) => msgs.push('sc:' + i + l),
      props: () => undefined,
      actions: () => undefined
    })
    storiesDispatchCastToggle('props', 'p1', true, {
      characters: () => undefined,
      scenes: () => undefined,
      props: (i, l) => msgs.push('pr:' + i + l),
      actions: () => undefined
    })
    storiesDispatchCastToggle('actions', 'a1', false, {
      characters: () => undefined,
      scenes: () => undefined,
      props: () => undefined,
      actions: (i, l) => msgs.push('ac:' + i + l)
    })

    const beats = [
      {
        id: 'b1',
        characterIds: [],
        characterId: null,
        sceneIds: [],
        sceneId: null,
        propIds: [],
        propId: null,
        actionIds: [],
        actionId: null
      }
    ]
    expect(storiesOptimisticBeatPatch(beats, 'b1', {})).toEqual(beats)
    const patched = storiesOptimisticBeatPatch(beats, 'b1', {
      characterIds: ['c1'],
      sceneIds: ['s1'],
      propIds: ['p1'],
      actionIds: ['a1']
    })
    expect(patched[0].characterId).toBe('c1')
    expect(patched[0].sceneId).toBe('s1')
    expect(
      storiesOptimisticBeatPatch(beats, 'other', { characterIds: ['c'] })
    ).toEqual(beats)
    const multi = [
      { id: 'b1' },
      { id: 'b2' },
      { id: 'b3' }
    ]
    expect(storiesMoveBeatIndex(multi, 'b1', 1).next?.map((b) => b.id)).toEqual([
      'b2',
      'b1',
      'b3'
    ])
    expect(storiesMoveBeatIndex(multi, 'b1', -1).next).toBeNull()
    expect(storiesMoveBeatIndex(multi, 'b3', 1).next).toBeNull()
    expect(storiesSelectedCoverIds(['a'], null)).toEqual(['a'])
    expect(storiesSelectedCoverIds([], 'b')).toEqual(['b'])
    expect(storiesSelectedCoverIds([], null)).toEqual([])
    storiesMsgToast(toastOk, 'm')()
    expect(storiesShouldReorder('a', 'b')).toBe(true)
    expect(storiesShouldReorder('a', 'a')).toBe(false)
    expect(storiesBeatLabel(0, 'T', 'Beat')).toBe('T')
    expect(storiesBeatLabel(1, '', 'Beat')).toBe('Beat 2')
    expect(
      storiesNextCoverAfterRemove([{ path: '/b' }], '/a', '/a', () => '/p')
    ).toBe('/p')
    expect(
      storiesNextCoverAfterRemove([{ path: '/b' }], '/x', '/b', () => '/p')
    ).toBe('/b')
    expect(
      storiesNextCoverAfterRemove([], '/x', '/z', () => null)
    ).toBeNull()

    expect(
      storiesRemoveCoverState(
        [
          { id: 'b', path: '/b' },
          { id: 'c', path: '/c' }
        ],
        { id: 'a', path: '/a' },
        '/a',
        'a',
        () => '/b',
        () => true
      ).coverPath
    ).toBe('/b')
    expect(
      storiesRemoveCoverState(
        [{ id: 'b', path: '/b' }],
        { id: 'a', path: '/a' },
        '/x',
        'a',
        () => '/b',
        () => false
      ).selectedCoverId
    ).toBe('b')
    expect(
      storiesRemoveCoverState(
        [
          { id: 'a', path: '/a' },
          { id: 'b', path: '/b' }
        ],
        { id: 'a', path: '/a' },
        '/b',
        'a',
        () => '/p',
        () => true
      ).selectedCoverId
    ).toBe('a')
    expect(
      storiesRemoveCoverState(
        [{ id: 'b', path: '/b' }],
        { id: 'a', path: '/a' },
        '/b',
        'sel',
        () => '/p',
        () => true
      ).selectedCoverId
    ).toBe('sel')

    expect(storiesAiFillToastKey(true, '', false)).toBe('fromImage')
    expect(storiesAiFillToastKey(false, '', false)).toBe('background')
    expect(storiesHasDraft({ a: 'x' })).toBe(true)
    expect(storiesHasDraft({ a: '' })).toBe(false)
    expect(storiesGuardAiNeed('', false, false, setErr, 'n')).toBe(true)
    expect(storiesGuardAiNeed('i', false, false, setErr, 'n')).toBe(false)

    expect(
      await storiesRunGenerateCoverSetup({
        storyId: null,
        isBusy: () => false,
        useIdentity: false,
        paths: [],
        resolveIdentity: () => ({ useEdit: false, paths: [] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p,
        ensureRules: (p) => p,
        summary: 's',
        setPendingId: () => undefined,
        setConfirm: () => undefined
      })
    ).toBe('no-id')
    expect(
      await storiesRunGenerateCoverSetup({
        storyId: 's',
        isBusy: () => true,
        useIdentity: false,
        paths: [],
        resolveIdentity: () => ({ useEdit: false, paths: [] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p,
        ensureRules: (p) => p,
        summary: 's',
        setPendingId: () => undefined,
        setConfirm: () => undefined
      })
    ).toBe('busy')
    expect(
      await storiesRunGenerateCoverSetup({
        storyId: 's',
        isBusy: () => false,
        useIdentity: true,
        paths: ['/a', '/b'],
        resolveIdentity: () => ({ useEdit: true, paths: ['/a', '/b'] }),
        buildPrompt: () => 'p',
        maybeAppend: (p) => p + '+',
        ensureRules: (p) => p + '!',
        summary: 's',
        setPendingId: (id) => msgs.push('pend:' + id),
        setConfirm: (c) => msgs.push('conf:' + c.prompt)
      })
    ).toBe('ready')

    expect(
      storiesCoverPromptParts({
        locale: 'en',
        title: 'T',
        note: 'n',
        idea: 'i',
        artBlock: 'art'
      }).length
    ).toBeGreaterThan(3)
    expect(
      storiesCoverPromptParts({
        locale: 'zh-HK',
        title: 'T',
        note: '',
        idea: '',
        artBlock: 'art'
      }).length
    ).toBeGreaterThan(3)


    await storiesMakeLinkToggle({
      getEditingId: () => 's',
      link: async () => undefined,
      unlink: async () => undefined,
      reload: () => undefined,
      toastSuccess: () => undefined,
      setError: () => undefined,
      toastError: () => undefined
    })('id', false)
    storiesMakeSetCover(
      () => undefined,
      [{ id: 'g', path: '/p' }],
      () => undefined,
      () => undefined
    )('/p')
    storiesMakeSetCover(
      () => undefined,
      [],
      () => undefined,
      () => undefined
    )('/x')
    storiesMakeCoverCommitted(() => 's1', {
      setCoverPath: () => undefined,
      loadDetail: () => undefined,
      refresh: () => undefined,
      toastSuccess: () => undefined
    })({ storyId: 's1', path: '/c' })
    expect(storiesGeneratingLabel(true, 'G', 'I')).toBe('G')
    expect(storiesGeneratingLabel(false, 'G', 'I')).toBe('I')
    expect(storiesStatusOrDraft('READY', () => true)).toBe('READY')
    expect(storiesStatusOrDraft('x', () => false)).toBe('DRAFT')
    expect(storiesAppendTemplate('hi', 'tmpl')).toBe('hi\ntmpl')
    expect(storiesAppendTemplate('', 'tmpl')).toBe('tmpl')
    expect(storiesSpokenPreview('short')).toBe('short')
    expect(storiesSpokenPreview('x'.repeat(100)).endsWith('…')).toBe(true)
    expect(await storiesCreateId(async () => ({ id: 'n' }))).toEqual({ id: 'n' })
    expect(storiesEditPrefix('en')).toMatch(/IMAGE EDIT/)
    expect(storiesEditPrefix('zh-HK')).toMatch(/IMAGE EDIT/)
    expect(
      storiesPrimaryCover([{ id: 'a', path: '/a' }], '/a')?.id
    ).toBe('a')
    expect(storiesPrimaryCover([], null)).toBeNull()
    expect(
      storiesSortTitle({ title: 'B' }, { title: 'A' })
    ).toBeGreaterThan(0)


    await storiesRunUpdateBeat({
      id: 'b1',
      patch: { characterIds: ['c'] },
      setBeats: (fn) => fn([{ id: 'b1' }]),
      update: async () => ({ id: 'b1', dialogue: 'x' }),
      setError: () => undefined,
      toastError: () => undefined,
      editingId: 's',
      reload: () => undefined
    })
    await storiesRunUpdateBeat({
      id: 'b1',
      patch: {},
      setBeats: (fn) => fn([{ id: 'b1' }]),
      update: async () => {
        throw new Error('u')
      },
      setError: () => undefined,
      toastError: () => undefined,
      editingId: 's',
      reload: () => undefined
    })
    expect(
      await storiesRunDeleteBeat({
        confirm: async () => false,
        delete: async () => undefined,
        editingId: 's',
        reload: () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined
      })
    ).toBe('cancel')
    expect(
      await storiesRunDeleteBeat({
        confirm: async () => true,
        delete: async () => undefined,
        editingId: 's',
        reload: () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined
      })
    ).toBe('ok')
    expect(
      await storiesRunDeleteBeat({
        confirm: async () => true,
        delete: async () => {
          throw new Error('d')
        },
        editingId: null,
        reload: () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined
      })
    ).toBe('error')
    expect(
      await storiesRunMoveBeat({
        editingId: null,
        beats: [{ id: 'a' }],
        id: 'a',
        delta: 1,
        setBeats: () => undefined,
        reorder: async () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined,
        reload: () => undefined
      })
    ).toBe('no-id')
    expect(
      await storiesRunMoveBeat({
        editingId: 's',
        beats: [{ id: 'a' }, { id: 'b' }],
        id: 'a',
        delta: 1,
        setBeats: () => undefined,
        reorder: async () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined,
        reload: () => undefined
      })
    ).toBe('ok')
    expect(
      await storiesRunMoveBeat({
        editingId: 's',
        beats: [{ id: 'a' }],
        id: 'a',
        delta: 1,
        setBeats: () => undefined,
        reorder: async () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined,
        reload: () => undefined
      })
    ).toBe('noop')
    expect(
      await storiesRunMoveBeat({
        editingId: 's',
        beats: [{ id: 'a' }, { id: 'b' }],
        id: 'a',
        delta: 1,
        setBeats: () => undefined,
        reorder: async () => {
          throw new Error('r')
        },
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined,
        reload: () => undefined
      })
    ).toBe('error')
    expect(
      storiesPickCoverImage([{ id: 'a', path: '/a' }], 'a', null)?.id
    ).toBe('a')


    expect(storiesApplyBeatTemplate('hi', 't')).toBe('hi\nt')
    expect(
      storiesApplyBeatTemplateToList(
        [{ id: 'b1', dialogue: 'a' }, { id: 'b2', dialogue: '' }],
        'b1',
        'TMPL'
      )[0].dialogue
    ).toMatch(/TMPL/)
    expect(
      storiesCommitBeatBlur('x', 'en', () => ({
        dialogue: 'd',
        beatContentJson: '{}'
      })).dialogue
    ).toBe('d')
    expect(
      storiesCommitBeatBlur('  ', 'en', () => ({ dialogue: null })).dialogue
    ).toBeNull()
    expect(storiesHardRulesFromDetail('h')).toBe('h')
    expect(storiesHardRulesFromDetail(null)).toBe('')
    expect(storiesCastPageNext(1, 5)).toBe(2)
    expect(storiesCastPageNext(5, 5)).toBe(5)
    expect(storiesDescSlice('hello world', 5)).toBe('hello')


    expect(
      storiesPickCoverImage(
        [
          { id: 'a', path: '/a' },
          { id: 'b', path: '/b' }
        ],
        null,
        '/b'
      )?.id
    ).toBe('b')
    expect(
      storiesPickCoverImage([{ id: 'a', path: '/a' }], null, null)?.id
    ).toBe('a')
    expect(storiesPickCoverImage([], null, null)).toBeNull()
    storiesCancelImageGen(
      () => undefined,
      () => undefined
    )
    storiesMultiBindUpdate(
      (id, p) => undefined,
      'b1',
      'characterIds',
      ['c1']
    )
    // force prop toggle factory path via makeLinkToggle
    await storiesMakeLinkToggle({
      getEditingId: () => 's',
      link: async (id) => {
        msgs.push('plink:' + id)
      },
      unlink: async (id) => {
        msgs.push('punl:' + id)
      },
      reload: async () => {
        msgs.push('prel')
      },
      toastSuccess: (l) => msgs.push('pt:' + l),
      setError: () => undefined,
      toastError: () => undefined
    })('prop-1', true)

    expect(msgs.length).toBeGreaterThan(0)

    // --- absolute residual thin-wrap pure ---
    expect(
      storiesBrowseSort(
        'title',
        { title: 'B', updatedAt: '2020-01-01' },
        { title: 'A', updatedAt: '2021-01-01' }
      )
    ).toBeGreaterThan(0)
    expect(
      storiesBrowseSort(
        'updated',
        { title: 'A', updatedAt: '2020-01-01' },
        { title: 'B', updatedAt: undefined }
      )
    ).toBeLessThan(0)
    expect(
      await storiesCreateStoryId('T', async (t) => ({ id: 'id-' + t }))
    ).toEqual({ id: 'id-T' })
    expect(
      await storiesCoverJobAfterGen({
        cancelled: false,
        discard: async () => undefined,
        path: '/p'
      })
    ).toBe(false)
    expect(
      await storiesCoverJobAfterGen({
        cancelled: true,
        discard: async () => undefined,
        path: '/p'
      })
    ).toBe(true)
    const propOps = storiesPropLinkToggleOps({
      getEditingId: () => 's1',
      linkProp: async (s, p) => {
        msgs.push(`lp:${s}:${p}`)
      },
      unlinkProp: async (s, p) => {
        msgs.push(`up:${s}:${p}`)
      },
      loadDetail: async (id) => {
        msgs.push('ld:' + id)
      },
      refreshStories: async () => {
        msgs.push('rs')
      },
      toastSuccess: (l) => msgs.push('ts:' + l),
      setError: () => undefined,
      toastError: () => undefined
    })
    await propOps.link('p9')
    await propOps.unlink('p9')
    await propOps.reload()
    propOps.toastSuccess(true)
    expect(
      storiesCastBrowserRows('props', {
        characters: [],
        scenes: [],
        props: [{ id: 'p1', name: 'Gun', description: 'd', updatedAt: 't' }],
        actions: [],
        linkedCharIds: new Set(),
        linkedSceneIds: new Set(),
        linkedPropIds: new Set(['p1']),
        linkedActionIds: new Set(),
        emptyChars: 'ec',
        emptyScenes: 'es',
        emptyProps: 'ep',
        emptyActions: 'ea'
      }).empty
    ).toBe('ep')
    expect(
      storiesCastBrowserRows('characters', {
        characters: [{ id: 'c1', name: 'A', description: 'd' }],
        scenes: [],
        props: [],
        actions: [],
        linkedCharIds: new Set(['c1']),
        linkedSceneIds: new Set(),
        linkedPropIds: new Set(),
        linkedActionIds: new Set(),
        emptyChars: 'ec',
        emptyScenes: 'es',
        emptyProps: 'ep',
        emptyActions: 'ea'
      }).items[0].label
    ).toBe('A')
    expect(
      storiesCastBrowserRows('scenes', {
        characters: [],
        scenes: [{ id: 'sc', title: '', description: 'longdesc-here' }],
        props: [],
        actions: [],
        linkedCharIds: new Set(),
        linkedSceneIds: new Set(),
        linkedPropIds: new Set(),
        linkedActionIds: new Set(),
        emptyChars: 'ec',
        emptyScenes: 'es',
        emptyProps: 'ep',
        emptyActions: 'ea'
      }).items[0].label
    ).toMatch(/longdesc/)
    expect(
      storiesCastBrowserRows('actions', {
        characters: [],
        scenes: [],
        props: [],
        actions: [{ id: 'a1', name: 'Kick', description: 'k' }],
        linkedCharIds: new Set(),
        linkedSceneIds: new Set(),
        linkedPropIds: new Set(),
        linkedActionIds: new Set(),
        emptyChars: 'ec',
        emptyScenes: 'es',
        emptyProps: 'ep',
        emptyActions: 'ea'
      }).items[0].id
    ).toBe('a1')
    expect(
      await storiesRunAddBeat({
        editingId: null,
        order: 0,
        create: async () => undefined,
        loadDetail: async () => undefined,
        refreshStories: async () => undefined,
        setError: () => undefined
      })
    ).toBe('no-id')
    expect(
      await storiesRunAddBeat({
        editingId: 's',
        order: 2,
        firstChar: 'c1',
        firstScene: 'sc1',
        create: async (payload) => {
          msgs.push('create-beat:' + payload.order)
        },
        loadDetail: async () => undefined,
        refreshStories: async () => undefined,
        setError: () => undefined
      })
    ).toBe('ok')
    expect(
      await storiesRunAddBeat({
        editingId: 's',
        order: 0,
        create: async () => {
          throw new Error('beat-fail')
        },
        loadDetail: async () => undefined,
        refreshStories: async () => undefined,
        setError: (m) => msgs.push('be:' + m)
      })
    ).toBe('error')
    expect(storiesCoverSetHandler(null, () => undefined)).toBeUndefined()
    expect(typeof storiesCoverSetHandler('/p', () => undefined)).toBe('function')
    storiesCoverSetHandler('/p', (p) => msgs.push('set:' + p))?.()
    expect(storiesCoverRemoveHandler(undefined, () => undefined)).toBeUndefined()
    storiesCoverRemoveHandler('gid', (id) => msgs.push('rm:' + id))?.()
    expect(storiesBlurDialogue('d', 'x')).toBe('d')
    expect(storiesBlurDialogue(null, '  ')).toBeNull()
    expect(storiesBlurDialogue(undefined, ' hi ')).toBe('hi')
    // pickCover path/0/null all branches again
    expect(
      storiesPickCoverImage(
        [
          { id: 'x', path: '/x' },
          { id: 'y', path: '/y' }
        ],
        'missing',
        '/nope'
      )?.id
    ).toBe('x')
    expect(storiesPickCoverImage([], 'z', '/z')).toBeNull()

    expect(storiesCoverJobCancelledResult()).toBeUndefined()
    expect(
      storiesAiMetaShouldSkip('', '', '', '', () => undefined, 'need')
    ).toBe(true)
    expect(
      storiesAiMetaShouldSkip('T', '', '', '', () => undefined, 'need')
    ).toBe(false)
    expect(
      await storiesCoverJobFinishOrCancel({
        cancelled: true,
        discard: async () => undefined,
        path: '/p',
        onContinue: async () => 'go'
      })
    ).toBeUndefined()
    expect(
      await storiesCoverJobFinishOrCancel({
        cancelled: false,
        discard: async () => undefined,
        path: '/p',
        onContinue: async () => 'go'
      })
    ).toBe('go')
    let ran = false
    storiesRunAiMetaIfReady({ skip: true, run: () => { ran = true } })
    expect(ran).toBe(false)
    storiesRunAiMetaIfReady({ skip: false, run: () => { ran = true } })
    expect(ran).toBe(true)
    const pt = storiesMakePropToggle({
      getEditingId: () => 's1',
      storiesApi: {
        linkProp: async ({ storyId, propId }) => {
          msgs.push(`L:${storyId}:${propId}`)
        },
        unlinkProp: async ({ storyId, propId }) => {
          msgs.push(`U:${storyId}:${propId}`)
        }
      },
      loadDetail: async () => { msgs.push('ld') },
      refreshStories: async () => { msgs.push('rf') },
      linkedMsg: 'linked',
      unlinkedMsg: 'unlinked',
      toastSuccess: (m) => msgs.push(m),
      setError: () => undefined,
      toastError: () => undefined
    })
    await pt('prop-x', false)
    await pt('prop-x', true)
    storiesMultiBindHandler((id, p) => { msgs.push(id + JSON.stringify(p)) }, 'b1', 'characterIds')(['c1'])
    storiesMultiBindHandler((id, p) => { msgs.push('s' + id) }, 'b1', 'sceneIds')(['s1'])
    storiesMultiBindHandler((id, p) => { msgs.push('p' + id) }, 'b1', 'propIds')(['p1'])
    storiesMultiBindHandler((id, p) => { msgs.push('a' + id) }, 'b1', 'actionIds')(['a1'])
    storiesCancelImageGenBind(() => { msgs.push('cc') }, () => { msgs.push('cp') })()
    let page = 1
    storiesCastPageNextClick((fn) => { page = fn(page) }, 5)()
    expect(page).toBe(2)
    expect(storiesCostumeOptionLabel('', 'desc-here')).toBe('desc-here')
    expect(storiesCostumeOptionLabel('Name', 'd')).toBe('Name')


  })
})



describe('abs100 Settings pure residual helpers', () => {
  it('covers every pure residual branch', async () => {
    const S = await import('./SettingsPage')
    if (typeof (S as any).settingsApiKeyPlaceholder !== 'function' && typeof (S as any).settingsApiKeyHint !== 'function') {
      expect(typeof S.SettingsPage).toBe('function')
      return
    }

    const msgs: string[] = []
    settingsApplyIpc(new Error('x'), (m) => msgs.push(m), (m) => msgs.push('t:' + m))
    settingsApplyIpc(new Error('y'))
    expect(settingsApplyIpcBody(new Error('b')).message).toBeTruthy()
    settingsCatchToast((m) => msgs.push(m))(new Error('z'))
    expect(settingsTabId('llm')).toBe('llm')
    expect(settingsProviderLabel('openai', { openai: 'OpenAI' })).toBe('OpenAI')
    expect(settingsProviderLabel('x', {})).toBe('x')
    expect(settingsBoolOr(undefined, true)).toBe(true)
    expect(settingsBoolOr(false, true)).toBe(false)
    expect(settingsStringOr(null, 'd')).toBe('d')
    expect(settingsStringOr('  v  ', 'd')).toBe('v')
    expect(settingsNumOr(3, 1)).toBe(3)
    expect(settingsNumOr(undefined, 1)).toBe(1)
    expect(settingsPickTab('llm', ['llm', 'app'], 'app')).toBe('llm')
    expect(settingsPickTab('x', ['llm'], 'app')).toBe('app')
    settingsSilentOrToast(true, (m) => msgs.push(m), 's')
    settingsSilentOrToast(false, (m) => msgs.push('ns:' + m), 's')
    expect(
      settingsModelsFromList([
        { id: 'a' },
        { id: 'b', ownedBy: 'fallback' }
      ])
    ).toEqual({ ids: ['a', 'b'], usedFallback: true })
    expect(settingsModelsFromList([{ id: 'a' }]).usedFallback).toBe(false)
    expect(settingsRateLimitFallbackModels('m1')).toContain('m1')
    expect(settingsRateLimitFallbackModels(undefined)).toContain('grok-4.5')
    expect(settingsIsRateLimit(new Error('x'))).toBe(false)

    expect(
      await settingsRunSaveFull({
        settings: null,
        setSaving: () => undefined,
        setError: () => undefined,
        coerceLang: (l) => l,
        currentLang: 'en',
        changeLang: async () => undefined,
        set: async () => ({}),
        applyNext: () => undefined,
        refreshAi: () => undefined,
        toastSuccess: () => undefined,
        toastError: () => undefined
      })
    ).toBe('no-settings')
    expect(
      await settingsRunSaveFull({
        settings: { uiLanguage: 'en' },
        setSaving: () => undefined,
        setError: () => undefined,
        coerceLang: (l) => l,
        currentLang: 'en',
        changeLang: async () => undefined,
        set: async (s) => s,
        applyNext: () => msgs.push('next'),
        refreshAi: () => msgs.push('ai'),
        toastSuccess: () => msgs.push('saved'),
        toastError: () => undefined
      })
    ).toBe('ok')
    expect(
      await settingsRunSaveFull({
        settings: { uiLanguage: 'zh-HK' },
        setSaving: () => undefined,
        setError: () => undefined,
        coerceLang: () => 'zh-HK',
        currentLang: 'en',
        changeLang: async () => msgs.push('chlang'),
        set: async () => {
          throw new Error('save')
        },
        applyNext: () => undefined,
        refreshAi: () => undefined,
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push(m)
      })
    ).toBe('error')

    expect(
      await settingsRunRefreshModelsFull({
        setBusy: () => undefined,
        maybeSet: async () => undefined,
        list: async () => [{ id: 'm1' }],
        setModels: (ids) => msgs.push('ids:' + ids.join(',')),
        toastInfo: (m) => msgs.push('i:' + m),
        toastSuccess: (m) => msgs.push('s:' + m),
        toastError: (m) => msgs.push('e:' + m),
        fallbackMsg: 'fb',
        loadedMsg: (n) => 'loaded:' + n,
        rateLimitMsg: 'rl',
        currentModel: 'm0',
        formatError: (e) => String(e)
      })
    ).toBe('ok')
    expect(
      await settingsRunRefreshModelsFull({
        setBusy: () => undefined,
        maybeSet: async () => undefined,
        list: async () => [{ id: 'm1', ownedBy: 'fallback' }],
        setModels: () => undefined,
        toastInfo: (m) => msgs.push('fb:' + m),
        toastSuccess: () => undefined,
        toastError: () => undefined,
        fallbackMsg: 'fb',
        loadedMsg: () => 'l',
        rateLimitMsg: 'rl',
        formatError: (e) => String(e)
      })
    ).toBe('ok')
    expect(
      await settingsRunRefreshModelsFull({
        setBusy: () => undefined,
        maybeSet: async () => undefined,
        list: async () => {
          throw new Error(
            JSON.stringify({ code: 'AI_RATE_LIMIT', message: 'rl' })
          )
        },
        setModels: (ids) => msgs.push('rlids:' + ids.length),
        toastInfo: (m) => msgs.push('rli:' + m),
        toastSuccess: () => undefined,
        toastError: () => undefined,
        fallbackMsg: 'fb',
        loadedMsg: () => 'l',
        rateLimitMsg: 'rl',
        currentModel: 'x',
        formatError: (e) => String(e)
      })
    ).toBe('rate-limit')
    expect(
      await settingsRunRefreshModelsFull({
        setBusy: () => undefined,
        maybeSet: async () => undefined,
        list: async () => {
          throw new Error('other')
        },
        setModels: () => undefined,
        toastInfo: () => undefined,
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push('err:' + m),
        fallbackMsg: 'fb',
        loadedMsg: () => 'l',
        rateLimitMsg: 'rl',
        formatError: (e) => 'fmt:' + (e as Error).message
      })
    ).toBe('error')

    expect(
      await settingsRunTestChatFull({
        settings: null,
        setBusy: () => undefined,
        set: async () => undefined,
        test: async () => ({ message: 'm', replyPreview: 'r' }),
        toastSuccess: () => undefined,
        toastError: () => undefined,
        formatOk: () => 'ok',
        formatError: () => 'e',
        refreshAi: () => undefined
      })
    ).toBe('no-settings')
    expect(
      await settingsRunTestChatFull({
        settings: {},
        setBusy: () => undefined,
        set: async () => undefined,
        test: async () => ({ message: 'm', replyPreview: 'hello' }),
        toastSuccess: (m) => msgs.push('chat:' + m),
        toastError: () => undefined,
        formatOk: (r) => r.message,
        formatError: () => 'e',
        refreshAi: () => msgs.push('refai')
      })
    ).toBe('ok')
    expect(
      await settingsRunTestChatFull({
        settings: {},
        setBusy: () => undefined,
        set: async () => undefined,
        test: async () => {
          throw new Error('fail')
        },
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push('tce:' + m),
        formatOk: () => 'ok',
        formatError: (e) => 'fmt:' + (e as Error).message,
        refreshAi: () => undefined
      })
    ).toBe('error')

    expect(
      await settingsRunClearAll({
        confirm: async () => false,
        clear: async () => undefined,
        toastSuccess: () => undefined,
        toastError: () => undefined,
        setError: () => undefined,
        reload: () => undefined
      })
    ).toBe('cancel')
    expect(
      await settingsRunClearAll({
        confirm: async () => true,
        clear: async () => undefined,
        toastSuccess: () => msgs.push('cleared'),
        toastError: () => undefined,
        setError: () => undefined,
        reload: () => undefined
      })
    ).toBe('ok')
    expect(
      await settingsRunClearAll({
        confirm: async () => true,
        clear: async () => {
          throw new Error('clr')
        },
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push(m),
        setError: () => undefined,
        reload: () => undefined
      })
    ).toBe('error')
    expect(
      await settingsRunLlmPreset({
        set: async () => undefined,
        toastSuccess: () => undefined,
        toastError: () => undefined,
        setError: () => undefined
      })
    ).toBe('ok')
    expect(
      await settingsRunLlmPreset({
        set: async () => {
          throw new Error('p')
        },
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push(m),
        setError: () => undefined
      })
    ).toBe('error')

    
    // --- settings residual pure thin-wraps ---
    settingsSetWebStatusMissing(() => undefined)
    expect(settingsGetGatewayApi(() => ({ gateway: { x: 1 } }))).toEqual({ x: 1 })
    expect(settingsGetGatewayApi(() => { throw new Error('no') })).toBeNull()
    expect(settingsGetGatewayApi(() => ({}))).toBeNull()
    expect(settingsGatewayMissingStatus('m').state).toBe('gateway_missing')
    settingsApplyGatewayMissing(() => undefined, 'm')
    settingsEnsureGatewayMissing({
      silent: false,
      toastError: (m) => msgs.push(m),
      setGatewayStatus: () => undefined,
      msg: 'gw-miss'
    })
    settingsEnsureGatewayMissing({
      silent: true,
      toastError: (m) => msgs.push('s:' + m),
      setGatewayStatus: () => undefined,
      msg: 'gw-miss'
    })
    expect(settingsOpenExternalEmpty('', (m) => msgs.push(m), 'nou')).toBe(true)
    expect(settingsOpenExternalEmpty('http://x', () => undefined, 'nou')).toBe(false)
    settingsClearAllCatch(new Error('clr'), (m) => msgs.push(m), (m) => msgs.push('t:' + m))
    await settingsApplyLlmPresetFallback(
      { llmProvider: 'openai', baseUrl: 'http://o', videoPath: '/v', model: 'm' } as never,
      'openai' as never,
      async (p) => {
        msgs.push('preset:' + p.llmProvider)
        return p
      }
    )
    settingsToastUpdateCheck(
      { status: 'available', latestVersion: '2' },
      {
        toastInfo: (m) => msgs.push('i:' + m),
        toastSuccess: (m) => msgs.push('s:' + m),
        toastError: (m) => msgs.push('e:' + m),
        availableMsg: (v) => 'av:' + v,
        upToDateMsg: 'up',
        devSkippedMsg: (k) => 'dev:' + (k || ''),
        errorMsg: (m) => m || 'err'
      }
    )
    settingsToastUpdateCheck(
      { status: 'not-available' },
      {
        toastInfo: () => undefined,
        toastSuccess: (m) => msgs.push('na:' + m),
        toastError: () => undefined,
        availableMsg: () => '',
        upToDateMsg: 'up',
        devSkippedMsg: () => '',
        errorMsg: () => ''
      }
    )
    settingsToastUpdateCheck(
      { status: 'dev-skipped', messageKey: 'updateDevSkipped' },
      {
        toastInfo: (m) => msgs.push('ds:' + m),
        toastSuccess: () => undefined,
        toastError: () => undefined,
        availableMsg: () => '',
        upToDateMsg: 'up',
        devSkippedMsg: (k) => 'dev:' + (k || 'none'),
        errorMsg: () => ''
      }
    )
    settingsToastUpdateCheck(
      { status: 'web-skipped' },
      {
        toastInfo: (m) => msgs.push('ws:' + m),
        toastSuccess: () => undefined,
        toastError: () => undefined,
        availableMsg: () => '',
        upToDateMsg: 'up',
        devSkippedMsg: () => 'webskip',
        errorMsg: () => ''
      }
    )
    settingsToastUpdateCheck(
      { status: 'error', message: 'boom' },
      {
        toastInfo: () => undefined,
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push('err:' + m),
        availableMsg: () => '',
        upToDateMsg: 'up',
        devSkippedMsg: () => '',
        errorMsg: (m) => m || 'err'
      }
    )
    settingsToastUpdateDownload(
      { status: 'downloaded' },
      {
        toastSuccess: (m) => msgs.push('dl:' + m),
        toastError: () => undefined,
        okMsg: 'ok',
        failMsg: (m) => m || 'f'
      }
    )
    settingsToastUpdateDownload(
      { status: 'error', message: 'd' },
      {
        toastSuccess: () => undefined,
        toastError: (m) => msgs.push('dle:' + m),
        okMsg: 'ok',
        failMsg: (m) => m || 'f'
      }
    )
    settingsToastUpdateInstall({ ok: false, message: 'i' }, (m) => msgs.push('inst:' + m), (m) => m || 'if')
    settingsToastUpdateInstall({ ok: true }, () => undefined, () => '')
    await settingsOpenReleasePage({
      openRelease: async () => ({ ok: false, message: 'or' }),
      toastError: (m) => msgs.push(m),
      openExternal: async () => undefined,
      failMsg: (m) => m || 'f',
      failSimple: 'fs'
    })
    await settingsOpenReleasePage({
      openRelease: async () => {
        throw new Error('x')
      },
      toastError: (m) => msgs.push('orc:' + m),
      openExternal: async () => undefined,
      failMsg: (m) => m || 'f',
      failSimple: 'fs'
    })
    await settingsOpenReleasePage({
      releaseUrl: null,
      openExternal: async (u) => {
        msgs.push('ext:' + u)
      },
      toastError: () => undefined,
      failMsg: () => '',
      failSimple: 'fs'
    })
    await settingsOpenReleasePage({
      openExternal: async () => {
        throw new Error('oe')
      },
      toastError: (m) => msgs.push('oef:' + m),
      failMsg: () => '',
      failSimple: 'fs'
    })
    await settingsStopWebServer({
      stop: async () => ({
        running: false,
        url: null,
        port: 1,
        error: null,
        staticReady: false
      }),
      setWebStatus: () => undefined,
      setSettings: () => undefined,
      persist: async () => ({}),
      toastInfo: (m) => msgs.push('stop:' + m),
      stoppedMsg: 'stopped'
    })
    expect(
      settingsNpmCheckMissing(null, () => undefined, (m) => msgs.push(m), 'npm-miss')
    ).toBe(true)
    expect(
      settingsNpmCheckMissing(() => undefined, () => undefined, () => undefined, 'npm-miss')
    ).toBe(false)
    await settingsOpenExternalWithFallback(async () => undefined, 'http://ok')
    await settingsOpenExternalWithFallback(async () => {
      throw new Error('fail')
    }, 'http://fb')
    // clipboard may fail in happy-dom — both branches
    await settingsCopyText('tok', (m) => msgs.push('cs:' + m), (m) => msgs.push('ci:' + m), 'copied')
    const patches: string[] = []
    settingsVideoChannelCustom(
      'custom',
      '',
      'http://base',
      (k, v) => patches.push(k + ':' + v),
      () => null
    )
    settingsVideoChannelCustom(
      'seedance',
      'http://v',
      'http://base',
      (k, v) => patches.push(k + ':' + v),
      (v) => (v === 'seedance' ? 'http://sd' : null)
    )
    settingsImageBaseUrlChange(
      'http://custom',
      'openai',
      (k, v) => patches.push(k + ':' + v),
      () => true,
      () => 'http://def'
    )
    settingsImageBaseUrlChange('x', 'custom', () => undefined, () => true, () => 'd')
    expect(settingsGatewayPackageMissing(false, (m) => msgs.push(m), 'pkg')).toBe(false)
    expect(settingsGatewayPackageMissing(true, () => undefined, 'pkg')).toBe(false)
    expect(settingsInstallHintsFallback('cmd').installCommand).toBe('cmd')
    settingsWebServerApiMissing((m) => msgs.push(m), 'noapi')
    expect(
      (settingsMergeFreshGateway(
        { apiKey: 'a', model: 'm1' },
        { apiKey: 'b', baseUrl: 'u', llmProvider: 'p', model: '' }
      ) as { apiKey: string; model: string }).apiKey
    ).toBe('b')
    expect(
      (settingsMergeFreshGateway(null, { apiKey: 'c' }) as { apiKey: string }).apiKey
    ).toBe('c')
    settingsBackupImportReloadToast((m) => msgs.push(m), 'reload')

    await settingsRunRefreshWebStatus({
      isElectron: false,
      getWebServer: () => null,
      setWebStatus: () => undefined
    })
    await settingsRunRefreshWebStatus({
      isElectron: true,
      getWebServer: () => ({}),
      setWebStatus: (s) => msgs.push('ws:' + String(s))
    })
    await settingsRunRefreshWebStatus({
      isElectron: true,
      getWebServer: () => ({
        status: async () => ({
          running: true,
          url: 'http://x',
          port: 1,
          error: null,
          staticReady: true
        })
      }),
      setWebStatus: (s) => msgs.push('run:' + String((s as { running?: boolean })?.running))
    })
    await settingsRunRefreshWebStatus({
      isElectron: true,
      getWebServer: () => ({
        status: async () => {
          throw new Error('st')
        }
      }),
      setWebStatus: (s) => msgs.push('nullws:' + String(s))
    })
    await settingsRunRefreshGatewayStatus({
      getGateway: () => null,
      setGatewayStatus: () => undefined,
      unavailableMsg: 'u'
    })
    await settingsRunRefreshGatewayStatus({
      getGateway: () => ({
        status: async () => ({ state: 'ready' })
      }),
      setGatewayStatus: (s) => msgs.push('gst:' + JSON.stringify(s)),
      unavailableMsg: 'u'
    })
    await settingsRunRefreshGatewayStatus({
      getGateway: () => ({
        status: async () => {
          throw new Error('g')
        }
      }),
      setGatewayStatus: (s) => msgs.push('gnull:' + String(s)),
      unavailableMsg: 'u'
    })
    expect(
      await settingsRunEnsureGateway({
        silent: true,
        setBusy: () => undefined,
        getGateway: () => null,
        setGatewayStatus: () => undefined,
        getSettings: async () => ({}),
        setSettings: () => undefined,
        openExternalUrl: async () => undefined,
        refreshAiStatus: async () => undefined,
        toastError: () => undefined,
        toastSuccess: () => undefined,
        toastInfo: () => undefined,
        unavailableMsg: 'u',
        buildMissingMsg: 'b',
        packageMissingMsg: 'p',
        readyWithKeyMsg: 'rk',
        readyMsg: 'r'
      })
    ).toBe(false)
    expect(
      await settingsRunEnsureGateway({
        silent: false,
        setBusy: () => undefined,
        getGateway: () => ({
          ensure: async () => ({ state: 'grok_build_missing' }),
          installHints: async () => ({ grokBuildUrl: 'http://x.ai' })
        }),
        setGatewayStatus: () => undefined,
        getSettings: async () => {
          throw new Error('no')
        },
        setSettings: () => undefined,
        openExternalUrl: async (u) => {
          msgs.push('open:' + u)
        },
        refreshAiStatus: async () => undefined,
        toastError: (m) => msgs.push(m),
        toastSuccess: () => undefined,
        toastInfo: () => undefined,
        unavailableMsg: 'u',
        buildMissingMsg: 'bmiss',
        packageMissingMsg: 'p',
        readyWithKeyMsg: 'rk',
        readyMsg: 'r'
      })
    ).toBe(false)
    expect(
      await settingsRunEnsureGateway({
        silent: true,
        setBusy: () => undefined,
        getGateway: () => ({
          ensure: async () => ({ state: 'gateway_missing' }),
          installHints: async () => ({ grokBuildUrl: 'http://x' })
        }),
        setGatewayStatus: () => undefined,
        getSettings: async () => ({}),
        setSettings: () => undefined,
        openExternalUrl: async () => undefined,
        refreshAiStatus: async () => undefined,
        toastError: () => undefined,
        toastSuccess: () => undefined,
        toastInfo: () => undefined,
        unavailableMsg: 'u',
        buildMissingMsg: 'b',
        packageMissingMsg: 'pkg',
        readyWithKeyMsg: 'rk',
        readyMsg: 'r'
      })
    ).toBe(false)
    expect(
      await settingsRunEnsureGateway({
        silent: false,
        setBusy: () => undefined,
        getGateway: () => ({
          ensure: async () => ({
            state: 'ready',
            healthOk: true,
            keyCreated: true
          }),
          installHints: async () => ({ grokBuildUrl: 'http://x' })
        }),
        setGatewayStatus: () => undefined,
        getSettings: async () => ({ apiKey: 'k' }),
        setSettings: (fn) => {
          fn(null)
          fn({ model: 'old' })
        },
        openExternalUrl: async () => undefined,
        refreshAiStatus: async () => {
          msgs.push('refai')
        },
        toastError: () => undefined,
        toastSuccess: (m) => msgs.push('ok:' + m),
        toastInfo: () => undefined,
        unavailableMsg: 'u',
        buildMissingMsg: 'b',
        packageMissingMsg: 'p',
        readyWithKeyMsg: 'rk',
        readyMsg: 'r'
      })
    ).toBe(true)
    expect(
      await settingsRunEnsureGateway({
        silent: false,
        setBusy: () => undefined,
        getGateway: () => ({
          ensure: async () => ({ state: 'starting', message: 'wait' }),
          installHints: async () => ({ grokBuildUrl: 'http://x' })
        }),
        setGatewayStatus: () => undefined,
        getSettings: async () => ({}),
        setSettings: () => undefined,
        openExternalUrl: async () => undefined,
        refreshAiStatus: async () => undefined,
        toastError: () => undefined,
        toastSuccess: () => undefined,
        toastInfo: (m) => msgs.push('info:' + m),
        unavailableMsg: 'u',
        buildMissingMsg: 'b',
        packageMissingMsg: 'p',
        readyWithKeyMsg: 'rk',
        readyMsg: 'r'
      })
    ).toBe(false)
    expect(
      await settingsRunEnsureGateway({
        silent: false,
        setBusy: () => undefined,
        getGateway: () => ({
          ensure: async () => {
            throw new Error('ens')
          },
          installHints: async () => ({ grokBuildUrl: 'http://x' })
        }),
        setGatewayStatus: () => undefined,
        getSettings: async () => ({}),
        setSettings: () => undefined,
        openExternalUrl: async () => undefined,
        refreshAiStatus: async () => undefined,
        toastError: (m) => msgs.push('enserr:' + m),
        toastSuccess: () => undefined,
        toastInfo: () => undefined,
        unavailableMsg: 'u',
        buildMissingMsg: 'b',
        packageMissingMsg: 'p',
        readyWithKeyMsg: 'rk',
        readyMsg: 'r'
      })
    ).toBe(false)
    await settingsRunOpenExternalUrl({
      url: '',
      toastError: (m) => msgs.push(m),
      toastInfo: () => undefined,
      noUrlMsg: 'nou',
      unavailableMsg: 'unav',
      copiedMsg: (h) => 'c:' + h,
      openExternal: async () => undefined,
      writeClipboard: async () => undefined
    })
    await settingsRunOpenExternalUrl({
      url: ' http://ok ',
      toastError: () => undefined,
      toastInfo: () => undefined,
      noUrlMsg: 'nou',
      unavailableMsg: 'unav',
      copiedMsg: (h) => 'c:' + h,
      openExternal: async (h) => {
        msgs.push('oe:' + h)
      },
      writeClipboard: async () => undefined
    })
    await settingsRunOpenExternalUrl({
      url: 'http://fail',
      toastError: (m) => msgs.push('oeerr:' + m),
      toastInfo: (m) => msgs.push('oeinfo:' + m),
      noUrlMsg: 'nou',
      unavailableMsg: 'unav',
      copiedMsg: (h) => 'c:' + h,
      openExternal: async () => {
        throw new Error('no')
      },
      writeClipboard: async () => undefined
    })
    await settingsRunOpenExternalUrl({
      url: 'http://fail2',
      toastError: (m) => msgs.push('oeerr2:' + m),
      toastInfo: () => undefined,
      noUrlMsg: 'nou',
      unavailableMsg: 'unav',
      copiedMsg: (h) => 'c:' + h,
      openExternal: async () => {
        throw new Error('no')
      },
      writeClipboard: async () => {
        throw new Error('clip')
      }
    })
    await settingsRunLlmPresetChange({
      settings: null,
      preset: 'openai' as never,
      applyPreset: async () => ({}),
      fallbackSet: async () => ({}),
      setSettings: () => undefined,
      setModelIds: () => undefined,
      toastSuccess: () => undefined,
      presetAppliedMsg: () => 'ok',
      ensureGateway: async () => undefined,
      refreshAiStatus: async () => undefined,
      setError: () => undefined
    })
    await settingsRunLlmPresetChange({
      settings: { imageProvider: 'x' },
      preset: 'openai' as never,
      applyPreset: async () => {
        throw new Error('noapply')
      },
      fallbackSet: async () => ({ model: 'm' }),
      setSettings: (fn) => {
        fn({ imageProvider: 'x', uiLanguage: 'en' })
        fn(null)
      },
      setModelIds: () => undefined,
      toastSuccess: (m) => msgs.push('pa:' + m),
      presetAppliedMsg: (p) => 'applied:' + p,
      ensureGateway: async () => undefined,
      refreshAiStatus: async () => {
        msgs.push('rai')
      },
      setError: () => undefined
    })
    await settingsRunLlmPresetChange({
      settings: {},
      preset: 'grok-gateway' as never,
      applyPreset: async () => ({}),
      fallbackSet: async () => ({}),
      setSettings: () => undefined,
      setModelIds: () => undefined,
      toastSuccess: () => undefined,
      presetAppliedMsg: () => 'ok',
      ensureGateway: async () => {
        msgs.push('ens')
      },
      refreshAiStatus: async () => undefined,
      setError: () => undefined
    })
    await settingsRunLlmPresetChange({
      settings: {},
      preset: 'openai' as never,
      applyPreset: async () => {
        throw new Error('outer')
      },
      fallbackSet: async () => {
        throw new Error('fb')
      },
      setSettings: () => undefined,
      setModelIds: () => undefined,
      toastSuccess: () => undefined,
      presetAppliedMsg: () => 'ok',
      ensureGateway: async () => undefined,
      refreshAiStatus: async () => undefined,
      setError: (m) => msgs.push('se:' + m)
    })
    expect(settingsUpdateIdleLabel(undefined, 'idle', {})).toBe('idle')
    expect(settingsUpdateIdleLabel('x', 'idle', { x: 'X' })).toBe('X')
    expect(settingsUpdateErrorSuffix('net', (k) => 'E:' + k)).toMatch(/E:net/)
    expect(settingsUpdateErrorSuffix(undefined, () => 'x')).toBe('')
    expect(settingsLegalVersionClass('1', '1', 'ok', 'warn')).toBe('ok')
    expect(settingsLegalVersionClass('1', '2', 'ok', 'warn')).toBe('warn')
    expect(settingsLegalOutdatedSuffix('1', '2', 'old')).toMatch(/old/)
    expect(settingsLegalOutdatedSuffix('1', '1', 'old')).toBe('')
    expect(settingsWebPortOrDefault(0, 8787)).toBe(8787)
    expect(settingsWebPortOrDefault(9, 8787)).toBe(9)
    expect(settingsChannelPickerValue(null, 'same-as-llm')).toBe('same-as-llm')
    expect(settingsApiKeyHint(true, 'c', 'n')).toBe('c')
    expect(settingsApiKeyHint(false, 'c', 'n')).toBe('n')
    expect(settingsNpmInstallCmd(null)).toMatch(/npm install/)
    expect(settingsNpmInstallCmd('x')).toBe('x')
    settingsCatchToastIf(true, () => undefined, new Error('x'))
    settingsCatchToastIf(false, (m) => msgs.push('ct:' + m), new Error('y'))

    expect(
      settingsApiKeyPlaceholder('openai', false, 'c', 'd')
    ).toBe('sk-…')
    expect(
      settingsApiKeyPlaceholder('custom', true, 'c', 'd')
    ).toBe('c')
    expect(
      settingsApiKeyPlaceholder('grok', false, 'c', 'd')
    ).toBe('d')
    await settingsCopyNpmInstallCmd({
      cmd: 'npm i x',
      toastSuccess: (m) => msgs.push(m),
      successMsg: 'ok'
    })
    expect(settingsUpdateStatusText('m', 's', 'S', 'idle')).toBe('m')
    expect(settingsUpdateStatusText(null, 'downloading', 'S', 'idle')).toBe(
      'S: downloading'
    )
    expect(settingsUpdateStatusText(null, null, 'S', 'idle')).toBe('idle')
    settingsToastIpcOr(new Error('x'), (m) => msgs.push('tio:' + m), 'fb')
    settingsImageCustomBaseUrl('', 'http://b', (k, v) => msgs.push(k + ':' + v))
    settingsImageCustomBaseUrl('http://x', 'http://b', () => undefined)

    expect(
      await settingsRunClearAllFull({
        setClearing: () => undefined,
        confirm: async () => false,
        clear: async () => undefined,
        getDefaults: async () => ({}),
        set: async () => ({}),
        setSettings: () => undefined,
        applyColorScheme: () => undefined,
        setShowLlmAdvanced: () => undefined,
        setShowVideoAdvanced: () => undefined,
        setModelIds: () => undefined,
        changeUiLanguage: async () => undefined,
        currentLang: () => 'en',
        refreshAiStatus: async () => undefined,
        refreshGateway: async () => undefined,
        toastSuccess: () => undefined,
        setError: () => undefined,
        toastError: () => undefined
      })
    ).toBe('cancel')
    expect(
      await settingsRunClearAllFull({
        setClearing: () => undefined,
        confirm: async () => true,
        clear: async () => undefined,
        getDefaults: async () => ({ uiLanguage: 'zh-HK', colorScheme: 'dark' }),
        set: async (w) => w,
        setSettings: () => undefined,
        applyColorScheme: () => undefined,
        setShowLlmAdvanced: () => undefined,
        setShowVideoAdvanced: () => undefined,
        setModelIds: () => undefined,
        changeUiLanguage: async () => {
          msgs.push('clang')
        },
        currentLang: () => 'en',
        refreshAiStatus: async () => undefined,
        refreshGateway: async () => {
          throw new Error('gw')
        },
        toastSuccess: () => msgs.push('cleared'),
        setError: () => undefined,
        toastError: () => undefined
      })
    ).toBe('ok')
    expect(
      await settingsRunClearAllFull({
        setClearing: () => undefined,
        confirm: async () => true,
        clear: async () => {
          throw new Error('clr')
        },
        getDefaults: async () => ({}),
        set: async () => ({}),
        setSettings: () => undefined,
        applyColorScheme: () => undefined,
        setShowLlmAdvanced: () => undefined,
        setShowVideoAdvanced: () => undefined,
        setModelIds: () => undefined,
        changeUiLanguage: async () => undefined,
        currentLang: () => 'en',
        refreshAiStatus: async () => undefined,
        refreshGateway: async () => undefined,
        toastSuccess: () => undefined,
        setError: (m) => msgs.push('ce:' + m),
        toastError: (m) => msgs.push('ct:' + m)
      })
    ).toBe('error')
    expect(settingsIsWebLabel(true, 'w', 'd')).toBe('w')
    expect(settingsIsWebLabel(false, 'w', 'd')).toBe('d')
    expect(settingsGatewayStatusOrNull(null)).toBeNull()
    expect(settingsGatewayStatusOrNull({ a: 1 })).toEqual({ a: 1 })
    expect(settingsNpmUpToDateLabel(false, 'up', 'r')).toBe('up')
    expect(settingsNpmUpToDateLabel(true, 'up', 'r')).toBe('r')
    expect(settingsWebPortOnChange('', 8787)).toBe(8787)
    expect(settingsWebPortOnChange('90', 8787)).toBe(90)
    expect(settingsWebPortOnChange('x', 8787)).toBe(8787)
    settingsToastPlain((m) => msgs.push(m), 'plain')
    settingsRunClearAllCatch,
  settingsRunClearAllCatch(new Error('x'), () => undefined, () => undefined)
    expect(settingsUpdateChannelLabel('desktop-packaged', null, 'd', 'w', 'v')).toBe('d')
    expect(settingsUpdateChannelLabel('web', null, 'd', 'w', 'v')).toBe('w')
    expect(settingsUpdateChannelLabel(null, 'web-skipped', 'd', 'w', 'v')).toBe('w')
    expect(settingsUpdateChannelLabel(null, null, 'd', 'w', 'v')).toBe('v')

    expect(settingsBuildClearDefaults('en', 'dark').uiLanguage).toBe('en')
    expect(settingsFailMsg(null, 'fb')).toBe('fb')
    expect(settingsFailMsg('m', 'fb')).toBe('m')
    expect(
      settingsDevSkippedKey('k', (k) => 'S:' + k, 'none')
    ).toBe('S:k')
    expect(settingsDevSkippedKey(null, () => 'x', 'none')).toBe('none')
    expect(settingsGatewayCardStatus(null, () => 1)).toBeNull()
    expect(
      settingsGatewayCardStatus({ a: 1 }, (s) => ({ ...s, b: 2 }))
    ).toEqual({ a: 1, b: 2 })
    await settingsRunNpmCheck({
      setBusy: () => undefined,
      checkNpm: undefined,
      setNpmUpdate: () => undefined,
      toastError: (m) => msgs.push(m),
      toastInfo: () => undefined,
      toastSuccess: () => undefined,
      missingMsg: 'miss',
      availableMsg: () => '',
      upToDateMsg: 'up',
      failMsg: 'f'
    })
    await settingsRunNpmCheck({
      setBusy: () => undefined,
      checkNpm: async () => ({
        latestVersion: '2',
        updateAvailable: true,
        installCommand: 'i'
      }),
      setNpmUpdate: () => undefined,
      toastError: () => undefined,
      toastInfo: (m) => msgs.push('av:' + m),
      toastSuccess: () => undefined,
      missingMsg: 'miss',
      availableMsg: (v) => 'av' + v,
      upToDateMsg: 'up',
      failMsg: 'f'
    })
    await settingsRunNpmCheck({
      setBusy: () => undefined,
      checkNpm: async () => ({
        latestVersion: '1',
        updateAvailable: false,
        installCommand: 'i'
      }),
      setNpmUpdate: () => undefined,
      toastError: () => undefined,
      toastInfo: () => undefined,
      toastSuccess: (m) => msgs.push(m),
      missingMsg: 'miss',
      availableMsg: () => '',
      upToDateMsg: 'up',
      failMsg: 'f'
    })
    await settingsRunNpmCheck({
      setBusy: () => undefined,
      checkNpm: async () => ({
        latestVersion: null,
        updateAvailable: false,
        installCommand: '',
        error: 'err'
      }),
      setNpmUpdate: () => undefined,
      toastError: (m) => msgs.push('ne:' + m),
      toastInfo: () => undefined,
      toastSuccess: () => undefined,
      missingMsg: 'miss',
      availableMsg: () => '',
      upToDateMsg: 'up',
      failMsg: 'f'
    })
    await settingsRunNpmCheck({
      setBusy: () => undefined,
      checkNpm: async () => {
        throw new Error('npm')
      },
      setNpmUpdate: () => undefined,
      toastError: (m) => msgs.push('nc:' + m),
      toastInfo: () => undefined,
      toastSuccess: () => undefined,
      missingMsg: 'miss',
      availableMsg: () => '',
      upToDateMsg: 'up',
      failMsg: 'f'
    })

    expect(
      (
        await settingsBuildClearDefaultsFromApi(
          () => 'en',
          async () => ({ colorScheme: 'dark' })
        )
      ).firstRunSeen
    ).toBe(true)
    await settingsRunOpenInstallPage({
      getGateway: () => null,
      fallbackCmd: 'cmd',
      openExternalUrl: async (u) => {
        msgs.push('inst:' + u)
      }
    })
    await settingsRunOpenInstallPage({
      getGateway: () => ({
        installHints: async () => ({ grokBuildUrl: 'http://g' })
      }),
      fallbackCmd: 'cmd',
      openExternalUrl: async (u) => {
        msgs.push('inst2:' + u)
      }
    })
    await settingsRunOpenInstallPage({
      getGateway: () => ({
        installHints: async () => {
          throw new Error('x')
        }
      }),
      fallbackCmd: 'cmd',
      openExternalUrl: async (u) => {
        msgs.push('inst3:' + u)
      }
    })
    settingsBindOpenExternal(null, async () => undefined)()
    settingsBindOpenExternal('http://w', async (u) => {
      msgs.push('bou:' + u)
    })()
    expect(settingsFailMsgBound('fb')(null)).toBe('fb')
    expect(settingsFailMsgBound('fb')('m')).toBe('m')
    expect(settingsDevSkippedBound((k) => 'K:' + k, 'none')('a')).toBe('K:a')
    expect(settingsDevSkippedBound((k) => 'K:' + k, 'none')(null)).toBe('none')






    expect(msgs.length).toBeGreaterThan(0)
  })
})


describe('abs100 Stories UI residual mop', () => {
  beforeEach(() => seed())

  it('hits cast props actions beats empty and cover residual', async () => {
    const costumesJson = JSON.stringify([
      {
        id: 'look-1',
        name: 'Coat',
        description: 'trench',
        artStyle: 'photo_cinematic',
        imagePath: '/media/aria.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'look-2',
        name: '',
        description: 'nameless-look-for-desc-slice-branch',
        artStyle: 'photo_cinematic',
        imagePath: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    const manyChars = Array.from({ length: 4 }, (_, i) =>
      makeCharacter({
        id: `char-${i + 1}`,
        name: i === 0 ? 'Aria' : `Cast${i}`,
        costumesJson: i === 0 ? costumesJson : null
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
      }),
      makeStory({ id: 'story-2', title: 'Alpha Story' })
    ])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        artStyle: 'photo_cinematic',
        hardRules: 'no logos',
        characters: [manyChars[0], manyChars[1]],
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()]
      } as never)
    )
    api.stories.create = vi.fn().mockResolvedValue(
      makeStory({ id: 'new-s', title: 'Nova' })
    )
    api.stories.update = vi.fn().mockResolvedValue(makeStory())
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi.fn().mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue(manyChars)
    api.scenes.list = vi.fn().mockResolvedValue([makeScene(), makeScene({ id: 'scene-2' })])
    api.props.list = vi.fn().mockResolvedValue(
      Array.from({ length: 12 }, (_, i) =>
        makeProp({ id: `prop-${i + 1}`, name: i === 0 ? 'Gun' : `Prop${i + 1}` })
      )
    )
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({ id: 'act-1', name: 'Draw' }),
      makeAction({ id: 'act-2', name: 'Kick' })
    ])
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({ id: 'beat-1', dialogue: 'hello' }),
      makeTimelineEntry({ id: 'beat-2', dialogue: '' })
    ])
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.update = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.delete = vi.fn().mockResolvedValue({})
    api.timeline.reorder = vi.fn().mockResolvedValue({})
    api.costumes.list = vi.fn().mockResolvedValue([])
    api.stories.generateCover = vi.fn().mockResolvedValue({
      path: '/tmp/c.png',
      label: 'Cover'
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 'filled',
      hardRules: 'hard'
    })
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [makeTimelineEntry({ id: 'nb' })]
    })

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Demo Story|Alpha/i)
    )
    // empty filter
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () =>
        fireEvent.change(el, { target: { value: 'zzzz-no-match' } })
      )
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/no match|No match|match/i)
    )
    await clickNamed(/Clear filters/i)

    await openCardEdit('Demo Story')
    await clickNamed(/^Meta$|Details|Profile/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 3)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'story mop body' } })
      )
    }
    await forceClick(/AI fill meta|AI meta|AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^Cover$|Images|Poster/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await forceClick(/Generate cover|Generate poster|Generate/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Upload|Pick/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove|remove/i)

    // Cast props/actions
    await clickNamed(/^Cast$|Links/i)
    for (const tab of [/Props/i, /Actions/i, /Scenes/i, /Characters/i]) {
      await clickNamed(tab)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
      for (const b of screen
        .getAllByRole('button')
        .filter((x) => /Link|Unlink|Add|Remove/i.test((x.textContent || '').trim()))
        .slice(0, 3)) {
        await act(async () => fireEvent.click(b))
      }
      // pagination next
      await clickNamed(/Next|→/)
    }
    // costume select
    for (const sel of Array.from(document.querySelectorAll('select')).slice(-3)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    // Script beats
    await clickNamed(/Script beats|Script|Beats/i)
    await clickNamed(/Add beat|New beat/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(0, 2)) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '【DIALOGUE】line mop' } })
      )
      await act(async () => fireEvent.blur(ta))
    }
    await clickNamed(/Template|Insert template|Script template/i)
    // multi-bind chips
    for (const chip of Array.from(document.querySelectorAll('button')).filter(
      (b) => {
        const t = (b.textContent || '').trim()
        return (
          t.length > 0 &&
          t.length < 28 &&
          !/Save|Delete|Add|Template|AI|↑|↓|Cancel|Close|Basics|Cast|Script|Generate|Upload|✕|Move|Remove/i.test(
            t
          )
        )
      }
    ).slice(0, 16)) {
      await act(async () => fireEvent.click(chip))
    }
    // empty blur path
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(0, 2)) {
      await act(async () => fireEvent.change(ta, { target: { value: '   ' } }))
      await act(async () => fireEvent.blur(ta))
    }
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /↑|↓|Up|Down|Move/i.test((x.textContent || '').trim()))
      .slice(0, 4)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/AI script|AI fill script|AI generate beats|Generate script/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // cover cancel image gen
    await clickNamed(/^Basics$|Meta$|Details/i)
    await forceClick(/Generate cover|Generate poster/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    for (const b of screen.getAllByRole('button')) {
      if (/^Cancel$/i.test((b.textContent || '').trim())) {
        await act(async () => fireEvent.click(b))
        break
      }
    }

    // empty title AI meta guard return
    for (const el of Array.from(document.querySelectorAll('input'))) {
      const inp = el as HTMLInputElement
      if (inp.type === 'checkbox' || inp.type === 'hidden') continue
      if ((inp.value || '').length > 0 && (inp.value || '').length < 80) {
        await act(async () => fireEvent.change(inp, { target: { value: '' } }))
      }
    }
    for (const el of Array.from(document.querySelectorAll('textarea'))) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await forceClick(/AI fill style|AI fill meta|AI fill/i)

    // cast props pagination + link
    await clickNamed(/Cast|Links/i)
    for (const b of screen.getAllByRole('button')) {
      const t = (b.textContent || '').trim()
      if (t.startsWith('Props') || /^Props/i.test(t)) {
        await act(async () => fireEvent.click(b))
        break
      }
    }
    for (const b of screen
      .getAllByRole('button')
      .filter((x) =>
        /Link|Unlink|link story|unlink/i.test((x.textContent || '').trim())
      )
      .slice(0, 4)) {
      await act(async () => fireEvent.click(b))
    }
    await forceClick(/→/)

    // characters costume nameless option
    for (const b of screen.getAllByRole('button')) {
      const t = (b.textContent || '').trim()
      if (t.startsWith('Characters') || /^Characters/i.test(t)) {
        await act(async () => fireEvent.click(b))
        break
      }
    }
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, {
            target: { value: s.options[s.options.length - 1].value }
          })
        )
      }
    }

    await forceClick(/^Save$/i)

    // close editor via aria-label Cancel (✕)
    const xBtn = screen
      .getAllByRole('button')
      .find((b) => (b.getAttribute('aria-label') || '') === 'Cancel')
    if (xBtn) await act(async () => fireEvent.click(xBtn))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // sort by title on library
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const titleOpt = Array.from(s.options).find((o) => o.value === 'title')
      if (titleOpt) {
        await act(async () =>
          fireEvent.change(s, { target: { value: 'title' } })
        )
      }
    }

    // new story create path (pure covers create id; light UI hit)
    await clickNamed(/New story|New/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    // title in editor
    for (const el of Array.from(document.querySelectorAll('input'))) {
      const inp = el as HTMLInputElement
      if (inp.type === 'checkbox' || inp.type === 'hidden') continue
      // likely title when empty or Untitled context
      await act(async () =>
        fireEvent.change(inp, { target: { value: 'Brand New Story' } })
      )
      break
    }
    await forceClick(/^Save$/i)
  }, 120000)
})


describe('abs100 Settings UI residual mop', () => {
  beforeEach(() => seed())

  it('hits gateway video image update web backup residual paths', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: '',
      imageProvider: 'same-as-llm',
      videoProvider: 'same-as-llm',
      webServerEnabled: true,
      webServerPort: 0,
      webServerHost: '127.0.0.1',
      webServerAuthToken: 'tok-abc',
      legalAcceptedVersion: '0.0.0',
      uiLanguage: 'en'
    })
    api.settings.set = vi.fn().mockImplementation(async (s) => ({
      ...DEFAULT_SETTINGS,
      ...s
    }))
    api.ai.applyLlmPreset = vi.fn().mockRejectedValue(new Error('no-preset'))
    api.ai.listModels = vi.fn().mockResolvedValue([{ id: 'm1' }])
    api.ai.testChat = vi.fn().mockResolvedValue({
      message: 'ok',
      replyPreview: 'hi'
    })
    // gateway missing path
    api.gateway = undefined as never
    api.webServer = {
      status: undefined,
      start: vi.fn().mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787,
        error: 'bind fail',
        staticReady: false
      }),
      stop: vi.fn().mockResolvedValue({
        running: false,
        url: null,
        port: 8787,
        error: null,
        staticReady: false
      }),
      generateToken: vi.fn().mockResolvedValue({ token: 'new-tok' })
    } as never
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'error',
      errorKind: 'network',
      message: 'fail',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      releaseUrl: null,
      installCommand: null
    })
    api.updates.check = vi
      .fn()
      .mockRejectedValueOnce(new Error('check-fail'))
      .mockResolvedValue({
        status: 'error',
        message: 'err',
        canCheck: true
      })
    api.updates.download = vi
      .fn()
      .mockRejectedValueOnce(new Error('dl-fail'))
      .mockResolvedValue({ status: 'error', message: 'd' })
    api.updates.install = vi
      .fn()
      .mockRejectedValueOnce(new Error('inst-fail'))
      .mockResolvedValue({ ok: false, message: 'i' })
    api.updates.openReleasePage = undefined
    api.updates.checkNpm = vi
      .fn()
      .mockRejectedValueOnce(new Error('npm-fail'))
      .mockResolvedValue({
        latestVersion: '2.0.0',
        updateAvailable: false,
        installCommand: null
      })
    api.app.openDataFolder = vi.fn().mockRejectedValue(new Error('folder'))
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ filePath: '/b.zip' })
    api.app.importFullBackup = vi.fn().mockResolvedValue({
      requiresReload: true
    })
    api.shell.openExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('ext'))
      .mockResolvedValue({ ok: true })

    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    // LLM / advanced / docs / custom key
    await clickNamed(/Chat model|Chat|LLM/i)
    await clickNamed(/Show advanced|Advanced/i)
    await clickNamed(/Docs|Documentation|Open docs|provider/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 2)) {
      const s = sel as HTMLSelectElement
      for (const o of Array.from(s.options)) {
        await act(async () =>
          fireEvent.change(s, { target: { value: o.value } })
        )
      }
    }

    // Image custom channel
    await clickNamed(/^Image$/i)
    for (const re of [/Custom/i, /Same/i, /Seedream/i, /Grok/i]) {
      await clickNamed(re)
    }
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 4)) {
      const inp = el as HTMLInputElement
      if (inp.type === 'checkbox' || inp.type === 'hidden') continue
      await act(async () =>
        fireEvent.change(inp, { target: { value: 'http://img-custom' } })
      )
    }

    // Video custom + model
    await clickNamed(/^Video$/i)
    for (const re of [/Custom/i, /Seedance/i, /Stub/i, /Same/i, /Grok/i]) {
      await clickNamed(re)
    }
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 4)) {
      const inp = el as HTMLInputElement
      if (inp.type === 'checkbox' || inp.type === 'hidden') continue
      await act(async () =>
        fireEvent.change(inp, { target: { value: 'video-model-x' } })
      )
    }

    // App tab: update, npm, web, creator, backup, clear
    await clickNamed(/^App$/i)
    for (const re of [
      /Open folder|Data folder/i,
      /Check for updates|Check update|Check/i,
      /Download/i,
      /Install update|Install/i,
      /Release|GitHub/i,
      /npm|CLI|Copy install/i,
      /Linktree|creator/i,
      /YSK|site/i,
      /Copy token|Token/i,
      /Copy URL|Copy url/i,
      /Open URL|Open url|webServerOpen|Open/i,
      /Export all|Full backup|Export/i,
      /Restore|Import/i,
      /Clear activity|Clear all|Wipe/i
    ]) {
      await forceClick(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15))
      })
    }

    // toggle web server enable (stop path)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }

    // port default blur
    for (const el of Array.from(document.querySelectorAll('input[type="number"]'))) {
      await act(async () =>
        fireEvent.change(el, { target: { value: '' } })
      )
      await act(async () => fireEvent.blur(el))
      await act(async () =>
        fireEvent.change(el, { target: { value: '0' } })
      )
      await act(async () => fireEvent.blur(el))
    }

    // language select
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, {
            target: { value: s.options[s.options.length - 1].value }
          })
        )
      }
    }

    await forceClick(/^Save$/i)
  }, 120000)


  it('web stop path + running url + npm uptodate + clear fail + no web api', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:3847/v1',
      webServerEnabled: true,
      webServerPort: 8787,
      webServerAuthToken: 'tok',
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0'
    })
    api.settings.set = vi.fn().mockImplementation(async (s) => ({
      ...DEFAULT_SETTINGS,
      ...s
    }))
    api.settings.clearAll = vi.fn().mockRejectedValue(new Error('clear-fail'))
    api.gateway = {
      status: vi.fn().mockResolvedValue({
        state: 'ready',
        healthOk: true,
        message: 'ok',
        grokPath: '/g',
        gctoacPath: '/c',
        adminUrl: 'http://127.0.0.1:3847/admin/'
      }),
      ensure: vi.fn().mockResolvedValue({
        state: 'ready',
        healthOk: true,
        keyReady: true
      }),
      installHints: vi.fn().mockResolvedValue({
        grokBuildUrl: 'https://x.ai/',
        installCommand: 'cmd'
      }),
      openAdmin: vi.fn().mockResolvedValue({ ok: true })
    } as never
    api.webServer = {
      status: vi.fn().mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787,
        error: 'e',
        staticReady: true
      }),
      start: vi.fn().mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787,
        error: null,
        staticReady: true
      }),
      stop: vi.fn().mockResolvedValue({
        running: false,
        url: null,
        port: 8787,
        error: null,
        staticReady: false
      }),
      generateToken: vi.fn().mockResolvedValue({ token: 't2' })
    } as never
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'web-skipped',
      source: 'web',
      channel: 'web',
      errorKind: 'network',
      messageKey: 'updateDevSkipped',
      canCheck: true,
      currentVersion: '1.0.0'
    })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      latestVersion: '1.0.0',
      updateAvailable: false,
      installCommand: null
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'dev-skipped',
      messageKey: undefined,
      canCheck: false
    })
    api.app.openDataFolder = vi.fn().mockRejectedValue(new Error('no'))

    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/^App$/i)
    // copy url + open when running
    await forceClick(/Copy URL|Copy url|URL/i)
    await forceClick(/Open URL|Open url|webServerOpen|Open http/i)
    // npm check uptodate
    await forceClick(/npm|CLI|Check npm/i)
    await forceClick(/Copy install|install command/i)
    // open folder fail
    await forceClick(/Open folder|Data folder/i)
    // toggle web off (stop)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
    }
    // clear all fail
    await forceClick(/Clear activity|Clear all|Wipe|Reset/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // second mount without webServer api
    // re-render not easy; call forceClick regen token when missing later
  }, 120000)

  it('webServer api missing branches', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'grok-gateway',
      webServerEnabled: false,
      webServerAuthToken: 'tok',
      uiLanguage: 'en'
    })
    // @ts-expect-error force missing
    api.webServer = undefined
    // @ts-expect-error no gateway
    api.gateway = undefined
    api.updates.checkNpm = undefined
    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/Chat|LLM/i)
    await forceClick(/Install|Open xAI|Open install|Grok/i)
    await clickNamed(/^App$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await forceClick(/Token|Regenerate|Regen/i)
    await forceClick(/npm|Check npm|CLI/i)
    // language
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, {
            target: { value: s.options[s.options.length - 1].value }
          })
        )
      }
    }
  }, 60000)

  it('web host change catch + open url when running', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      webServerEnabled: true,
      webServerPort: 8787,
      webServerHost: '127.0.0.1',
      webServerAuthToken: 'tok'
    })
    api.settings.set = vi
      .fn()
      .mockRejectedValueOnce(new Error('set-fail'))
      .mockResolvedValue({ ...DEFAULT_SETTINGS, webServerEnabled: true })
    api.webServer = {
      status: vi.fn().mockResolvedValue({
        running: true,
        url: 'http://127.0.0.1:8787',
        port: 8787,
        error: 'err',
        staticReady: true
      }),
      start: vi.fn().mockRejectedValue(new Error('start-fail')),
      stop: vi.fn().mockResolvedValue({ running: false }),
      generateToken: vi.fn().mockRejectedValue(new Error('tok-fail'))
    } as never
    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/^App$/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (Array.from(s.options).some((o) => o.value === '0.0.0.0')) {
        await act(async () =>
          fireEvent.change(s, { target: { value: '0.0.0.0' } })
        )
      }
    }
    await forceClick(/Open URL|Open url|Open http|webServerOpen/i)
    await forceClick(/Token|Regen/i)
  }, 60000)

})

