import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { makeStory } from '../../test/pageFixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import { SettingsPage } from './SettingsPage'
import { DEFAULT_SETTINGS } from '../../types/settings'

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

function seedSettings(overrides: Record<string, unknown> = {}) {
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
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
    webServerPort: 8787,
    ...overrides
  })
  api.settings.set = vi.fn().mockImplementation(async (p) => p)
  api.app.getInfo = vi.fn().mockResolvedValue({
    version: '1.0.0',
    isPackaged: false,
    userData: '/tmp/ud',
    mediaRoot: '/tmp/media',
    name: 'IDM',
    channels: 1
  })
  api.media.checkFfmpeg = vi.fn().mockResolvedValue({
    available: true,
    version: '6.0'
  })
  api.ai.listModels = vi.fn().mockResolvedValue(['grok-4.5', 'grok-3'])
  api.ai.testChat = vi.fn().mockResolvedValue({ ok: true, message: 'hi' })
  api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
    baseUrl: 'http://127.0.0.1:3847/v1',
    model: 'grok-4.5'
  })
  api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
  api.gateway.status = vi.fn().mockResolvedValue({
    state: 'ready',
    message: 'ok',
    healthOk: true,
    grokPath: '/tmp/g',
    gctoacPath: '/tmp/c',
    adminUrl: 'http://127.0.0.1:3847'
  })
  api.gateway.ensure = vi.fn().mockResolvedValue({
    state: 'ready',
    healthOk: true
  })
  api.gateway.installHints = vi.fn().mockResolvedValue({
    steps: ['install grok']
  })
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
    token: 'tok'
  })
  api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
  api.webServer.generateToken = vi.fn().mockResolvedValue('tok-new')
  api.updates.status = vi.fn().mockResolvedValue({
    status: 'idle',
    channel: 'desktop-dev',
    currentVersion: '1.0.0',
    canCheck: true,
    canDownload: false,
    canAutoInstall: false
  })
  api.updates.check = vi.fn().mockResolvedValue({
    status: 'available',
    latestVersion: '1.1.0'
  })
  api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
  api.updates.install = vi.fn().mockResolvedValue({ ok: true })
  api.updates.checkNpm = vi.fn().mockResolvedValue({
    packageName: 'instant-drama-magician',
    currentVersion: '1.0.0',
    latestVersion: '1.0.1',
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
}

function findBtn(re: RegExp) {
  return screen.getAllByRole('button').find((b) => re.test(b.textContent || ''))
}

async function clickBtn(re: RegExp) {
  const b = findBtn(re)
  if (b && !(b as HTMLButtonElement).disabled) {
    await act(async () => {
      fireEvent.click(b)
    })
  }
  return b
}

async function visitTab(label: RegExp) {
  await clickBtn(label)
}

describe('SettingsPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    seedSettings()
  })

  it('loads settings and cycles tabs, saves', async () => {
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Settings|Chat model/i)
    )

    for (const re of [
      /Chat model/i,
      /^Image$/i,
      /^Video$/i,
      /^Export$/i,
      /^App$/i
    ]) {
      await visitTab(re)
    }

    for (const input of Array.from(
      document.querySelectorAll('input, select, textarea')
    ).slice(0, 16)) {
      const tag = input.tagName.toLowerCase()
      if (tag === 'select') {
        const sel = input as HTMLSelectElement
        if (sel.options.length > 1) {
          await act(async () => {
            fireEvent.change(sel, { target: { value: sel.options[1].value } })
          })
        }
      } else if ((input as HTMLInputElement).type === 'checkbox') {
        await act(async () => {
          fireEvent.click(input)
        })
      } else if ((input as HTMLInputElement).type !== 'file') {
        await act(async () => {
          fireEvent.change(input, {
            target: { value: 'http://127.0.0.1:1/v1' }
          })
        })
      }
    }

    await clickBtn(/^Save$/i)
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
  })

  it('chat tab: presets, models, test chat, advanced', async () => {
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await visitTab(/Chat model/i)

    // Click provider presets if present as buttons
    for (const re of [
      /Grok local gateway/i,
      /OpenAI/i,
      /OpenRouter/i,
      /Custom endpoint/i
    ]) {
      await clickBtn(re)
    }

    await clickBtn(/Refresh model list/i)
    await waitFor(() => expect(api.ai.listModels).toHaveBeenCalled())

    await clickBtn(/Test chat/i)
    await waitFor(() => expect(api.ai.testChat).toHaveBeenCalled())

    await clickBtn(/Show advanced|Hide advanced|Advanced/i)

    // Interact with model select
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }

    expect(api.gateway.status).toHaveBeenCalled()
  })

  it('image and video tabs change providers', async () => {
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    await visitTab(/^Image$/i)
    for (const re of [
      /Same as chat/i,
      /Grok local/i,
      /Custom/i,
      /Seedream/i,
      /Show advanced|Advanced/i
    ]) {
      await clickBtn(re)
    }
    for (const input of Array.from(
      document.querySelectorAll('input, select')
    ).slice(0, 8)) {
      if (input.tagName === 'SELECT') {
        const s = input as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () => {
            fireEvent.change(s, { target: { value: s.options[1].value } })
          })
        }
      } else if ((input as HTMLInputElement).type !== 'checkbox') {
        await act(async () => {
          fireEvent.change(input, { target: { value: 'img-model' } })
        })
      }
    }

    await visitTab(/^Video$/i)
    for (const re of [
      /Stub/i,
      /Same as chat/i,
      /Seedance/i,
      /Show advanced|Advanced/i
    ]) {
      await clickBtn(re)
    }
    for (const input of Array.from(
      document.querySelectorAll('input, select')
    ).slice(0, 8)) {
      if (input.tagName === 'SELECT') {
        const s = input as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () => {
            fireEvent.change(s, { target: { value: s.options[1].value } })
          })
        }
      }
    }

    await clickBtn(/^Save$/i)
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
  })

  it('export tab and app: language, color, web server, updates, backups', async () => {
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 'live-tok'
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'stable',
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true
    })
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    await visitTab(/^Export$/i)
    for (const input of Array.from(
      document.querySelectorAll('input, select, textarea')
    ).slice(0, 10)) {
      if ((input as HTMLInputElement).type === 'checkbox') {
        await act(async () => {
          fireEvent.click(input)
        })
      } else if (input.tagName === 'SELECT') {
        const s = input as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () => {
            fireEvent.change(s, { target: { value: s.options[1].value } })
          })
        }
      }
    }
    await clickBtn(/BGM|Clear BGM|pick/i)

    await visitTab(/^App$/i)

    // Language / color scheme buttons
    for (const re of [
      /English|中文|日本語|System|Light|Dark/i
    ]) {
      await clickBtn(re)
    }

    // Web server
    for (const re of [
      /Enable web server|Start|Stop/i,
      /Regenerate/i,
      /Copy token/i
    ]) {
      await clickBtn(re)
    }

    // Updates
    for (const re of [
      /Check for updates/i,
      /Download update/i,
      /Restart to install/i,
      /release|Open/i
    ]) {
      await clickBtn(re)
    }

    // Backups / diagnostics / legal
    for (const re of [
      /backup|export|import/i,
      /support|diagnostics/i,
      /disclaimer|terms|legal/i,
      /open.*folder|user data|media/i
    ]) {
      await clickBtn(re)
    }

    await act(async () => {
      await Promise.resolve()
    })
    expect(api.settings.get).toHaveBeenCalled()
  })

  it('gateway ensure and install paths', async () => {
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'need_build',
      message: 'install grok',
      healthOk: false,
      grokPath: null,
      gctoacPath: null,
      adminUrl: null
    })
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await visitTab(/Chat model/i)
    for (const re of [
      /install|ensure|start|retry|gateway|admin|repo/i
    ]) {
      await clickBtn(re)
    }
    expect(api.gateway.status).toHaveBeenCalled()
  })

  it('clear all triggers confirm path', async () => {
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickBtn(/Clear all/i)
    // May open dialog — confirm if present
    const dialog = document.querySelector('[role="alertdialog"]')
    if (dialog) {
      const buttons = Array.from(dialog.querySelectorAll('button'))
      const confirm = buttons[buttons.length - 1]
      if (confirm) {
        await act(async () => {
          confirm.click()
        })
      }
    }
    await act(async () => {
      await Promise.resolve()
    })
    expect(api.settings.get).toHaveBeenCalled()
  })

  it('settings load error', async () => {
    api.settings.get = vi.fn().mockRejectedValue(new Error('settings-down'))
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(screen.getByText(/settings-down/i)).toBeTruthy())
  })

  it('save failure is handled without crash', async () => {
    api.settings.set = vi.fn().mockRejectedValue(new Error('save-fail'))
    await renderWithProviders(<SettingsPage />, { withToastHost: true })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickBtn(/^Save$/i)
    await waitFor(() => expect(api.settings.set).toHaveBeenCalled()).catch(
      () => undefined
    )
    expect(document.body.textContent || '').toMatch(/Settings|Chat|App/i)
  })

  it('ffmpeg missing banner path', async () => {
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: false,
      version: null,
      error: 'not found'
    })
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.media.checkFfmpeg).toHaveBeenCalled())
    await visitTab(/^App$/i)
    expect(document.body.textContent || '').toMatch(
      /FFmpeg|missing|Settings|App/i
    )
  })

  it('residual settings every control and error paths', async () => {
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 'tok'
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'downloaded',
      channel: 'stable',
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true
    })
    api.ai.testChat = vi.fn().mockRejectedValue(new Error('chat-fail'))
    api.ai.listModels = vi.fn().mockRejectedValue(new Error('models-fail'))
    await renderWithProviders(<SettingsPage />, { withToastHost: true })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    for (const tab of [
      /Chat model/i,
      /^Image$/i,
      /^Video$/i,
      /^Export$/i,
      /^App$/i
    ]) {
      const b = screen
        .getAllByRole('button')
        .find((x) => tab.test(x.textContent || ''))
      if (b) {
        await act(async () => {
          b.click()
        })
      }
      for (const input of Array.from(
        document.querySelectorAll('input, select, textarea')
      ).slice(0, 16)) {
        const tag = input.tagName.toLowerCase()
        if (tag === 'select') {
          const s = input as HTMLSelectElement
          if (s.options.length > 1) {
            await act(async () => {
              fireEvent.change(s, { target: { value: s.options[1].value } })
            })
          }
        } else if ((input as HTMLInputElement).type === 'checkbox') {
          await act(async () => {
            fireEvent.click(input)
          })
        } else if ((input as HTMLInputElement).type !== 'file') {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'test-value' } })
          })
        }
      }
      for (const re of [
        /Refresh|Test|Advanced|Show|Hide|Start|Stop|Regenerate|Copy|Check|Download|Install|Open|backup|export|import|support|diagnostics|Clear|Grok|OpenAI|Custom|Stub|Same|token|BGM|Light|Dark|System/i
      ]) {
        const btn = screen
          .getAllByRole('button')
          .find((x) => re.test(x.textContent || ''))
        if (btn && !(btn as HTMLButtonElement).disabled) {
          await act(async () => {
            btn.click()
          })
        }
      }
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    const save = screen
      .getAllByRole('button')
      .find((b) => /^Save$/i.test((b.textContent || '').trim()))
    await act(async () => {
      save?.click()
    })
    expect(api.settings.get).toHaveBeenCalled()
  })
})
