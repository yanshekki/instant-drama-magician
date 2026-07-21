/**
 * High-priority user hard rules (必須 / 禁止) for image & video generation.
 * Inlined into the single prompt string — image/video APIs have no separate
 * negative-prompt channel.
 */

export const HARD_RULES_HEADER =
  'HARD RULES (highest priority — must obey; override any conflicting earlier details):'

export const HARD_RULES_FOOTER =
  'If any earlier instruction conflicts with HARD RULES, follow HARD RULES.'

/** Normalize / cap user hard-rules text. Empty → null. */
export function normalizeHardRules(
  raw: string | null | undefined,
  maxLen = 2000
): string | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  if (s.length > maxLen) s = s.slice(0, maxLen).trim()
  return s || null
}

/** Format the HARD RULES block (no surrounding blank lines). */
export function hardRulesBlock(hardRules: string): string {
  const body = hardRules.trim()
  if (!body) return ''
  return [HARD_RULES_HEADER, body, HARD_RULES_FOOTER].join('\n')
}

/**
 * Append hard rules at the end of a prompt (models weight late “must obey” well).
 * If rules already present as a block, still re-append a clean block only when
 * `force` is true — default: skip if prompt already ends with HARD RULES header.
 */
export function appendHardRules(
  prompt: string,
  hardRules?: string | null,
  opts?: { force?: boolean }
): string {
  const rules = normalizeHardRules(hardRules)
  if (!rules) return prompt
  const base = String(prompt ?? '').trimEnd()
  if (!base) return hardRulesBlock(rules)
  if (
    !opts?.force &&
    base.includes(HARD_RULES_HEADER)
  ) {
    // Already injected (e.g. builder + handler) — avoid duplicate walls of text
    return base
  }
  return `${base}\n\n${hardRulesBlock(rules)}`
}

/**
 * Ensure hard rules appear at the end even if the user edited promptOverride
 * and removed them. Always force re-append after stripping prior HARD RULES blocks.
 */
export function ensureHardRules(
  prompt: string,
  hardRules?: string | null
): string {
  const rules = normalizeHardRules(hardRules)
  if (!rules) return prompt
  const stripped = stripHardRulesBlocks(String(prompt ?? ''))
  return appendHardRules(stripped, rules, { force: true })
}

/** Remove previous HARD RULES sections (best-effort). */
export function stripHardRulesBlocks(prompt: string): string {
  if (!prompt.includes(HARD_RULES_HEADER)) return prompt
  // Split on header; keep text before first header; drop rule blocks
  const parts = prompt.split(HARD_RULES_HEADER)
  if (parts.length <= 1) return prompt
  const head = parts[0].trimEnd()
  // Any trailing content after footer in later parts is rare — drop rule segments
  return head
}

/** Merge multiple hard-rules sources (story + cast assets); de-dupe lines. */
export function mergeHardRules(
  ...parts: Array<string | null | undefined>
): string | null {
  const lines = new Set<string>()
  for (const p of parts) {
    const n = normalizeHardRules(p)
    if (!n) continue
    for (const line of n.split(/\r?\n/)) {
      const t = line.trim()
      if (t) lines.add(t)
    }
  }
  if (lines.size === 0) return null
  return normalizeHardRules([...lines].join('\n'))
}

/**
 * Instruction block for AI profile / meta fill: hardRules MUST be non-empty.
 */
export function hardRulesAiInstruction(locale: 'zh-HK' | 'en' = 'zh-HK'): string {
  if (locale === 'en') {
    return [
      'hardRules: REQUIRED non-empty string (never omit the key, never use null/array).',
      'Write 3–8 short lines mixing MUST and MUST-NOT for image & video gen of THIS asset only.',
      'Name the subject in each line when useful (e.g. "Character Maya: exactly two hands") so timeline merge can attribute rules to the correct object.',
      'Focus on common AI failures: extra limbs, wrong anatomy counts, unrelated objects (wires, logos), watermarks, third faces, wrong species.',
      'Format example: "【必須】Character: exactly two hands, five fingers\\n【禁止】extra limbs; watermarks; third face".',
      'Do NOT pad with vague quality words (no "high quality", "masterpiece", "4k" alone).'
    ].join(' ')
  }
  return [
    'hardRules：必填非空字串（不可缺鍵、不可 null／陣列）。',
    '用 3–8 短句寫【必須】與【禁止】，只針對本資產出圖／出片常見幻覺。',
    '句中宜點名主體（例：「角色小雨：恰好兩隻手」），方便時間軸合併時對應到正確物件。',
    '重點：多餘肢體、解剖數量錯誤、無關雜物（電線、Logo）、水印、第三人臉、物種錯誤。',
    '格式例：「【必須】角色：恰好兩隻手、五指完整\\n【禁止】第三肢體；水印；第三人臉」。',
    '禁止用空泛畫質詞充數（不可只寫 high quality／傑作／4k）。'
  ].join(' ')
}

