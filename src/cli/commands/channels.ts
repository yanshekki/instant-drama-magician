import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { resolveClient } from '../client'
import { emitFailure, emitSuccess, printHuman, table } from '../output'
import { CORE_CHANNELS, DESKTOP_CHANNEL_NAMES, specFor } from '../../runtime/channelManifest'
import { toAppError } from '../../types/errors'

export async function cmdChannels(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const sub = positionals[0] || 'list'
  if (sub === 'describe') {
    const name = positionals[1]
    if (!name) {
      emitFailure(
        globals,
        { message: 'Usage: idm channels describe <channel>', code: 'USAGE' },
        EXIT.USAGE
      )
    }
    const spec = specFor(name)
    const live = await tryLiveHas(globals, name)
    const payload = { ...spec, availableNow: live }
    if (globals.json) emitSuccess(globals, { ok: true, result: payload, meta: { ms: 0, mode: 'local' } })
    else {
      printHuman(`${spec.channel}`)
      printHuman(`  ${spec.description}`)
      if (spec.argsHint) printHuman(`  args: ${spec.argsHint}`)
      if (spec.destructive) printHuman('  destructive: yes')
      printHuman(`  available on current client: ${live === null ? 'unknown' : live}`)
    }
    return
  }

  // list
  const filter =
    (typeof flags.filter === 'string' && flags.filter) ||
    (typeof flags.f === 'string' && flags.f) ||
    ''
  const catalog = Boolean(flags.catalog || flags.all)

  let names: string[] = []
  let mode: 'remote' | 'local' = 'local'
  try {
    const client = await resolveClient(globals)
    mode = client.mode
    names = await client.channels()
    await client.dispose?.()
  } catch (e) {
    if (catalog) {
      names = DESKTOP_CHANNEL_NAMES
    } else {
      emitFailure(globals, {
        ok: false,
        error: {
          code: toAppError(e).code,
          message: toAppError(e).message
        }
      })
    }
  }

  if (catalog) {
    const set = new Set([...names, ...DESKTOP_CHANNEL_NAMES, ...CORE_CHANNELS.map((c) => c.channel)])
    names = [...set].sort()
  }

  if (filter) {
    names = names.filter((n) => n.includes(String(filter)))
  }

  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result: {
        count: names.length,
        channels: names.map((c) => ({
          channel: c,
          ...specFor(c)
        }))
      },
      meta: { ms: 0, mode }
    })
    return
  }

  printHuman(`channels (${names.length}) mode=${mode}`)
  printHuman(
    table(
      names.map((c) => {
        const s = specFor(c)
        return {
          channel: c,
          destructive: s.destructive ? 'yes' : '',
          note: s.description.slice(0, 48)
        }
      })
    )
  )
}

async function tryLiveHas(
  globals: CliGlobalOptions,
  channel: string
): Promise<boolean | null> {
  try {
    const client = await resolveClient(globals)
    const list = await client.channels()
    await client.dispose?.()
    return list.includes(channel)
  } catch {
    return null
  }
}
