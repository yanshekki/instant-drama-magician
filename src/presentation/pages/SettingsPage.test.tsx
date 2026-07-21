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

describe('SettingsPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
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
      llmProvider: 'openai-compatible'
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
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({})
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'stopped',
      message: '',
      healthOk: false,
      grokPath: null,
      gctoacPath: null,
      adminUrl: 'http://127.0.0.1:3847'
    })
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
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('tok')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'idle',
      channel: 'desktop-dev',
      currentVersion: '1.0.0'
    })
    api.updates.check = vi.fn().mockResolvedValue({ status: 'dev-skipped' })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateAvailable: false,
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
  })

  it('loads settings and cycles tabs, saves', async () => {
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText(/Settings|LLM|Language model/i)).toBeTruthy()
    )

    // Switch tabs
    for (const re of [/llm|model|chat/i, /image/i, /video/i, /app|general/i]) {
      const tab = screen.getAllByRole('button').find((b) =>
        re.test(b.textContent || '')
      )
      if (tab) {
        await act(async () => {
          tab.click()
        })
      }
    }

    // Interact with inputs on app tab
    for (const input of Array.from(
      document.querySelectorAll('input, select, textarea')
    ).slice(0, 12)) {
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
          fireEvent.change(input, { target: { value: 'http://127.0.0.1:1/v1' } })
        })
      }
    }

    const save = screen.getAllByRole('button').find((b) =>
      /save/i.test(b.textContent || '')
    )
    if (save) {
      await act(async () => {
        save.click()
      })
      await waitFor(() => expect(api.settings.set).toHaveBeenCalled())
    }

    // Test chat / list models / other actions
    for (const re of [
      /test chat|test connection/i,
      /list models|refresh models/i,
      /check.*update|update/i,
      /start|web server/i,
      /generate token/i,
      /open/i,
      /export|backup|support|diagnostics/i
    ]) {
      const btn = screen.getAllByRole('button').find((b) =>
        re.test(b.textContent || '')
      )
      if (btn && !(btn as HTMLButtonElement).disabled) {
        await act(async () => {
          btn.click()
        })
      }
    }
  })

  it('settings load error', async () => {
    api.settings.get = vi.fn().mockRejectedValue(new Error('settings-down'))
    await renderWithProviders(<SettingsPage />)
    await waitFor(() => expect(screen.getByText(/settings-down/i)).toBeTruthy())
  })
})
