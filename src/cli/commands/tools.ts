import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { resolveClient } from '../client'
import { emitFailure, emitSuccess, printHuman } from '../output'
import {
  DESKTOP_CHANNEL_NAMES,
  toOpenAiTools
} from '../../runtime/channelManifest'
import { resolveInvokeArgs } from '../parseArgs'
import { toAppError } from '../../types/errors'

export async function cmdTools(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const sub = positionals[0] || 'schema'
  if (sub === 'schema') {
    let channels: string[] = DESKTOP_CHANNEL_NAMES
    try {
      const client = await resolveClient(globals)
      const live = await client.channels()
      if (live.length) channels = live
      await client.dispose?.()
    } catch {
      /* use desktop catalog */
    }
    const openai = toOpenAiTools(channels)
    const payload = {
      ok: true,
      format: flags.anthropic
        ? 'anthropic-compatible-via-openai-shape'
        : flags.hermes
          ? 'hermes-shell-hint'
          : 'openai',
      count: openai.length,
      tools: openai,
      invokeHint:
        'Run: idm invoke <channel> --args \'[...]\''
    }
    if (globals.json || flags.openai || flags.anthropic || flags.hermes) {
      // Agent default: always JSON for schema
      process.stdout.write(
        JSON.stringify(
          flags.openai || flags.anthropic || flags.hermes
            ? openai
            : payload,
          null,
          globals.pretty ? 2 : undefined
        ) + '\n'
      )
      return
    }
    printHuman(`tools: ${openai.length} (use --json or --openai for full dump)`)
    printHuman(openai.slice(0, 12).map((t) => t.function.name).join('\n'))
    printHuman('…')
    return
  }

  if (sub === 'call') {
    // idm tools call idm_stories_list --args '[]'
    const toolName = positionals[1]
    if (!toolName) {
      emitFailure(
        globals,
        { message: 'Usage: idm tools call <toolName> --args \'[...]\'', code: 'USAGE' },
        EXIT.USAGE
      )
    }
    const mapped = mapToolNameToChannel(toolName)
    const args = await resolveInvokeArgs(positionals.slice(2), flags)
    const client = await resolveClient(globals)
    const t0 = Date.now()
    try {
      const result = await client.invoke(mapped, args)
      emitSuccess(globals, {
        ok: true,
        channel: mapped,
        result,
        meta: { ms: Date.now() - t0, mode: client.mode }
      })
    } catch (e) {
      const err = toAppError(e)
      emitFailure(globals, {
        ok: false,
        channel: mapped,
        error: { code: err.code, message: err.message, details: err.details }
      })
    } finally {
      await client.dispose?.()
    }
    return
  }

  emitFailure(
    globals,
    { message: 'Usage: idm tools schema|call ...', code: 'USAGE' },
    EXIT.USAGE
  )
}

export function mapToolNameToChannel(toolName: string): string {
  let n = toolName
  if (n.startsWith('idm_')) n = n.slice(4)
  // Prefer known channels: match by replacing : with _
  const hit = DESKTOP_CHANNEL_NAMES.find((c) => c.replace(/:/g, '_') === n)
  if (hit) return hit
  const idx = n.indexOf('_')
  if (idx === -1) return n
  return `${n.slice(0, idx)}:${n.slice(idx + 1)}`
}
