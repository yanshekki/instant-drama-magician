/**
 * Lightweight argv parser (no commander dependency).
 */
import type { CliGlobalOptions } from './types'

export interface ParsedArgv {
  globals: Partial<CliGlobalOptions>
  /** First non-flag token (command) */
  command: string | null
  /** Remaining tokens after command */
  positionals: string[]
  /** Long/short flags for subcommands */
  flags: Record<string, string | boolean>
}

const GLOBAL_BOOL = new Set([
  'json',
  'pretty',
  'quiet',
  'q',
  'local',
  'yes',
  'y',
  'help',
  'h',
  'version',
  'V'
])

const GLOBAL_VALUE = new Set([
  'url',
  'token',
  'data-dir',
  'dataDir',
  'profile',
  'p'
])

function toCamel(k: string): string {
  return k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function parseArgv(argv: string[]): ParsedArgv {
  const globals: Partial<CliGlobalOptions> & { version?: boolean } = {}
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []
  let command: string | null = null
  let i = 0

  while (i < argv.length) {
    const a = argv[i]
    if (a === '--') {
      positionals.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      let key = eq === -1 ? a.slice(2) : a.slice(2, eq)
      let val: string | boolean | undefined =
        eq === -1 ? undefined : a.slice(eq + 1)
      const camel = toCamel(key)

      if (key === 'help' || key === 'h') {
        globals.help = true
        i++
        continue
      }
      if (key === 'version' || key === 'V') {
        ;(globals as { version?: boolean }).version = true
        i++
        continue
      }
      if (GLOBAL_BOOL.has(key) || GLOBAL_BOOL.has(camel)) {
        const on = val !== 'false' && val !== '0'
        if (key === 'q' || camel === 'quiet') globals.quiet = on
        else if (key === 'y' || camel === 'yes') globals.yes = on
        else if (camel === 'json') globals.json = on
        else if (camel === 'pretty') globals.pretty = on
        else if (camel === 'local') globals.local = on
        i++
        continue
      }
      if (GLOBAL_VALUE.has(key) || GLOBAL_VALUE.has(camel)) {
        if (val === undefined) {
          val = argv[++i]
        }
        if (key === 'data-dir' || camel === 'dataDir') globals.dataDir = val
        else if (key === 'p' || camel === 'profile') globals.profile = val
        else if (camel === 'url') globals.url = val
        else if (camel === 'token') globals.token = val
        i++
        continue
      }
      // subcommand flags
      if (val === undefined) {
        const next = argv[i + 1]
        if (next && !next.startsWith('-')) {
          val = next
          i += 2
          flags[camel] = val
          continue
        }
        flags[camel] = true
        i++
        continue
      }
      flags[camel] = val
      i++
      continue
    }
    if (a.startsWith('-') && a.length === 2) {
      const k = a[1]
      if (k === 'q') {
        globals.quiet = true
        i++
        continue
      }
      if (k === 'y') {
        globals.yes = true
        i++
        continue
      }
      if (k === 'h') {
        globals.help = true
        i++
        continue
      }
      if (k === 'V') {
        ;(globals as { version?: boolean }).version = true
        i++
        continue
      }
      if (k === 'p') {
        globals.profile = argv[++i]
        i++
        continue
      }
      flags[k] = true
      i++
      continue
    }
    if (!command) {
      command = a
    } else {
      positionals.push(a)
    }
    i++
  }

  return { globals, command, positionals, flags }
}

/** Parse JSON args from positionals and/or --args / --args-stdin */
export async function resolveInvokeArgs(
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<unknown[]> {
  if (flags.argsStdin || flags['args-stdin']) {
    const chunks: Buffer[] = []
    for await (const c of process.stdin) chunks.push(Buffer.from(c))
    const text = Buffer.concat(chunks).toString('utf8').trim()
    if (!text) return []
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) ? parsed : [parsed]
  }
  if (typeof flags.args === 'string') {
    const parsed = JSON.parse(flags.args) as unknown
    return Array.isArray(parsed) ? parsed : [parsed]
  }
  if (positionals.length === 0) return []
  // Each positional may be JSON value; if single token is array/object use as full args
  if (positionals.length === 1) {
    const t = positionals[0]
    try {
      const parsed = JSON.parse(t) as unknown
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return [t]
    }
  }
  return positionals.map((t) => {
    try {
      return JSON.parse(t) as unknown
    } catch {
      return t
    }
  })
}
