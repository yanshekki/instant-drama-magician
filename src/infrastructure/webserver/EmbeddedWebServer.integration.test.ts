import { describe, expect, it } from 'vitest'
import { EmbeddedWebServer, generateWebServerToken } from './EmbeddedWebServer'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

describe('EmbeddedWebServer integration', () => {
  it('serves health + authenticated invoke', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'idm-ws-'))
    // Must match EmbeddedWebServer → createRuntime default: dataDir/instant-drama.db
    const dbPath = join(dataDir, 'instant-drama.db')
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../../..'),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: 'pipe'
    })
    process.env.DATABASE_URL = `file:${dbPath}`
    const token = generateWebServerToken()
    const port = 18999
    const server = new EmbeddedWebServer()
    try {
      const status = await server.start({
        dataDir,
        port,
        host: '127.0.0.1',
        authToken: token,
        authDisabled: false,
        appVersion: 'test',
        isPackaged: false
      })
      expect(status.running).toBe(true)
      expect(status.channels).toBeGreaterThanOrEqual(100)

      const health = await fetch(`http://127.0.0.1:${port}/api/health`)
      expect(health.ok).toBe(true)

      const unauth = await fetch(`http://127.0.0.1:${port}/api/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'stories:list', args: [] })
      })
      expect(unauth.status).toBe(401)

      const inv = await fetch(`http://127.0.0.1:${port}/api/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ channel: 'stories:list', args: [] })
      })
      expect(inv.ok).toBe(true)
      const body = (await inv.json()) as { ok: boolean; result: unknown }
      expect(body.ok).toBe(true)
      expect(Array.isArray(body.result)).toBe(true)
    } finally {
      await server.stop()
      rmSync(dataDir, { recursive: true, force: true })
    }
  }, 60_000)
})
