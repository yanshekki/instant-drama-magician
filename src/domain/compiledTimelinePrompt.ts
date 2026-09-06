/**
 * Live storyboard prompt compiled from a timeline beat (H3 Director style).
 * Text-only; MediaGen polish remains a separate optional step.
 */
import type { Action, Character, Prop, Scene, TimelineEntry } from '../types/domain'
import {
  beatContentToClipPromptBlock,
  extractSpokenLines,
  parseBeatContent
} from './beatContent'
import { collectTimelineHardRules } from './promptHardRules'
import { buildClipPrompt } from './promptContinuity'
import { timelineGraphBindIds } from './timelineGraph'
import { numberMediaPool, pictureKey } from './timelineLanes'
import { SPATIAL_ROLE_MODEL_LINES } from './spatialRef'

export type CompiledPromptSection = {
  id: string
  title: string
  body: string
}

export type CompiledPictureSlot = {
  index: number
  kind: 'character' | 'scene' | 'prop' | 'action' | 'spatial'
  entityId: string
  name: string
  imagePath: string | null
  refRole?: 'identity' | 'spatial' | 'motion' | 'style'
}

export type CompiledTimelinePrompt = {
  text: string
  sections: CompiledPromptSection[]
  pictures: CompiledPictureSlot[]
}