/** Fallback when model forgets hardRules (still better than empty). */
export function defaultHardRulesFallback(
  kind: 'story' | 'character' | 'scene' | 'prop' | 'action' | 'costume',
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    const map: Record<typeof kind, string> = {
      story:
        '【必須】readable silhouette; coherent lighting\n【禁止】watermarks; UI chrome; unreadable text captions; extra limbs on humans',
      character:
        '【必須】exactly two hands, two arms, two legs (unless non-human design)\n【禁止】extra limbs; third face; watermarks; brand logos',
      scene:
        '【必須】empty-set location identity; consistent architecture\n【禁止】new hero faces; watermarks; random props that break the location',
      prop:
        '【必須】single clear prop identity; clean silhouette\n【禁止】unrelated wires/cables; extra objects; watermarks; celebrity faces',
      action:
        '【必須】same identity across all panels; readable motion beats\n【禁止】extra limbs; panel count wrong; watermarks; title replacing a panel',
      costume:
        '【必須】full readable outer costume; correct silhouette on body\n【禁止】ghost old outfit; fused limbs; watermarks; brand logos'
    }
    return map[kind]
  }
  const map: Record<typeof kind, string> = {
    story:
      '【必須】剪影可讀；光線連貫\n【禁止】水印；UI 邊框；難讀字幕；人類多餘肢體',
    character:
      '【必須】恰好兩隻手、兩臂、兩腿（非人設定除外）\n【禁止】多餘肢體；第三人臉；水印；品牌 Logo',
    scene:
      '【必須】空鏡場地身份；建築一致\n【禁止】新增主角臉；水印；破壞場地的亂入道具',
    prop:
      '【必須】單一清晰道具身份；輪廓乾淨\n【禁止】無關電線／纜線；多餘雜物；水印；名人臉',
    action:
      '【必須】各格身份一致；動作節拍可讀\n【禁止】多餘肢體；格數錯誤；水印；標題取代分鏡格',
    costume:
      '【必須】外層戲服完整可讀；輪廓正確\n【禁止】舊裝殘影；肢體融合；水印；品牌 Logo'
  }
  return map[kind]
}

export type TimelineHardRulesSources = {
  story?: { hardRules?: string | null; title?: string | null } | null
  characters?: Array<{
    hardRules?: string | null
    name?: string | null
  } | null> | null
  scenes?: Array<{
    hardRules?: string | null
    title?: string | null
    description?: string | null
  } | null> | null
  props?: Array<{
    hardRules?: string | null
    name?: string | null
  } | null> | null
  actions?: Array<{
    hardRules?: string | null
    name?: string | null
  } | null> | null
}

/**
 * Merge hard rules from story + assets bound on a timeline clip.
 * Default: label each source so the video model knows which object the rule targets
 * (e.g. `[Character · Keith]` vs `[Scene · 屋頂]`).
 */
export function collectTimelineHardRules(
  sources: TimelineHardRulesSources,
  opts?: { labelObjects?: boolean }
): string | null {
  const labelObjects = opts?.labelObjects !== false
  if (!labelObjects) {
    const parts: Array<string | null | undefined> = []
    if (sources.story?.hardRules) parts.push(sources.story.hardRules)
    for (const list of [
      sources.characters,
      sources.scenes,
      sources.props,
      sources.actions
    ]) {
      if (!list) continue
      for (const item of list) {
        if (item?.hardRules) parts.push(item.hardRules)
      }
    }
    return mergeHardRules(...parts)
  }

  const sections: string[] = []
  const pushSection = (label: string, rules?: string | null): void => {
    const n = normalizeHardRules(rules)
    if (!n) return
    sections.push(`[${label}]\n${n}`)
  }

  if (sources.story?.hardRules) {
    const st = sources.story.title?.trim()
    pushSection(st ? `Story · ${st}` : 'Story', sources.story.hardRules)
  }
  for (const c of sources.characters ?? []) {
    if (!c?.hardRules) continue
    const name = c.name?.trim() || 'Character'
    pushSection(`Character · ${name}`, c.hardRules)
  }
  for (const s of sources.scenes ?? []) {
    if (!s?.hardRules) continue
    const name =
      s.title?.trim() ||
      (s.description ? String(s.description).slice(0, 32).trim() : '') ||
      'Scene'
    pushSection(`Scene · ${name}`, s.hardRules)
  }
  for (const p of sources.props ?? []) {
    if (!p?.hardRules) continue
    const name = p.name?.trim() || 'Prop'
    pushSection(`Prop · ${name}`, p.hardRules)
  }
  for (const a of sources.actions ?? []) {
    if (!a?.hardRules) continue
    const name = a.name?.trim() || 'Action'
    pushSection(`Action · ${name}`, a.hardRules)
  }

  if (sections.length === 0) return null
  // Cap total size (normalizeHardRules max is per-chunk; whole block ~4k)
  return normalizeHardRules(sections.join('\n\n'), 4000)
}
