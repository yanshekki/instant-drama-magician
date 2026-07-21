/**
 * AI prompts for story style bible + short-drama script beats (timeline).
 */

import { buildImproveUserPrompt } from './aiImprovePrompt'
import type { BeatContent, BeatUnit } from './beatContent'
import { AppError } from '../types/errors'
import {
  beatContentToJson,
  estimateBeatDurationSeconds,
  normalizeBeatContent,
  serializeBeatContent,
  spokenSummaryFromBeatContent
} from './beatContent'
import {
  defaultHardRulesFallback,
  hardRulesAiInstruction,
  normalizeHardRules
} from './promptHardRules'

export function buildStoryMetaSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You are a short-drama showrunner.',
      'Given a story title and optional idea, write a concise visual style bible AND hard rules for cover + clip generation.',
      'Return ONLY JSON (no fences): {"styleNote":"2-5 sentences: tone, lighting, camera, color, pacing","hardRules":"3-8 MUST/MUST-NOT lines for image & video"}',
      hardRulesAiInstruction('en'),
      'Concrete, filmable language for AI video continuity.',
      'Use title, idea, existing style note / hard rules, and any context snippets; if thin, invent freely a coherent style bible + rules.'
    ].join(' ')
  }
  return [
    '你是短劇主創／視覺總監。',
    '根據故事標題與構想，寫簡潔可拍的風格備註（Style bible）以及出圖／出片「生成鐵則」。',
    '只回傳 JSON（不要代碼塊）：{"styleNote":"2–5 句：氣氛、光線、鏡頭、色調、節奏","hardRules":"3–8 句必須／禁止"}',
    hardRulesAiInstruction('zh-HK'),
    '要具體、適合 AI 影片／出圖延續。',
    '用提供的標題、構想、現有風格／鐵則與上下文；不足就自由補齊一套連貫風格與鐵則。'
  ].join(' ')
}

export function buildStoryMetaUserPrompt(options: {
  title: string
  idea?: string
  existingStyleNote?: string | null
  existingHardRules?: string | null
  /** Cast / scene / prop blurbs for richer style direction */
  contextSnippets?: string[]
  locale?: 'zh-HK' | 'en'
}): string {
  const extras =
    options.contextSnippets?.filter(Boolean).length
      ? [
          {
            labelEn: 'Story context (cast / scenes / props):',
            labelZh: '故事上下文（角色／場景／道具）：',
            body: options.contextSnippets!.filter(Boolean).join('\n')
          }
        ]
      : []
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea?.trim() || options.title,
    draft: {
      title: options.title,
      styleNote: options.existingStyleNote ?? '',
      hardRules: options.existingHardRules ?? ''
    },
    draftLabel: {
      en: 'Current story fields:',
      zh: '目前故事欄位：'
    },
    extraBlocks: extras,
    createLabel: { en: 'Story idea / title:', zh: '故事構想／標題：' },
    emptyIdeaPolish: {
      en: '(polish visual style bible + hardRules for AI video continuity)',
      zh: '（潤飾視覺風格備註與生成鐵則，利於 AI 出片 continuity）'
    },
    closing: {
      en: 'Return ONLY JSON: {"styleNote":"…","hardRules":"…"}. Both keys required and non-empty.',
      zh: '只回傳 JSON：{"styleNote":"…","hardRules":"…"}。兩個鍵都必填且非空。'
    }
  })
}

export type StoryMetaExtract = {
  styleNote: string
  hardRules: string
}

export function extractStoryMetaJson(
  text: string,
  locale: 'zh-HK' | 'en' = 'zh-HK'
): StoryMetaExtract {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const brace = s.match(/\{[\s\S]*\}/)
  if (brace) s = brace[0]
  const parsed = JSON.parse(s) as {
    styleNote?: unknown
    hardRules?: unknown
  }
  const note =
    typeof parsed.styleNote === 'string' ? parsed.styleNote.trim() : ''
  if (!note) throw new AppError('VALIDATION', 'errors.styleNoteRequired')
  const rules =
    normalizeHardRules(
      typeof parsed.hardRules === 'string' ? parsed.hardRules : null
    ) || defaultHardRulesFallback('story', locale)
  return { styleNote: note, hardRules: rules }
}

