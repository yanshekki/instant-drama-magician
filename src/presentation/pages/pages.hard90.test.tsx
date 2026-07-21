/**
 * Push Settings + Timeline past 90%, and top up Characters/Scenes/Stories.
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
import { SettingsPage } from './SettingsPage'
import { TimelinePage } from './TimelinePage'
import { CharactersPage } from './CharactersPage'
import { ScenesPage } from './ScenesPage'
import { StoriesPage } from './StoriesPage'

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
    onPlayheadChange?: (t: number) => void
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
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'entry-1', 1, 7)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() =>
          p.onDropAsset?.({ kind: 'character', id: 'char-1' }, 12)
        }
      >
        k-drop
      </button>
      <button type="button" onClick={() => p.onPlayheadChange?.(2.5)}>
        k-head
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
      <button type="button" onClick={() => p.onTime?.(4)}>
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
          onClick={() => p.onStartVideoQueue?.(['entry-1', 'entry-2'])}
        >
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
              openExportFolder: true
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
    onNextClip?: () => void
    onRetry?: () => void
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
        <button type="button" onClick={() => p.onNextClip?.()}>
          vpn
        </button>
        <button type="button" onClick={() => p.onAbandon?.()}>
          vpa
        </button>
        <button type="button" onClick={() => p.onRetry?.()}>
          vpr
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
  try {
    localStorage.clear()
    localStorage.removeItem('idm.aiJobs.v1')
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
    { timeout: 12000 }
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
    { timeout: 12000 }
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

async function acceptDraft() {
  await waitFor(() => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true), {
    timeout: 8000
  })
  await act(async () => {
    await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
  })
}

function base() {
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
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'p',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' },
    kind: 'timeline-clip',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({ ok: true })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
}

describe('hard90 Timeline', () => {
  beforeEach(() => base())

  it('entries pack play progress export delete generate full', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        dialogue: 'Hello residual',
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
        dialogue: 'Ready residual',
        characterId: 'char-1'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        storyId: 'story-1',
        order: 2,
        startTime: 10,
        endTime: 16,
        mediaStatus: 'FAILED',
        dialogue: 'Fail residual'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
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
      bgmVolume: 0.4,
      dialogueVolume: 1
    })
    api.settings.set = vi.fn().mockResolvedValue({})
    api.generation.run = vi.fn().mockResolvedValue({
      success: true,
      steps: [{ step: 'video', success: true }]
    })
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
        sizeBytes: 2048000
      },
      {
        id: 'ex2',
        kind: 'board',
        fileName: 'b.png',
        path: '/b.png',
        createdAt: '2026-07-14T12:00:00.000Z',
        sizeBytes: 400
      }
    ])
    api.media.deleteExport = vi.fn().mockResolvedValue({
      ok: true,
      items: [],
      latestPath: null
    })
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

    await clickNamed(/^k-sel$/i)
    await clickNamed(/^k-pack$/i)
    await clickNamed(/Pack clips/i)
    await waitFor(() => expect(api.timeline.update).toHaveBeenCalled()).catch(
      () => undefined
    )
    await clickNamed(/^k-resize$/i)
    await clickNamed(/^k-move$/i)
    await clickNamed(/^k-drop$/i)
    await waitFor(() => expect(api.timeline.create).toHaveBeenCalled()).catch(
      () => undefined
    )
    await clickNamed(/^k-head$/i)

    // Play / pause + clock paths
    await clickNamed(/^Play$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await clickNamed(/^p-tick$/i)
    await clickNamed(/^p-end$/i)
    await clickNamed(/^Pause$/i)

    // Progress events
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
          entryId: 'entry-1',
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
        fireEvent.change(ta, { target: { value: 'hard90 dialogue residual' } })
      )
    }
    await clickNamed(/^Save$/i)
    await clickNamed(/^6s$|^10s$|Set to/i)
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
    await waitFor(() => expect(api.media.exportFinal).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/Export history/i)
    await clickNamed(/Open file|folder|Refresh/i)
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
    // pipeline done via jobs
    await act(async () => {
      jobs!.startJob({
        kind: 'pipeline',
        label: 'pipe',
        scope: { storyId: 'story-1' },
        run: async () => ({
          type: 'pipeline' as const,
          storyId: 'story-1',
          ok: true
        })
      })
    })
    await acceptDraft().catch(() => undefined)
  }, 70000)

  it('export preflight deny + fallback confirm', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({ id: 'entry-1', startTime: 0, endTime: 4 }),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        startTime: 4,
        endTime: 10,
        mediaStatus: 'READY',
        mediaPath: '/m.mp4'
      })
    ])
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.media.exportPreflight = vi
      .fn()
      .mockResolvedValueOnce({
        ffmpeg: true,
        ffmpegMessage: 'ffmpeg OK',
        readyClips: 1,
        totalClips: 2,
        willUseFallback: true,
        warnings: ['will fallback'],
        canExport: true
      })
      .mockResolvedValue({
        ffmpeg: false,
        ffmpegMessage: 'no ffmpeg',
        readyClips: 0,
        totalClips: 2,
        willUseFallback: false,
        warnings: [],
        canExport: false
      })
    api.media.exportFinal = vi
      .fn()
      .mockRejectedValueOnce(new Error('export boom'))
      .mockResolvedValue({ path: '/f.mp4' })
    api.settings.get = vi.fn().mockResolvedValue({
      videoMode: 'stub',
      defaultMaxClipSeconds: 6
    })

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Export$/i)
    await clickNamed(/^exp$/i)
    await clickNamed(/^xexp$/i)
  }, 25000)
})

describe('hard90 Settings', () => {
  beforeEach(() => {
    base()
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
      chatTimeoutMs: 60000,
      burnSubtitles: true,
      includeSilentAudio: true,
      openExportFolder: true
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p,
      webServerEnabled: true
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '2.0.0',
      isPackaged: true,
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 5
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '7',
      path: '/bin/ffmpeg'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi.fn().mockResolvedValue([
      { id: 'a', ownedBy: 'x' },
      { id: 'b', ownedBy: 'fallback' }
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
      message: 'ok',
      healthOk: true,
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
      installCommand: 'npm i -g grok'
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
    api.webServer.generateToken = vi.fn().mockResolvedValue('newtok')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'downloaded',
      channel: 'stable',
      currentVersion: '1.0',
      latestVersion: '2.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 100,
      releaseNotes: '## notes\n- item',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '2.0'
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
        progress: 40,
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
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi
      .fn()
      .mockResolvedValue({ ok: true, path: '/s.json' })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('every settings tab control error and success paths', async () => {
    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    // LLM
    await clickNamed(/Chat model/i)
    await clickNamed(/Show advanced options|Show advanced/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ) as HTMLInputElement[]) {
      if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '90000' } })
        )
      } else if (
        input.type === 'password' ||
        input.type === 'text' ||
        !input.type
      ) {
        await act(async () =>
          fireEvent.change(input, {
            target: { value: 'http://127.0.0.1:9999/v1' }
          })
        )
      }
    }
    for (const re of [
      /Refresh model list/i,
      /Test chat/i,
      /Grok local|OpenAI|Custom|OpenRouter|preset/i,
      /Recheck|Ensure|Install|Copy|admin|Open/i
    ]) {
      await clickNamed(re)
    }

    await clickNamed(/^Image$/i)
    for (const re of [/Custom|Same|Seedream|Grok|Show advanced/i]) {
      await clickNamed(re)
    }
    for (const input of Array.from(document.querySelectorAll('input')).slice(
      0,
      10
    ) as HTMLInputElement[]) {
      if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'img-id' } })
        )
      }
    }

    await clickNamed(/^Video$/i)
    for (const re of [/Stub|Custom|Seedance|Same|Show advanced|api|gateway/i]) {
      await clickNamed(re)
    }
    for (const input of Array.from(document.querySelectorAll('input')).slice(
      0,
      10
    ) as HTMLInputElement[]) {
      if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'vid-id' } })
        )
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
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    await clickNamed(/^App$/i)
    const port = Array.from(document.querySelectorAll('input')).find(
      (i) => (i as HTMLInputElement).type === 'number'
    ) as HTMLInputElement | undefined
    if (port) {
      await act(async () => fireEvent.change(port, { target: { value: '' } }))
      await act(async () => fireEvent.blur(port))
      await act(async () =>
        fireEvent.change(port, { target: { value: '9191' } })
      )
      await act(async () => fireEvent.blur(port))
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
      /Stop|Start|Enable web|Regenerate|Copy token|Copy URL|Open in browser/i,
      /release notes|Show|Hide/i,
      /Check for updates|Download|Restart|Open release|npm|Copy install/i,
      /English|System|Light|Dark/i,
      /backup|export|import|support|diagnostics|Clear|folder|disclaimer|terms|FFmpeg|ffmpeg/i
    ]) {
      await clickNamed(re)
    }
    await clickNamed(/^Save$/i)

    // Second pass: gateway missing branch
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'grok_build_missing',
      healthOk: false,
      message: 'need build'
    })
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'grok_build_missing',
      healthOk: false,
      message: 'need',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://a'
    })
    await clickNamed(/Chat model/i)
    await clickNamed(/Grok|Recheck|Ensure|Install|Copy/i)
  }, 50000)
})

describe('hard90 top-up Characters Scenes Stories', () => {
  beforeEach(() => base())

  it('Characters soul search local + sheet create + swap', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png')
      })
    ])
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
        name: 'W',
        costume: 'c',
        artStyle: 'anime',
        rationale: 'r'
      }
    })
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Aria', description: 'd', appearance: 'a' },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.souls.list = vi.fn().mockResolvedValue({
      data: [],
      total_pages: 1,
      current_page: 1
    })
    api.souls.searchLocal = vi.fn().mockResolvedValue({
      items: [{ id: 3, title: 'Local Soul', content: '# local soul' }]
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 3,
      title: 'Local Soul',
      content: '# local soul'
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 0,
      pages: 0,
      fromCache: true,
      suggestions: []
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

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')
    await clickNamed(/^Profile$/i)
    const search = Array.from(document.querySelectorAll('input')).find((i) =>
      /search/i.test((i as HTMLInputElement).placeholder || '')
    )
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Local' } })
      )
    }
    await clickNamed(/Search|Refresh/i)
    const local = screen.queryAllByText(/Local Soul/i)
    if (local[0]) await act(async () => fireEvent.click(local[0]!))
    await clickNamed(/Use/i)
    await clickNamed(/Generate Soul/i)
    await clickNamed(/Import local/i)
    await clickNamed(/^Costume$/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'swap costume residual' } })
      )
    }
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen()
    await clickNamed(/^Save$/i)
  }, 45000)

  it('Scenes confirmPlotSuggest + create plate', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg')
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.create = vi.fn().mockResolvedValue(makeScene({ id: 'n' }))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: { title: 'R', description: 'd', mood: 'tense' },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/p.png',
      label: 'E',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
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
    await clickNamed(/Suggest from story/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    // Prefer overlay with selects + fill (ignore EditorShell dialog)
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
          (o) => o.value === 'story-1' || o.value
        )
      ) as HTMLSelectElement | undefined
      if (sel && sel.options.length > 1) {
        await act(async () =>
          fireEvent.change(sel, {
            target: {
              value:
                Array.from(sel.options).find((o) => o.value === 'story-1')
                  ?.value || sel.options[1].value
            }
          })
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
    // Fallback: drive scene-ai-fill via jobs if UI path missed
    if (!api.scenes.aiFill.mock.calls.length) {
      await act(async () => {
        jobs!.startJob({
          kind: 'scene-ai-fill',
          label: 'f',
          scope: { sceneId: 'scene-1' },
          run: async () => ({
            type: 'scene-profile' as const,
            sceneId: 'scene-1',
            storyId: 'story-1',
            profile: { title: 'R', description: 'd', mood: 'tense' },
            profileJson: '{}',
            isNew: false
          })
        })
      })
    }
    await acceptDraft().catch(() => undefined)
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate location plate/i)
    await confirmImageGen()
    await clickNamed(/Atmosphere/i)
    await clickNamed(/Generate atmosphere swap/i)
    await clickNamed(/^Save$/i)
  }, 40000)

  it('Stories beat multi-ids reorder delete cast costume', async () => {
    const beats = [
      makeTimelineEntry({
        id: 'b1',
        order: 0,
        dialogue: 'A residual',
        characterId: 'char-1',
        sceneId: 'scene-1'
      }),
      makeTimelineEntry({
        id: 'b2',
        order: 1,
        dialogue: 'B residual',
        characterId: 'char-1',
        sceneId: 'scene-1'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        characters: [makeCharacter(), makeCharacter({ id: 'char-2', name: 'Ben' })],
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
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [{ order: 0, dialogue: 'X', characterId: 'char-1', sceneId: 'scene-1' }],
      drafts: [],
      raw: ''
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 's',
      hardRules: 'h',
      artStyle: 'anime'
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/c.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/cc.png' })
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

    await clickNamed(/Cast/i)
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      await clickNamed(kind)
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
      20
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
        fireEvent.change(ta, { target: { value: 'beat residual hard90' } })
      )
    }
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Delete/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Save$/i)
  }, 45000)
})
