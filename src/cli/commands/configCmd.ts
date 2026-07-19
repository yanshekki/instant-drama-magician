import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import {
  defaultConfigPath,
  loadConfigFile,
  saveConfigFile
} from '../config'
import { emitFailure, emitSuccess, printHuman } from '../output'

export async function cmdConfig(
  globals: CliGlobalOptions,
  positionals: string[]
): Promise<void> {
  const sub = positionals[0] || 'get'
  const path = defaultConfigPath()

  if (sub === 'path') {
    if (globals.json) emitSuccess(globals, { ok: true, result: { path } })
    else printHuman(path)
    return
  }

  if (sub === 'get') {
    const file = loadConfigFile(path)
    if (globals.json) emitSuccess(globals, { ok: true, result: file })
    else printHuman(JSON.stringify(file, null, 2))
    return
  }

  if (sub === 'set') {
    // idm config set url http://...
    // idm config set token SECRET
    // idm config set dataDir /path
    const key = positionals[1]
    const value = positionals[2]
    if (!key || value === undefined) {
      emitFailure(
        globals,
        {
          message: 'Usage: idm config set <url|token|dataDir|defaultOutput> <value>',
          code: 'USAGE'
        },
        EXIT.USAGE
      )
    }
    const allowed = new Set(['url', 'token', 'dataDir', 'defaultOutput'])
    if (!allowed.has(key)) {
      emitFailure(
        globals,
        { message: `Unknown config key: ${key}`, code: 'USAGE' },
        EXIT.USAGE
      )
    }
    const next = saveConfigFile({ [key]: value }, path)
    if (globals.json) emitSuccess(globals, { ok: true, result: next })
    else printHuman(`saved ${key} → ${path}`)
    return
  }

  emitFailure(
    globals,
    { message: 'Usage: idm config path|get|set ...', code: 'USAGE' },
    EXIT.USAGE
  )
}
