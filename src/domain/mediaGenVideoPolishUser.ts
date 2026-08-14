/**
 * Domain *VideoPolishUserPrompt bodies for MediaGen video stage (second polish).
 */
import { PromptCatalog } from '../prompts'
import type { MediaGenKind, MediaGenMaterialSection } from './mediaGenPrep'
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

/** Rewrite leftover English beat labels when the UI is Chinese. */
export function localizeBeatDirectorText(text: string, locale: string): string {
  const raw = (text || '').trim()
  if (!raw) return ''
  if (!(locale || '').toLowerCase().startsWith('zh')) return raw
  return raw
    .replace(/^Story:\s*/gim, '故事：')
    .replace(/^Beat #(\d+)\s*·\s*(\d+)s clip/gim, '第 $1 段 · $2 秒片段')
    .replace(/^Beat #(\d+)\s*·\s*/gim, '第 $1 段 · ')
    .replace(/^Style:\s*/gim, '風格：')
    .replace(/^Cast:\s*/gim, '角色：')
    .replace(/^Location:\s*/gim, '場景：')
    .replace(/^Dialogue:\s*/gim, '對白：')
    .replace(/^Primary character:\s*/gim, '主角色：')
    .replace(/^Prop:\s*/gim, '道具：')
    .replace(/^Camera:\s*/gim, '鏡頭：')
    .replace(/^Mood:\s*/gim, '情緒：')
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
  const still = (opts.stillPrompt || '').trim()
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

/** Prefer a polished director line; drop English keyframe boilerplate on zh UI. */
export function pickVideoDirectorPrompt(
  candidate: string | null | undefined,
  fallback: string,
  locale: string
): string {
  const polished = (candidate || '').trim()
  const fb = fallback.trim()
  if (!polished) return fb
  const zh = (locale || '').toLowerCase().startsWith('zh')
  if (zh && looksLikeEnglishKeyframeTaskHint(polished)) return fb || polished
  return polished
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
    revisionPrompt
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
      hardRules
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
      hardRules ? `HARD RULES:\n${hardRules}` : null,
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
      beatOrDialogue: beat || null,
      previousContext: continuity || null,
      revisionPrompt: revisionPrompt || null,
      hardRules
    })
  }
  return null
}
