import type { ElectronApi } from '../types/electron-api'
import { createHttpAppClient } from './httpAppClient'

declare global {
  interface Window {
    api: ElectronApi & {
      /** Preload escape hatch (optional, for polyfills). */
      _invoke?: (channel: string, args?: unknown[]) => Promise<unknown>
    }
  }
}

function ensureWebServer(api: ElectronApi): ElectronApi {
  if (api.webServer?.generateToken && api.webServer?.start) {
    return api
  }
  const inv = (
    api as ElectronApi & {
      _invoke?: (channel: string, args?: unknown[]) => Promise<unknown>
    }
  )._invoke

  if (typeof inv === 'function') {
    // Stale preload missing webServer namespace — rebuild from raw IPC
    const webServer: ElectronApi['webServer'] = {
      status: () =>
        inv('webServer:status') as ReturnType<ElectronApi['webServer']['status']>,
      start: () =>
        inv('webServer:start') as ReturnType<ElectronApi['webServer']['start']>,
      stop: () =>
        inv('webServer:stop') as ReturnType<ElectronApi['webServer']['stop']>,
      generateToken: () =>
        inv('webServer:generateToken') as ReturnType<
          ElectronApi['webServer']['generateToken']
        >
    }
    return { ...api, webServer }
  }

  // Last resort: HTTP client namespace (web mode / partial bridge)
  try {
    const http = createHttpAppClient()
    return { ...api, webServer: http.webServer }
  } catch {
    return api
  }
}

/** Renderer-side API bridge. Electron preload, else HTTP web client. */
export function getApi(): ElectronApi {
  if (typeof window !== 'undefined' && window.api) {
    return ensureWebServer(window.api)
  }
  // Browser / self-hosted web mode
  if (typeof window !== 'undefined') {
    return createHttpAppClient()
  }
  throw new Error(
    'API is not available. Run Electron (`npm run dev`) or the web server (`npm run start:server`).'
  )
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api)
}

export function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && !window.api
}
