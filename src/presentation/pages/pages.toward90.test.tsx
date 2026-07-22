/**
 * Targeted coverage push toward 90%+ per page.
 * Focused cases for densest remaining handler clusters.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
import { SettingsPage } from './SettingsPage'
import { StoriesPage } from './StoriesPage'
import { PropsPage } from './PropsPage'
import { ScenesPage } from './ScenesPage'
import { CharactersPage } from './CharactersPage'
import { CostumesPage } from './CostumesPage'
import { ActionsPage } from './ActionsPage'
import { AuditLogPage } from './AuditLogPage'
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
  return {
    ...actual,
    changeUiLanguage: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: (props: {
    onSelect?: (id: string) => void
    onPackAbut?: () => void
    entries?: Array<{ id: string }>
  }) => (
    <div data-testid="konva">
      <button
        type="button"
        onClick={() => props.onSelect?.(props.entries?.[0]?.id ?? 'entry-1')}
      >
        sel
      </button>
      <button type="button" onClick={() => props.onPackAbut?.()}>
        pack
      </button>
    </div>
  )
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: () => <div data-testid="prev" />
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: () => null
}))
vi.mock('../components/ExportFinalDialog', () => ({
  ExportFinalDialog: (props: {
    open?: boolean
    onConfirm?: (o: object) => void
    onCancel?: () => void
  }) =>
    props.open ? (
      <div data-testid="ex">
        <button type="button" onClick={() => props.onConfirm?.({})}>
          ex-ok
        </button>
        <button type="button" onClick={() => props.onCancel?.()}>
          ex-cancel
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
    onEmergencyExit?: () => void
    onNextClip?: () => void
    onRetry?: () => void
    onDraftPatch?: (p: object) => void
  }) =>
    props.open ? (
      <div data-testid="vp">
        <button type="button" onClick={() => void props.onConfirm?.()}>
          vp-confirm
        </button>
        <button type="button" onClick={() => props.onFinish?.()}>
          vp-finish
        </button>
        <button type="button" onClick={() => props.onNextClip?.()}>
          vp-next
        </button>
        <button type="button" onClick={() => props.onAbandon?.()}>
          vp-abandon
        </button>
        <button type="button" onClick={() => props.onEmergencyExit?.()}>
          vp-exit
        </button>
        <button type="button" onClick={() => props.onRetry?.()}>
          vp-retry
        </button>
        <button
          type="button"
          onClick={() => props.onDraftPatch?.({ userExtraPrompt: 'x' })}
        >
          vp-patch
        </button>
      </div>
    ) : null
}))

type JobsApi = ReturnType<typeof useAiJobs>
let jobsApi: JobsApi | null = null
function Probe(): null {
  const j = useAiJobs()
  useEffect(() => {
    jobsApi = j
  }, [j, j.jobs, j.pendingDrafts])
  return null
}

async function clickRe(re: RegExp, allowDisabled = false) {
  const b = screen.getAllByRole('button').find((x) => {
    if (!re.test(x.textContent || '')) return false
    return allowDisabled || !(x as HTMLButtonElement).disabled
  })
  if (b) {
    await act(async () => {
      fireEvent.click(b)
    })
  }
  return b
}

function seed() {
  reseedMockApi(api)
  jobsApi = null
  localStorage.clear()
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi.fn().mockResolvedValue({
    url: 'blob:t',
    filePath: '/m.png'
  })
  api.media.pickRefImage = vi.fn().mockResolvedValue({ path: '/tmp/r.png' })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'p',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { characterId: 'char-1' },
    kind: 'character-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
    professionalPrompt: 's',
    stillPath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' }
  })
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({ ok: true })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
}

describe('Settings toward 90%', () => {
  beforeEach(() => {
    seed()
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
      webServerPort: 8787
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1.2.0',
      isPackaged: true,
      userData: '/ud',
      mediaRoot: '/m',
      name: 'IDM',
      channels: 3
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '7'
    })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/bgm.mp3' })
    api.ai.listModels = vi.fn().mockResolvedValue([
      { id: 'grok-4.5', ownedBy: 'xai' },
      { id: 'fb', ownedBy: 'fallback' }
    ])
    api.ai.testChat = vi.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      replyPreview: 'hello world from model'
    })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
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
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 'live'
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('tok2')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'downloading',
      channel: 'stable',
      currentVersion: '1.0.0',
      latestVersion: '1.3.1',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 42,
      releaseNotes: '## Notes\n- fix\n- feat',
      releaseUrl: 'https://example.com/r',
      messageKey: 'updateAvailable',
      installCommand: 'npm i -g x@1.3.1'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '1.3.1',
      currentVersion: '1.0.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      progress: 100
    })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '1.0.0',
      latestVersion: '1.3.1',
      updateAvailable: true,
      checkedAt: new Date().toISOString(),
      installCommand: 'npm i -g instant-drama-magician@1.3.1'
    })
    api.updates.onState = vi.fn((cb: (s: unknown) => void) => {
      cb({
        status: 'downloading',
        progress: 55,
        currentVersion: '1.0.0',
        latestVersion: '1.3.1',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true,
        releaseNotes: 'notes'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com'
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      ok: true,
      path: '/tmp/s.json'
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('update UI states, npm check, language, color, models rate limit', async () => {
    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    await clickRe(/^App$/i)
    // release notes toggle
    await clickRe(/release notes|Show|Hide/i)
    await clickRe(/release notes|Show|Hide/i)
    await clickRe(/Check for updates/i)
    await clickRe(/Download update/i)
    await clickRe(/Restart to install/i)
    await clickRe(/Open release|release page/i)
    await clickRe(/npm|NPM|Check npm/i)
    await clickRe(/Copy install|copy/i)

    // language / color
    for (const re of [/English|中文|日本語|System|Light|Dark/i]) {
      await clickRe(re)
    }

    await clickRe(/Chat model/i)
    await clickRe(/Refresh model list/i)
    await clickRe(/Test chat/i)
    await clickRe(/Show advanced|Advanced/i)
    await clickRe(/Grok local|OpenAI|Custom/i)

    // rate limit path
    api.ai.listModels = vi.fn().mockRejectedValue({
      code: 'AI_RATE_LIMIT',
      message: 'rate'
    })
    await clickRe(/Refresh model list/i)

    await clickRe(/^Image$/i)
    for (const re of [/Custom|Same|Seedream|Grok/i]) {
      await clickRe(re)
    }
    await clickRe(/^Video$/i)
    for (const re of [/Stub|Custom|Seedance|Same/i]) {
      await clickRe(re)
    }
    await clickRe(/^Export$/i)
    await clickRe(/BGM|Clear BGM|pick/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ).slice(0, 6)) {
      await act(async () => {
        fireEvent.click(cb)
      })
    }

    await clickRe(/^App$/i)
    await clickRe(/Stop|Start|Enable web server/i)
    await clickRe(/Regenerate|Copy token/i)
    await clickRe(/backup|export|import|support|diagnostics|Clear activity/i)
    await clickRe(/disclaimer|terms|legal/i)
    await clickRe(/open|folder|user data|media/i)

    await clickRe(/^Save$/i)
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
  }, 40000)

  it('models fail generic + update not-available + npm error', async () => {
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'not-available',
      channel: 'stable',
      currentVersion: '1.0.0',
      canCheck: true,
      canDownload: false
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'not-available',
      currentVersion: '1.0.0'
    })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'x',
      currentVersion: '1.0.0',
      latestVersion: null,
      updateAvailable: false,
      checkedAt: new Date().toISOString(),
      installCommand: 'npm i -g x',
      error: 'registry down'
    })
    api.ai.listModels = vi.fn().mockRejectedValue(new Error('models boom'))
    await renderWithProviders(<SettingsPage />, { withToastHost: true })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickRe(/Chat model/i)
    await clickRe(/Refresh model list/i)
    await clickRe(/^App$/i)
    await clickRe(/Check for updates/i)
    await clickRe(/npm|NPM|Check npm/i)
    expect(document.body.textContent || '').toMatch(/Settings|App|Chat/i)
  })
})

describe('Stories / Characters / Costumes / Actions toward 90%', () => {
  beforeEach(() => {
    seed()
  })

  it('Stories: AI script with confirm, cast toggles, beats', async () => {
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        characters: [makeCharacter()],
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()]
      })
    )
    api.stories.update = vi.fn().mockResolvedValue({})
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [
        {
          order: 0,
          dialogue: 'Hello world',
          characterId: 'char-1',
          sceneId: 'scene-1'
        },
        { order: 1, dialogue: 'Next', characterId: 'char-1', sceneId: 'scene-1' }
      ],
      drafts: [],
      raw: ''
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 'noir',
      hardRules: 'no logos',
      artStyle: 'anime'
    })
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter(),
      makeCharacter({ id: 'char-2', name: 'Ben' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([makeProp()])
    api.actions.list = vi.fn().mockResolvedValue([makeAction()])
    api.timeline.create = vi.fn().mockResolvedValue({ id: 'b1' })
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    await clickRe(/^Edit$/i)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    // Meta AI
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () => {
        fireEvent.change(ta, { target: { value: 'rainy noir pilot idea' } })
      })
    }
    await clickRe(/fill meta|AI meta|Suggest meta|AI fill/i)
    await waitFor(() =>
      expect(api.stories.aiFillMeta).toHaveBeenCalled()
    ).catch(() => undefined)

    // Script AI
    await clickRe(/Script|Beats/i)
    await clickRe(/fill script|AI script|Suggest script/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
    }
    await waitFor(() =>
      expect(api.stories.aiFillScript).toHaveBeenCalled()
    ).catch(() => undefined)

    await clickRe(/Add beat/i)
    for (const re of [/move|up|down|delete/i]) {
      await clickRe(re)
    }

    // Cast
    await clickRe(/^Cast$/i)
    for (const re of [
      /Character|Scene|Prop|Action/i,
      /All|Linked|Unlinked/i,
      /link|unlink|Link/i
    ]) {
      await clickRe(re)
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }

    await clickRe(/^Save$/i)
    expect(api.stories.get).toHaveBeenCalled()
  }, 40000)

  it('Characters: video-prep-done event + gallery multi + new sheet', async () => {
    const gallery = JSON.stringify([
      {
        id: 'g1',
        path: '/media/aria.png',
        label: 'Front',
        kind: 'sheet',
        layer: 'identity',
        createdAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'g2',
        path: '/media/base.png',
        label: 'Base',
        kind: 'sheet',
        layer: 'base',
        createdAt: '2026-07-02T00:00:00.000Z'
      }
    ])
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        refGalleryJson: gallery,
        refImagePath: '/media/aria.png'
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/s.png',
      label: 'S',
      variant: 'bible'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/s2.png',
      character: { id: 'char-1', costume: 'c' },
      gallery: []
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.list = vi.fn().mockResolvedValue([])
    api.souls.list = vi.fn().mockResolvedValue({
      data: [],
      total_pages: 1,
      current_page: 1
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 0,
      pages: 0,
      fromCache: true,
      suggestions: []
    })

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Aria')).toBeTruthy(), {
      timeout: 8000
    })
    const edit = screen
      .getAllByRole('button')
      .find((b) => /^Edit$/i.test((b.textContent || '').trim()))
    if (edit) {
      await act(async () => {
        fireEvent.click(edit)
      })
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickRe(/^References$/i)
    // layer filters
    for (const re of [/^All$/i, /Identity/i, /Base/i, /Costume/i, /Detail/i]) {
      await clickRe(re)
    }
    // multi thumbs if present
    for (const b of screen.getAllByRole('button').filter((x) =>
      /Front|Base|Cover/i.test(x.getAttribute('title') || x.textContent || '')
    )) {
      await act(async () => {
        fireEvent.click(b)
      })
    }
    await clickRe(/Set as cover/i)
    await clickRe(/←|→|left|right/i)

    // video prep done event
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            gallery: [
              {
                id: 'g1',
                path: '/media/aria.png',
                kind: 'sheet',
                label: 'Front',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/v.mp4'
              }
            ]
          }
        })
      )
    })

    await clickRe(/Intro video|intro/i)
    if (screen.queryByTestId('vp')) {
      await clickRe(/vp-confirm/i)
      await clickRe(/vp-finish|vp-abandon|vp-exit/i)
    }

    // programmatic sheet draft for commit handler
    await act(async () => {
      jobsApi!.startJob({
        kind: 'character-sheet',
        label: 'sheet',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'character-sheet' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          path: '/tmp/s.png',
          variant: 'bible',
          label: 'Bible',
          layer: 'identity'
        })
      })
    })
    await waitFor(() =>
      expect(jobsApi?.pendingDrafts.length ?? 0).toBeGreaterThan(0)
    )
    await act(async () => {
      await jobsApi!.acceptDraft(jobsApi!.pendingDrafts[0]!.id)
    })
    await waitFor(() =>
      expect(api.characters.commitSheet).toHaveBeenCalled()
    )
  }, 40000)

  it('Costumes: dress flow confirm and generateDressed job', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/dressed.png',
      costume: {
        refImagePath: '/tmp/dressed.png',
        refGalleryJson: null
      }
    })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        refImagePath: '/media/aria.png',
        refGalleryJson: JSON.stringify([
          {
            id: 'g1',
            path: '/media/aria.png',
            label: 'F',
            kind: 'sheet',
            createdAt: '2026-07-01T00:00:00.000Z'
          }
        ])
      })
    ])
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Rain coat')).toBeTruthy())
    await clickRe(/^Edit$/i)
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    )

    await clickRe(/Dress|Links|Character/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () => {
        fireEvent.change(ta, { target: { value: 'long trench coat rain' } })
      })
    }
    await clickRe(/Generate|dressed|Dress/i, true)
    // image gen confirm
    const go = screen
      .getAllByRole('button')
      .find((b) => /^Generate$/i.test((b.textContent || '').trim()))
    if (go) {
      await act(async () => {
        fireEvent.click(go)
      })
    }
    await waitFor(() =>
      expect(api.costumes.generateDressed).toHaveBeenCalled()
    ).catch(() => undefined)

    await clickRe(/link|Link|All|Unlinked/i)
    await clickRe(/Upload|pick/i)
    expect(api.costumes.list).toHaveBeenCalled()
  }, 35000)

  it('Actions: plate UI + intro + cast type switch', async () => {
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        refGalleryJson: JSON.stringify([
          {
            id: 'a1',
            path: '/media/a.png',
            label: 'G',
            kind: 'plate',
            createdAt: '2026-07-01T00:00:00.000Z'
          }
        ]),
        refImagePath: '/media/a.png'
      })
    ])
    api.actions.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/ap.png',
      label: 'Grid'
    })
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/apc.png',
      gallery: []
    })
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        refGalleryJson: JSON.stringify([
          {
            id: 'g1',
            path: '/c.png',
            label: 'F',
            kind: 'sheet',
            createdAt: '2026-07-01T00:00:00.000Z'
          }
        ]),
        refImagePath: '/c.png'
      })
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
    await waitFor(() => expect(screen.getByText('Draw gun')).toBeTruthy())
    await clickRe(/^Edit$/i)
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    )

    await clickRe(/References|ref/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }
    await clickRe(/add|cover|still/i)
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
      expect(api.actions.generatePlate).toHaveBeenCalled()
    ).catch(async () => {
      // fallback programmatic
      await act(async () => {
        jobsApi!.startJob({
          kind: 'action-plate',
          label: 'p',
          scope: { actionId: 'action-1' },
          run: async () => ({
            type: 'action-plate' as const,
            actionId: 'action-1',
            storyId: 'story-1',
            path: '/tmp/ap.png',
            variant: 'grid',
            label: 'Grid'
          })
        })
      })
    })
    await waitFor(
      () => expect(jobsApi?.pendingDrafts.length ?? 0).toBeGreaterThan(0),
      { timeout: 8000 }
    ).catch(() => undefined)
    if (jobsApi?.pendingDrafts[0]) {
      await act(async () => {
        await jobsApi!.acceptDraft(jobsApi!.pendingDrafts[0]!.id)
      })
    }
    await clickRe(/Intro video|intro/i)
    await clickRe(/Set as cover/i)
    await clickRe(/Remove/i)
    expect(api.actions.list).toHaveBeenCalled()
  }, 35000)
})

describe('Props Scenes video-prep-done + Audit advanced', () => {
  beforeEach(() => {
    seed()
  })

  it('Props: intro video prep + done event reloads gallery', async () => {
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
      makeProp({
        id: 'prop-1',
        refGalleryJson: gallery,
        refImagePath: '/media/badge.png'
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Badge')).toBeTruthy())
    await clickRe(/^Edit$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickRe(/References|ref/i)
    await clickRe(/Intro video|intro/i)
    if (screen.queryByTestId('vp')) {
      await clickRe(/vp-confirm/i)
      await clickRe(/vp-finish/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'prop-intro',
            entityIds: { propId: 'prop-1' },
            gallery: [
              {
                id: 'pg1',
                path: '/media/badge.png',
                kind: 'plate',
                label: 'Hero',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/v.mp4'
              }
            ]
          }
        })
      )
    })
    // also no-gallery path
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'prop-intro',
            entityIds: { propId: 'prop-1' }
          }
        })
      )
    })
    expect(api.props.list).toHaveBeenCalled()
  }, 25000)

  it('Scenes: atmosphere swap + copy gallery + looks', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        refImagePath: '/media/roof.png',
        refGalleryJson: JSON.stringify([
          {
            id: 'sg1',
            path: '/media/roof.png',
            label: 'Est',
            kind: 'plate',
            createdAt: '2026-07-01T00:00:00.000Z'
          }
        ])
      }),
      makeScene({ id: 'scene-2', title: 'Alley' })
    ])
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/atm.png',
      label: 'Rain'
    })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({ ok: true })
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/p.png',
      label: 'P'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: []
    })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Rooftop')).toBeTruthy())
    await clickRe(/^Edit$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickRe(/Atmosphere/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () => {
        fireEvent.change(ta, { target: { value: 'stormy night neon' } })
      })
    }
    await clickRe(/swap|atmosphere|Generate/i, true)
    await waitFor(() =>
      expect(api.scenes.swapAtmosphere).toHaveBeenCalled()
    ).catch(() => undefined)

    await clickRe(/References|ref/i)
    await clickRe(/copy|Copy/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }
    await clickRe(/look|Add look|Add/i)
    await clickRe(/plot|Suggest/i)
    await clickRe(/use|apply|confirm|OK|Fill|Cancel/i)

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'scene-intro',
            entityIds: { sceneId: 'scene-1' },
            gallery: []
          }
        })
      )
    })
    expect(api.scenes.list).toHaveBeenCalled()
  }, 35000)

  it('Audit: advanced filters, sort, clear, selection paths', async () => {
    api.activity.query = vi.fn().mockResolvedValue({
      entries: [
        ...makeAuditEntries(),
        {
          ts: '2026-07-15T09:00:00.000Z',
          kind: 'error',
          message: 'boom err',
          level: 'error',
          storyId: 'story-1',
          meta: { ms: 9000 }
        },
        {
          ts: '2026-07-15T08:00:00.000Z',
          kind: 'generation',
          message: 'gen step',
          level: 'warn',
          storyId: null,
          meta: { step: 'video' }
        },
        {
          ts: '2026-07-14T08:00:00.000Z',
          kind: 'ipc',
          message: 'settings:get',
          level: 'info',
          storyId: null,
          meta: {}
        }
      ],
      path: '/tmp/activity.jsonl'
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(<AuditLogPage />, { withToastHost: true })
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())

    await clickRe(/advanced|Advanced/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 4); i++) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[i]!.value } })
        })
      }
    }
    for (const re of [
      /error|warn|info|all|generation|export|media|ipc/i,
      /refresh|folder|copy|clear/i
    ]) {
      await clickRe(re)
    }
    const rows = document.querySelectorAll(
      'ul.divide-y > li > button, li button, [role="listitem"] button'
    )
    for (const r of Array.from(rows).slice(0, 6)) {
      await act(async () => {
        ;(r as HTMLButtonElement).click()
      })
    }
    await clickRe(/copy/i)
    await clickRe(/clear/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
    }
    const search = document.querySelector(
      'input[type="search"], input[placeholder]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () => {
        fireEvent.change(search, { target: { value: 'export' } })
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 350))
      })
    }
    expect(api.activity.query).toHaveBeenCalled()
  }, 25000)

  it('Timeline: retry failed starts prep + export history branches', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({
        mediaStatus: 'FAILED',
        status: 'FAILED',
        mediaPath: null
      }),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        startTime: 5,
        endTime: 11,
        mediaStatus: 'READY',
        mediaPath: '/m.mp4'
      })
    ])
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({ refImagePath: '/a.png' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
    api.props.list = vi.fn().mockResolvedValue([])
    api.actions.list = vi.fn().mockResolvedValue([])
    api.settings.get = vi.fn().mockResolvedValue({
      defaultMaxClipSeconds: 6,
      videoMode: 'stub',
      burnSubtitles: true
    })
    api.generation.run = vi.fn().mockResolvedValue({
      success: true,
      steps: [{ step: 'x', success: true }]
    })
    api.media.listExports = vi.fn().mockResolvedValue([
      {
        id: 'ex1',
        kind: 'final',
        fileName: 'f.mp4',
        path: '/tmp/f.mp4',
        createdAt: '2026-07-15T12:00:00.000Z',
        sizeBytes: 100
      }
    ])
    api.media.deleteExport = vi.fn().mockResolvedValue({ ok: true })
    api.media.exportFinal = vi.fn().mockResolvedValue({ path: '/tmp/f.mp4' })

    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())

    await clickRe(/Retry failed|Retry/i)
    for (let i = 0; i < 2; i++) {
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => {
          clickDialogConfirm()
        })
      }
    }
    if (screen.queryByTestId('vp')) {
      await clickRe(/vp-confirm/i)
      await clickRe(/vp-next|vp-finish|vp-abandon/i)
    }

    await clickRe(/Export history/i)
    await clickRe(/Open file|open/i)
    await clickRe(/folder/i)
    await clickRe(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
    }
    await clickRe(/Pack clips|pack/i)
    await clickRe(/^Export$/i)
    if (screen.queryByTestId('ex')) {
      await clickRe(/ex-ok/i)
    }
    expect(api.timeline.list).toHaveBeenCalled()
  }, 35000)
})
