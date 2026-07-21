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

  it('path getter and cache reuse', () => {
    const s = new SettingsStore(path)
    expect(s.path).toBe(path)
    const a = s.load()
    const b = s.load()
    expect(a).toBe(b)
  })

  it('migrates legacy grok model and gateway defaults on load', () => {
    writeFileSync(
      path,
      JSON.stringify({
        baseUrl: 'http://127.0.0.1:39281/v1',
        videoPath: 'http://127.0.0.1:39281/v1/videos',
        model: 'grok-cli',
        apiKey: ''
      }),
      'utf8'
    )
    const s = new SettingsStore(path)
    const loaded = s.load()
    expect(s.lastLoadMigrated).toBe(true)
    expect(loaded.llmProvider).toBe('grok-gateway')
    expect(loaded.model).toBe('grok-4.5')
    expect(loaded.baseUrl).toMatch(/3847/)
  })
})
