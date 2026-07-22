/**
 * LLM polish step before any generateVideo call.
 * Raw materials → chat → single director-style image-to-video prompt.
 * Chinese instruction text: Hong Kong written Chinese (書面語).
 */

export type VideoPromptKind = 'intro' | 'timeline_clip'

const SOUL_MAX_CHARS = 8000

export function truncateForVideoPrompt(
  text: string | null | undefined,
  max = SOUL_MAX_CHARS
): string {
  const t = (text ?? '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n…[truncated]`
}

/**
 * Materials block so polish LLM keeps HARD RULES and ends output with them.
 * Used by intro + timeline clip polish user prompts.
 */
export function hardRulesMaterialsBlock(
  hardRules: string | null | undefined,
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string | null {
  const rules = (hardRules ?? '').trim()
  if (!rules) return null
  if (locale === 'en') {
    return [
      'HARD RULES (HIGHEST PRIORITY — keep every line; object labels like [Character · Name] must stay).',
      'Place the full HARD RULES block at the END of your output. Do not weaken, drop, or reassign rules.',
      rules
    ].join('\n')
  }
  return [
    'HARD RULES／生成鐵則（最高優先——保留每一行；[Character · 名] 等物件標籤不可刪）。',
    '必須將完整 HARD RULES 區塊放在輸出最尾。不得削弱、刪除或套錯主體。',
    rules
  ].join('\n')
}

/**
 * System prompt for the video-prompt editor LLM.
 * Output should be English-first (gateway image-to-video works best),
 * with spoken-language constraints explicit when needed.
 */
export function buildVideoPromptPolishSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  const en = locale === 'en'
  if (en) {
    return [
      'You write ONE final image-to-video prompt for a short-drama AI video model.',
      'Return ONLY the prompt text — no markdown fences, no title, no explanation.',
      'Rules:',
      '- English director language preferred; keep character names and required dialogue language codes clear.',
      '- Person still: IDENTITY LOCK (face, hair, body, wardrobe, colors). Location plate: SPACE LOCK (architecture, materials, layout, signage, palette) — empty set preferred; no new cast faces.',
      '- Use ALL provided profile / soul / beat / location facts that affect look, motion, speech, or atmosphere; ignore empty fields.',
      '- Invent only what is needed to complete a filmable clip from the materials and seed — do not import a fixed sample world, Demo story, or facts not present in materials/seed.',
      '- Condense long soul.md into actionable performance + identity beats; do not dump the whole bible verbatim.',
      '- Duration 6–10s; continuous action; cinematic; no text overlays, logos, watermarks, or extra unrelated people.',
      '- Anatomically correct humans unless the script requires otherwise (two hands, two arms, two legs).',
      '- If multi-character, keep each listed subject consistent; primary focus first.',
      '- If HARD RULES appear in materials, keep them and place them at the end of your output (highest priority).',
      '- Director revision may refine style/action but must NOT violate HARD RULES.'
    ].join('\n')
  }
  return [
    '你為短劇 AI 圖生影片模型撰寫「一條」最終 image-to-video 導演提示詞。',
    '只回傳提示詞正文——不要 markdown 代碼塊、標題或解釋。',
    '規則：',
    '- 以英文導演用語為主；角色姓名與口白語言要求須清楚標示。',
    '- 人物靜圖：IDENTITY LOCK（臉、髮、體型、服裝、顏色）。場景靜幀：SPACE LOCK（建築、材質、格局、招牌、色盤）——空鏡為主，勿新增角色臉。',
    '- 凡已提供且影響外形、動作、口白、氣氛或場地的人設／soul／段落／地點資料均須用上；空白欄位可略。',
    '- 只按材料與 seed 補齊可拍細節；勿引入固定樣本世界、Demo 故事、或材料／seed 未出現的事實。',
    '- 長篇 soul.md 須濃縮為可拍的表演與身份要點，不可整篇照貼。',
    '- 時長 6–10 秒；動作連貫；電影感；無字幕、logo、浮水印、無關路人。',
    '- 除非劇情要求，否則解剖結構正常（雙手雙腳）。',
    '- 多角色時保持每位主體一致；主焦點優先。',
    '- 若材料含 HARD RULES（生成鐵則），必須保留並放在輸出最尾（最高優先）。',
    '- 導演修訂可調整氣氛／動作，但不得違反 HARD RULES。'
  ].join('\n')
}

export interface IntroVideoPolishContext {
  locale?: 'zh-HK' | 'en'
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  /** Pre-built template fallback (already includes expanded profile). */
  fallbackPrompt: string
  name: string
  description?: string | null
  appearance?: string | null
  personality?: string | null
  backstory?: string | null
  costume?: string | null
  ageRange?: string | null
  gender?: string | null
  voiceDesc?: string | null
  mannerisms?: string | null
  relationships?: string | null
  visualTags?: string | null
  artStyle?: string | null
  seedPrompt?: string | null
  spokenLanguages?: string[] | null
  soulExcerpt?: string | null
  hardRules?: string | null
}

export function buildIntroVideoPolishUserPrompt(
  ctx: IntroVideoPolishContext
): string {
  const en = ctx.locale === 'en'
  const langs =
    Array.isArray(ctx.spokenLanguages) && ctx.spokenLanguages.length > 0
      ? ctx.spokenLanguages.join(', ')
      : en
        ? '(match character bible)'
        : '（跟從角色人設語言）'
  const soul = truncateForVideoPrompt(ctx.soulExcerpt, SOUL_MAX_CHARS)
  return [
    en
      ? 'TASK: Self-introduction casting clip (image-to-video).'
      : '任務：自我介紹選角短片（圖生影片）。',
    ctx.hasRefImage
      ? en
        ? 'Reference still is attached to the video API — lock identity to that image.'
        : '參考靜圖會交予影片 API——必須鎖定該圖身份。'
      : en
        ? 'No reference still path in this text; still lock to profile appearance/costume.'
        : '本文無靜圖路徑；仍須鎖定人設外貌／戲服。',
    `Duration target: ${ctx.seconds}s. Aspect: ${ctx.aspectRatio || '16:9'}.`,
    en ? 'Character dossier:' : '角色檔案：',
    `name: ${ctx.name}`,
    ctx.ageRange ? `ageRange: ${ctx.ageRange}` : null,
    ctx.gender ? `gender: ${ctx.gender}` : null,
    ctx.description ? `description: ${ctx.description}` : null,
    ctx.appearance ? `appearance: ${ctx.appearance}` : null,
    ctx.costume ? `costume: ${ctx.costume}` : null,
    ctx.personality ? `personality: ${ctx.personality}` : null,
    ctx.backstory ? `backstory: ${ctx.backstory}` : null,
    ctx.voiceDesc ? `voiceDesc: ${ctx.voiceDesc}` : null,
    ctx.mannerisms ? `mannerisms: ${ctx.mannerisms}` : null,
    ctx.relationships ? `relationships: ${ctx.relationships}` : null,
    ctx.visualTags ? `visualTags: ${ctx.visualTags}` : null,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    ctx.seedPrompt ? `seedPrompt: ${ctx.seedPrompt}` : null,
    `spokenLanguages: ${langs}`,
    soul
      ? en
        ? `soul.md (use fully as performance/identity source):\n${soul}`
        : `soul.md（作為表演／身份完整來源）：\n${soul}`
      : null,
    hardRulesMaterialsBlock(ctx.hardRules, en ? 'en' : 'zh-HK'),
    en ? 'Template draft (improve; do not ignore dossier):' : '模板草稿（請改進；勿忽略檔案）：',
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface SceneIntroVideoPolishContext {
  locale?: 'zh-HK' | 'en'
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  title?: string | null
  description: string
  script?: string | null
  locationType?: string | null
  timeOfDay?: string | null
  weather?: string | null
  mood?: string | null
  lighting?: string | null
  colorPalette?: string | null
  setDressing?: string | null
  soundscape?: string | null
  cameraNotes?: string | null
  visualTags?: string | null
  artStyle?: string | null
  seedPrompt?: string | null
  hardRules?: string | null
}

/** Materials for location / establishing intro clip polish. */
export function buildSceneIntroVideoPolishUserPrompt(
  ctx: SceneIntroVideoPolishContext
): string {
  const en = ctx.locale === 'en'
  const name =
    ctx.title?.trim() ||
    ctx.description.trim().slice(0, 48) ||
    (en ? 'Location' : '場景')
  return [
    en
      ? 'TASK: Location intro / establishing clip (image-to-video).'
      : '任務：場景介紹／建立鏡頭短片（圖生影片）。',
    ctx.hasRefImage
      ? en
        ? 'Reference location still is attached to the video API — lock SPACE identity to that plate.'
        : '參考場景靜圖會交予影片 API——必須鎖定該圖空間身份。'
      : en
        ? 'No reference still path in this text; still lock to location bible description.'
        : '本文無靜圖路徑；仍須鎖定地點聖經描述。',
    `Duration target: ${ctx.seconds}s. Aspect: ${ctx.aspectRatio || '16:9'}.`,
    en ? 'Location dossier:' : '場景檔案：',
    `title: ${name}`,
    `description: ${ctx.description}`,
    ctx.locationType ? `locationType: ${ctx.locationType}` : null,
    ctx.timeOfDay ? `timeOfDay: ${ctx.timeOfDay}` : null,
    ctx.weather ? `weather: ${ctx.weather}` : null,
    ctx.mood ? `mood: ${ctx.mood}` : null,
    ctx.lighting ? `lighting: ${ctx.lighting}` : null,
    ctx.colorPalette ? `colorPalette: ${ctx.colorPalette}` : null,
    ctx.setDressing ? `setDressing: ${ctx.setDressing}` : null,
    ctx.soundscape ? `soundscape: ${ctx.soundscape}` : null,
    ctx.cameraNotes ? `cameraNotes: ${ctx.cameraNotes}` : null,
    ctx.visualTags ? `visualTags: ${ctx.visualTags}` : null,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    ctx.seedPrompt ? `seedPrompt: ${ctx.seedPrompt}` : null,
    ctx.script
      ? en
        ? `script cue (atmosphere only):\n${truncateForVideoPrompt(ctx.script, 1200)}`
        : `劇本提示（只作氣氛）：\n${truncateForVideoPrompt(ctx.script, 1200)}`
      : null,
    en
      ? 'Prefer empty set; no new cast faces unless already in the still. No text overlays or logos.'
      : '空鏡為主；除非靜幀已有，否則勿新增角色臉。無字幕、logo。',
    hardRulesMaterialsBlock(ctx.hardRules, en ? 'en' : 'zh-HK'),
    en ? 'Template draft (improve; do not ignore dossier):' : '模板草稿（請改進；勿忽略檔案）：',
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface PropIntroVideoPolishContext {
  locale?: 'zh-HK' | 'en'
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  name: string
  description: string
  material?: string | null
  sizeNotes?: string | null
  condition?: string | null
  visualTags?: string | null
  artStyle?: string | null
  seedPrompt?: string | null
  hardRules?: string | null
}

/** Materials for prop / object hero intro clip polish. */
export function buildPropIntroVideoPolishUserPrompt(
  ctx: PropIntroVideoPolishContext
): string {
  const en = ctx.locale === 'en'
  return [
    en
      ? 'TASK: Prop / object hero intro clip (image-to-video).'
      : '任務：道具主視覺介紹短片（圖生影片）。',
    ctx.hasRefImage
      ? en
        ? 'Reference prop still is attached — lock OBJECT identity to that image.'
        : '參考道具靜圖會交予影片 API——必須鎖定該圖物件身份。'
      : en
        ? 'No reference still path in this text; still lock to prop dossier.'
        : '本文無靜圖路徑；仍須鎖定道具檔案描述。',
    `Duration target: ${ctx.seconds}s. Aspect: ${ctx.aspectRatio || '16:9'}.`,
    en ? 'Prop dossier:' : '道具檔案：',
    `name: ${ctx.name}`,
    `description: ${ctx.description}`,
    ctx.material ? `material: ${ctx.material}` : null,
    ctx.sizeNotes ? `sizeNotes: ${ctx.sizeNotes}` : null,
    ctx.condition ? `condition: ${ctx.condition}` : null,
    ctx.visualTags ? `visualTags: ${ctx.visualTags}` : null,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    ctx.seedPrompt ? `seedPrompt: ${ctx.seedPrompt}` : null,
    en
      ? 'No new hands or cast faces unless already in the still. No text overlays or logos.'
      : '除非靜幀已有，否則勿新增手或角色臉。無字幕、logo。',
    hardRulesMaterialsBlock(ctx.hardRules, en ? 'en' : 'zh-HK'),
    en ? 'Template draft (improve; do not ignore dossier):' : '模板草稿（請改進；勿忽略檔案）：',
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface CostumeIntroVideoPolishContext {
  locale?: 'zh-HK' | 'en'
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  name: string
  description: string
  artStyle?: string | null
  hardRules?: string | null
}

/** Materials for wardrobe / costume look intro clip polish. */
export function buildCostumeIntroVideoPolishUserPrompt(
  ctx: CostumeIntroVideoPolishContext
): string {
  const en = ctx.locale === 'en'
  return [
    en
      ? 'TASK: Costume / wardrobe look intro clip (image-to-video).'
      : '任務：戲服／造型介紹短片（圖生影片）。',
    ctx.hasRefImage
      ? en
        ? 'Reference still is attached — if person present lock IDENTITY + wardrobe; if mannequin/flat-lay lock garment silhouette and materials.'
        : '參考靜圖會交予影片 API——有人則鎖定身份＋服裝；人台／平鋪則鎖定服裝輪廓與材質。'
      : en
        ? 'No reference still path; lock to costume description.'
        : '本文無靜圖路徑；仍須鎖定戲服描述。',
    `Duration target: ${ctx.seconds}s. Aspect: ${ctx.aspectRatio || '16:9'}.`,
    en ? 'Costume dossier:' : '戲服檔案：',
    `name: ${ctx.name}`,
    `description: ${ctx.description}`,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    en
      ? 'Show fabric drape/motion subtly; no new cast faces; no text overlays or logos.'
      : '布料垂墜／微動即可；勿新增角色臉；無字幕、logo。',
    hardRulesMaterialsBlock(ctx.hardRules, en ? 'en' : 'zh-HK'),
    en ? 'Template draft (improve; do not ignore dossier):' : '模板草稿（請改進；勿忽略檔案）：',
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface ClipVideoPolishContext {
  locale?: 'zh-HK' | 'en'
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  storyTitle: string
  styleNote?: string | null
  characterBlocks?: string[]
  sceneBlock?: string | null
  propBlock?: string | null
  /** Motion-library action guide(s) for performance / blocking */
  actionBlock?: string | null
  beatOrDialogue?: string | null
  previousContext?: string | null
  multiCastNote?: string | null
  revisionPrompt?: string | null
  /**
   * Merged HARD RULES from story + bound cast (already labeled per object).
   * Must appear in materials so polish keeps them; final generate re-appends too.
   */
  hardRules?: string | null
}

export function buildClipVideoPolishUserPrompt(
  ctx: ClipVideoPolishContext
): string {
  const en = ctx.locale === 'en'
  const rules = (ctx.hardRules ?? '').trim()
  return [
    en
      ? 'TASK: Short-drama timeline clip (image-to-video).'
      : '任務：短劇時間軸片段（圖生影片）。',
    ctx.hasRefImage
      ? en
        ? 'A reference still may be attached — lock identity/location continuity to it when relevant.'
        : '可能附有參考靜圖——相關時鎖定身份／場地連續性。'
      : null,
    `Story: ${ctx.storyTitle}`,
    ctx.styleNote?.trim()
      ? `Style bible: ${ctx.styleNote.trim().slice(0, 600)}`
      : null,
    `Duration: ${ctx.seconds}s. Aspect: ${ctx.aspectRatio || '16:9'}.`,
    ctx.multiCastNote || null,
    ctx.characterBlocks?.length
      ? en
        ? `Characters:\n${ctx.characterBlocks.join('\n---\n')}`
        : `角色：\n${ctx.characterBlocks.join('\n---\n')}`
      : null,
    ctx.sceneBlock ? (en ? `Scene:\n${ctx.sceneBlock}` : `場景：\n${ctx.sceneBlock}`) : null,
    ctx.propBlock ? (en ? `Prop:\n${ctx.propBlock}` : `道具：\n${ctx.propBlock}`) : null,
    ctx.actionBlock
      ? en
        ? `Action / motion guide:\n${ctx.actionBlock}`
        : `動作指導：\n${ctx.actionBlock}`
      : null,
    ctx.beatOrDialogue
      ? en
        ? `Beat / dialogue:\n${ctx.beatOrDialogue}`
        : `段落／對白：\n${ctx.beatOrDialogue}`
      : null,
    ctx.previousContext
      ? en
        ? `Previous clip continuity:\n${ctx.previousContext}`
        : `前一段連續性：\n${ctx.previousContext}`
      : null,
    ctx.revisionPrompt?.trim()
      ? en
        ? `DIRECTOR REVISION (must follow):\n${ctx.revisionPrompt.trim()}`
        : `導演修訂（必須遵守）：\n${ctx.revisionPrompt.trim()}`
      : null,
    hardRulesMaterialsBlock(rules, en ? 'en' : 'zh-HK'),
    en ? 'Template draft (improve):' : '模板草稿（請改進）：',
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Pull the polished prompt from an LLM reply (strip fences / labels).
 */
export function extractPolishedVideoPrompt(raw: string): string {
  let t = (raw ?? '').trim()
  if (!t) return ''
  // ```...``` or ```text
  const fence = t.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/)
  if (fence?.[1]) t = fence[1].trim()
  // Common prefixes
  t = t.replace(/^(?:final\s+)?(?:video\s+)?prompt\s*[:：]\s*/i, '').trim()
  t = t.replace(/^提示詞\s*[:：]\s*/i, '').trim()
  // Drop surrounding quotes
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim()
  }
  return t
}
