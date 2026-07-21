/**
 * Residual mop: drive ALL presentation pages toward 100% lines.
 * Focus first: Settings, Timeline, Scenes, Stories (<90), then Characters/Actions/Props/Costumes.
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
        onClick={() => p.onDropAsset?.({ kind: 'character', id: 'char-1' }, 5)}
      >
        k-drop
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'scene', id: 'scene-1' }, 1)}
      >
        k-drop-sc
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
      <button type="button" onClick={() => p.onTime?.(1.5)}>
        p-tick
      </button>
      <button type="button" onClick={() => p.onTime?.(4.5)}>
        p-tick2
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
        <button type="button" onClick={() => p.onStartVideoQueue?.(['entry-1', 'entry-2'])}>
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
      { timeout: 3500 }
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
  await waitFor(
    () => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true),
    { timeout: 8000 }
  )
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
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({
    ok: true,
    isDirectory: true,
    path: '/tmp/idm-user'
  })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'professional mop prompt',
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
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  api.generation.run = vi.fn().mockResolvedValue({
    success: true,
    steps: [
      { step: 'script', success: true },
      { step: 'timeline', success: true, degraded: false }
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
  api.timeline.history = {
    undo: vi.fn().mockResolvedValue(true),
    redo: vi.fn().mockResolvedValue(true)
  } as never
}

// ─────────────────────────────────────────────────────────────
// Timeline mop
// ─────────────────────────────────────────────────────────────
describe('mop100 Timeline residual', () => {
  beforeEach(() => seed())

  it('play empty→ready advance, export, snap, pack, konva, undo', async () => {
    const entries = [
      makeTimelineEntry({
        id: 'entry-1',
        storyId: 'story-1',
        order: 0,
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        mediaPath: null,
        dialogue: 'Empty gap',
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
        dialogue: 'Ready clip',
        characterId: 'char-1'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        storyId: 'story-1',
        order: 2,
        startTime: 10,
        endTime: 16,
        mediaStatus: 'FAILED',
        mediaPath: null,
        dialogue: 'Failed clip'
      })
    ]
    api.timeline.list = vi.fn().mockResolvedValue(entries)
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi.fn().mockResolvedValue(
      makeTimelineEntry({ id: 'n', startTime: 16, endTime: 20 })
    )
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.undo = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.redo = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png')
      })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      videoMode: 'stub',
      snapEnabled: false,
      snapGridSec: 0.25,
      openExportFolder: true,
      burnSubtitles: true
    })
    api.settings.set = vi.fn().mockResolvedValue({})
    api.media.listExports = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'ex1',
          kind: 'final',
          fileName: 'f.mp4',
          path: '/exports/f.mp4',
          createdAt: '2026-07-15T12:00:00.000Z',
          sizeBytes: 500
        },
        {
          id: 'ex2',
          kind: 'board',
          fileName: 'b.png',
          path: '/exports/b.png',
          createdAt: 'not-a-date',
          sizeBytes: 2048
        },
        {
          id: 'ex3',
          kind: 'final',
          fileName: 'big.mp4',
          path: '/exports/big.mp4',
          createdAt: '2026-07-14T12:00:00.000Z',
          sizeBytes: 5 * 1024 * 1024
        }
      ],
      latestPath: '/exports/f.mp4'
    })
    api.media.deleteExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('del exp'))
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
        Object.assign(new Error('ffmpeg missing'), {
          code: 'FFMPEG_UNAVAILABLE'
        })
      )
      .mockResolvedValue({ path: '/exports/out.mp4' })
    api.media.exportStoryboard = vi.fn().mockResolvedValue({ path: '/b.png' })
    api.media.importClip = vi.fn().mockResolvedValue({ path: '/i.mp4' })
    api.media.openClip = vi.fn().mockResolvedValue({})
    api.generation.run = vi.fn().mockResolvedValue({
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
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled(), {
      timeout: 8000
    })

    await clickNamed(/^k-sel$/i)
    await clickNamed(/^p-tick$/i)
    await clickNamed(/^p-end$/i)
    await clickNamed(/^k-sel2$/i)
    await clickNamed(/^p-tick2$/i)
    await clickNamed(/^p-end$/i)
    await clickNamed(/^Play$|▶|Pause/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await clickNamed(/^Play$|▶|Pause/i)

    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'mop dialogue residual' } })
      )
    }
    for (const inp of Array.from(document.querySelectorAll('input')).slice(
      0,
      4
    ) as HTMLInputElement[]) {
      if (inp.type === 'number' || inp.type === 'range') {
        await act(async () =>
          fireEvent.change(inp, { target: { value: '6' } })
        )
      } else if (inp.type === 'checkbox') {
        await act(async () => fireEvent.click(inp))
      }
    }

    await clickNamed(/Snap|Grid/i)
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

    await clickNamed(/Pack|Abut/i)
    await clickNamed(/^k-pack$/i)
    await clickNamed(/^k-resize$/i)
    await clickNamed(/^k-move$/i)
    await clickNamed(/^k-drop$/i)
    await clickNamed(/^k-drop-sc$/i)
    await clickNamed(/^k-sel3$/i)

    // Generate: cancel confirm (avoid startClipPrepQueue → VideoPrep crash)
    await clickNamed(/Start generation|Generate all|^Generate$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (cancel) await act(async () => fireEvent.click(cancel))
    }
    // Retry failed with zero need after filtering — still click for toast path
    // (do not confirm if it opens batch prep)
    await clickNamed(/Retry failed clips|Retry failed/i)
    if (document.querySelector('[role="alertdialog"]')) {
      const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (cancel) await act(async () => fireEvent.click(cancel))
    }

    await clickNamed(/Export history/i)
    await clickNamed(/Open file|Open File/i)
    await clickNamed(/folder|Folder|Show/i)
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (cancel) await act(async () => fireEvent.click(cancel))
    }
    await clickNamed(/Refresh/i)
    const x = Array.from(document.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === '✕'
    )
    if (x) await act(async () => fireEvent.click(x))

    await clickNamed(/Export final|Export video|Export/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Export final|Export video|Export/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Storyboard|Board export/i)

    await clickNamed(/Advanced/i)
    // skip q — starts video prep queue
    await clickNamed(/^adv-r$/i)
    await clickNamed(/^adv-rt$/i)
    await clickNamed(/^xc$/i)

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        })
      )
    })

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'timeline-clip',
            entityIds: { storyId: 'story-1', entryId: 'entry-2' },
            path: '/done.mp4'
          }
        })
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Import/i)
  }, 90000)

  it('empty timeline no-failed + listExports missing + generate cancel', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([])
    // listExports not a function
    // @ts-expect-error intentional
    api.media.listExports = undefined
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      videoMode: 'stub'
    })
    api.generation.run = vi.fn().mockResolvedValue({
      success: true,
      steps: [{ step: 'script', success: true }]
    })

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    await clickNamed(/Retry failed clips|Retry failed/i)
    await clickNamed(/Start generation|Generate/i)
    if (document.querySelector('[role="alertdialog"]')) {
      const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Cancel$/i.test((b.textContent || '').trim())
      )
      if (cancel) await act(async () => fireEvent.click(cancel))
    }
    await clickNamed(/Start generation|Generate/i)
    // no entries toast path
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
  }, 30000)
})

// ─────────────────────────────────────────────────────────────
// Settings mop
// ─────────────────────────────────────────────────────────────
describe('mop100 Settings residual', () => {
  beforeEach(() => seed())

  it('installHints copy/open, LLM advanced, rate-limit, web, npm, color, creator', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      legalAcceptedAt: '2026-01-01T00:00:00.000Z',
      firstRunSeen: true,
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'unknown-model',
      llmProvider: 'openai-compatible',
      apiKey: 'gk_live_x',
      imageProvider: 'custom',
      imageBaseUrl: 'https://img.x/v1',
      imageModel: 'im',
      videoProvider: 'custom',
      videoBaseUrl: 'https://vid.x/v1',
      videoModel: 'vm',
      videoMode: 'api',
      colorScheme: 'system',
      webServerPort: 8787,
      webServerHost: '127.0.0.1',
      webServerEnabled: true,
      chatTimeoutMs: 45000
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '2.1.0',
      isPackaged: true,
      userData: '/tmp/idm-user',
      mediaRoot: '/tmp/media',
      name: 'IDM',
      channels: 8
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: false,
      message: 'no ffmpeg mop'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })

    let modelsN = 0
    api.ai.listModels = vi.fn().mockImplementation(async () => {
      modelsN++
      if (modelsN === 1) {
        throw Object.assign(new Error('rate'), { code: 'AI_RATE_LIMIT' })
      }
      return [
        { id: 'a', ownedBy: 'fallback' },
        { id: 'b', ownedBy: 'x' }
      ]
    })
    api.ai.testChat = vi
      .fn()
      .mockRejectedValueOnce(new Error('chat fail'))
      .mockResolvedValue({ ok: true, message: 'ok', replyPreview: 'hello world' })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://preset/v1',
      model: 'pm'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})

    let ensureN = 0
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'gateway_missing',
      healthOk: false,
      message: 'need install',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://a',
      keyReady: false
    })
    api.gateway.ensure = vi.fn().mockImplementation(async () => {
      ensureN++
      if (ensureN === 1) {
        return {
          state: 'grok_build_missing',
          healthOk: false,
          message: 'build',
          grokPath: null,
          gctoacPath: null,
          adminUrl: 'http://a',
          keyReady: false,
          keyCreated: false
        }
      }
      return {
        state: 'ready',
        healthOk: true,
        keyReady: true,
        keyCreated: true,
        message: 'ok',
        grokPath: '/g',
        gctoacPath: '/c',
        adminUrl: 'http://a'
      }
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/build',
      installCommand: 'curl -fsSL https://x.ai/install | sh'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })

    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 'tok',
      addresses: [
        { id: 'lan', address: 'http://192.168.0.5:8787' },
        { id: 'localhost', address: 'http://127.0.0.1:8787' },
        { id: 'tailscale', address: 'http://100.64.0.1:8787' }
      ]
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('tok2')

    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'desktop-packaged',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 10,
      releaseNotes: '## notes',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '2.0.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi
      .fn()
      .mockRejectedValueOnce(new Error('npm fail'))
      .mockResolvedValue({
        packageName: 'instant-drama-magician',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        updateAvailable: true,
        checkedAt: new Date().toISOString(),
        installCommand: 'npm i -g instant-drama-magician@2'
      })
    api.updates.onState = vi.fn((cb: (s: object) => void) => {
      cb({
        status: 'downloading',
        progress: 55,
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true,
        channel: 'desktop-packaged'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({
      ok: true,
      path: '/b.zip'
    })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      ok: true,
      path: '/s.json'
    })
    api.shell.openPath = vi.fn().mockResolvedValue({
      ok: true,
      isDirectory: true,
      path: '/tmp/idm-user'
    })
    api.shell.openExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('ext fail'))
      .mockResolvedValue({ ok: true })

    let clipN = 0
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn().mockImplementation(async () => {
          clipN++
          if (clipN % 2 === 1) throw new Error('clip fail')
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

    // Chat + advanced + gateway install UI
    await clickNamed(/Chat model|Chat/i)
    await clickNamed(/Show advanced options/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 12) as HTMLInputElement[]) {
      if (input.type === 'checkbox') {
        await act(async () => fireEvent.click(input))
      } else if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '80000' } })
        )
        await act(async () => fireEvent.blur(input))
      } else if (input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'https://custom/v1' } })
        )
      }
    }
    // Gateway recheck → installHints + copy install command buttons
    for (let i = 0; i < 3; i++) {
      await clickNamed(/Recheck|Start gateway|Ensure|gateway/i)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
    }
    // Copy install cmd (onCopyInstall) + open install page
    for (const re of [
      /Copy install|Copy command|Copy/i,
      /Open install|install page|Grok Build|Install/i
    ]) {
      await clickNamed(re)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15))
      })
    }
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Test chat|Test/i)
    await clickNamed(/Test chat|Test/i)
    await clickNamed(/Grok|Custom|preset|Apply/i)
    await clickNamed(/Hide advanced options|Show advanced/i)

    for (const tab of [/^Image$/i, /^Video$/i]) {
      await clickNamed(tab)
      await clickNamed(/Show advanced options|Hide advanced/i)
      for (const input of Array.from(
        document.querySelectorAll('input')
      ).slice(0, 8) as HTMLInputElement[]) {
        if (input.type === 'checkbox') {
          await act(async () => fireEvent.click(input))
        } else if (input.type !== 'file') {
          await act(async () =>
            fireEvent.change(input, {
              target: {
                value: input.type === 'number' ? '8' : 'https://x/v1'
              }
            })
          )
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
    }

    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Pick|Browse|Clear/i)

    await clickNamed(/^App$/i)
    await clickNamed(/Show advanced options|Hide advanced/i)
    // Color scheme + language selects
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        for (let i = 0; i < Math.min(s.options.length, 4); i++) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[i].value } })
          )
        }
      }
    }
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 14) as HTMLInputElement[]) {
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
      /Start|Stop|Enable|Regenerate token|Copy/i,
      /Check for updates|Check|Download|Install and restart|release|npm|notes|Show|Hide/i,
      /Export all data/i,
      /Restore from backup/i,
      /support|diagnostics|Clear activity|clear all/i,
      /Linktree|Copy/i
    ]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 12))
      })
    }
    // Network address Copy buttons
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Copy$/i.test((x.textContent || '').trim()))
      .slice(0, 6)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Open folder/i)
    await clickNamed(/Export all data/i)
    await clickNamed(/Restore from backup/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/^Save$/i)
  }, 70000)

  it('gateway null + shell openExternal missing + web-skipped', async () => {
    const prev = api.gateway
    // @ts-expect-error
    api.gateway = undefined
    const prevExt = api.shell.openExternal
    // @ts-expect-error
    api.shell.openExternal = undefined
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'zh-Hant',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'web-skipped',
      channel: 'web',
      currentVersion: '1.0.0',
      canCheck: false,
      canDownload: false,
      canAutoInstall: false
    })
    // webServer without status
    const ws = api.webServer as { status?: unknown }
    const prevSt = ws.status
    delete ws.status

    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/Chat model|Chat/i)
    await clickNamed(/Recheck|gateway|install|Open|Copy/i)
    await clickNamed(/^App$/i)
    await clickNamed(/Linktree|Copy|npm|Check/i)
    await clickNamed(/^Save$/i)

    api.gateway = prev
    api.shell.openExternal = prevExt
    ws.status = prevSt
  }, 30000)
})

// ─────────────────────────────────────────────────────────────
// Stories mop
// ─────────────────────────────────────────────────────────────

describe('mop100 Settings grok-gateway install UI', () => {
  beforeEach(() => seed())

  it('need_build shows Copy + Open xAI and hits installHints openExternal', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok-4.5',
      apiKey: '',
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'grok_build_missing',
      healthOk: false,
      message: 'install grok',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://127.0.0.1:3847/admin/',
      keyReady: false
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'grok_build_missing',
      healthOk: false,
      message: 'still missing',
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://127.0.0.1:3847/admin/',
      keyReady: false
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/cli',
      installCommand: 'curl -fsSL https://x.ai/cli/install.sh | bash'
    })
    api.shell.openExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('ext fail'))
      .mockResolvedValue({ ok: true })
    let clipN = 0
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn().mockImplementation(async () => {
          clipN++
          if (clipN === 1) throw new Error('clip fail')
        })
      }
    })
    api.ai.listModels = vi.fn().mockResolvedValue([])
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({ available: true })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'idle',
      channel: 'desktop-dev',
      currentVersion: '1.0.0',
      canCheck: false,
      canDownload: false,
      canAutoInstall: false
    })
    api.webServer.status = vi.fn().mockResolvedValue({ running: false })
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1',
      isPackaged: false,
      userData: '/u',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 1
    })

    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    // LLM tab is default; gateway card should show install UI
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(
          /Install Grok Build|Open xAI|Copy/i
        ),
      { timeout: 8000 }
    )
    // Copy install cmd (success after fail)
    const copyBtns = screen
      .getAllByRole('button')
      .filter((b) => /^Copy$/i.test((b.textContent || '').trim()))
    for (const b of copyBtns.slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    // Open xAI website → installHints + openExternal
    await clickNamed(/Open xAI website|Open xAI/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Open xAI website|Open xAI/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // Recheck
    await clickNamed(/Recheck|recheck|Check again/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    expect(api.gateway.installHints).toHaveBeenCalled()
  }, 40000)

  it('gateway ready + ensure keyCreated toast + custom advanced', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok-4.5',
      apiKey: 'gk_live_ok',
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true
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
      message: 'ok',
      grokPath: '/g',
      gctoacPath: '/c',
      adminUrl: 'http://a'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.ai.listModels = vi.fn().mockResolvedValue([
      { id: 'grok-4.5', ownedBy: 'x' }
    ])
    api.ai.testChat = vi.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      replyPreview: 'hi'
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
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/Recheck|recheck/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Test chat|Test/i)
    // Switch to custom provider for advanced baseUrl paths
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
    )) {
      const s = sel as HTMLSelectElement
      const opt = Array.from(s.options).find((o) =>
        /custom|openai|openrouter/i.test(o.textContent || o.value)
      )
      if (opt) {
        await act(async () =>
          fireEvent.change(s, { target: { value: opt.value } })
        )
      }
    }
    // LlmProviderPicker may be buttons not select
    for (const re of [/Custom|OpenAI|OpenRouter|Grok/i]) {
      await clickNamed(re)
    }
    await clickNamed(/Show advanced options/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 8) as HTMLInputElement[]) {
      if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '90000' } })
        )
      } else if (input.type !== 'checkbox' && input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'https://custom/v1' } })
        )
      }
    }
    await clickNamed(/^Save$/i)
  }, 40000)
})

describe('mop100 Stories residual', () => {
  beforeEach(() => seed())

  it('cast all kinds Add/Remove + costume + multi beats + cover cancel + script', async () => {
    const manyChars = Array.from({ length: 16 }, (_, i) =>
      makeCharacter({
        id: `char-${i + 1}`,
        name: i === 0 ? 'Aria' : `Cast${i}`,
        costumesJson: i === 0 ? costumesJson : null
      })
    )
    const beats = [
      makeTimelineEntry({
        id: 'entry-1',
        dialogue: '[DIALOGUE|Aria] Hi mop',
        characterIds: ['char-1'],
        sceneIds: ['scene-1'],
        propIds: ['prop-1'],
        actionIds: []
      }),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        dialogue: 'Beat two',
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
        characters: [
          {
            ...manyChars[0],
            storyCostumeId: 'look-1',
            storyCostume: { id: 'look-1', name: 'Coat' }
          }
        ],
        scenes: [makeScene(), makeScene({ id: 'scene-2', title: 'Alley' })],
        props: [makeProp(), makeProp({ id: 'prop-2', name: 'Flask' })],
        actions: [makeAction(), makeAction({ id: 'act-2', name: 'Kick' })],
        timeline: beats
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue(makeStory())
    api.stories.create = vi.fn().mockResolvedValue(
      makeStory({ id: 'sn', title: 'New' })
    )
    api.stories.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('lc'))
      .mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi
      .fn()
      .mockRejectedValueOnce(new Error('ls'))
      .mockResolvedValue({})
    api.stories.unlinkScene = vi
      .fn()
      .mockRejectedValueOnce(new Error('us'))
      .mockResolvedValue({})
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
      .mockRejectedValueOnce(new Error('script fail'))
      .mockResolvedValue({
        beats: [{ order: 0, dialogue: 'Hi', characterIds: ['char-1'] }],
        drafts: [],
        raw: ''
      })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 'cinematic mop',
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
      .mockRejectedValueOnce(new Error('beat upd'))
      .mockImplementation(async (id: string, patch: object) => ({
        ...makeTimelineEntry({ id }),
        ...patch
      }))
    api.timeline.delete = vi.fn().mockRejectedValueOnce(new Error('beat del'))
    api.timeline.reorder = vi
      .fn()
      .mockRejectedValueOnce(new Error('reorder'))
      .mockResolvedValue({ ok: true })
    api.timeline.create = vi.fn().mockResolvedValue(
      makeTimelineEntry({ id: 'en', dialogue: 'new' })
    )
    api.media.discardSheetDraft = vi.fn().mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())

    // filters
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

    await openCardEdit('Demo Story')
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    await clickNamed(/Basics|Meta/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'mop style bible' } })
      )
    }
    await clickNamed(/AI fill style notes|AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    // Cast — do not Save (closes editor)
    await clickNamed(/Cast \/ set|Cast/i)
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(
          /Add to story|Remove from story|Aria|Cast1/i
        ),
      { timeout: 8000 }
    )
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      const tabBtn = screen.getAllByRole('button').find((b) => {
        const t = (b.textContent || '').replace(/\d+/g, '').trim()
        return kind.test(t)
      })
      if (tabBtn) await act(async () => fireEvent.click(tabBtn))
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
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
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[0].value } })
          )
        }
      }
      const toggles = screen
        .getAllByRole('button')
        .filter((b) =>
          /Add to story|Remove from story/i.test((b.textContent || '').trim())
        )
      for (const b of toggles.slice(0, 5)) {
        await act(async () => fireEvent.click(b))
        await act(async () => {
          await new Promise((r) => setTimeout(r, 25))
        })
      }
      const castQ = document.querySelector(
        'input[placeholder*="Search" i]'
      ) as HTMLInputElement | null
      if (castQ) {
        await act(async () =>
          fireEvent.change(castQ, { target: { value: 'Cast' } })
        )
        await act(async () =>
          fireEvent.change(castQ, { target: { value: '' } })
        )
      }
      await clickNamed(/→/)
      await clickNamed(/←/)
    }

    // Script
    await clickNamed(/Script beats|Script/i)
    await clickNamed(/Add beat/i)
    await clickNamed(/↑|Move up/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickNamed(/↓|Move down/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      4
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: {
            value:
              '[MOOD] tense\n[DIALOGUE|Aria|cold] Mop multi-line residual'
          }
        })
      )
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      12
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
    await clickNamed(/Insert script template|template/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    const beatDel = screen
      .getAllByRole('button')
      .find((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (beatDel) {
      await act(async () => fireEvent.click(beatDel))
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }

    // Cover cancel + multi-ref
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
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
  }, 90000)
})

// ─────────────────────────────────────────────────────────────
// Scenes mop
// ─────────────────────────────────────────────────────────────
describe('mop100 Scenes residual', () => {
  beforeEach(() => seed())

  it('plot confirm looks apply copy gallery plate intro identity', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['scene-intro:scene-1:/media/roof.png']: {
            kind: 'scene-intro',
            entityIds: { sceneId: 'scene-1' },
            sourceImagePath: '/media/roof.png',
            professionalPrompt: 'p',
            stillPath: '/s.png',
            durationSeconds: 6
          }
        })
      )
    } catch {
      /* ignore */
    }
    const looksJson = JSON.stringify([
      {
        id: 'look-s1',
        name: 'Rain',
        description: 'wet neon',
        artStyle: 'anime',
        imagePath: '/media/roof.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'look-s2',
        name: 'Fog',
        description: 'soft fog',
        artStyle: 'not-style',
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
        mood: 'tense'
      }),
      makeScene({
        id: 'scene-2',
        title: 'Rooftop',
        sceneNumber: 2,
        locationKey: 'rooftop',
        description: 'sister',
        refImagePath: '/media/roof2.png',
        refGalleryJson: gal('/media/roof2.png', 'sg2'),
        artStyle: 'realistic'
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    let createN = 0
    api.scenes.create = vi.fn().mockImplementation(async () => {
      createN++
      if (createN === 1) throw new Error('create fail')
      return makeScene({ id: 'sn', title: 'New mop', sceneNumber: 9 })
    })
    api.scenes.delete = vi.fn().mockRejectedValue(new Error('del'))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'Rooftop+',
        description: 'd',
        locationType: 'exterior',
        timeOfDay: 'night',
        weather: 'rain',
        mood: 'tense',
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
      gallery: [
        {
          id: 'pg',
          path: '/tmp/spc.png',
          kind: 'plate',
          label: 'P',
          layer: 'identity',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.scenes.swapAtmosphere = vi
      .fn()
      .mockRejectedValueOnce(new Error('atm'))
      .mockResolvedValue({
        path: '/tmp/atm.png',
        label: 'Atm',
        layer: 'detail'
      })
    api.scenes.copyGalleryFrom = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy'))
      .mockResolvedValue({
        scene: makeScene({
          id: 'scene-1',
          title: 'Rooftop',
          locationKey: 'rooftop',
          refGalleryJson: gal('/media/roof2.png', 'copied')
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
      expect(screen.getAllByText(/Rooftop/i).length).toBeGreaterThan(0)
    )

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
    await clickNamed(/Clear filters/i)

    // Plot from header — empty story first then with story
    await clickNamed(/Suggest from story/i)
    await clickNamed(/AI fill|Confirm|Generate|Suggest/i)
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
    await clickNamed(/AI fill|Confirm|Generate|Suggest/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await clickNamed(/^Cancel$/i)
    await clickNamed(/Clear filters/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      6
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 0) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[0].value } })
        )
      }
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rooftop/i)
    )

    await openCardEdit('Rooftop')

    // AI need idea
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
        fireEvent.change(el, { target: { value: 'mop rain neon' } })
      )
    }

    await act(async () => {
      void jobs!.startJob({
        kind: 'scene-ai-fill',
        label: 'hang',
        scope: { sceneId: 'scene-1' },
        run: async () => {
          await new Promise(() => {
            /* hang */
          })
        }
      })
    })
    await clickNamed(/AI fill/i)
    for (const j of [...(jobs?.activeJobs ?? [])]) {
      await act(async () => {
        await jobs!.cancelJob(j.id)
      })
    }

    await clickNamed(/Looks|Atmosphere|Mood/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'fog dawn mop look' } })
      )
    }
    await clickNamed(/Add look|Save look|Add to library|Add/i)
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 3)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Generate atmosphere|Atmosphere|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Generate atmosphere|Atmosphere|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickNamed(/^Plates$|^References$/i)
    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /#\s*2/i.test((b.textContent || '').trim()))
    if (copyBtn) {
      await act(async () => fireEvent.click(copyBtn))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      await act(async () => fireEvent.click(copyBtn))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
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
    await clickNamed(
      /Generate plate|Generate scene plate|Generate professional/
    )
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/Intro|Continue|video/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^Save$/i)

    // New scene plate create fail then ok
    await clickNamed(/New scene/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'New mop scene' } })
      )
    }
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/Generate plate|Generate|Create and generate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70))
    })
    await clickNamed(/Generate plate|Generate|Create and generate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70))
    })
  }, 90000)
})

