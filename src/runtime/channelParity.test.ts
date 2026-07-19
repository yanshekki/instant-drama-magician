import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DESKTOP_CHANNEL_NAMES } from './channelManifest'
import { createRuntime } from './createRuntime'

describe('channel parity', () => {
  it('registers all desktop IPC channels in headless runtime', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-parity-'))
    process.env.DATABASE_URL = `file:${join(dir, 'test.db')}`
    const rt = createRuntime({ dataDir: dir, appVersion: 'test' })
    try {
      const live = new Set(rt.channels())
      expect(live.size).toBeGreaterThanOrEqual(137)
      const missing = DESKTOP_CHANNEL_NAMES.filter((c) => !live.has(c))
      expect(missing).toEqual([])
    } finally {
      void rt.dispose()
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })
})
