/**
 * Remote IdmClient — talks to EmbeddedWebServer /api/invoke.
 */
import type { IdmClient } from '../types'
import { AppError, toAppError } from '../../types/errors'

export interface RemoteClientOptions {
  url: string
  token?: string | null
}

export function createRemoteClient(opts: RemoteClientOptions): IdmClient {
  const base = opts.url.replace(/\/+$/, '')
  const token = opts.token || ''

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }

  const invoke = async (
    channel: string,
    args: unknown[] = []
  ): Promise<unknown> => {
    let res: Response
    try {
      res = await fetch(`${base}/api/invoke`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ channel, args })
      })
    } catch (e) {
      throw new AppError(
        'IO',
        `Cannot reach IDM server at ${base}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      throw new AppError(
        'IO',
        `Invalid JSON from server (${res.status}): ${text.slice(0, 200)}`
      )
    }
    if (res.status === 401) {
      throw new AppError(
        'AI_UNAUTHORIZED',
        'errors.cliUnauthorizedToken'
      )
    }
    const obj = body as {
      ok?: boolean
      result?: unknown
      error?: { code?: string; message?: string; details?: unknown }
      message?: string
    }
    if (!res.ok || obj.ok === false) {
      const err = obj.error || {
        code: 'ERROR',
        message: obj.message || `HTTP ${res.status}`
      }
      throw new AppError(
        (typeof err.code === 'string' ? err.code : 'ERROR') as never,
        String(err.message || 'Request failed'),
        typeof err.details === 'string' ? err.details : undefined
      )
    }
    return obj.result
  }

  const channels = async (): Promise<string[]> => {
    let res: Response
    try {
      res = await fetch(`${base}/api/channels`, { headers: headers() })
    } catch (e) {
      throw new AppError(
        'IO',
        `Cannot reach IDM server at ${base}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
    if (res.status === 401) {
      throw new AppError('AI_UNAUTHORIZED', 'errors.unauthorized')
    }
    const body = (await res.json()) as { channels?: string[] }
    return Array.isArray(body.channels) ? body.channels : []
  }

  return {
    mode: 'remote',
    invoke,
    channels,
    describe: () => ({
      mode: 'remote',
      url: base,
      auth: Boolean(token)
    })
  }
}

export function isNetworkError(err: unknown): boolean {
  const e = toAppError(err)
  return (
    e.code === 'IO' ||
    /Cannot reach|fetch failed|ECONNREFUSED|network/i.test(e.message)
  )
}

export function isAuthError(err: unknown): boolean {
  const e = toAppError(err)
  return e.code === 'AI_UNAUTHORIZED' || /Unauthorized/i.test(e.message)
}
