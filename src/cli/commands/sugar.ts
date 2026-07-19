/**
 * Friendly domain subcommands → invoke sugar.
 */
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { resolveClient } from '../client'
import { emitFailure, emitSuccess } from '../output'
import { toAppError } from '../../types/errors'

async function run(
  globals: CliGlobalOptions,
  channel: string,
  args: unknown[] = []
): Promise<void> {
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
    emitFailure(globals, {
      ok: false,
      channel,
      error: { code: err.code, message: err.message, details: err.details }
    })
  } finally {
    await client.dispose?.()
  }
}

export async function cmdStories(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const sub = positionals[0]
  if (!sub || sub === 'list') return run(globals, 'stories:list')
  if (sub === 'get') {
    const id = positionals[1]
    if (!id) {
      emitFailure(globals, { message: 'idm stories get <id>', code: 'USAGE' }, EXIT.USAGE)
    }
    return run(globals, 'stories:get', [id])
  }
  if (sub === 'create') {
    const title =
      (typeof flags.title === 'string' && flags.title) ||
      positionals[1] ||
      'Untitled'
    return run(globals, 'stories:create', [{ title }])
  }
  if (sub === 'delete') {
    const id = positionals[1]
    if (!id) {
      emitFailure(globals, { message: 'idm stories delete <id>', code: 'USAGE' }, EXIT.USAGE)
    }
    if (!globals.yes) {
      emitFailure(
        globals,
        { message: 'Pass --yes to confirm delete', code: 'USAGE' },
        EXIT.USAGE
      )
    }
    return run(globals, 'stories:delete', [id])
  }
  if (sub === 'seed-demo' || sub === 'seedDemo') {
    const locale = positionals[1] || 'zh-HK'
    return run(globals, 'stories:seedDemo', [locale])
  }
  emitFailure(
    globals,
    {
      message: 'idm stories list|get|create|delete|seed-demo',
      code: 'USAGE'
    },
    EXIT.USAGE
  )
}

export async function cmdSettings(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const sub = positionals[0] || 'get'
  if (sub === 'get') return run(globals, 'settings:get')
  if (sub === 'set') {
    // idm settings set locale zh-HK
    // or idm settings set --json '{"locale":"en"}'
    if (typeof flags.json === 'string') {
      const partial = JSON.parse(flags.json) as Record<string, unknown>
      return run(globals, 'settings:set', [partial])
    }
    const key = positionals[1]
    const value = positionals[2]
    if (!key || value === undefined) {
      emitFailure(
        globals,
        {
          message: 'idm settings set <key> <value>  OR  --json \'{...}\'',
          code: 'USAGE'
        },
        EXIT.USAGE
      )
    }
    let parsed: unknown = value
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = value
    }
    return run(globals, 'settings:set', [{ [key]: parsed }])
  }
  emitFailure(globals, { message: 'idm settings get|set', code: 'USAGE' }, EXIT.USAGE)
}

export async function cmdAi(
  globals: CliGlobalOptions,
  positionals: string[]
): Promise<void> {
  const sub = positionals[0] || 'status'
  if (sub === 'status') return run(globals, 'ai:status')
  if (sub === 'models' || sub === 'list-models') return run(globals, 'ai:listModels')
  if (sub === 'test-chat' || sub === 'testChat') return run(globals, 'ai:testChat')
  emitFailure(
    globals,
    { message: 'idm ai status|models|test-chat', code: 'USAGE' },
    EXIT.USAGE
  )
}

export async function cmdApp(
  globals: CliGlobalOptions,
  positionals: string[]
): Promise<void> {
  const sub = positionals[0] || 'info'
  if (sub === 'info') return run(globals, 'app:getInfo')
  emitFailure(globals, { message: 'idm app info', code: 'USAGE' }, EXIT.USAGE)
}
