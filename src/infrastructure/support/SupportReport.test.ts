import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  defaultSupportReportName,
  redactSettings,
  supportReportPath,
  writeSupportReportJson
} from './SupportReport'
import { DEFAULT_SETTINGS } from '../../types/settings'

describe('SupportReport', () => {
  it('redacts secrets and marks optional urls', () => {
    const r = redactSettings({
      ...DEFAULT_SETTINGS,
      apiKey: 'secret-key-value',
      ttsHttpUrl: 'http://localhost/tts',
      webServerAuthToken: 'tok',
      imageApiKey: 'ik',
      videoApiKey: 'vk'
    })
    expect(r.apiKey).toBe('[redacted]')
    expect(r.ttsHttpUrl).toBe('[set]')
    expect(r.webServerAuthToken).toBe('[redacted]')
    expect(r.imageApiKey).toBe('[redacted]')
    expect(r.videoApiKey).toBe('[redacted]')
    expect(r.videoMode).toBe(DEFAULT_SETTINGS.videoMode)

    const empty = redactSettings({
      ...DEFAULT_SETTINGS,
      apiKey: '',
      ttsHttpUrl: '',
      webServerAuthToken: '',
      imageApiKey: '',
      videoApiKey: ''
    })
    expect(empty.apiKey).toBe('')
    expect(empty.ttsHttpUrl).toBe('')
  })

  it('default name and path under exports', () => {
    const name = defaultSupportReportName()
    expect(name).toMatch(/^idm-support-.*\.json$/)
    expect(supportReportPath('/data', 'x.json')).toBe(
      join('/data', 'exports', 'x.json')
    )
    expect(supportReportPath('/data')).toMatch(/exports\/idm-support-/)
  })

  it('writeSupportReportJson creates file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-support-'))
    try {
      const out = join(dir, 'nested', 'report.json')
      const path = writeSupportReportJson(out, {
        generatedAt: '2026-01-01T00:00:00.000Z',
        app: {
          version: '1',
          name: 'idm',
          isPackaged: false,
          platform: 'linux',
          electron: '0',
          userData: '/u',
          mediaRoot: '/m'
        },
        diagnostics: {
          chat: { available: true, message: 'ok' },
          video: { available: false, message: 'no' },
          ffmpeg: { available: true, message: 'ok' },
          videoMode: 'auto',
          tips: []
        },
        settings: {},
        activity: []
      })
      expect(path).toBe(out)
      expect(JSON.parse(readFileSync(out, 'utf-8')).app.version).toBe('1')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
