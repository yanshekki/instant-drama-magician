/**
 * Single entry for all default generation prompts.
 * UI chrome stays in i18next; director / system / speech lock copy lives here.
 */
import { coerceUiLanguage, type UiLanguage } from '../domain/uiLanguages'
import { resolvePromptContext } from './resolve'
import {
  PROMPT_COPY_KEYS,
  promptCopyTable,
  type PromptCopyKey
} from './copy'

export class PromptCatalog {
  static locale(lang?: string | null): UiLanguage {
    return coerceUiLanguage(lang, 'zh-HK')
  }

  static t(
    lang: string | null | undefined,
    key: PromptCopyKey,
    vars?: Record<string, string | number | null | undefined>
  ): string {
    const table = promptCopyTable(lang)
    let out = table[key] ?? promptCopyTable('en')[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.split(`{{${k}}}`).join(v == null ? '' : String(v))
      }
    }
    return out
  }

  static context(lang?: string | null) {
    return resolvePromptContext(lang)
  }

  static keys(): readonly PromptCopyKey[] {
    return PROMPT_COPY_KEYS
  }
}
