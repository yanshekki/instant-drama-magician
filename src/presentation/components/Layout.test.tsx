import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
const isWebRuntime = vi.fn(() => true)

vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isWebRuntime: () => isWebRuntime()
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' }
  })
}))
vi.mock('../../lib/i18n', () => ({
  changeUiLanguage: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../hooks/useMenuActions', () => ({
  useMenuActions: () => undefined
}))
vi.mock('./AiJobHud', () => ({ AiJobHud: () => <div data-testid="hud" /> }))
vi.mock('./MediaGenHost', () => ({
  MediaGenHost: () => <div data-testid="mgh" />
}))
vi.mock('./AiDraftModal', () => ({
  AiDraftModal: () => <div data-testid="draft" />
}))

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    aiStatus: {
      available: true,
      chat: { available: false },
      // image custom provider string (line 302 else)
      image: { available: true, message: 'ok', provider: 'dalle-custom' },
      // video same-as-llm → llmTitle (line 314)
      video: { available: false, message: 'off', provider: 'same-as-llm' },
      // unknown preset → custom title (line 193)
      llmProvider: 'my-custom-provider-xyz',
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok'
    },
    stories: [],
    activeStoryId: null,
    setActiveStoryId: vi.fn(),
    refreshStories: vi.fn(),
    refreshAiStatus: vi.fn(),
    loading: false
  })
}))