/** @deprecated prefer extractStoryMetaJson */
export function extractStyleNoteJson(text: string): string {
  return extractStoryMetaJson(text).styleNote
}

export interface StoryBeatDraft {
  /** Primary character name as in cast, or empty */
  characterName: string
  /** Extra character names appearing in this beat (dialogue/action who) */
  characterNames: string[]
  /** 1-based scene number preferred, or scene title fragment */
  sceneHint: string
  propName: string
  /** Spoken-line cache (may be multi-line) */
  dialogue: string
  /** Full structured screenplay for the clip */
  content: BeatContent
  /** Human-readable script for editor */
  scriptText: string
  beatContentJson: string
}

export function buildStoryBeatsSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You write short-drama TIMELINE BEATS for AI video.',
      'Each beat = ONE short clip screenplay (not a single spoken line).',
      'A beat MUST include rich performance content: mood, atmosphere, actions, expressions, optional camera/sfx, and zero or more spoken dialogue lines (1–4 lines common).',
      'Return ONLY a JSON array (no fences). Each item shape:',
      '{"characterName":"primary cast name or empty","characterNames":["optional extra cast"],"sceneHint":"scene number or title","propName":"prop or empty","mood":"…","atmosphere":"…","camera":"optional","sfx":"optional","units":[{"type":"action","who":"Name","text":"…"},{"type":"expression","who":"Name","text":"…"},{"type":"dialogue","who":"Name","line":"spoken words only","tone":"optional delivery","parenthetical":"optional"},{"type":"note","text":"optional"}]}',
      'Rules:',
      '- units.type dialogue.line = ONLY words the character speaks (no stage directions inside line).',
      '- Put physical business in action; face/micro-performance in expression; delivery in tone/parenthetical.',
      '- Multiple dialogue units in one beat are encouraged when the clip has a short exchange or self-talk.',
      '- Pure action beats (no dialogue) are allowed.',
      '- Write 4–8 beats. Use only cast names provided.',
      '- Prefer conflict, clear visual action, filmable detail.',
      '- Stay faithful to the title, style, cast, and scenes provided; if thin, invent freely within that cast/world.'
    ].join('\n')
  }
  return [
    '你為短劇時間軸撰寫「劇情段落」——每一段 = 一小段 AI 影片的完整拍攝腳本，而非一句對白。',
    '每段必須有豐富表演內容：心情、氣氛、動作、表情、可選鏡頭／聲效，以及 0 至多句口白（常見 1–4 句）。',
    '只回傳 JSON 陣列（不要代碼塊）。每項形狀：',
    '{"characterName":"主角色名或空","characterNames":["其他出場角色"],"sceneHint":"場次號或場景名","propName":"道具或空","mood":"…","atmosphere":"…","camera":"可選","sfx":"可選","units":[{"type":"action","who":"名","text":"…"},{"type":"expression","who":"名","text":"…"},{"type":"dialogue","who":"名","line":"只寫口白","tone":"語氣可選","parenthetical":"括註可選"},{"type":"note","text":"可選"}]}',
    '規則：',
    '- dialogue.line 只寫角色講出口的話，不要把動作寫進口白。',
    '- 肢體動作放 action；表情微表演放 expression；語氣放 tone／parenthetical。',
    '- 一段可有多句對白（對話回合或自語）。',
    '- 允許純動作段（無對白）。',
    '- 寫 4–8 段。角色名必須用提供名單。',
    '- 要有衝突、可視動作、可拍細節。',
    '- 忠於已提供的標題、風格、選角與場景；不足就在同一世界內自由補齊。'
  ].join('\n')
}

