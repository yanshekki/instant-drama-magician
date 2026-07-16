import type { ElectronApi } from '../types/electron-api'

declare global {
  interface Window {
    api: ElectronApi
  }
}

/** Renderer-side API bridge. Falls back to in-memory mock when not in Electron. */
export function getApi(): ElectronApi {
  if (typeof window !== 'undefined' && window.api) {
    return window.api
  }
  throw new Error('Electron API is not available. Run via `npm run dev` (Electron).')
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api)
}