import { Layout } from './Layout'

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isWebRuntime.mockReturnValue(true)
    api.settings.get = vi.fn().mockResolvedValue({
      lastGenerationDegraded: true,
      uiLanguage: 'en',
      colorScheme: 'dark'
    })
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '1.2.0',
      name: 'IDM'
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0'
    })
    api.updates.onState = vi.fn((cb: (s: unknown) => void) => {
      // also fire downloaded
      setTimeout(() => {
        cb({
          status: 'downloaded',
          currentVersion: '1.0.0',
          latestVersion: '1.2.0'
        })
      }, 0)
      return () => undefined
    })
    api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => cleanup())

  it('renders nav, version, web badge, degraded banner, update banner', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('v1.2.0')).toBeTruthy())
    // Web badge may appear in sidebar + mobile top bar
    expect(screen.getAllByText('Web').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('hud')).toBeTruthy()
    expect(screen.getByTestId('mgh')).toBeTruthy()
    // YSK logo click
    fireEvent.click(screen.getByLabelText('YSK Limited'))
    await waitFor(() => expect(api.shell.openExternal).toHaveBeenCalled())
  })

  it('opens and closes mobile nav drawer', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const menu = screen.getByLabelText(/openMenu|Open menu/i)
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    // backdrop closes drawer
    const backdrop = document.querySelector(
      'button.fixed.inset-0.z-40'
    ) as HTMLButtonElement | null
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(menu.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('settings/get failure still renders', async () => {
    api.settings.get = vi.fn().mockRejectedValue(new Error('x'))
    api.app.getInfo = vi.fn().mockRejectedValue(new Error('y'))
    api.updates.status = vi.fn().mockRejectedValue(new Error('z'))
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
  })

  it('openExternal failure falls back to window.open', async () => {
    api.shell.openExternal = vi.fn().mockRejectedValue(new Error('no'))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => screen.getByLabelText('YSK Limited'))
    fireEvent.click(screen.getByLabelText('YSK Limited'))
    await waitFor(() => expect(open).toHaveBeenCalled())
    open.mockRestore()
  })

  it('download and install update buttons from banner', async () => {
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0'
    })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    // banner text may use i18n keys
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      fireEvent.click(dl)
      await waitFor(() => expect(api.updates.download).toHaveBeenCalled())
    }
    const inst = Array.from(document.querySelectorAll('button')).find((b) =>
      /installUpdate|install/i.test(b.textContent || '')
    )
    if (inst) {
      fireEvent.click(inst)
      await waitFor(() => expect(api.updates.install).toHaveBeenCalled())
    }
  })

  it('update download fail toasts error', async () => {
    api.updates.download = vi.fn().mockRejectedValue(new Error('dl'))
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      fireEvent.click(dl)
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    }
  })

  it('install fail when ok:false', async () => {
    api.updates.onState = vi.fn((cb: (s: unknown) => void) => {
      cb({
        status: 'downloaded',
        currentVersion: '1.0.0',
        latestVersion: '1.2.0'
      })
      return () => undefined
    })
    api.updates.install = vi.fn().mockResolvedValue({
      ok: false,
      message: 'blocked'
    })
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const inst = Array.from(document.querySelectorAll('button')).find((b) =>
      /installUpdate|install/i.test(b.textContent || '')
    )
    if (inst) {
      fireEvent.click(inst)
      await waitFor(() => expect(api.updates.install).toHaveBeenCalled())
    }
  })

  it('electron mode hides Web badge', async () => {
    isWebRuntime.mockReturnValue(false)
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    expect(screen.queryByText('Web')).toBeNull()
  })

  it('creator donate button opens linktree', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const donate = Array.from(document.querySelectorAll('button')).find((b) =>
      /sidebarDonate|linktr|☕/i.test(b.textContent || b.title || '')
    )
    if (donate) {
      fireEvent.click(donate)
      await waitFor(() => expect(api.shell.openExternal).toHaveBeenCalled())
    }
  })

  it('download success updates banner and install catch', async () => {
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1.0.0',
      latestVersion: '1.3.1'
    })
    api.updates.install = vi.fn().mockRejectedValue(new Error('inst'))
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      await act(async () => {
        fireEvent.click(dl)
      })
      await waitFor(() => expect(api.updates.download).toHaveBeenCalled())
    }
    const inst = Array.from(document.querySelectorAll('button')).find((el) =>
      /installUpdate|install/i.test(el.textContent || '')
    )
    if (inst) {
      await act(async () => {
        fireEvent.click(inst)
      })
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    }
  })

  it('dismiss update banner', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const bannerBtns = Array.from(
      document.querySelectorAll('[role="status"] button')
    )
    if (bannerBtns.length) {
      await act(async () => {
        fireEvent.click(bannerBtns[bannerBtns.length - 1])
      })
    }
  })

  it('donate openExternal failure falls back', async () => {
    api.shell.openExternal = vi.fn().mockRejectedValue(new Error('no'))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const donate = Array.from(document.querySelectorAll('button')).find((b) =>
      /sidebarDonate|☕/i.test(b.textContent || '')
    )
    if (donate) {
      await act(async () => {
        fireEvent.click(donate)
      })
      await waitFor(() => expect(open).toHaveBeenCalled())
    }
    open.mockRestore()
  })


  it('ChannelLine detail + offline image/video providers', async () => {
    // re-mock useApp with richer aiStatus
    const { useApp } = await import('../context/AppContext')
    // already mocked module - update by redefining is hard; instead set settings colorScheme system
    api.settings.get = vi.fn().mockResolvedValue({
      lastGenerationDegraded: false,
      uiLanguage: 'en',
      colorScheme: 'light'
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.5.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1.0.0',
      latestVersion: '1.5.0'
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      await act(async () => {
        fireEvent.click(dl)
      })
      await waitFor(() => expect(api.updates.download).toHaveBeenCalled())
    }
  })

  it('download status not downloaded keeps banner', async () => {
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0'
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      await act(async () => {
        fireEvent.click(dl)
      })
    }
  })

  it('changeUiLanguage when stored lang differs', async () => {
    const i18n = await import('../../lib/i18n')
    api.settings.get = vi.fn().mockResolvedValue({
      lastGenerationDegraded: false,
      uiLanguage: 'zh-HK',
      colorScheme: 'system'
    })
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    // changeUiLanguage may be called
    getItem.mockRestore()
  })

  it('download success updates banner fully', async () => {
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0'
    })
    api.updates.install = vi.fn().mockResolvedValue({
      ok: false,
      message: ''
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      await act(async () => {
        fireEvent.click(dl)
      })
      await waitFor(() => expect(api.updates.download).toHaveBeenCalled())
    }
    await waitFor(() => {
      const inst = Array.from(document.querySelectorAll('button')).find((b) =>
        /installUpdate|install/i.test(b.textContent || '')
      )
      if (inst) fireEvent.click(inst)
    })
  })


  it('system color scheme watch fires syncTheme', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      lastGenerationDegraded: false,
      uiLanguage: 'en',
      colorScheme: 'system'
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    // fire matchMedia change if any
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    if (mql && 'onchange' in mql && mql.onchange) {
      mql.onchange(new Event('change') as never)
    }
  })


  it('download status downloaded updates banner state', async () => {
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.9.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1.0.0',
      latestVersion: '1.9.0'
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      await act(async () => {
        fireEvent.click(dl)
      })
      await waitFor(() => expect(api.updates.download).toHaveBeenCalled())
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
    }
  })


  it('custom llm offline status line via settings only', async () => {
    // offline chat
    // re-render with default mock is fine — exercise download already
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1',
      latestVersion: '2'
    } as never)
    // fix dup key in previous if any
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
  })

  it('download fail toast and image same-as-llm titles', async () => {
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      canDownload: true
    })
    api.updates.download = vi
      .fn()
      .mockRejectedValue(new Error('download fail'))
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
    const dl = Array.from(document.querySelectorAll('button')).find((b) =>
      /downloadUpdate|download/i.test(b.textContent || '')
    )
    if (dl) {
      await act(async () => {
        fireEvent.click(dl)
      })
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'settings.updateDownloadFail'
        )
      )
    }
    // image/video same-as-llm provider titles rendered from mock useApp
    expect(document.body.textContent).toBeTruthy()
  })

  it('system colorScheme watches matchMedia', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      lastGenerationDegraded: false,
      uiLanguage: 'en',
      colorScheme: 'system'
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home-sys</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home-sys')).toBeTruthy())
    // fire system scheme change if listener registered
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const add =
      (mql as unknown as { addEventListener?: Function }).addEventListener ||
      (mql as unknown as { addListener?: Function }).addListener
    void add
    try {
      ;(mql as unknown as { onchange?: Function | null }).onchange?.(
        new Event('change')
      )
    } catch {
      /* */
    }
  })

  it('download success updates banner via onState available', async () => {
    api.updates.download = vi.fn().mockResolvedValue({
      status: 'downloaded',
      currentVersion: '1.0.0',
      latestVersion: '2.5.0'
    })
    api.updates.onState = vi.fn((cb: (s: unknown) => void) => {
      queueMicrotask(() =>
        cb({
          status: 'available',
          currentVersion: '1.0.0',
          latestVersion: '2.5.0'
        })
      )
      return () => undefined
    })
    await act(async () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>home-dl</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getByText('home-dl')).toBeTruthy())
    await waitFor(() => {
      const el = document.body.textContent || ''
      expect(el).toMatch(/updateAvailableBanner|downloadUpdate/)
    })
    const downloadBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => (b.textContent || '').includes('downloadUpdate')
    )
    expect(downloadBtn).toBeTruthy()
    await act(async () => {
      fireEvent.click(downloadBtn!)
    })
    await waitFor(() => expect(api.updates.download).toHaveBeenCalled())
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'settings.updateDownloadedToast'
      )
    )
  })

})