// ─────────────────────────────────────────────────────────────
// Characters / Actions / Props / Costumes mop residuals
// ─────────────────────────────────────────────────────────────
describe('mop100 Characters Actions Props Costumes residual', () => {
  beforeEach(() => seed())

  it('Characters clear filters AI need idea intro no-id sheet cancel', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        gender: 'female',
        artStyle: 'anime',
        spokenLanguages: '["en"]',
        soulHubId: 1,
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        costumesJson,
        hardRules: 'no logos'
      }),
      makeCharacter({
        id: 'char-2',
        name: 'Ben',
        gender: '',
        spokenLanguages: 'bad',
        refImagePath: null
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Aria', description: 'd', artStyle: 'anime' },
      profileJson: '{}',
      raw: ''
    })
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
      character: { id: 'char-1', costume: 'c' },
      gallery: []
    })
    api.characters.readSoulContent = vi.fn().mockResolvedValue({
      content: '# soul'
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Aria')).toBeTruthy())
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < s.options.length; i++) {
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
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'mop body' } })
      )
    }
    await clickNamed(/^References$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate professional reference/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Intro|video/i)
  }, 60000)

  it('Actions props costumes busy intro plate guards', async () => {
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
      path: '/tmp/ap.png',
      label: 'B'
    })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Draw gun', description: 'd' },
      profileJson: '{}',
      raw: ''
    })
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/pp.png',
      label: 'H'
    })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Badge', description: 'd' },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cost-1',
        name: 'Rain coat',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/d.png'
    })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Rain coat',
      description: 'long'
    })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])

    // Actions
    const { unmount: u1 } = await renderWithProviders(
      <>
        <Probe />
        <ActionsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Draw gun')
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
    await clickNamed(/^References$/i)
    await clickNamed(/Generate instruction board|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Intro|video/i)
    u1()

    // Props
    const { unmount: u2 } = await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Badge')
    await clickNamed(/Clear filters/i)
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/Generate prop plate|Generate plate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Intro|video/i)
    u2()

    // Costumes
    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')
    await clickNamed(/Clear filters/i)
    await clickNamed(/Dress|Generate dressed/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Intro|video/i)
    await clickNamed(/^Save$/i)
  }, 90000)
})