export function buildStoryBeatsUserPrompt(options: {
  title: string
  styleNote?: string | null
  idea?: string
  characters: Array<{ name: string; description?: string }>
  scenes: Array<{ sceneNumber?: number; title?: string | null; description: string }>
  props: Array<{ name: string; description?: string }>
  locale?: 'zh-HK' | 'en'
}): string {
  const en = options.locale === 'en'
  const chars =
    options.characters
      .map((c) => `- ${c.name}${c.description ? `: ${c.description.slice(0, 160)}` : ''}`)
      .join('\n') || (en ? '(no cast)' : '（無角色）')
  const scenes =
    options.scenes
      .map(
        (s) =>
          `- #${s.sceneNumber ?? '?'} ${s.title || s.description.slice(0, 100)}`
      )
      .join('\n') || (en ? '(no scenes — invent locations in sceneHint)' : '（無場景 — sceneHint 可寫地點）')
  const props =
    options.props
      .map(
        (p) =>
          p.description
            ? `${p.name} (${p.description.slice(0, 60)})`
            : p.name
      )
      .join(', ') || (en ? '(none)' : '（無）')
  return [
    en
      ? 'GENERATE full clip screenplay beats using ALL cast, scenes, props, style, and idea below.'
      : '生成完整「短片腳本」段落：使用下方全部選角、場景、道具、風格與構想。',
    en
      ? 'Each beat needs mood + atmosphere + actions/expressions + optional multi-line dialogue.'
      : '每段要有心情、氣氛、動作／表情，以及可選的多句對白。',
    en ? `Story: ${options.title}` : `故事：${options.title}`,
    options.styleNote?.trim()
      ? en
        ? `Style: ${options.styleNote.trim()}`
        : `風格：${options.styleNote.trim()}`
      : '',
    options.idea?.trim()
      ? en
        ? `User direction: ${options.idea.trim()}`
        : `用戶指示：${options.idea.trim()}`
      : '',
    en ? 'Cast:' : '角色：',
    chars,
    en ? 'Scenes:' : '場景：',
    scenes,
    en ? `Props: ${props}` : `道具：${props}`,
    en ? 'Return beats JSON array only.' : '只回傳段落 JSON 陣列。'
  ]
    .filter(Boolean)
    .join('\n')
}

function unitsFromLegacyDialogue(dialogue: string): BeatUnit[] {
  const t = dialogue.trim()
  if (!t) return []
  // If it looks like pure speech
  if (t.length < 80 && !/[，。；]/.test(t.slice(10))) {
    return [{ type: 'dialogue', who: '', line: t }]
  }
  return [{ type: 'action', text: t }]
}

