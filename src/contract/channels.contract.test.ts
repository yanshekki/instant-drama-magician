import { describe, expect, it } from 'vitest'
import { DESKTOP_CHANNEL_NAMES } from '../runtime/channelManifest'
import { createRuntime } from '../runtime/createRuntime'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

describe('channel contract', () => {
  it('live runtime registers exactly desktop channel set', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'idm-ch-'))
    const dbPath = join(dataDir, 't.db')
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../..'),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: 'pipe'
    })
    process.env.DATABASE_URL = `file:${dbPath}`
    const rt = createRuntime({ dataDir, databaseUrl: `file:${dbPath}` })
    try {
      const live = new Set(rt.channels())
      expect(live.size).toBe(DESKTOP_CHANNEL_NAMES.length)
      for (const c of DESKTOP_CHANNEL_NAMES) {
        expect(live.has(c), `missing ${c}`).toBe(true)
      }
    } finally {
      void rt.dispose()
      rmSync(dataDir, { recursive: true, force: true })
    }
  })
})
