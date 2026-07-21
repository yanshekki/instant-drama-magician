import { describe, expect, it, vi } from 'vitest'
import {
  createLocalClient,
  resolveLocalDataDir,
  localDbUrl
} from './local'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

describe('createLocalClient', () => {
  it('resolveLocalDataDir and localDbUrl', () => {
    expect(resolveLocalDataDir('/tmp/foo')).toContain('foo')
    expect(resolveLocalDataDir(null)).toBeTruthy()
    expect(localDbUrl('/tmp/d')).toMatch(/file:.*instant-drama\.db/)
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
    const client = await createLocalClient({
      dataDir,
      appVersion: '9.9.9-test'
    })
    try {
      expect(client.mode).toBe('local')
      const ch = await client.channels()
      expect(ch.length).toBe(153)
      const list = await client.invoke('stories:list', [])
      expect(Array.isArray(list)).toBe(true)
      const d = client.describe?.()
      expect(d).toMatchObject({ mode: 'local' })
      expect((d as { channelCount?: number }).channelCount).toBe(153)
    } finally {
      await client.dispose?.()
      rmSync(dataDir, { recursive: true, force: true })
    }
  }, 60_000)

  it('survives migrate failure', async () => {
    vi.resetModules()
    vi.doMock('../../application/services/AppDataMigrationService', () => ({
      migrateAppDataIfNeeded: () => {
        throw new Error('mig boom')
      }
    }))
    const dataDir = mkdtempSync(join(tmpdir(), 'idm-local-mig-'))
    const dbPath = join(dataDir, 'instant-drama.db')
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../../..'),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: 'pipe'
    })
    const { createLocalClient: create } = await import('./local')
    try {
      const client = await create({ dataDir })
      await client.dispose?.()
    } finally {
      try {
        rmSync(dataDir, { recursive: true, force: true })
      } catch {
        /* busy sqlite on some FS */
      }
      vi.doUnmock('../../application/services/AppDataMigrationService')
      vi.resetModules()
    }
  }, 60_000)
})
