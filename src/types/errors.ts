/** Unified application error shape for IPC + UI */

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CANCELLED'
  | 'AI_UNAVAILABLE'
  | 'AI_FAILED'
  | 'FFMPEG_UNAVAILABLE'
  | 'FFMPEG_FAILED'
  | 'IO'
  | 'INTERNAL'
  | 'VIDEO_FEATURE_OFF'
  | 'VIDEO_KEY_MODE'
  | 'VIDEO_UNAUTHORIZED'
  | 'VIDEO_TIMEOUT'
  | 'VIDEO_JOB_FAILED'
  | 'VIDEO_RATE_LIMIT'

export interface AppErrorBody {
  code: AppErrorCode
  message: string
  details?: string
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly details?: string

  constructor(code: AppErrorCode, message: string, details?: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  toJSON(): AppErrorBody {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

export function toAppError(error: unknown): AppErrorBody {
  if (error instanceof AppError) return error.toJSON()
  if (error instanceof Error) {
    return mapVideoHttpMessage(error.message) ?? {
      code: 'INTERNAL',
      message: error.message
    }
  }
  return { code: 'INTERNAL', message: String(error) }
}

/** Map gateway / provider error strings to structured codes. */
export function mapVideoHttpMessage(message: string): AppErrorBody | null {
  const m = message.toLowerCase()
  if (/^cancell?ed$|aborted|user cancelled/.test(m)) {
    return { code: 'CANCELLED', message: message }
  }
  if (/videoapi|video api is disabled|featuredisabled|feature.?disabled/.test(m)) {
    return {
      code: 'VIDEO_FEATURE_OFF',
      message: message,
      details: 'Enable videoApi in Gateway Admin → API features.'
    }
  }
  if (/agent-mode|admin api key|mediaforbidden|forbidden.*video/.test(m)) {
    return {
      code: 'VIDEO_KEY_MODE',
      message: message,
      details: 'Use an agent-mode or admin API key for video.'
    }
  }
  if (/\b401\b|unauthorized/.test(m)) {
    return {
      code: 'VIDEO_UNAUTHORIZED',
      message: message,
      details: 'Check API key in Settings.'
    }
  }
  if (/\b429\b|rate limit/.test(m)) {
    return {
      code: 'VIDEO_RATE_LIMIT',
      message: message,
      details: 'Wait and retry; lower videoConcurrency.'
    }
  }
  if (/timed out|timeout/.test(m)) {
    return {
      code: 'VIDEO_TIMEOUT',
      message: message,
      details: 'Increase videoTimeoutSec or check Gateway job queue.'
    }
  }
  if (/job failed|video job|status failed/.test(m)) {
    return {
      code: 'VIDEO_JOB_FAILED',
      message: message,
      details: 'Open Gateway logs; retry this clip.'
    }
  }
  if (/video http|cannot reach gateway|gateway/.test(m)) {
    return { code: 'AI_FAILED', message: message }
  }
  return null
}

export function isAppErrorBody(value: unknown): value is AppErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.code === 'string' && typeof v.message === 'string'
}

export function mapHttpStatusToVideoError(
  status: number,
  bodyText: string
): AppError {
  const mapped = mapVideoHttpMessage(`Video HTTP ${status}: ${bodyText}`)
  if (mapped) {
    return new AppError(mapped.code, mapped.message, mapped.details)
  }
  if (status === 401) {
    return new AppError('VIDEO_UNAUTHORIZED', `Video HTTP 401: ${bodyText.slice(0, 200)}`)
  }
  if (status === 403) {
    return new AppError('VIDEO_KEY_MODE', `Video HTTP 403: ${bodyText.slice(0, 200)}`)
  }
  if (status === 429) {
    return new AppError('VIDEO_RATE_LIMIT', `Video HTTP 429: ${bodyText.slice(0, 200)}`)
  }
  return new AppError('AI_FAILED', `Video HTTP ${status}: ${bodyText.slice(0, 500)}`)
}
