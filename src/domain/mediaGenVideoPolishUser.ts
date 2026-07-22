/**
 * Domain *VideoPolishUserPrompt bodies for MediaGen video stage (second polish).
 */
import type { MediaGenKind, MediaGenMaterialSection } from './mediaGenPrep'
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

/**
 * Build specialized video polish user content for MediaGen mode=video.
 * Falls back to null when no specialized builder applies (caller uses generic).
 */
export function buildMediaGenVideoPolishUserOverride(opts: {
  kind: MediaGenKind | string
  locale: 'zh-HK' | 'en'
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
      locale === 'en'
        ? 'TASK: Action / motion-guide intro clip (image-to-video).'
        : '任務：動作指導介紹短片（圖生影片）。',
      hasRefImage
        ? locale === 'en'
          ? 'Reference still attached — lock performance identity to that frame.'
          : '參考靜圖已附——表演身份鎖定該幀。'
        : null,
      `Duration: ${seconds}s. Aspect: ${aspectRatio}.`,
      profile || `Action: ${name}`,
      hardRules ? `HARD RULES:\n${hardRules}` : null,
      locale === 'en' ? 'Template draft:' : '模板草稿：',
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
