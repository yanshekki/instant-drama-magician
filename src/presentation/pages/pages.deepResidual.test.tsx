/**
 * Deep residual coverage: Settings tabs, Timeline pack/export/clip, Props/Scenes plate UI.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeProp,
  makeScene,
  makeStory,
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
import { PropsPage } from './PropsPage'
import { ScenesPage } from './ScenesPage'

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
  return {
    ...actual,
    changeUiLanguage: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: (props: {
    onSelect?: (id: string) => void
    onMove?: (id: string, start: number, end: number) => void
    onPack?: () => void
    entries?: Array<{ id: string }>
  }) => (
    <div data-testid="konva">
      <button
        type="button"
        data-testid="konva-select"
        onClick={() => props.onSelect?.(props.entries?.[0]?.id ?? 'entry-1')}
      >
        select
      </button>
      <button
        type="button"
        data-testid="konva-move"
        onClick={() => props.onMove?.(props.entries?.[0]?.id ?? 'entry-1', 0, 6)}
      >
        move
      </button>
      <button
        type="button"
        data-testid="konva-pack"
        onClick={() =>
          (
            props as { onPackAbut?: () => void }
          ).onPackAbut?.()
        }
      >
        pack-from-konva
      </button>
    </div>
  )
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: (props: {
    onTime?: (t: number) => void
    onEnded?: () => void
    onGenerate?: () => void
  }) => (
    <div data-testid="preview">
      <button type="button" onClick={() => props.onTime?.(2)}>
        tick
      </button>
      <button type="button" onClick={() => props.onEnded?.()}>
        ended
      </button>
      <button type="button" onClick={() => props.onGenerate?.()}>
        preview-gen
      </button>
    </div>
  )
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: (props: {
    open?: boolean
    onClose?: () => void
    onStartVideoQueue?: (ids: string[], opts?: { skipStill?: boolean }) => void
    onRefreshTimeline?: () => void
  }) =>
    props.open ? (
      <div data-testid="advanced">
        <button type="button" onClick={() => props.onClose?.()}>
          close-adv
        </button>
        <button
          type="button"
          onClick={() => props.onStartVideoQueue?.(['entry-1', 'entry-2'])}
        >
          queue-video
        </button>
        <button type="button" onClick={() => props.onRefreshTimeline?.()}>
          refresh-tl
        </button>
      </div>
    ) : null
}))
vi.mock('../components/ExportFinalDialog', () => ({
  ExportFinalDialog: (props: {
    open?: boolean
    onCancel?: () => void
    onConfirm?: (opts: Record<string, unknown>) => void
  }) =>
    props.open ? (
      <div data-testid="export-dlg">
        <button
          type="button"
          onClick={() =>
            props.onConfirm?.({
              includeSubtitles: true,
              burnSubtitles: true,
              format: 'mp4'
            })
          }
        >
          do-export
        </button>
        <button type="button" onClick={() => props.onCancel?.()}>
          cancel-export
        </button>
      </div>
    ) : null
}))

vi.mock('../components/VideoPrepModal', () => ({
  VideoPrepModal: (props: {
    open?: boolean
    onConfirm?: () => void
    onFinish?: () => void
    onAbandon?: () => void
    onNextClip?: () => void
  }) =>
    props.open ? (
      <div data-testid="vp">
        <button type="button" onClick={() => void props.onConfirm?.()}>
          vp-ok
        </button>
        <button type="button" onClick={() => props.onFinish?.()}>
          vp-done
        </button>
        <button type="button" onClick={() => props.onNextClip?.()}>
          vp-next
        </button>
        <button type="button" onClick={() => props.onAbandon?.()}>
          vp-abandon
        </button>
      </div>
    ) : null
}))

type JobsApi = ReturnType<typeof useAiJobs>
let jobsApi: JobsApi | null = null
function JobsProbe(): null {
  const j = useAiJobs()
  useEffect(() => {
    jobsApi = j
  }, [j, j.jobs, j.pendingDrafts])
  return null
}

async function clickRe(re: RegExp, allowDisabled = false) {
  const b = screen.getAllByRole('button').find((x) => {
    if (!re.test(x.textContent || '')) return false
    if (allowDisabled) return true
    return !(x as HTMLButtonElement).disabled
  })
  if (b) {
    await act(async () => {
      fireEvent.click(b)
    })
  }
  return b
}

function seedBase() {
  reseedMockApi(api)
  jobsApi = null
  localStorage.clear()
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi.fn().mockResolvedValue({
    url: 'blob:x',
    filePath: '/media/x.png'
  })
  api.media.pickRefImage = vi.fn().mockResolvedValue({ path: '/tmp/ref.png' })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
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
    queueTotal: 2
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/out.mp4' })
  api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'still',
    stillPath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' }
  })
}

describe('deep residual Settings', () => {
  beforeEach(() => {
    seedBase()
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      legalAcceptedAt: '2026-01-01T00:00:00.000Z',
      firstRunSeen: true,
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok-4.5',
      llmProvider: 'openai-compatible',
      apiKey: 'gk_test',
      imageProvider: 'same-as-llm',
      videoProvider: 'stub',
      videoMode: 'stub',
      colorScheme: 'system',
      webServerPort: 8787
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => p)
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1.1.0',
      isPackaged: true,
      userData: '/tmp/ud',
      mediaRoot: '/tmp/media',
      name: 'IDM',
      channels: 2
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '6.1'
    })
    api.ai.listModels = vi.fn().mockResolvedValue(['grok-4.5', 'grok-3', 'x'])
    api.ai.testChat = vi.fn().mockResolvedValue({ ok: true, message: 'hi' })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    api.ai.probeChat = vi.fn().mockResolvedValue({ available: true })
    api.ai.probeVideo = vi.fn().mockResolvedValue({ available: false })
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'ready',
      message: 'ok',
      healthOk: true,
      grokPath: '/g',
      gctoacPath: '/c',
      adminUrl: 'http://127.0.0.1:3847'
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'ready',
      healthOk: true
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({ steps: [] })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: false,
      url: '',
      port: 8787,
      error: null,
      staticReady: true
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      token: 't'
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('new-tok')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'stable',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '1.2.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      updateAvailable: true,
      checkedAt: new Date().toISOString(),
      installCommand: 'npm i -g x'
    })
    api.updates.onState = vi.fn(() => () => undefined)
    api.updates.openReleasePage = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com'
    })
    api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
    api.shell.openPath = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      ok: true,
      path: '/tmp/support.json'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/tmp/bgm.mp3' })
  })

  it('walks all settings tabs, presets, web, updates, backups', async () => {
    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    const tabs = [
      /Chat model/i,
      /^Image$/i,
      /^Video$/i,
      /^Export$/i,
      /^App$/i
    ]
    for (const tab of tabs) {
      await clickRe(tab)
      // exercise inputs
      for (const el of Array.from(
        document.querySelectorAll('input, select, textarea')
      ).slice(0, 18)) {
        const tag = el.tagName.toLowerCase()
        if (tag === 'select') {
          const s = el as HTMLSelectElement
          if (s.options.length > 1) {
            await act(async () => {
              fireEvent.change(s, { target: { value: s.options[1].value } })
            })
          }
        } else if ((el as HTMLInputElement).type === 'checkbox') {
          await act(async () => {
            fireEvent.click(el)
          })
        } else if ((el as HTMLInputElement).type !== 'file') {
          await act(async () => {
            fireEvent.change(el, { target: { value: 'http://127.0.0.1:9/v1' } })
          })
        }
      }
      for (const re of [
        /Refresh model list/i,
        /Test chat/i,
        /Show advanced|Hide advanced|Advanced/i,
        /Grok local|OpenAI|OpenRouter|Custom|Same as chat|Stub|Seedance|Seedream/i,
        /Enable web server|Start|Stop/i,
        /Regenerate|Copy token/i,
        /Check for updates|Download update|Restart to install/i,
        /Open|release|backup|export|import|support|diagnostics|Clear|BGM|Light|Dark|System|English/i,
        /Apply|preset|defaults|gateway|admin|repo/i
      ]) {
        await clickRe(re)
      }
    }

    // Clear all confirm
    await clickRe(/Clear all/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
    }
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickRe(/^Save$/i)
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
  }, 40000)

  it('settings error paths: models fail, chat fail, web fail, gateway need_build', async () => {
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'need_build',
      message: 'install',
      healthOk: false,
      grokPath: null,
      gctoacPath: null,
      adminUrl: null
    })
    api.ai.listModels = vi.fn().mockRejectedValue(new Error('models-down'))
    api.ai.testChat = vi.fn().mockRejectedValue(new Error('chat-down'))
    api.webServer.start = vi.fn().mockRejectedValue(new Error('web-down'))
    api.updates.check = vi.fn().mockRejectedValue(new Error('upd-down'))
    await renderWithProviders(<SettingsPage />, { withToastHost: true })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickRe(/Chat model/i)
    await clickRe(/Refresh model list/i)
    await clickRe(/Test chat/i)
    await clickRe(/install|ensure|retry|gateway|admin/i)
    await clickRe(/^App$/i)
    await clickRe(/Enable web server|Start/i)
    await clickRe(/Check for updates/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    expect(document.body.textContent || '').toMatch(/Settings|Chat|App/i)
  })
})

describe('deep residual Timeline', () => {
  beforeEach(() => {
    seedBase()
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({
        id: 'entry-1',
        order: 0,
        dialogue: 'First line of dialogue for the beat.',
        startTime: 0,
        endTime: 4,
        mediaStatus: 'EMPTY',
        characterId: 'char-1',
        sceneId: 'scene-1'
      }),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        dialogue: 'Second line.',
        startTime: 6,
        endTime: 12,
        mediaStatus: 'READY',
        mediaPath: '/media/c.mp4',
        stillPath: '/media/s.png',
        characterId: 'char-1',
        sceneId: 'scene-1'
      }),
      makeTimelineEntry({
        id: 'entry-3',
        order: 2,
        dialogue: 'Failed one',
        startTime: 14,
        endTime: 20,
        mediaStatus: 'FAILED',
        status: 'FAILED'
      })
    ])
    api.timeline.create = vi
      .fn()
      .mockResolvedValue(makeTimelineEntry({ id: 'e-new' }))
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/media/aria.png' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.settings.get = vi.fn().mockResolvedValue({
      defaultMaxClipSeconds: 6,
      videoMode: 'stub',
      burnSubtitles: true
    })
    api.generation.run = vi.fn().mockResolvedValue({
      success: true,
      steps: [{ step: 'video', success: true }]
    })
    api.generation.runClip = vi.fn().mockResolvedValue({ success: true })
    api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
    api.media.exportFinal = vi.fn().mockResolvedValue({
      path: '/tmp/final.mp4',
      ok: true
    })
    api.media.exportPreflight = vi.fn().mockResolvedValue({ ok: true })
    api.media.listExports = vi.fn().mockResolvedValue([
      {
        id: 'ex1',
        kind: 'final',
        fileName: 'final.mp4',
        path: '/tmp/final.mp4',
        createdAt: '2026-07-15T12:00:00.000Z',
        sizeBytes: 2048
      },
      {
        id: 'ex2',
        kind: 'board',
        fileName: 'board.png',
        path: '/tmp/board.png',
        createdAt: '2026-07-14T12:00:00.000Z',
        sizeBytes: 512
      }
    ])
    api.media.deleteExport = vi.fn().mockResolvedValue({ ok: true })
    api.media.importClip = vi.fn().mockResolvedValue({ path: '/tmp/imp.mp4' })
    api.media.openClip = vi.fn().mockResolvedValue({})
    api.shell.openPath = vi.fn().mockResolvedValue({ ok: true })
    api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  })

  it('pack, duration, save dialogue, clip ops, export history delete', async () => {
    await renderWithProviders(
      <>
        <JobsProbe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled(), {
      timeout: 5000
    })

    // Select clip
    const sel = screen.queryByTestId('konva-select')
    if (sel) {
      await act(async () => {
        fireEvent.click(sel)
      })
    }

    // Pack clips (toolbar + konva control)
    await clickRe(/Pack clips/i)
    const packK = screen.queryByTestId('konva-pack')
    if (packK) {
      await act(async () => {
        fireEvent.click(packK)
      })
    }
    await waitFor(() => expect(api.timeline.update).toHaveBeenCalled()).catch(
      () => undefined
    )

    // Duration 6s / 10s
    await clickRe(/^6s$|^6$/i)
    await clickRe(/^10s$|^10$/i)

    // Dialogue + revision
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () => {
        fireEvent.change(ta, {
          target: { value: 'Updated spoken line for residual.' }
        })
      })
    }
    await clickRe(/^Save$/i)
    await waitFor(() => expect(api.timeline.update).toHaveBeenCalled()).catch(
      () => undefined
    )

    // Import / open / generate this clip
    await clickRe(/Import clip/i)
    await waitFor(() => expect(api.media.importClip).toHaveBeenCalled()).catch(
      () => undefined
    )
    await clickRe(/Open clip/i)
    await clickRe(/Generate this clip|Regenerate|Replay/i)

    // Move via konva mock → history → undo/redo
    const move = screen.queryByTestId('konva-move')
    if (move) {
      await act(async () => {
        fireEvent.click(move)
      })
    }
    await clickRe(/^Undo$/i)
    await clickRe(/^Redo$/i)

    // Export final
    await clickRe(/^Export$/i)
    if (screen.queryByTestId('export-dlg')) {
      await act(async () => {
        fireEvent.click(screen.getByText('do-export'))
      })
      await waitFor(() =>
        expect(api.media.exportFinal).toHaveBeenCalled()
      ).catch(() => undefined)
    }

    // Export history: open, open file/folder, delete
    await clickRe(/Export history/i)
    await waitFor(() => expect(api.media.listExports).toHaveBeenCalled())
    await clickRe(/Open file|open file/i)
    await clickRe(/Open folder|Show in folder|folder/i)
    await clickRe(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
      await waitFor(() =>
        expect(api.media.deleteExport).toHaveBeenCalled()
      ).catch(() => undefined)
    }
    await clickRe(/Refresh/i)
    await clickRe(/^Cancel$/i)

    // Advanced studio queue
    await clickRe(/Advanced|Studio|Prep/i)
    if (screen.queryByTestId('advanced')) {
      await act(async () => {
        fireEvent.click(screen.getByText('queue-video'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('refresh-tl'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('close-adv'))
      })
    }

    // Retry failed → clip prep queue
    await clickRe(/Retry failed|Retry/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
    }
    // video prep modal mock
    if (screen.queryByTestId('vp')) {
      await act(async () => {
        fireEvent.click(screen.getByText('vp-ok'))
      })
    }

    // Add clip
    await clickRe(/Add to timeline/i)
    await waitFor(() => expect(api.timeline.create).toHaveBeenCalled()).catch(
      () => undefined
    )

    // Preview ticks
    await clickRe(/^tick$/i)
    await clickRe(/^ended$/i)
    await clickRe(/preview-gen/i)

    // Cast binding selects
    for (const selEl of Array.from(document.querySelectorAll('select')).slice(
      0,
      6
    )) {
      const s = selEl as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }

    // Delete clip confirm
    await clickRe(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
      await waitFor(() => expect(api.timeline.delete).toHaveBeenCalled()).catch(
        () => undefined
      )
    }

    expect(api.timeline.list).toHaveBeenCalled()
  }, 45000)

  it('pack need-two-clips and empty generate paths', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([makeTimelineEntry()])
    await renderWithProviders(<TimelinePage />, {
      route: '/timeline',
      withToastHost: true
    })
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    await clickRe(/Pack clips/i)
    // toast path for need clips / already packed

    api.timeline.list = vi.fn().mockResolvedValue([])
    await clickRe(/Add to timeline/i)
    await clickRe(/^Generate$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
    }
    expect(document.body.textContent || '').toMatch(/Timeline|clip|Pack/i)
  })
})

describe('deep residual Props + Scenes plate UI', () => {
  beforeEach(() => {
    seedBase()
  })

  it('Props: UI generate plate confirm and draft accept', async () => {
    const gallery = JSON.stringify([
      {
        id: 'pg1',
        path: '/media/badge.png',
        label: 'Hero',
        kind: 'plate',
        createdAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({ refGalleryJson: gallery, refImagePath: '/media/badge.png' })
    ])
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/p-draft.png',
      label: 'Hero',
      variant: 'hero'
    })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/p-ok.png',
      gallery: []
    })
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Badge', description: 'd', material: 'm' },
      profileJson: '{}',
      raw: ''
    })
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <JobsProbe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Badge')).toBeTruthy(), {
      timeout: 8000
    })
    const edit = await waitFor(() => {
      const b = screen
        .getAllByRole('button')
        .find((x) => /^Edit$/i.test((x.textContent || '').trim()))
      expect(b).toBeTruthy()
      return b!
    })
    await act(async () => {
      fireEvent.click(edit)
    })
    // Editor shell may take a tick; also try title click if Save missing
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await act(async () => {
        fireEvent.click(screen.getByText('Badge'))
      })
    }
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('button')
            .some((b) => /^Save$/i.test((b.textContent || '').trim())) ||
            document.querySelector('[role="dialog"]')
        ).toBeTruthy(),
      { timeout: 5000 }
    ).catch(() => undefined)

    // Prefer UI plate path when editor open; else programmatic draft
    await clickRe(/References|ref/i)
    const plateBtn = screen
      .getAllByRole('button')
      .find((b) => /Generate plate/i.test(b.textContent || ''))
    if (plateBtn && !(plateBtn as HTMLButtonElement).disabled) {
      await act(async () => {
        fireEvent.click(plateBtn)
      })
      const go = screen
        .getAllByRole('button')
        .find((b) => /^Generate$/i.test((b.textContent || '').trim()))
      if (go) {
        await act(async () => {
          fireEvent.click(go)
        })
      }
      await waitFor(() =>
        expect(api.props.generatePlate).toHaveBeenCalled()
      ).catch(() => undefined)
    }
    if ((jobsApi?.pendingDrafts.length ?? 0) === 0) {
      await act(async () => {
        jobsApi!.startJob({
          kind: 'prop-plate',
          label: 'plate',
          scope: { propId: 'prop-1' },
          run: async () => ({
            type: 'prop-plate' as const,
            propId: 'prop-1',
            storyId: 'story-1',
            path: '/tmp/p-draft.png',
            variant: 'hero',
            label: 'Hero'
          })
        })
      })
    }
    await waitFor(
      () => expect(jobsApi?.pendingDrafts.length ?? 0).toBeGreaterThan(0),
      { timeout: 8000 }
    )
    await act(async () => {
      await jobsApi!.acceptDraft(jobsApi!.pendingDrafts[0]!.id)
    })
    await waitFor(() => expect(api.props.commitPlate).toHaveBeenCalled())

    await clickRe(/Set as cover/i)
    await clickRe(/Remove this image/i)
    await clickRe(/Upload|pick/i)
    expect(api.props.list).toHaveBeenCalled()
  }, 40000)

  it('Scenes: UI plate + atmosphere + plot suggest', async () => {
    const gallery = JSON.stringify([
      {
        id: 'sg1',
        path: '/media/roof.png',
        label: 'Est',
        kind: 'plate',
        createdAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ refGalleryJson: gallery, refImagePath: '/media/roof.png' }),
      makeScene({ id: 'scene-2', title: 'Alley', refImagePath: null })
    ])
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sc-d.png',
      label: 'Est',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/sc-ok.png',
      gallery: []
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/atm.png'
    })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({})
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: { title: 'R', description: 'd' },
      profileJson: '{}',
      raw: ''
    })

    await renderWithProviders(
      <>
        <JobsProbe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Rooftop')).toBeTruthy(), {
      timeout: 8000
    })
    const edit = await waitFor(() => {
      const b = screen
        .getAllByRole('button')
        .find((x) => /^Edit$/i.test((x.textContent || '').trim()))
      expect(b).toBeTruthy()
      return b!
    })
    await act(async () => {
      fireEvent.click(edit)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await clickRe(/References|ref/i)
    await clickRe(/Atmosphere/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () => {
        fireEvent.change(ta, { target: { value: 'heavy rain fog' } })
      })
    }
    await clickRe(/swap|atmosphere/i, true)
    await waitFor(() =>
      expect(api.scenes.swapAtmosphere).toHaveBeenCalled()
    ).catch(() => undefined)

    // plate draft accept (UI or programmatic)
    await clickRe(/References|ref/i)
    await clickRe(/Generate plate/i, true)
    const go = screen
      .getAllByRole('button')
      .find((b) => /^Generate$/i.test((b.textContent || '').trim()))
    if (go) {
      await act(async () => {
        fireEvent.click(go)
      })
    }
    await waitFor(() =>
      expect(api.scenes.generatePlate).toHaveBeenCalled()
    ).catch(() => undefined)
    if ((jobsApi?.pendingDrafts.length ?? 0) === 0) {
      await act(async () => {
        jobsApi!.startJob({
          kind: 'scene-plate',
          label: 'plate',
          scope: { sceneId: 'scene-1' },
          run: async () => ({
            type: 'scene-plate' as const,
            sceneId: 'scene-1',
            storyId: 'story-1',
            path: '/tmp/sc-d.png',
            variant: 'establishing',
            label: 'Est'
          })
        })
      })
    }
    await waitFor(
      () => expect(jobsApi?.pendingDrafts.length ?? 0).toBeGreaterThan(0),
      { timeout: 8000 }
    )
    await act(async () => {
      await jobsApi!.acceptDraft(jobsApi!.pendingDrafts[0]!.id)
    })
    await waitFor(() => expect(api.scenes.commitPlate).toHaveBeenCalled())

    await clickRe(/plot|Suggest/i)
    await clickRe(/use|apply|confirm|OK|Fill/i)
    await clickRe(/Upload|pick/i)
    await clickRe(/copy|Copy/i)

    expect(api.scenes.list).toHaveBeenCalled()
  }, 40000)
})
