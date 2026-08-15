/**
 * Domain *VideoPolishUserPrompt bodies for MediaGen video stage (second polish).
 */
import { PromptCatalog } from '../prompts'
import { UI_LANGUAGES } from './uiLanguages'
import type { MediaGenKind, MediaGenMaterialSection } from './mediaGenPrep'
import {
  HARD_RULES_FOOTER,
  HARD_RULES_HEADER,
  hardRulesSealFooter,
  hardRulesSealHeader,
  stripHardRulesBlocks
} from './promptHardRules'
import { buildSpeechLanguageLockText } from './speechLanguageLock'
import {
  buildClipVideoPolishUserPrompt,
  buildCostumeIntroVideoPolishUserPrompt,
  buildIntroVideoPolishUserPrompt,
  buildPropIntroVideoPolishUserPrompt,
  buildSceneIntroVideoPolishUserPrompt
} from './videoPromptPolish'

function sectionText(
  sections: MediaGenMaterialSection[],
  id: string
): string {
  return sections.find((s) => s.id === id)?.text?.trim() || ''
}

function firstProfileName(sections: MediaGenMaterialSection[]): string {
  const t = sectionText(sections, 'profile') || sectionText(sections, 'beat_profile')
  const m = /(?:Name|Character|Title|Scene|Prop|Action)[:：]\s*(.+)/i.exec(t)
  if (m?.[1]) return m[1].split('\n')[0]!.trim().slice(0, 80)
  return sections.find((s) => s.kind === 'text-profile')?.title || 'Subject'
}

