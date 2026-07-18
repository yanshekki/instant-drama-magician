import {
  isAppErrorBody,
  mapChatMessage,
  type AppErrorBody,
  type AppErrorCode
} from '../types/errors'

/**
 * Parse IPC errors that carry JSON AppErrorBody in Error.message.
 * Electron wraps invoke failures as:
 *   Error invoking remote method 'x': Error: {"code":...}
 */
export function parseIpcError(error: unknown): AppErrorBody {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error)

  // 1) Direct JSON body
  const direct = tryParseAppErrorJson(raw)
  if (direct) return direct

  // 2) Electron wrapper: ... Error: {json}  or  ...: {json}
  const embedded = raw.match(/\{[\s\S]*"code"\s*:\s*"[A-Z_]+"[\s\S]*\}/)
  if (embedded) {
    const fromEmbed = tryParseAppErrorJson(embedded[0])
    if (fromEmbed) return fromEmbed
  }

  // 3) Heuristic from free text (429 etc.)
  const mapped = mapChatMessage(raw)
  if (mapped) return mapped

  // 4) Strip Electron prefix for readability
  const stripped = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()

  return {
    code: 'INTERNAL',
    message: stripped || raw
  }
}

function tryParseAppErrorJson(text: string): AppErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (isAppErrorBody(parsed)) return parsed
  } catch {
    /* not pure JSON */
  }
  return null
}

/** User-facing line for toasts (message + optional details). */
export function formatIpcError(error: unknown): string {
  const body = parseIpcError(error)
  if (body.details && !body.message.includes(body.details)) {
    return `${body.message} — ${body.details}`
  }
  return body.message
}

export function isRateLimitError(error: unknown): boolean {
  return parseIpcError(error).code === 'AI_RATE_LIMIT'
}

export async function invokeSafe<T>(fn: () => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false; error: AppErrorBody }
> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: parseIpcError(error) }
  }
}

export type { AppErrorCode }
