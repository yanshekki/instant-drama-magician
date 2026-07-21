/** Unified application error shape for IPC + UI */

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CANCELLED'
  | 'AI_UNAVAILABLE'
  | 'AI_FAILED'
  | 'AI_UNAUTHORIZED'
  | 'AI_RATE_LIMIT'
  | 'AI_KEY_MODE'
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
    return (
      mapVideoHttpMessage(error.message) ??
      mapChatMessage(error.message) ?? {
        code: 'INTERNAL',
        message: error.message
      }
    )
  }
  return { code: 'INTERNAL', message: String(error) }
}

/** Map chat / models HTTP failures for Grok Gateway. */
export function mapChatHttpStatus(status: number, bodyText: string): AppError {
  // Prefer short, user-facing messages — never dump raw JSON bodies into toasts.
  if (status === 401) {
    return new AppError(
      'AI_UNAUTHORIZED',
      'errors.apiKeyRejected',
      'The gateway refused the key. Re-select Grok so the app can issue a new key.'
    )
  }
  if (status === 403) {
    return new AppError(
      'AI_KEY_MODE',
      'errors.keyNotAllowed',
      'The app key may need agent permissions. Re-select Grok to refresh automatically.'
    )
  }
  if (status === 429) {
    return new AppError(
      'AI_RATE_LIMIT',
      'errors.tooManyRequests',
      'The gateway rate limit was hit. Wait a few seconds and try again.'
    )
  }
  // Gateway up but Grok CLI failed (vision format, crash, empty stdout)
  if (
    (status === 502 || status === 500) &&
    /grok cli exited|grok_error|produced no stdout|e2big/i.test(bodyText)
  ) {
    return new AppError(
      'AI_FAILED',
      'errors.grokCliFailed',
      'errors.grokCliFailedHint'
    )
  }
  const mapped = mapChatMessage(`Chat HTTP ${status}: ${bodyText.slice(0, 200)}`)
  if (mapped) {
    return new AppError(mapped.code, mapped.message, mapped.details)
  }
  return new AppError(
    'AI_FAILED',
    `Request failed (HTTP ${status})`,
    bodyText.slice(0, 200) || undefined
  )
}

export function mapChatMessage(message: string): AppErrorBody | null {
  const m = message.toLowerCase()
  if (
    /cannot reach|econnrefused|fetch failed|failed to fetch|networkerror|network|enotfound|net::err_/.test(
      m
    )
  ) {
    return {
      code: 'AI_UNAVAILABLE',
      message: 'errors.networkFailed',
      details: 'errors.aiUnavailable'
    }
  }
  if (/\bno api key\b/.test(m)) {
    return {
      code: 'AI_UNAUTHORIZED',
      message: 'errors.noApiKey',
      details:
        'Open Settings → re-select Grok so the app can auto-create a gateway key.'
    }
  }
  if (/\b401\b|unauthorized|invalid api key/.test(m)) {
    return {
      code: 'AI_UNAUTHORIZED',
      message: 'errors.apiKeyRejected',
      details: 'Re-select Grok so the app can issue a new key automatically.'
    }
  }
  if (/\b403\b|forbidden|safe.?mode|key mode/.test(m)) {
    return {
      code: 'AI_KEY_MODE',
      message: 'errors.keyNotAllowed',
      details: 'Re-select Grok to refresh access automatically.'
    }
  }
  if (/\b429\b|rate limit/.test(m)) {
    return {
      code: 'AI_RATE_LIMIT',
      message: 'errors.tooManyRequests',
      details: 'Wait a few seconds and try again.'
    }
  }
  // Grok CLI process failed under gateway (vision / argv / crash)
  if (/grok cli exited|grok_error|produced no stdout|\be2big\b/.test(m)) {
    return {
      code: 'AI_FAILED',
      message: 'errors.grokCliFailed',
      details: 'errors.grokCliFailedHint'
    }
  }
  // Grok-Cli-to-OpenAI-compatible: strictSampling rejects temperature/top_p/stop
  if (/strictsampling|sampling parameters|temperature\/top_p\/stop/.test(m)) {
    return {
      code: 'AI_FAILED',
      message,
      details:
        'Gateway strictSampling is on. App omits temperature for Grok preset; ensure you are on latest build, or disable strictSampling in Admin → API features.'
    }
  }
  // Image gen tool finished without writing a file (policy block, imagesApi off, or tool fail)
  if (
    /no_image_in_sandbox|no image file was found in the sandbox|image generation or edit tool may have failed or been blocked/.test(
      m
    )
  ) {
    return {
      code: 'AI_FAILED',
      message,
      details:
        'IMAGE_NO_SANDBOX: Gateway imagesApi ran but returned no image. Enable imagesApi in Admin → API features; use agent/admin key. Body/nude plates are often content-filtered — try「底衫褲」or「戲服」packages first, or simplify the character description.'
    }
  }
  if (/imagesapi|image api is disabled|image.?api.?disabled/.test(m)) {
    return {
      code: 'AI_FAILED',
      message,
      details:
        'IMAGE_API_OFF: Enable imagesApi in Gateway Admin → API features, then retry.'
    }
  }
  if (/timed out|timeout|aborted/.test(m)) {
    return {
      code: 'AI_FAILED',
      message,
      details: 'Increase chatTimeoutMs or check Gateway chat queue'
    }
  }
  if (/chat http|grok cli chat failed|gateway|validation_error/.test(m)) {
    return { code: 'AI_FAILED', message }
  }
  return null
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
