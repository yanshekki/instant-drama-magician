/**
 * instant-drama — InstantDrama Magician CLI entry.
 *
 *   npx tsx src/cli/bin.ts doctor --json
 *   instant-drama invoke stories:list --json
 *   instant-drama characters generate-sheet --args '[{...}]'
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseArgv } from './parseArgs'
import { resolveGlobals } from './config'
import { printHelp } from './commands/help'
import { cmdDoctor } from './commands/doctor'
import { cmdInvoke } from './commands/invoke'
import { cmdChannels } from './commands/channels'
import { cmdConfig } from './commands/configCmd'
import { cmdServer } from './commands/server'
import { cmdTools } from './commands/tools'
import { cmdBuild } from './commands/build'
import { cmdOpen } from './commands/open'
import { cmdUpdate } from './commands/update'
import { cmdAi, cmdApp, cmdSettings, cmdStories } from './commands/sugar'
import { cmdDomain, DOMAIN_NAMESPACES } from './commands/domain'
import { emitFailure, printHuman } from './output'
import { EXIT } from './types'

function packageVersion(): string {
  // Prefer this package's package.json (works for npm -g and local),
  // not process.cwd() which may be an unrelated project.
  const candidates = [
    join(__dirname, '..', '..', 'package.json'),
    join(__dirname, '..', '..', '..', 'package.json')
  ]
  for (const p of candidates) {
    try {
      const j = JSON.parse(readFileSync(p, 'utf8')) as {
        name?: string
        version?: string
      }
      if (j.version && (!j.name || j.name === 'instant-drama-magician')) {
        return j.version
      }
    } catch {
      /* try next */
    }
  }
  if (process.env.npm_package_version) return process.env.npm_package_version
  return '1.0.0'
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const parsed = parseArgv(argv)
  const globals = resolveGlobals(parsed.globals)

  if (
    (parsed.globals as { version?: boolean }).version ||
    parsed.command === 'version'
  ) {
    const v = packageVersion()
    if (globals.json) printHuman(JSON.stringify({ ok: true, version: v }))
    else printHuman(v)
    return
  }

  if (
    globals.help ||
    !parsed.command ||
    parsed.command === 'help' ||
    parsed.command === '--help'
  ) {
    if (parsed.command && parsed.command !== 'help' && !globals.help) {
      // fall through
    } else {
      printHelp()
      return
    }
  }

  if (process.env.IDM_JSON === '1') globals.json = true

  const cmd = parsed.command
  const pos = parsed.positionals
  const flags = parsed.flags

  switch (cmd) {
    case 'help':
      printHelp()
      return
    case 'doctor':
      await cmdDoctor(globals)
      return
    case 'invoke':
    case 'call':
      await cmdInvoke(globals, pos, flags)
      return
    case 'channels':
    case 'channel':
      await cmdChannels(globals, pos, flags)
      return
    case 'config':
      await cmdConfig(globals, pos)
      return
    case 'server':
      await cmdServer(globals, pos, flags)
      return
    case 'build':
      await cmdBuild(globals, pos, flags)
      return
    case 'update':
      await cmdUpdate(globals, pos, flags)
      return
    case 'open':
    case 'launch':
      await cmdOpen(globals, pos, flags)
      return
    case 'desktop': {
      // instant-drama desktop build|open — alias namespace
      const sub = pos[0]
      if (sub === 'build') {
        await cmdBuild(globals, pos.slice(1), flags)
        return
      }
      if (sub === 'open' || sub === 'launch') {
        await cmdOpen(globals, pos.slice(1), flags)
        return
      }
      emitFailure(
        globals,
        {
          message: 'Usage: instant-drama desktop build|open [options]',
          code: 'USAGE'
        },
        EXIT.USAGE
      )
      return
    }
    case 'tools':
    case 'tool':
      await cmdTools(globals, pos, flags)
      return
    case 'stories':
    case 'story':
      // Prefer friendly sugar when subcommand known; else domain
      if (
        !pos[0] ||
        ['list', 'get', 'create', 'delete', 'seed-demo', 'seedDemo'].includes(
          pos[0]
        )
      ) {
        await cmdStories(globals, pos, flags)
        return
      }
      await cmdDomain(globals, 'stories', pos, flags)
      return
    case 'settings':
      if (!pos[0] || pos[0] === 'get' || pos[0] === 'set') {
        await cmdSettings(globals, pos, flags)
        return
      }
      await cmdDomain(globals, 'settings', pos, flags)
      return
    case 'ai':
      if (
        !pos[0] ||
        ['status', 'models', 'list-models', 'test-chat', 'testChat'].includes(
          pos[0]
        )
      ) {
        await cmdAi(globals, pos)
        return
      }
      await cmdDomain(globals, 'ai', pos, flags)
      return
    case 'app':
      if (!pos[0] || pos[0] === 'info') {
        await cmdApp(globals, pos)
        return
      }
      // instant-drama app open → open desktop (not channel sugar)
      if (pos[0] === 'open' || pos[0] === 'launch' || pos[0] === 'build') {
        if (pos[0] === 'build') {
          await cmdBuild(globals, pos.slice(1), flags)
        } else {
          await cmdOpen(globals, pos.slice(1), flags)
        }
        return
      }
      await cmdDomain(globals, 'app', pos, flags)
      return
    default:
      if (cmd && DOMAIN_NAMESPACES.includes(cmd)) {
        await cmdDomain(globals, cmd, pos, flags)
        return
      }
      // Alias: video-prep → videoPrep
      if (cmd === 'video-prep') {
        await cmdDomain(globals, 'videoPrep', pos, flags)
        return
      }
      if (cmd === 'web-server') {
        await cmdDomain(globals, 'webServer', pos, flags)
        return
      }
      emitFailure(
        globals,
        {
          message: `Unknown command: ${cmd}. Try: instant-drama help  |  instant-drama channels list`,
          code: 'USAGE'
        },
        EXIT.USAGE
      )
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  if (process.argv.includes('--json') || process.env.IDM_JSON === '1') {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: { code: 'ERROR', message: msg }
      }) + '\n'
    )
  } else {
    process.stderr.write(`instant-drama fatal: ${msg}\n`)
  }
  process.exit(EXIT.ERROR)
})
