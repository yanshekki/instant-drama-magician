import { isAppErrorBody, type AppErrorBody } from '../types/errors'

/** Parse IPC errors that carry JSON AppErrorBody in Error.message */
export function parseIpcError(error: unknown): AppErrorBody {
  if (error instanceof Error) {
    try {
      const parsed: unknown = JSON.parse(error.message)
      if (isAppErrorBody(parsed)) return parsed
    } catch {
      // not JSON
    }
    return { code: 'INTERNAL', message: error.message }
  }
  return { code: 'INTERNAL', message: String(error) }
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
