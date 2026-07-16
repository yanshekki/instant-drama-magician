import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings
} from '../../types/settings'

export class SettingsStore {
  private cache: AppSettings | null = null

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath
  }

  load(): AppSettings {
    if (this.cache) return this.cache
    try {
      if (existsSync(this.filePath)) {
        const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<AppSettings>
        this.cache = mergeSettings(raw)
        return this.cache
      }
    } catch {
      // corrupt file → defaults
    }
    this.cache = { ...DEFAULT_SETTINGS }
    return this.cache
  }

  save(partial: Partial<AppSettings>): AppSettings {
    const next = mergeSettings({ ...this.load(), ...partial })
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(next, null, 2), 'utf-8')
    this.cache = next
    return next
  }

  static defaultPath(userDataDir: string): string {
    return join(userDataDir, 'settings.json')
  }
}
