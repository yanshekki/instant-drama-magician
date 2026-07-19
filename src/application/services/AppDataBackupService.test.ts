import { describe, expect, it } from 'vitest'
import {
  FULL_BACKUP_KIND,
  parseFullBackupManifest,
  settingsPayloadForBackup
} from './AppDataBackupService'
import type { AppSettings } from '../../types/settings'
import { DEFAULT_SETTINGS } from '../../types/settings'

describe('AppDataBackupService helpers', () => {
  it('parses a valid full-backup manifest', () => {
    const m = parseFullBackupManifest({
      version: 1,
      kind: FULL_BACKUP_KIND,
      appVersion: '1.0.0',
      platform: 'linux',
      exportedAt: '2026-01-01T00:00:00.000Z',
      includeSecrets: false,
      includeLogs: true,
      databaseBasename: 'instant-drama.db'
    })
    expect(m.kind).toBe(FULL_BACKUP_KIND)
    expect(m.version).toBe(1)
    expect(m.includeSecrets).toBe(false)
  })

  it('rejects story-style or foreign manifests', () => {
    expect(() =>
      parseFullBackupManifest({
        version: 2,
        kind: 'story',
        storyId: 'x'
      })
    ).toThrow(/full app-data/i)
  })

  it('redacts secrets by default for export payload', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'secret-key-123',
      ttsHttpUrl: 'http://tts.local'
    }
    const redacted = settingsPayloadForBackup(settings, false)
    expect(redacted.apiKey).toBe('[redacted]')
    expect(redacted.ttsHttpUrl).toBe('[set]')

    const full = settingsPayloadForBackup(settings, true)
    expect(full.apiKey).toBe('secret-key-123')
  })
})