export function formatShotTimestamp(seconds: number): string {
  const s = Math.max(0, Number(seconds) || 0)
  const mm = Math.floor(s / 60)
  const rest = s - mm * 60
  const whole = Math.floor(rest)
  const ms = Math.round((rest - whole) * 1000)
  return `${String(mm).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function pick<T extends { id: string }>(
  list: T[] | undefined,
  ids: string[]
): T[] {
  if (!list?.length || !ids.length) return []
  const map = new Map(list.map((row) => [row.id, row]))
  return ids.map((id) => map.get(id)).filter((row): row is T => Boolean(row))
}

function subjectLine(
  kind: CompiledPictureSlot['kind'],
  name: string,
  pictureIndex: number,
  locale: string
): string {
  const pic = `<Picture ${pictureIndex}>`
  const zh = locale.toLowerCase().startsWith('zh')
  if (kind === 'character') {
    return zh
      ? `〈主體 ${pictureIndex}〉為 ${pic} 所示角色「${name}」。`
      : `<Subject ${pictureIndex}> is the character shown in ${pic} (${name}).`
  }
  if (kind === 'scene') {
    return zh
      ? `〈主體 ${pictureIndex}〉為 ${pic} 所示場景「${name}」。`
      : `<Subject ${pictureIndex}> is the location shown in ${pic} (${name}).`
  }
  if (kind === 'prop') {
    return zh
      ? `〈主體 ${pictureIndex}〉為 ${pic} 所示道具「${name}」。`
      : `<Subject ${pictureIndex}> is the prop shown in ${pic} (${name}).`
  }
  if (kind === 'spatial') {
    return zh
      ? `〈主體 ${pictureIndex}〉為 ${pic} 所示白模空間契約：只鎖站位、比例與機位，不要抄黏土灰當成品。`
      : `<Subject ${pictureIndex}> is the white-model spatial contract in ${pic} (${name}): positions, scale, and camera only — do not copy clay gray as the final look.`
  }
  return zh
    ? `〈主體 ${pictureIndex}〉為 ${pic} 所示動作參考「${name}」。`
    : `<Subject ${pictureIndex}> is the action reference in ${pic} (${name}).`
}

export function compileTimelinePrompt(input: {
  entry: TimelineEntry
  storyTitle: string
  styleNote?: string | null
  characters?: Character[]
  scenes?: Scene[]
  props?: Prop[]
  actions?: Action[]
  locale?: string | null
  previousContext?: string | null
  shotIndex?: number
  storyHardRules?: string | null
  spatialPlayblastPath?: string | null
}): CompiledTimelinePrompt {
  const locale = input.locale || 'zh-HK'
  const entry = input.entry
  const charIds = timelineGraphBindIds(entry.characterIds, entry.characterId)
  const sceneIds = timelineGraphBindIds(entry.sceneIds, entry.sceneId)
  const propIds = timelineGraphBindIds(entry.propIds, entry.propId)
  const actionIds = timelineGraphBindIds(entry.actionIds, entry.actionId)
  const characters = pick(input.characters, charIds)
  const scenes = pick(input.scenes, sceneIds)
  const props = pick(input.props, propIds)
  const actions = pick(input.actions, actionIds)

  const poolItems: Array<{
    key: string
    kind: CompiledPictureSlot['kind']
    entityId: string
    name: string
    imagePath: string | null
  }> = []
  for (const c of characters) {
    poolItems.push({
      key: pictureKey('character', c.id),
      kind: 'character',
      entityId: c.id,
      name: c.name,
      imagePath: c.refSheetPath || c.refImagePath || null
    })
  }
  for (const s of scenes) {
    poolItems.push({
      key: pictureKey('scene', s.id),
      kind: 'scene',
      entityId: s.id,
      name: (s.title || s.description || s.id).slice(0, 48),
      imagePath: s.refImagePath || null
    })
  }
  for (const p of props) {
    poolItems.push({
      key: pictureKey('prop', p.id),
      kind: 'prop',
      entityId: p.id,
      name: p.name,
      imagePath: p.refImagePath || null
    })
  }
  for (const a of actions) {
    poolItems.push({
      key: pictureKey('action', a.id),
      kind: 'action',
      entityId: a.id,
      name: a.name,
      imagePath: a.refImagePath || null
    })
  }
  const spatialPath = input.spatialPlayblastPath?.trim() || null
  if (spatialPath) {
    poolItems.push({
      key: pictureKey('action', `spatial:${entry.id}`),
      kind: 'spatial',
      entityId: entry.id,
      name: 'white-model',
      imagePath: spatialPath
    })
  }
  const numbers = numberMediaPool(poolItems.map((p) => ({ key: p.key })))
  const pictures: CompiledPictureSlot[] = poolItems.map((p) => ({
    index: numbers[p.key] ?? 0,
    kind: p.kind,
    entityId: p.entityId,
    name: p.name,
    imagePath: p.imagePath,
    refRole: p.kind === 'spatial' ? 'spatial' : p.kind === 'action' ? 'motion' : 'identity'
  }))

  const zh = locale.toLowerCase().startsWith('zh')
  const titles = {
    subjects: zh ? '主體定義' : 'subject_definitions',
    retention: zh ? '一致性' : 'retention_analysis',
    shot: zh ? '分鏡' : 'detailed_description',
    dialogue: zh ? '對白' : 'dialogue',
    sound: zh ? '聲效' : 'overall_soundscape',
    model: zh ? '模型提示' : 'model_prompt',
    spatial: zh ? '空間契約' : 'spatial_contract'
  }

  const subjectBody = pictures
    .map((p) => subjectLine(p.kind, p.name, p.index, locale))
    .join('\n')

  const hardRules = collectTimelineHardRules(
    {
      story: input.storyHardRules
        ? { hardRules: input.storyHardRules, title: input.storyTitle }
        : undefined,
      characters,
      scenes,
      props,
      actions
    },
    { uiLocale: locale }
  )

  const shotN = Math.max(1, input.shotIndex ?? (entry.order ?? 0) + 1)
  const ts = formatShotTimestamp(entry.startTime)
  const beat = parseBeatContent(entry.dialogue, entry.beatContentJson)
  const beatBlock =
    beatContentToClipPromptBlock(beat, entry.dialogue, locale) ||
    (entry.dialogue ? entry.dialogue : '')
  const shotHead =
    shotN === 1
      ? zh
        ? `［鏡頭 ${shotN}］`
        : `[Shot ${shotN}]`
      : zh
        ? `［鏡頭 ${shotN}］ ${ts}`
        : `[Shot ${shotN}] At ${ts}`
  const shotBody = [shotHead, beatBlock].filter(Boolean).join('\n')

  const spoken = extractSpokenLines(beat).trim()
  const sfx = beat?.sfx?.trim() || ''

  const seconds = Math.max(0, entry.endTime - entry.startTime)
  const modelBody = buildClipPrompt({
    storyTitle: input.storyTitle,
    styleNote: input.styleNote,
    character: characters[0] ?? null,
    scene: scenes[0] ?? null,
    prop: props[0] ?? null,
    dialogue: entry.dialogue,
    beatContentJson: entry.beatContentJson,
    seconds,
    previousContext: input.previousContext,
    locale
  })

  const sections: CompiledPromptSection[] = []
  const push = (id: string, title: string, body: string | null | undefined): void => {
    const t = (body || '').trim()
    if (!t) return
    sections.push({ id, title, body: t })
  }
  push('subjects', titles.subjects, subjectBody)
  push(
    'spatial',
    titles.spatial,
    spatialPath
      ? SPATIAL_ROLE_MODEL_LINES.spatial
      : null
  )
  push('retention', titles.retention, hardRules)
  push('shot', titles.shot, shotBody)
  push('dialogue', titles.dialogue, spoken)
  push('sound', titles.sound, sfx)
  push('model', titles.model, modelBody)

  const text = sections.map((s) => `${s.title}:\n${s.body}`).join('\n\n')
  return { text, sections, pictures }
}
