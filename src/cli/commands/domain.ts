/**
 * Generic domain sugar: idm <namespace> <action> [args...]
 * Maps to channel `namespace:camelAction`.
 *
 * Examples:
 *   idm characters list
 *   idm characters generate-sheet --args '[{...}]'
 *   idm generation run STORY_ID
 *   idm media check-ffmpeg
 */
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { resolveClient } from '../client'
import { resolveInvokeArgs } from '../parseArgs'
import { emitFailure, emitSuccess } from '../output'
import { toAppError } from '../../types/errors'
import { isAuthError, isNetworkError } from '../client/remote'
import { DESKTOP_CHANNEL_NAMES } from '../../runtime/channelManifest'

const DESTRUCTIVE = /:(delete|clear|import|cancel|install)$/i

export function kebabToCamel(action: string): string {
  return action.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function resolveDomainChannel(
  namespace: string,
  action: string
): string {
  const camel = kebabToCamel(action)
  const primary = `${namespace}:${camel}`
  if (DESKTOP_CHANNEL_NAMES.includes(primary)) return primary
  // try exact lowercase action as-is (e.g. already camelCase)
  const alt = `${namespace}:${action}`
  if (DESKTOP_CHANNEL_NAMES.includes(alt)) return alt
  return primary
}

export async function cmdDomain(
  globals: CliGlobalOptions,
  namespace: string,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const action = positionals[0]
  if (!action || action === 'help') {
    const list = DESKTOP_CHANNEL_NAMES.filter((c) =>
      c.startsWith(namespace + ':')
    )
    emitSuccess(globals, {
      ok: true,
      result: {
        namespace,
        usage: `idm ${namespace} <action> [jsonArgs...]`,
        channels: list
      },
      meta: { ms: 0, mode: 'local' }
    })
    return
  }

  const channel = resolveDomainChannel(namespace, action)
  const rest = positionals.slice(1)
  // resolveInvokeArgs already accepts bare non-JSON tokens as args
  const args = await resolveInvokeArgs(rest, flags)

  if (DESTRUCTIVE.test(channel) && !globals.yes) {
    emitFailure(
      globals,
      {
        message: `Destructive channel ${channel} requires --yes (or IDM_YES=1)`,
        code: 'USAGE'
      },
      EXIT.USAGE
    )
  }

  const client = await resolveClient(globals)
  const t0 = Date.now()
  try {
    // Prefer live channel names if available
    const live = await client.channels()
    const use =
      live.includes(channel)
        ? channel
        : live.find(
            (c) =>
              c.toLowerCase() === channel.toLowerCase() ||
              c === `${namespace}:${action}`
          ) || channel
    const result = await client.invoke(use, args)
    emitSuccess(globals, {
      ok: true,
      channel: use,
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

/** All top-level namespaces derived from channel catalog */
export const DOMAIN_NAMESPACES = [
  ...new Set(DESKTOP_CHANNEL_NAMES.map((c) => c.split(':')[0]))
].sort()
