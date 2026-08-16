import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'
import {
  aspectForComicFormat,
  type ComicPageFormat
} from './comicPageFormat'
import {
  getKeyArtMakeMethod,
  type KeyArtMakeMethodId
} from './keyArtMakeMethods'
import {
  getKeyArtShotType,
  keyArtTypeFormatLockKey,
  type KeyArtShotTypeId
} from './keyArtShotTypes'

export function buildKeyArtFallbackPrompt(opts: {
  locale?: string
  storyTitle: string
  shotOrder: number
  shotType: KeyArtShotTypeId
  pageFormat: ComicPageFormat
  method: KeyArtMakeMethodId
  brief?: string | null
  beatText?: string | null
}): string {
  const locale = PromptCatalog.locale(opts.locale)
  const type = getKeyArtShotType(opts.shotType)
  const method = getKeyArtMakeMethod(opts.method)
  const ar = aspectForComicFormat(opts.pageFormat)
  const lines = [
    PromptCatalog.t(locale, 'keyArt.task', {
      title: opts.storyTitle,
      n: opts.shotOrder
    }),
    PromptCatalog.t(locale, type.lockKey as PromptCopyKey),
    PromptCatalog.t(locale, keyArtTypeFormatLockKey(opts.pageFormat)),
    PromptCatalog.t(locale, `keyArt.${method.lockKey}` as PromptCopyKey),
    opts.brief?.trim()
      ? PromptCatalog.t(locale, 'keyArt.briefLine', { brief: opts.brief.trim() })
      : '',
    opts.beatText?.trim()
      ? PromptCatalog.t(locale, 'keyArt.beatLine', { beat: opts.beatText.trim() })
      : '',
    PromptCatalog.t(locale, 'keyArt.close', { aspect: ar })
  ]
  return lines.filter(Boolean).join('\n')
}
