import { describe, expect, it } from 'vitest'
import { registerAllHandlers } from './registerAllHandlers'
import { createHeadlessDialog, createHeadlessShell } from './adapters'
import type { HandlerHost } from './HandlerHost'
import { createMockPrisma } from '../test/mockPrisma'
import { SettingsStore } from '../infrastructure/settings/SettingsStore'
import { ActivityLog } from '../infrastructure/activity/ActivityLog'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('registerAllHandlers', () => {
  it('registers 151 channels onto map', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-reg-'))
    try {
      const handlers = new Map<string, (...a: unknown[]) => unknown>()
      const host: HandlerHost = {
        mode: 'headless',
        userData: dir,
        mediaRoot: join(dir, 'media'),
        appVersion: 'test',
        isPackaged: false,
        platform: 'linux',
        getPrisma: () => createMockPrisma() as never,
        settingsStore: new SettingsStore(join(dir, 'settings.json')),
        activity: new ActivityLog(join(dir, 'activity.log')),
        dialog: createHeadlessDialog(),
        shell: createHeadlessShell(),
        getMainWindow: () => null
      }
      registerAllHandlers((ch, fn) => handlers.set(ch, fn), host)
      expect(handlers.size).toBe(151)
      expect(handlers.has('stories:list')).toBe(true)
      expect(handlers.has('generation:run')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
