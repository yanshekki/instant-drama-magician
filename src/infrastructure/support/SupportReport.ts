import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import type { AppSettings } from '../../types/settings'
import type { ActivityEntry } from '../activity/ActivityLog'

export interface SupportReportPayload {
  generatedAt: string
  app: {
    version: string
    name: string
    isPackaged: boolean
    platform: string
    electron: string
    userData: string
    mediaRoot: string
  }
  diagnostics: {
    chat: { available: boolean; message: string }
    video: { available: boolean; message: string }
    ffmpeg: { available: boolean; message: string }
    videoMode: string
    tips: string[]
  }
  /** Settings with secrets redacted */
  settings: Record<string, unknown>
  activity: ActivityEntry[]
}

export function redactSettings(settings: AppSettings): Record<string, unknown> {
  return {
    ...settings,
    apiKey: settings.apiKey ? '[redacted]' : '',
    ttsHttpUrl: settings.ttsHttpUrl ? '[set]' : ''
  }
}

export function writeSupportReportJson(
  outPath: string,
  payload: SupportReportPayload
): string {
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8')
  return outPath
}

export function defaultSupportReportName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `idm-support-${stamp}.json`
}

export function supportReportPath(userData: string, fileName?: string): string {
  return join(userData, 'exports', fileName ?? defaultSupportReportName())
}
