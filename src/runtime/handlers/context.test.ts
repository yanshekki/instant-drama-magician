import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHandlerContext } from './context'
import { createHeadlessDialog, createHeadlessShell } from '../adapters'
import { SettingsStore } from '../../infrastructure/settings/SettingsStore'
import { ActivityLog } from '../../infrastructure/activity/ActivityLog'
import { createMockPrisma } from '../../test/mockPrisma'
import type { HandlerHost } from '../HandlerHost'

describe('createHandlerContext', () => {
  it('builds context with service factories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-ctx-'))
    try {
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
      const ctx = createHandlerContext(() => undefined, host)
      expect(typeof ctx.stories).toBe('function')
      expect(typeof ctx.characters).toBe('function')
      expect(ctx.mediaRoot()).toContain('media')
      expect(ctx.userDataPath()).toBe(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
