import { describe, expect, it, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createRuntime } from './createRuntime'

describe('createRuntime', () => {
  let dir: string
  let runtime: Awaited<ReturnType<typeof createRuntime>> | null = null

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose()
      runtime = null
    }
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('boots headless runtime with channels', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-rt-'))
    const dbPath = join(dir, 't.db')
    process.env.DATABASE_URL = `file:${dbPath}`
    // Ensure schema exists for list
    const { execSync } = await import('child_process')
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../..'),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: 'pipe'
    })
    runtime = createRuntime({
      dataDir: dir,
      databaseUrl: `file:${dbPath}`,
      appVersion: 'test',
      isPackaged: false
    })
    expect(runtime.channels().length).toBe(153)
    expect(runtime.hasChannel('stories:list')).toBe(true)
    const list = await runtime.invoke('stories:list', [])
    expect(Array.isArray(list)).toBe(true)
  }, 60_000)
})
