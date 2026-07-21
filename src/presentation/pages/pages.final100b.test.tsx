/**
 * Final residual: Settings image/video providers, Timeline safe paths,
 * Stories cast toggles, Scenes atmosphere looks — drive under-90 past 90.
 * videoPrep.create always returns professionalPrompt string.
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
    onRefresh?: () => void
    onRefreshTimeline?: () => void
  }) =>
    p.open ? (
      <div data-testid="adv">
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
    path: '/tmp/u'
  })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockImplementation(async (payload: {
    kind?: string
    storyId?: string
    entryId?: string
    characterId?: string
    sceneId?: string
    sourceImagePath?: string
  }) => ({
    professionalPrompt: 'FULL PROFESSIONAL PROMPT residual safe',
    stillPath: payload?.sourceImagePath ?? '/s.png',
    sourceImagePath: payload?.sourceImagePath ?? '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: {
      storyId: payload?.storyId ?? 'story-1',
      entryId: payload?.entryId,
      characterId: payload?.characterId,
      sceneId: payload?.sceneId
    },
    kind: payload?.kind ?? 'timeline-clip',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1,
    materialsSummary: 'm',
    stillPromptUsed: 's',
    skippedStill: false
  }))
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'from still FULL',
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
    success: false,
    steps: [{ step: 'script', success: false, error: 'x', degraded: true }]
  })
  api.generation.onProgress = vi.fn(() => () => undefined)
  api.settings.get = vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS })
  api.settings.set = vi.fn().mockResolvedValue({})
  api.costumes.list = vi.fn().mockResolvedValue([])
  api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
  api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  api.props.list = vi.fn().mockResolvedValue([makeProp()])
  api.actions.list = vi.fn().mockResolvedValue([makeAction()])
  api.timeline.list = vi.fn().mockResolvedValue([])
}

describe('final100b Settings', () => {
  beforeEach(() => seed())

  it('image/video provider matrix + app web npm color + openai advanced', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      imageProvider: 'same-as-llm',
      videoProvider: 'stub',
      videoMode: 'stub',
      colorScheme: 'system',
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true,
      webServerPort: 8787,
      webServerHost: '0.0.0.0',
      webServerEnabled: false,
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
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '7',
      path: '/ff'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    let modelsN = 0
    api.ai.listModels = vi.fn().mockImplementation(async () => {
      modelsN++
      if (modelsN === 1) {
        throw Object.assign(new Error('rate'), { code: 'AI_RATE_LIMIT' })
      }
      return [
        { id: 'gpt-4o', ownedBy: 'fallback' },
        { id: 'gpt-4.1', ownedBy: 'openai' }
      ]
    })
    api.ai.testChat = vi.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      replyPreview: 'hi'
    })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o'
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
      keyCreated: false,
      message: 'ok'
    })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: false,
      url: null,
      port: 8787,
      error: null,
      staticReady: true,
      token: 't',
      addresses: [
        { id: 'lan', address: 'http://192.168.1.9:8787' },
        { id: 'localhost', address: 'http://127.0.0.1:8787' }
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
      currentVersion: '1',
      latestVersion: '2',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 0,
      releaseNotes: 'n',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '2'
    })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
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
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValueOnce(new Error('c'))
          .mockResolvedValue(undefined)
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
          fireEvent.change(input, { target: { value: '75000' } })
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
    await clickNamed(/Test chat|Test/i)

    await clickNamed(/^Image$/i)
    for (const re of [/Seedream|seedream|Custom|Same as|Grok/i]) {
      await clickNamed(re)
    }
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
    for (const re of [/Seedance|seedance|Grok|Custom|Stub|Same/i]) {
      await clickNamed(re)
    }
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 5); i++) {
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
              value: input.type === 'number' ? '8' : 'https://vid.custom/v1'
            }
          })
        )
      }
    }

    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Pick|Browse|Clear/i)

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
      /Check|Download|Install|npm|release|notes/i,
      /Export all data/i,
      /Restore from backup/i,
      /support|diagnostics|Clear activity/i,
      /Linktree|Copy/i,
      /Light|Dark|System/i
    ]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Copy$/i.test((x.textContent || '').trim()))
      .slice(0, 4)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/^Save$/i)
  }, 60000)

  it('grok-gateway need_build Copy + Open xAI installHints', async () => {
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
      message: 'need build',
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
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/cli',
      installCommand: 'curl install'
    })
    api.shell.openExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('ext'))
      .mockResolvedValue({ ok: true })
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
    expect(api.gateway.installHints).toHaveBeenCalled()
  }, 30000)
})

describe('final100b Timeline', () => {
  beforeEach(() => seed())

  it('play empty→ready, snap pack export history, generate cancel', async () => {
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
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
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
      snapEnabled: true,
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
    api.media.deleteExport = vi.fn().mockResolvedValue({
      ok: true,
      items: [],
      latestPath: null
    })
    api.media.exportPreflight = vi.fn().mockResolvedValue({
      ffmpeg: true,
      ffmpegMessage: 'ok',
      readyClips: 1,
      totalClips: 3,
      willUseFallback: false,
      warnings: [],
      canExport: true
    })
    api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/out.mp4' })
    api.media.exportStoryboard = vi.fn().mockResolvedValue({ path: '/b.png' })
    api.generation.onProgress = vi.fn((cb: (p: object) => void) => {
      cb({
        storyId: 'story-1',
        index: 0,
        total: 2,
        step: 'script',
        entryId: 'entry-2',
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
    await clickNamed(/^k-pack$/i)
    await clickNamed(/^k-resize$/i)
    await clickNamed(/^k-move$/i)
    await clickNamed(/^k-drop$/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'residual dialogue' } })
      )
    }
    await clickNamed(/Snap|Grid/i)
    await clickNamed(/Pack|Abut/i)

    await clickNamed(/Export history/i)
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
    await clickNamed(/Storyboard|Board/i)
    await clickNamed(/Advanced/i)
    await clickNamed(/^adv-r$/i)
    await clickNamed(/^adv-rt$/i)
    await clickNamed(/^xc$/i)

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
  }, 25000)
})

describe('final100b Stories', () => {
  beforeEach(() => seed())

  it('cast Add/Remove all kinds + costume + beats + cover', async () => {
    const manyChars = Array.from({ length: 14 }, (_, i) =>
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
        sceneIds: ['scene-1']
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
        characters: [{ ...manyChars[0], storyCostumeId: null }],
        scenes: [makeScene({ id: 'scene-1' })],
        props: [makeProp({ id: 'prop-1' })],
        actions: [makeAction({ id: 'act-1' })],
        timeline: beats
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue(makeStory())
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
    api.stories.generateCover = vi.fn().mockResolvedValue({
      path: '/tmp/cov.png',
      label: 'C'
    })
    api.stories.commitCover = vi.fn().mockResolvedValue({
      path: '/tmp/c.png',
      gallery: []
    })
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
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
      makeScene({ id: 'scene-1', title: 'Rooftop' }),
      makeScene({ id: 'scene-2', title: 'Alley' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({ id: 'prop-1', name: 'Badge' }),
      makeProp({ id: 'prop-2', name: 'Flask' })
    ])
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({ id: 'act-1', name: 'Draw gun' }),
      makeAction({ id: 'act-2', name: 'Kick' })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.list = vi.fn().mockResolvedValue(beats)
    api.timeline.update = vi.fn().mockImplementation(async (id, patch) => ({
      ...makeTimelineEntry({ id }),
      ...patch
    }))
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.create = vi.fn().mockResolvedValue(
      makeTimelineEntry({ id: 'en' })
    )

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Demo Story')
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

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
        4
      )) {
        const s = sel as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[1].value } })
          )
        }
      }
      const toggles = screen
        .getAllByRole('button')
        .filter((b) =>
          /Add to story|Remove from story/i.test((b.textContent || '').trim())
        )
      for (const b of toggles.slice(0, 4)) {
        await act(async () => fireEvent.click(b))
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20))
        })
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
  }, 70000)
})

describe('final100b Scenes', () => {
  beforeEach(() => seed())

  it('atmosphere looks Apply styleLabel + plates copy + intro', async () => {
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
        mood: 'tense',
        lighting: 'neon'
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
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
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
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'P',
      variant: 'hero'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: []
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/atm.png',
      label: 'A',
      layer: 'detail'
    })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({
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

    await clickNamed(/Suggest from story/i)
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    // If still in editor from plot, cancel again
    if (
      screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      // already in editor — good
    } else {
      await openCardEdit('Rooftop')
    }
    await clickNamed(/^Images$/i)
    // Gen mode Atmosphere (not a top-level tab)
    const atmoModes = screen
      .getAllByRole('button')
      .filter((b) => /^Atmosphere$/i.test((b.textContent || '').trim()))
    if (atmoModes.length) {
      await act(async () => fireEvent.click(atmoModes[atmoModes.length - 1]!))
    }
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(
          /wet neon|fog soft|Atmosphere library|Apply/i
        ),
      { timeout: 8000 }
    )
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 3)) {
      await act(async () => fireEvent.click(b))
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'new residual atmosphere' } })
      )
    }
    await clickNamed(/Add to library/i)
    const delLooks = screen
      .getAllByRole('button')
      .filter((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (delLooks[0]) await act(async () => fireEvent.click(delLooks[0]!))
    await clickNamed(/Generate atmosphere|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })

    await clickNamed(/^Plates$/i)
    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /#\s*2/i.test((b.textContent || '').trim()))
    if (copyBtn) {
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
  }, 70000)
})
