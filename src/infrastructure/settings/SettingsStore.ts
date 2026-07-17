import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { migrateGatewayDefaults } from '../../domain/gatewayDefaults'
import { inferLlmPreset } from '../../domain/openaiCompatible'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings
} from '../../types/settings'

export class SettingsStore {
  private cache: AppSettings | null = null
  /** True if last load migrated legacy :39281 defaults */
  lastLoadMigrated = false

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath
  }

  load(): AppSettings {
    if (this.cache) return this.cache
    try {
      if (existsSync(this.filePath)) {
        const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<AppSettings>
        let merged = mergeSettings(raw)
        const { settings, migrated } = migrateGatewayDefaults(merged)
        merged = {
          ...settings,
          // Align preset tag with base URL when missing / stale
          llmProvider: settings.llmProvider ?? inferLlmPreset(settings.baseUrl)
        }
        // If URL looks like grok gateway but preset wrong after migrate
        if (migrated) {
          merged.llmProvider = 'grok-gateway'
        }
        // Refresh legacy default model name
        if (
          merged.llmProvider === 'grok-gateway' &&
          (merged.model === 'grok-cli' || !merged.model?.trim())
        ) {
          merged.model = 'grok-4.5'
        }
        this.lastLoadMigrated = migrated
        this.cache = merged
        const shouldPersist =
          migrated ||
          raw.llmProvider === undefined ||
          raw.model === 'grok-cli' ||
          !raw.model
        if (shouldPersist) {
          mkdirSync(dirname(this.filePath), { recursive: true })
          writeFileSync(this.filePath, JSON.stringify(merged, null, 2), 'utf-8')
        }
        return this.cache
      }
    } catch {
      // corrupt file → defaults
    }
    this.lastLoadMigrated = false
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
