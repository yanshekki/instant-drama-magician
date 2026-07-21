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
      'errors.reselectGrokHint'
    )
  }
  if (status === 403) {
    return new AppError(
      'AI_KEY_MODE',
      'errors.keyNotAllowed',
      'errors.reselectGrokAgentHint'
    )
  }
  if (status === 429) {
    return new AppError(
      'AI_RATE_LIMIT',
      'errors.tooManyRequests',
      'errors.rateLimitHint'
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
  return new AppError('AI_FAILED', 'errors.requestFailedHttp', bodyText.slice(0, 200) || String(status))
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
      details: 'errors.reselectGrokHint'
    }
  }
  if (/\b401\b|unauthorized|invalid api key/.test(m)) {
    return {
      code: 'AI_UNAUTHORIZED',
      message: 'errors.apiKeyRejected',
      details: 'errors.reselectGrokHint'
    }
  }
  if (/\b403\b|forbidden|safe.?mode|key mode/.test(m)) {
    return {
      code: 'AI_KEY_MODE',
      message: 'errors.keyNotAllowed',
      details: 'errors.reselectGrokAgentHint'
    }
  }
  if (/\b429\b|rate limit/.test(m)) {
    return {
      code: 'AI_RATE_LIMIT',
      message: 'errors.tooManyRequests',
      details: 'errors.rateLimitHint'
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
      message: 'errors.strictSamplingFailed',
      details: 'errors.strictSamplingHint'
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
      message: 'errors.imageNoSandbox',
      details: 'errors.imageNoSandboxHint'
    }
  }
  if (/imagesapi|image api is disabled|image.?api.?disabled/.test(m)) {
    return {
      code: 'AI_FAILED',
      message: 'errors.imageApiDisabled',
      details: 'errors.imageApiDisabledHint'
    }
  }
  if (/timed out|timeout|aborted/.test(m)) {
    return {
      code: 'AI_FAILED',
      message: 'errors.chatTimedOut',
      details: 'errors.chatTimeoutHint'
    }
  }
  if (/chat http|grok cli chat failed|gateway|validation_error/.test(m)) {
    return {
      code: 'AI_FAILED',
      message: 'errors.aiRequestFailed',
      details: message.slice(0, 300)
    }
  }
  return null
}

/** Map gateway / provider error strings to structured codes. */
export function mapVideoHttpMessage(message: string): AppErrorBody | null {
  const m = message.toLowerCase()
  if (/^cancell?ed$|aborted|user cancelled/.test(m)) {
    return { code: 'CANCELLED', message: 'errors.cancelled' }
  }
  if (/videoapi|video api is disabled|featuredisabled|feature.?disabled/.test(m)) {
    return {
      code: 'VIDEO_FEATURE_OFF',
      message: 'errors.videoFeatureOff',
      details: 'errors.videoFeatureOffHint'
    }
  }
  if (/agent-mode|admin api key|mediaforbidden|forbidden.*video/.test(m)) {
    return {
      code: 'VIDEO_KEY_MODE',
      message: 'errors.videoKeyMode',
      details: 'errors.videoKeyModeHint'
    }
  }
  if (/\b401\b|unauthorized/.test(m)) {
    return {
      code: 'VIDEO_UNAUTHORIZED',
      message: 'errors.videoUnauthorized',
      details: 'errors.videoUnauthorizedHint'
    }
  }
  if (/\b429\b|rate limit/.test(m)) {
    return {
      code: 'VIDEO_RATE_LIMIT',
      message: 'errors.videoRateLimit',
      details: 'errors.videoRateLimitHint'
    }
  }
  if (/timed out|timeout/.test(m)) {
    return {
      code: 'VIDEO_TIMEOUT',
      message: 'errors.videoJobTimedOut',
      details: 'errors.videoTimeoutHint'
    }
  }
  if (/job failed|video job|status failed/.test(m)) {
    return {
      code: 'VIDEO_JOB_FAILED',
      message: 'errors.videoJobFailed',
      details: 'errors.videoJobFailedHint'
    }
  }
  if (/video http|cannot reach gateway|gateway/.test(m)) {
    return {
      code: 'AI_FAILED',
      message: 'errors.videoHttpFailed',
      details: message.slice(0, 300)
    }
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
  // Prefer body heuristics (feature-off, agent key, timeouts, …) before status.
  // Use raw body first so generic "Video HTTP …" does not swallow status mapping.
  const fromBody = mapVideoHttpMessage(bodyText)
  if (fromBody) {
    return new AppError(fromBody.code, fromBody.message, fromBody.details)
  }
  if (status === 401) {
    return new AppError('VIDEO_UNAUTHORIZED', 'errors.videoUnauthorized', bodyText.slice(0, 200))
  }
  if (status === 403) {
    return new AppError('VIDEO_KEY_MODE', 'errors.videoKeyMode', bodyText.slice(0, 200))
  }
  if (status === 429) {
    return new AppError('VIDEO_RATE_LIMIT', 'errors.videoRateLimit', bodyText.slice(0, 200))
  }
  // Synthetic prefix always matches mapVideoHttpMessage's "video http" heuristic
  // (and may match timeout/job-failed tokens in the body first).
  const mapped = mapVideoHttpMessage(`Video HTTP ${status}: ${bodyText}`)
  return new AppError(
    mapped?.code ?? 'AI_FAILED',
    mapped?.message ?? 'errors.videoHttpFailed',
    mapped?.details ?? `${status}: ${bodyText.slice(0, 500)}`
  )
}