/** Rewrite leftover English beat labels into the UI language. */
export function localizeBeatDirectorText(text: string, locale: string): string {
  const raw = (text || '').trim()
  if (!raw) return ''
  const loc = locale || 'zh-HK'
  const L = (key: string, vars?: Record<string, string | number>) =>
    PromptCatalog.t(loc, key, vars)
  return raw
    .replace(/^Story:\s*/gim, L('directorLabel.story'))
    .replace(
      /^Beat #(\d+)\s*·\s*(\d+)s clip/gim,
      (_, n, s) => L('directorLabel.beatNsec', { n, s })
    )
    .replace(/^Beat #(\d+)\s*·\s*/gim, (_, n) => L('directorLabel.beatN', { n }))
    .replace(/^Style bible:\s*/gim, L('directorLabel.style'))
    .replace(/^Style:\s*/gim, L('directorLabel.style'))
    .replace(/^Cast:\s*/gim, L('directorLabel.cast'))
    .replace(/^Location:\s*/gim, L('directorLabel.location'))
    .replace(/^Dialogue:\s*/gim, L('directorLabel.speech'))
    .replace(/^Primary character:\s*/gim, L('directorLabel.primaryChar'))
    .replace(/^Prop:\s*/gim, L('directorLabel.prop'))
    .replace(/^Camera:\s*/gim, L('directorLabel.camera'))
    .replace(/^Mood:\s*/gim, L('directorLabel.mood'))
    .replace(/^Beat atmosphere:\s*/gim, L('directorLabel.atmo'))
    .replace(/\bBeat atmosphere:\s*/g, L('directorLabel.atmo'))
    .replace(/^SFX cues:\s*/gim, L('directorLabel.sfx'))
    .replace(/\bSFX cues:\s*/g, L('directorLabel.sfx'))
    .replace(/^VISUAL ACTION:\s*/gim, L('directorLabel.action'))
    .replace(/\bVISUAL ACTION:\s*/g, L('directorLabel.action'))
    .replace(/^EXPRESSION:\s*/gim, L('directorLabel.expr'))
    .replace(/\bEXPRESSION:\s*/g, L('directorLabel.expr'))
    .replace(/^SPEECH \(spoken lines\):\s*/gim, L('directorLabel.speech'))
    .replace(/SPEECH \(spoken lines\):\s*/gi, L('directorLabel.speech'))
    .replace(/^Director notes:\s*/gim, L('directorLabel.notes'))
    .replace(/^IDENTITY:\s*/gim, L('directorLabel.identity'))
    .replace(/^SPACE:\s*/gim, L('directorLabel.space'))
    .replace(/^ACTION:\s*/gim, L('directorLabel.action'))
    .replace(/Ref#(\d+)/g, `${L('directorLabel.ref')}$1`)
}

/** English still/video taskHint leaked into the director box. */
export function looksLikeEnglishKeyframeTaskHint(text: string): boolean {
  const raw = (text || '').trim()
  if (!raw) return false
  return (
    /Keyframe still then short-drama video/i.test(raw) ||
    /Continuity-lock previous frame when attached/i.test(raw) ||
    /^IMAGE-TO-VIDEO:\s*animate this keyframe/i.test(raw)
  )
}

/**
 * Usable image-to-video director fallback when polish fails or echoes
 * the English keyframe taskHint. Never starts with that boilerplate.
 */
export function buildMediaGenVideoDirectorFallback(opts: {
  locale: string
  seconds: number
  aspectRatio: string
  stillPrompt?: string | null
  beatText?: string | null
}): string {
  const loc = opts.locale || 'zh-HK'
  const still = localizeBeatDirectorText((opts.stillPrompt || '').trim(), loc)
  const beat = localizeBeatDirectorText((opts.beatText || '').trim(), loc)
  const stillOk = still && !looksLikeEnglishKeyframeTaskHint(still) ? still : ''
  return [
    PromptCatalog.t(loc, 'mediaGen.directorFallback'),
    PromptCatalog.t(loc, 'mediaGen.directorFallbackCam'),
    buildSpeechLanguageLockText({ locale: loc, uiLocale: loc }),
    beat || null,
    stillOk || null,
    PromptCatalog.t(loc, 'common.durationAspect', {
      seconds: opts.seconds,
      aspect: opts.aspectRatio
    })
  ]
    .filter(Boolean)
    .join('\n')
}

function lockOnlyMarkerTokens(): string[] {
  const toks = [
    '對白鎖定',
    '对白锁定',
    '口白鎖定',
    '口白锁定',
    '生成鐵則',
    '生成铁则',
    'SPEECH LOCK',
    'HARD RULES'
  ]
  for (const lang of UI_LANGUAGES) {
    toks.push(PromptCatalog.t(lang.id, 'directorLabel.lock'))
    toks.push(PromptCatalog.t(lang.id, 'directorLabel.hardRules'))
  }
  return [...new Set(toks.filter(Boolean))]
}

/** Polished output that is only a speech/hard-rules seal — not a director line. */
export function looksLikeLockOnlyDirector(text: string): boolean {
  const raw = (text || '').trim()
  if (!raw) return true
  const markers = lockOnlyMarkerTokens()
  if (!markers.some((tok) => raw.includes(tok))) return false
  let rest = stripHardRulesBlocks(raw)
  for (const tok of markers) {
    rest = rest.split(tok).join('')
  }
  rest = rest
    .replace(/If any earlier instruction conflicts[^\n]*/gi, '')
    .replace(/若前文與生成鐵則衝突[^\n]*/g, '')
    .replace(/若前文与生成铁则冲突[^\n]*/g, '')
    .replace(/[·•|:：\-\s]+/g, ' ')
    .trim()
  return rest.length < 40
}

/** Rewrite leftover English seals into the current UI language. */
export function rewriteDirectorSealWording(
  text: string,
  locale: string
): string {
  const raw = text || ''
  if (!raw) return raw
  const loc = locale || 'zh-HK'
  const lock = PromptCatalog.t(loc, 'directorLabel.lock')
  const hard = PromptCatalog.t(loc, 'directorLabel.hardRules')
  const identityLock = PromptCatalog.t(loc, 'directorLabel.identityLock')
  const spaceLock = PromptCatalog.t(loc, 'directorLabel.spaceLock')
  const continuityShort = PromptCatalog.t(loc, 'continuity.lockHeader')
    .replace(/[（(].*/u, '')
    .replace(/[:：]\s*$/u, '')
    .trim()
  const prevPrefix = PromptCatalog.t(loc, 'continuity.prevContext', {
    snippet: ''
  }).replace(/\s+$/u, '')
  let s = raw
  s = s.replace(/SPEECH LOCK/g, lock)
  s = s.replace(/口白鎖定/g, lock)
  s = s.replace(/口白锁定/g, lock)
  s = s.replace(/IDENTITY LOCK/g, identityLock)
  s = s.replace(/SPACE LOCK/g, spaceLock)
  s = s.replace(
    /CONTINUITY LOCK \(must obey for short-drama sequence\):/g,
    PromptCatalog.t(loc, 'continuity.lockHeader')
  )
  s = s.replace(/CONTINUITY LOCK/g, continuityShort)
  s = s.replace(/Previous beat context:/g, prevPrefix)
  s = s.replace(
    /^No text overlays, logos, watermarks\./gim,
    PromptCatalog.t(loc, 'continuity.noText')
  )
  if ((loc || '').toLowerCase().startsWith('zh')) {
    s = s.replace(/口白語言/g, loc.toLowerCase().startsWith('zh-cn') ? '对白语言' : '對白語言')
    s = s.replace(/口白语言/g, '对白语言')
    s = s.replace(/口白/g, loc.toLowerCase().startsWith('zh-cn') ? '对白' : '對白')
  }
  s = s.split(HARD_RULES_HEADER).join(hardRulesSealHeader(loc))
  s = s.split(HARD_RULES_FOOTER).join(hardRulesSealFooter(loc))
  s = s.replace(/HARD RULES/g, hard)
  return localizeBeatDirectorText(s, loc)
}

/** Prefer a polished director line; drop English keyframe boilerplate. */
export function pickVideoDirectorPrompt(
  candidate: string | null | undefined,
  fallback: string,
  locale: string
): string {
  const polished = (candidate || '').trim()
  const fb = fallback.trim()
  if (!polished) return rewriteDirectorSealWording(fb, locale)
  if (looksLikeEnglishKeyframeTaskHint(polished)) {
    return rewriteDirectorSealWording(fb || polished, locale)
  }
  if (looksLikeLockOnlyDirector(polished)) {
    return rewriteDirectorSealWording(fb || polished, locale)
  }
  return rewriteDirectorSealWording(polished, locale)
}

/**
 * Build specialized video polish user content for MediaGen mode=video.
 * Falls back to null when no specialized builder applies (caller uses generic).
 */
export function buildMediaGenVideoPolishUserOverride(opts: {
  kind: MediaGenKind | string
  locale: string
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  hardRules?: string | null
  includedSections: MediaGenMaterialSection[]
  /** Timeline director revision / user extra */
  revisionPrompt?: string | null
  promptTemplateId?: string | null
}): string | null {
  const {
    kind,
    locale,
    seconds,
    aspectRatio = '16:9',
    hasRefImage,
    fallbackPrompt,
    hardRules,
    includedSections,
    revisionPrompt,
    promptTemplateId
  } = opts
  const name = firstProfileName(includedSections)
  const profile = sectionText(includedSections, 'profile')
  const beat = sectionText(includedSections, 'beat_profile')
  const continuity = sectionText(includedSections, 'continuity_lock')

  if (kind === 'character-intro') {
    return buildIntroVideoPolishUserPrompt({
      locale,
      seconds,
      aspectRatio,
      hasRefImage,
      fallbackPrompt,
      name,
      description: profile.slice(0, 400) || name,
      hardRules
    })
  }
  if (kind === 'costume-intro') {
    return buildCostumeIntroVideoPolishUserPrompt({
      locale,
      seconds,
      aspectRatio,
      hasRefImage,
      fallbackPrompt,
      name,
      description: profile.slice(0, 600) || name,
      hardRules
    })
  }
  if (kind === 'scene-intro') {
    return buildSceneIntroVideoPolishUserPrompt({
      locale,
      seconds,
      aspectRatio,
      hasRefImage,
      fallbackPrompt,
      title: name,
      description: profile.slice(0, 800) || name,
      hardRules,
      promptTemplateId
    })
  }
  if (kind === 'prop-intro') {
    return buildPropIntroVideoPolishUserPrompt({
      locale,
      seconds,
      aspectRatio,
      hasRefImage,
      fallbackPrompt,
      name,
      description: profile.slice(0, 600) || name,
      hardRules
    })
  }
  if (kind === 'action-intro') {
    return [
      PromptCatalog.t(locale, 'actionIntroPolish.task'),
      hasRefImage
        ? PromptCatalog.t(locale, 'actionIntroPolish.hasRef')
        : null,
      PromptCatalog.t(locale, 'common.durationAspect', {
        seconds,
        aspect: aspectRatio
      }),
      profile || `Action: ${name}`,
      hardRules
        ? `${PromptCatalog.t(locale, 'hardRules.sealHeader')}\n${hardRules}`
        : null,
      PromptCatalog.t(locale, 'common.templateDraft'),
      fallbackPrompt
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (kind === 'timeline-clip') {
    const storyLine =
      /Story:\s*(.+)/i.exec(beat)?.[1]?.trim() ||
      'Story'
    return buildClipVideoPolishUserPrompt({
      locale,
      seconds,
      aspectRatio,
      hasRefImage,
      fallbackPrompt,
      storyTitle: storyLine.slice(0, 120),
      styleNote: /Style:\s*(.+)/i.exec(beat)?.[1] ?? null,
      beatOrDialogue: beat
        ? localizeBeatDirectorText(beat, locale)
        : null,
      previousContext: continuity
        ? localizeBeatDirectorText(continuity, locale)
        : null,
      revisionPrompt: revisionPrompt || null,
      hardRules
    })
  }
  return null
}
