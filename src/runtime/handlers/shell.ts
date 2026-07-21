/**
 * Domain IPC handlers (split for maintainability).
 */
import { AppError } from '../../types/errors'
import type { HandlerContext } from './context'

export function registerShellHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host
  } = ctx

// ─── Shell helpers ─────────────────────────────────────────
reg(
  'shell:openExternal',
  (async ( url: string) => {
    const raw = typeof url === 'string' ? url.trim() : ''
    if (!raw) {
      throw new AppError('VALIDATION', 'errors.urlRequired')
    }
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      throw new AppError('VALIDATION', 'errors.invalidUrl', String(raw))
    }
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      throw new AppError(
        'VALIDATION',
        'errors.unsupportedUrlProtocol',
        String(parsed.protocol)
      )
    }
    const href = parsed.href
    try {
      await host.shell.openExternal(href)
      return { ok: true as const, url: href }
    } catch (first) {
      // Linux / sandboxed environments: Electron openExternal can fail
      // while xdg-open / open still works.
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)
      try {
        if (process.platform === 'darwin') {
          await execFileAsync('open', [href])
        } else if (process.platform === 'win32') {
          await execFileAsync('cmd', ['/c', 'start', '', href])
        } else {
          await execFileAsync('xdg-open', [href])
        }
        return { ok: true as const, url: href, via: 'fallback' as const }
      } catch {
        throw new AppError(
          'IO',
          'errors.openUrlFailed',
          first instanceof Error ? first.message : String(first)
        )
      }
    }
  })
)

reg(
  'shell:openPath',
  (async ( filePath: string) => {
    const err = await host.shell.openPath(filePath)
    if (err) throw new AppError('IO', err)
    return { ok: true as const }
  })
)

reg(
  'shell:showItemInFolder',
  (async ( filePath: string) => {
    host.shell.showItemInFolder(filePath)
    return { ok: true as const }
  })
)

}
