import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SettingsStore } from './SettingsStore'

describe('SettingsStore', () => {
  let dir: string
  let path: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-settings-'))
    path = join(dir, 'settings.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads defaults when file missing', () => {
    const s = new SettingsStore(path)
    const settings = s.load()
    expect(settings).toBeTruthy()
    expect(settings.webServerPort).toBeDefined()
  })

  it('save and reload merges partial', () => {
    const s = new SettingsStore(path)
    s.save({ uiLanguage: 'en', apiKey: 'gk_test' })
    const s2 = new SettingsStore(path)
    const loaded = s2.load()
    expect(loaded.uiLanguage).toBe('en')
    expect(loaded.apiKey).toBe('gk_test')
  })

  it('corrupt file falls back to defaults', () => {
    writeFileSync(path, '{not-json', 'utf8')
    const s = new SettingsStore(path)
    expect(s.load()).toBeTruthy()
  })
})