export function extractStoryBeatsJson(
  text: string,
  locale: 'zh-HK' | 'en' = 'zh-HK'
): StoryBeatDraft[] {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const arrMatch = s.match(/\[[\s\S]*\]/)
  if (arrMatch) s = arrMatch[0]
  const parsed = JSON.parse(s) as unknown
  if (!Array.isArray(parsed)) throw new AppError('VALIDATION', 'errors.beatsMustBeArray')
  const out: StoryBeatDraft[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const characterName =
      typeof o.characterName === 'string' ? o.characterName.trim() : ''
    const characterNames: string[] = []
    if (Array.isArray(o.characterNames)) {
      for (const n of o.characterNames) {
        if (typeof n === 'string' && n.trim()) characterNames.push(n.trim())
      }
    }
    const sceneHint =
      typeof o.sceneHint === 'string'
        ? o.sceneHint.trim()
        : typeof o.sceneNumber === 'number'
          ? String(o.sceneNumber)
          : ''
    const propName = typeof o.propName === 'string' ? o.propName.trim() : ''

    let content = normalizeBeatContent({
      version: 1,
      mood: o.mood,
      atmosphere: o.atmosphere,
      camera: o.camera,
      sfx: o.sfx,
      units: o.units
    })

    // Legacy: single dialogue / line / script field
    if (!content) {
      const legacy =
        typeof o.script === 'string'
          ? o.script.trim()
          : typeof o.dialogue === 'string'
            ? o.dialogue.trim()
            : typeof o.line === 'string'
              ? o.line.trim()
              : ''
      if (!legacy) continue
      const units = unitsFromLegacyDialogue(legacy)
      content = {
        version: 1,
        units:
          characterName && units[0]?.type === 'dialogue'
            ? [{ ...units[0], who: characterName || units[0].who }]
            : units
      }
    }

    // Ensure primary character name collected
    if (characterName && !characterNames.includes(characterName)) {
      characterNames.unshift(characterName)
    }
    for (const u of content.units) {
      if ('who' in u && u.who?.trim() && !characterNames.includes(u.who.trim())) {
        characterNames.push(u.who.trim())
      }
    }

    const scriptText = serializeBeatContent(content, locale)
    const spoken = spokenSummaryFromBeatContent(content)
    const legacyDlg =
      typeof o.dialogue === 'string' ? o.dialogue.trim() : ''
    const dialogue = spoken || legacyDlg || scriptText
    if (!content.units.length && !content.mood && !dialogue) continue

    out.push({
      characterName: characterName || characterNames[0] || '',
      characterNames,
      sceneHint,
      propName,
      dialogue,
      content,
      scriptText,
      beatContentJson: beatContentToJson(content)
    })
  }
  if (!out.length) throw new AppError('VALIDATION', 'errors.noBeatsInResponse')
  return out
}

/** Map free-text cast hints to library ids (multi-character). */
export function resolveBeatIds(
  beat: StoryBeatDraft,
  cast: {
    characters: Array<{ id: string; name: string }>
    scenes: Array<{
      id: string
      sceneNumber?: number
      title?: string | null
      description: string
    }>
    props: Array<{ id: string; name: string }>
  }
): {
  characterId: string | null
  sceneId: string | null
  propId: string | null
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  durationSeconds: number
} {
  const names = [
    beat.characterName,
    ...(beat.characterNames ?? [])
  ]
    .map((n) => n.trim())
    .filter(Boolean)
  const characterIds: string[] = []
  for (const name of names) {
    const cn = name.toLowerCase()
    const id =
      cast.characters.find((c) => c.name.toLowerCase() === cn)?.id ??
      cast.characters.find((c) => cn && c.name.toLowerCase().includes(cn))?.id ??
      null
    if (id && !characterIds.includes(id)) characterIds.push(id)
  }
  const characterId = characterIds[0] ?? null

  let sceneId: string | null = null
  const hint = beat.sceneHint.trim()
  if (hint) {
    const num = hint.match(/(\d+)/)
    if (num) {
      const n = Number(num[1])
      sceneId =
        cast.scenes.find((s) => s.sceneNumber === n)?.id ?? null
    }
    if (!sceneId) {
      const h = hint.toLowerCase()
      sceneId =
        cast.scenes.find(
          (s) =>
            (s.title && s.title.toLowerCase().includes(h)) ||
            s.description.toLowerCase().includes(h)
        )?.id ?? null
    }
  }
  if (!sceneId && cast.scenes[0]) sceneId = cast.scenes[0].id
  const sceneIds = sceneId ? [sceneId] : []

  const pn = beat.propName.toLowerCase()
  const propId = pn
    ? cast.props.find((p) => p.name.toLowerCase() === pn)?.id ??
      cast.props.find((p) => p.name.toLowerCase().includes(pn))?.id ??
      null
    : null
  const propIds = propId ? [propId] : []
  const durationSeconds = estimateBeatDurationSeconds(beat.content)

  return {
    characterId,
    sceneId,
    propId,
    characterIds,
    sceneIds,
    propIds,
    durationSeconds
  }
}
