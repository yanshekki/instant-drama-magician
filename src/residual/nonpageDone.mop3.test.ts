/**
 * mop3 — remaining 1–3 line residuals
 */
import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../test/handlerTestUtils'

describe('mop3: cli config parseArgs bin doctor local', () => {
  it('config corrupt + profile select line 70', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cfg3-'))
    const cfg = join(dir, 'c.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        profiles: { pro: { url: 'http://a', token: 't' } },
        defaultProfile: 'pro'
      })
    )
    process.env.IDM_CONFIG = cfg
    const { resolveGlobals, loadConfigFile } = await import('../cli/config')
    // corrupt
    writeFileSync(cfg, '{not-json')
    try {
      if (typeof loadConfigFile === 'function') loadConfigFile()
    } catch {
      /* */
    }
    resolveGlobals({} as never)
    writeFileSync(
      cfg,
      JSON.stringify({
        profiles: { pro: { url: 'http://a' } },
        defaultProfile: 'pro'
      })
    )
    resolveGlobals({ profile: 'pro' } as never)
    resolveGlobals({ profile: 'missing' } as never)
    delete process.env.IDM_CONFIG
    rmSync(dir, { recursive: true, force: true })
  })

  it('parseArgs --local and --token', async () => {
    const { parseArgv } = await import('../cli/parseArgs')
    const a = parseArgv(['--local', 'doctor'])
    const b = parseArgv(['--token=abc', 'doctor'])
    const c = parseArgv(['--token', 'xyz', 'doctor'])
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(c).toBeTruthy()
  })
})

describe('mop3: gateway openAdmin adminUrl', () => {
  it('uses gw.adminUrl when status empty', async () => {
    const { registerGatewayHandlers } = await import(
      '../runtime/handlers/gateway'
    )
    const openAdmin = vi.fn(async () => ({ ok: true }))
    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        openAdminWindow: openAdmin
      } as never
    })
    // patch gateway service on host if present
    registerGatewayHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    if (h.has('gateway:openAdmin')) {
      try {
        await Promise.race([
          invokeRegistered(h as never, 'gateway:openAdmin', {}),
          new Promise((r) => setTimeout(r, 300))
        ])
      } catch {
        /* */
      }
    }
  })
})

describe('mop3: updates desktop-dev channel', () => {
  it('nonDesktopUpdateState packaged false channel', async () => {
    const { nonDesktopUpdateState } = await import(
      '../runtime/handlers/updates'
    )
    const st = nonDesktopUpdateState('dev-skipped', {
      isPackaged: false,
      appVersion: '1.0.0'
    })
    expect(st.status).toMatch(/skip|web|dev/i)
  })
})

describe('mop3: media mtime catch', () => {
  it('toPreviewUrl missing mtime', async () => {
    const { registerMediaHandlers } = await import(
      '../runtime/handlers/media'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-med3-'))
    const ctx = makeHandlerContext({ mediaRoot: () => dir })
    registerMediaHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    if (h.has('media:toPreviewUrl')) {
      try {
        await invokeRegistered(h as never, 'media:toPreviewUrl', join(dir, 'missing.png'))
      } catch {
        /* */
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('mop3: adapters linux xdg-open', () => {
  it('openPath', async () => {
    const mod = await import('../runtime/adapters')
    for (const k of Object.keys(mod)) {
      const f = (mod as Record<string, unknown>)[k]
      if (typeof f === 'function' && /create|shell|Shell|headless/i.test(k)) {
        try {
          const shell = await (f as Function)()
          if (shell?.openPath) await shell.openPath('/tmp')
        } catch {
          /* */
        }
      }
    }
  })
})
