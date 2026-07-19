/**
 * Browser transport for ElectronApi: POST /api/invoke { channel, args }.
 * Nested api.foo.bar() → channel "foo:bar".
 * Special-cases file pick / download for web export·import·open.
 */
import type { ElectronApi } from '../types/electron-api'
import { AppError } from '../types/errors'
import {
  maybeDownloadResult,
  openInBrowserTab,
  pickFile,
  triggerBrowserDownload,
  uploadBrowserFile,
  withAuthQuery
} from './webTransfer'

const TOKEN_KEY = 'idm_auth_token'

export function getStoredAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStoredAuthToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function clearStoredAuthToken(): void {
  setStoredAuthToken('')
}

function apiBase(): string {
  const env = (import.meta as { env?: { VITE_IDM_API_BASE?: string } }).env
  return (env?.VITE_IDM_API_BASE ?? '').replace(/\/+$/, '')
}

async function invokeChannel(
  channel: string,
  args: unknown[]
): Promise<unknown> {
  const token = getStoredAuthToken()
  const res = await fetch(`${apiBase()}/api/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ channel, args })
  })

  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { message: text }
  }

  if (!res.ok) {
    const err = body as {
      code?: string
      message?: string
      details?: string
      error?: { code?: string; message?: string; details?: string }
    }
    const e = err?.error ?? err
    throw new AppError(
      (e?.code as never) || 'INTERNAL',
      e?.message || `HTTP ${res.status}`,
      e?.details
    )
  }

  const wrapped = body as { ok?: boolean; result?: unknown }
  let result: unknown =
    wrapped && typeof wrapped === 'object' && 'result' in wrapped
      ? wrapped.result
      : body
  result = attachTokenToUrls(result)
  return result
}

function attachTokenToUrls(result: unknown): unknown {
  if (result == null || typeof result !== 'object') return result
  const r = result as Record<string, unknown>
  for (const key of ['url', 'downloadUrl', 'openUrl'] as const) {
    if (typeof r[key] === 'string') {
      r[key] = withAuthQuery(r[key] as string)
    }
  }
  return result
}

const EVENT_METHODS = new Set(['onProgress', 'onState', 'onMenuAction'])

async function handleSpecial(
  channel: string,
  args: unknown[]
): Promise<unknown | undefined> {
  // Import: pick zip → upload → invoke with path
  if (channel === 'project:importBackup') {
    const file = await pickFile('.zip,application/zip')
    if (!file) return null
    const up = await uploadBrowserFile(file, { subdir: 'uploads' })
    return invokeChannel('project:importBackup', [up.filePath])
  }

  if (channel === 'app:importFullBackup') {
    const file = await pickFile('.zip,application/zip')
    if (!file) return null
    const up = await uploadBrowserFile(file, { subdir: 'uploads' })
    const result = await invokeChannel('app:importFullBackup', [up.filePath])
    // Full restore: force reload so new DB is used
    if (
      result &&
      typeof result === 'object' &&
      (result as { requiresReload?: boolean }).requiresReload
    ) {
      setTimeout(() => window.location.reload(), 800)
    }
    return result
  }

  if (channel === 'project:exportBackup') {
    const result = await invokeChannel(channel, args)
    maybeDownloadResult(result)
    return result
  }

  if (channel === 'app:exportFullBackup') {
    const result = await invokeChannel(channel, args)
    maybeDownloadResult(result)
    return result
  }

  if (channel === 'media:saveAs') {
    const result = await invokeChannel(channel, args)
    maybeDownloadResult(result)
    return result
  }

  if (channel === 'shell:openPath' || channel === 'shell:showItemInFolder') {
    const result = (await invokeChannel(channel, args)) as {
      ok?: boolean
      openUrl?: string
      downloadUrl?: string
      isDirectory?: boolean
      path?: string
      message?: string
      fileName?: string
    }
    if (result?.openUrl) {
      openInBrowserTab(result.openUrl)
    } else if (result?.downloadUrl) {
      triggerBrowserDownload(result.downloadUrl, result.fileName)
    } else if (result?.isDirectory && result.path) {
      // Cannot open OS folders in browser — copy path via clipboard best-effort
      try {
        await navigator.clipboard.writeText(result.path)
      } catch {
        /* ignore */
      }
    }
    return result
  }

  if (channel === 'shell:openExternal') {
    const url = String(args[0] ?? '')
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    return { ok: true, url }
  }

  if (channel === 'media:pickRefImage' || channel === 'media:pickBgm') {
    const accept =
      channel === 'media:pickBgm'
        ? 'audio/*,.mp3,.wav,.m4a'
        : 'image/*,.png,.jpg,.jpeg,.webp'
    const file = await pickFile(accept)
    if (!file) return null
    const up = await uploadBrowserFile(file, {
      subdir: channel === 'media:pickBgm' ? 'bgm' : 'refs'
    })
    return {
      filePath: up.filePath,
      originalName: file.name
    }
  }

  return undefined
}

/**
 * Proxy ElectronApi: api.stories.list() → invoke("stories:list").
 */
export function createHttpAppClient(): ElectronApi {
  const root: Record<string, unknown> = {}

  const handler: ProxyHandler<object> = {
    get(_target, ns: string | symbol) {
      if (typeof ns !== 'string' || ns === 'then') return undefined
      if (!root[ns]) {
        root[ns] = new Proxy(
          {},
          {
            get(_t, method: string | symbol) {
              if (typeof method !== 'string') return undefined
              if (EVENT_METHODS.has(method)) {
                return () => () => {
                  /* no-op unsubscribe */
                }
              }
              const channel = `${ns}:${method}`
              return async (...args: unknown[]) => {
                const special = await handleSpecial(channel, args)
                if (special !== undefined) return special
                return invokeChannel(channel, args)
              }
            }
          }
        )
      }
      return root[ns]
    }
  }

  return new Proxy({}, handler) as ElectronApi
}

export async function loginWithToken(token: string): Promise<boolean> {
  setStoredAuthToken(token)
  try {
    await invokeChannel('app:getInfo', [])
    return true
  } catch {
    clearStoredAuthToken()
    return false
  }
}
