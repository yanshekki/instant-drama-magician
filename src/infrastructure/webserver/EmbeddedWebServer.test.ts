import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const invoke = vi.fn(async (ch: string) => {
  if (ch === 'stories:list') return []
  if (ch === 'boom') throw new Error(JSON.stringify({ code: 'IO', message: 'x' }))
  return { ch }
})
const channels = vi.fn(() => ['stories:list', 'ai:status'])
const dispose = vi.fn()

vi.mock('../../runtime/createRuntime', () => ({
  createRuntime: () => ({
    invoke,
    channels,
    dispose
  })
}))

import {
  EmbeddedWebServer,
  generateWebServerToken
} from './EmbeddedWebServer'

describe('EmbeddedWebServer', () => {
  let dataDir: string
  let server: EmbeddedWebServer | null = null

  afterEach(async () => {
    if (server) {
      await server.stop()
      server = null
    }
    if (dataDir) {
      try {
        rmSync(dataDir, { recursive: true, force: true })
      } catch {
        /* */
      }
    }
    invoke.mockClear()
    channels.mockClear()
    dispose.mockClear()
  })

  it('constructs and reports stopped status', () => {
    const s = new EmbeddedWebServer()
    const st = s.getStatus()
    expect(st.running).toBe(false)
    expect(st.channels).toBe(0)
  })

  it('generateWebServerToken is hex', () => {
    const t = generateWebServerToken()
    expect(t).toMatch(/^[0-9a-f]{48}$/)
  })

  it('starts, serves health/channels/invoke/static and stops', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'idm-ews-'))
    const staticDir = join(dataDir, 'static')
    mkdirSync(staticDir, { recursive: true })
    writeFileSync(join(staticDir, 'index.html'), '<html>ok</html>')
    writeFileSync(join(staticDir, 'app.js'), 'console.log(1)')

    server = new EmbeddedWebServer()
    const token = 'tok123'
    const st = await server.start({
      dataDir,
      port: 0, // will clamp
      host: '127.0.0.1',
      authToken: token,
      authDisabled: false,
      staticDir,
      appVersion: '9.9.9',
      isPackaged: false
    })
    // port 0 clamps to 8787 via Math.max(1, Math.min(...)) — actually Math.floor(0)||8787
    expect(st.running).toBe(true)
    expect(st.authRequired).toBe(true)
    expect(st.staticReady).toBe(true)
    expect(st.channels).toBe(2)

    const port = st.port
    const base = `http://127.0.0.1:${port}`

    // OPTIONS CORS
    const opt = await fetch(`${base}/api/health`, { method: 'OPTIONS' })
    expect(opt.status).toBe(204)

    const health = await fetch(`${base}/api/health`)
    expect(health.ok).toBe(true)
    const hj = (await health.json()) as { version: string }
    expect(hj.version).toBe('9.9.9')

    // unauth channels
    const unauthCh = await fetch(`${base}/api/channels`)
    expect(unauthCh.status).toBe(401)

    // auth via query token
    const ch = await fetch(`${base}/api/channels?token=${token}`)
    expect(ch.ok).toBe(true)

    // unauth invoke
    const unauth = await fetch(`${base}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'stories:list', args: [] })
    })
    expect(unauth.status).toBe(401)

    // bad json
    const bad = await fetch(`${base}/api/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: 'not-json'
    })
    expect(bad.status).toBe(400)

    // missing channel
    const noCh = await fetch(`${base}/api/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ args: [] })
    })
    expect(noCh.status).toBe(400)

    // success
    const ok = await fetch(`${base}/api/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ channel: 'stories:list', args: [] })
    })
    expect(ok.ok).toBe(true)
    expect(((await ok.json()) as { ok: boolean }).ok).toBe(true)

    // static index
    const html = await fetch(`${base}/`)
    expect(html.ok).toBe(true)
    expect(await html.text()).toContain('ok')

    // static js
    const js = await fetch(`${base}/app.js`)
    expect(js.ok).toBe(true)

    // SPA fallback for missing path
    const spa = await fetch(`${base}/some/client/route`)
    expect(spa.ok).toBe(true)

    await server.stop()
    expect(server.getStatus().running).toBe(false)
    // second stop is no-op
    await server.stop()
    server = null
  })

  it('authDisabled allows invoke without token', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'idm-ews-d-'))
    server = new EmbeddedWebServer()
    const st = await server.start({
      dataDir,
      port: 19101,
      host: '127.0.0.1',
      authDisabled: true,
      appVersion: 't'
    })
    const r = await fetch(`http://127.0.0.1:${st.port}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'stories:list', args: [] })
    })
    expect(r.ok).toBe(true)
  })

  it('empty authToken allows loopback', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'idm-ews-lb-'))
    server = new EmbeddedWebServer()
    const st = await server.start({
      dataDir,
      port: 19102,
      host: '127.0.0.1',
      authToken: '',
      authDisabled: false
    })
    const r = await fetch(`http://127.0.0.1:${st.port}/api/channels`)
    // loopback without token should pass when authToken empty
    expect(r.ok).toBe(true)
  })

  it('restart when already running', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'idm-ews-r-'))
    server = new EmbeddedWebServer()
    await server.start({
      dataDir,
      port: 19103,
      host: '127.0.0.1',
      authDisabled: true
    })
    const st2 = await server.start({
      dataDir,
      port: 19103,
      host: '127.0.0.1',
      authDisabled: true
    })
    expect(st2.running).toBe(true)
  })
})
