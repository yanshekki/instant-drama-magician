/**
 * stdout contract for humans and agents.
 */
import type { CliGlobalOptions, InvokeErrorBody, InvokeResult } from './types'
import { EXIT } from './types'

export function printJson(value: unknown, pretty = false): void {
  process.stdout.write(
    JSON.stringify(value, null, pretty ? 2 : undefined) + '\n'
  )
}

export function printHuman(line: string): void {
  process.stdout.write(line + (line.endsWith('\n') ? '' : '\n'))
}

export function printErr(line: string): void {
  process.stderr.write(line + (line.endsWith('\n') ? '' : '\n'))
}

export function emitSuccess(
  opts: CliGlobalOptions,
  payload: InvokeResult | Record<string, unknown>
): void {
  if (opts.json) {
    printJson(payload, opts.pretty)
    return
  }
  if ('result' in payload) {
    const r = (payload as InvokeResult).result
    if (r === undefined || r === null) {
      printHuman('ok')
      return
    }
    if (typeof r === 'string' || typeof r === 'number' || typeof r === 'boolean') {
      printHuman(String(r))
      return
    }
    printJson(r, true)
    return
  }
  printJson(payload, true)
}

export function emitFailure(
  opts: CliGlobalOptions,
  err: InvokeErrorBody | { message: string; code?: string },
  exitCode: number = EXIT.ERROR
): never {
  const body: InvokeErrorBody =
    'ok' in err && err.ok === false
      ? err
      : {
          ok: false,
          error: {
            code: (err as { code?: string }).code || 'ERROR',
            message: (err as { message: string }).message || String(err)
          }
        }
  if (opts.json) {
    printJson(body, opts.pretty)
  } else {
    printErr(`error: ${body.error.code} — ${body.error.message}`)
  }
  process.exit(exitCode)
}

export function table(rows: Array<Record<string, string | number>>): string {
  if (!rows.length) return '(empty)'
  const keys = Object.keys(rows[0])
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length))
  )
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length))
  const head = keys.map((k, i) => pad(k, widths[i])).join('  ')
  const sep = widths.map((w) => '-'.repeat(w)).join('  ')
  const body = rows
    .map((r) => keys.map((k, i) => pad(String(r[k] ?? ''), widths[i])).join('  '))
    .join('\n')
  return `${head}\n${sep}\n${body}`
}
