/** Unified application error shape for IPC + UI */

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AI_UNAVAILABLE'
  | 'AI_FAILED'
  | 'FFMPEG_UNAVAILABLE'
  | 'FFMPEG_FAILED'
  | 'IO'
  | 'INTERNAL'

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
    return { code: 'INTERNAL', message: error.message }
  }
  return { code: 'INTERNAL', message: String(error) }
}

export function isAppErrorBody(value: unknown): value is AppErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.code === 'string' && typeof v.message === 'string'
}
