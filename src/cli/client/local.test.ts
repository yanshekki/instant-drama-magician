import { describe, expect, it } from 'vitest'
import { createLocalClient, resolveLocalDataDir } from './local'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

describe('createLocalClient', () => {
  it('resolveLocalDataDir returns absolute path', () => {
    expect(resolveLocalDataDir('/tmp/foo')).toContain('foo')
  })

  it('invokes stories:list on temp runtime', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'idm-local-cli-'))
    const dbPath = join(dataDir, 'instant-drama.db')
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../../..'),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: 'pipe'
    })
    process.env.DATABASE_URL = `file:${dbPath}`
    const client = await createLocalClient({ dataDir })
    try {
      expect(client.mode).toBe('local')
      const ch = await client.channels()
      expect(ch.length).toBe(153)
      const list = await client.invoke('stories:list', [])
      expect(Array.isArray(list)).toBe(true)
    } finally {
      await client.dispose?.()
      rmSync(dataDir, { recursive: true, force: true })
    }
  }, 60_000)
})
