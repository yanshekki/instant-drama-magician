import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { resolveClient } from '../client'
import { resolveInvokeArgs } from '../parseArgs'
import { emitFailure, emitSuccess } from '../output'
import { toAppError } from '../../types/errors'
import { isAuthError, isNetworkError } from '../client/remote'

export async function cmdInvoke(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const channel = positionals[0]
  if (!channel) {
    emitFailure(
      globals,
      { message: 'Usage: idm invoke <channel> [jsonArgs...]', code: 'USAGE' },
      EXIT.USAGE
    )
  }

  const args = await resolveInvokeArgs(positionals.slice(1), flags)
  const client = await resolveClient(globals)
  const t0 = Date.now()
  try {
    const result = await client.invoke(channel, args)
    emitSuccess(globals, {
      ok: true,
      channel,
      result,
      meta: { ms: Date.now() - t0, mode: client.mode }
    })
  } catch (e) {
    const err = toAppError(e)
    const code = isAuthError(e)
      ? EXIT.UNAUTH
      : isNetworkError(e)
        ? EXIT.CONNECT
        : EXIT.ERROR
    emitFailure(
      globals,
      {
        ok: false,
        channel,
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        },
        meta: { ms: Date.now() - t0, mode: client.mode }
      },
      code
    )
  } finally {
    await client.dispose?.()
  }
}
