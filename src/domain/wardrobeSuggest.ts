/**
 * Suggest costume + art style from story plot context (scenes / style note).
 * Domain-only prompt builders; IPC runs the LLM.
 */
import { PromptCatalog } from '../prompts'
import { ART_STYLES, isArtStyleId, type ArtStyleId } from './characterArtStyles'
import { AppError } from '../types/errors'
import { assembleSystemPrompt } from './promptTemplates'

export type PlotSegmentRef =
  | { type: 'all' }
  | { type: 'scene'; sceneId: string }
  | { type: 'beat'; entryId: string }

export interface WardrobeSuggestInput {
  characterName: string
  appearance?: string | null
  currentCostume?: string | null
  ageRange?: string | null
  gender?: string | null
  /** Full profile extras for better wardrobe continuity */
  description?: string | null
  personality?: string | null
  visualTags?: string | null
  mannerisms?: string | null
  /** Optional soul.md excerpt */
  soulExcerpt?: string | null
  storyTitle?: string | null
  styleNote?: string | null
  /** Scene blurbs (description + script snippets) */
  sceneSnippets: string[]
  /** Human-readable segment label for the model */
  segmentLabel?: string | null
  locale?: string
  existingCostumeNames?: string[]
  /** Optional user direction for the look */
  userRequest?: string | null
}

export interface WardrobeSuggestion {
  name: string
  costume: string
  /** Empty when the model did not return a valid style id — do not invent one. */
  artStyle: ArtStyleId | ''
  rationale: string
}

export function buildWardrobeSuggestSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const styleIds = ART_STYLES.map((s) => s.id).join(', ')
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: PromptCatalog.t(locale, 'wardrobe.system', { styleIds })
  })
}

export function buildWardrobeSuggestUserPrompt(
  input: WardrobeSuggestInput
): string {
  const locale = input.locale ?? 'zh-HK'
  const scenes =
    input.sceneSnippets.filter(Boolean).slice(0, 12).join('\n---\n') ||
    PromptCatalog.t(locale, 'wardrobe.noScenes')
  const lines = [
    PromptCatalog.t(locale, 'wardrobe.improveMode'),
    PromptCatalog.t(locale, 'wardrobe.characterForm'),
    `name: ${input.characterName}`,
    input.description ? `description: ${input.description}` : '',
    input.appearance ? `appearance: ${input.appearance}` : '',
    input.personality ? `personality: ${input.personality}` : '',
    input.ageRange ? `age: ${input.ageRange}` : '',
    input.gender ? `gender: ${input.gender}` : '',
    input.mannerisms ? `mannerisms: ${input.mannerisms}` : '',
    input.visualTags ? `visualTags: ${input.visualTags}` : '',
    input.currentCostume ? `current costume: ${input.currentCostume}` : '',
    input.existingCostumeNames?.length
      ? `already has looks: ${input.existingCostumeNames.join('; ')}`
      : '',
    input.soulExcerpt?.trim()
      ? PromptCatalog.t(locale, 'wardrobe.soulExcerpt', {
          soul: input.soulExcerpt.trim().slice(0, 4000)
        })
      : '',
    input.userRequest?.trim()
      ? PromptCatalog.t(locale, 'wardrobe.userRequest', {
          request: input.userRequest.trim()
        })
      : '',
    PromptCatalog.t(locale, 'wardrobe.storyContext'),
    input.storyTitle ? `title: ${input.storyTitle}` : '',
    input.styleNote
      ? PromptCatalog.t(locale, 'wardrobe.style', { style: input.styleNote })
      : '',
    input.segmentLabel
      ? PromptCatalog.t(locale, 'wardrobe.segment', {
          label: input.segmentLabel
        })
      : '',
    PromptCatalog.t(locale, 'wardrobe.sceneContext'),
    scenes,
    PromptCatalog.t(locale, 'wardrobe.proposeNew')
  ]
  return lines.filter(Boolean).join('\n')
}

export function extractWardrobeSuggestionJson(
  text: string
): WardrobeSuggestion {
  const raw = text.trim()
  let jsonStr = raw
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) jsonStr = fence[1].trim()
  const brace = jsonStr.match(/\{[\s\S]*\}/)
  if (brace) jsonStr = brace[0]
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>
  const name =
    typeof parsed.name === 'string' && parsed.name.trim()
      ? parsed.name.trim()
      : 'Look'
  const costume =
    typeof parsed.costume === 'string' ? parsed.costume.trim() : ''
  if (!costume) throw new AppError('VALIDATION', 'errors.wardrobeCostumeMissing')
  const styleRaw =
    typeof parsed.artStyle === 'string' ? parsed.artStyle.trim() : ''
  const artStyle: ArtStyleId | '' = isArtStyleId(styleRaw) ? styleRaw : ''
  const rationale =
    typeof parsed.rationale === 'string' ? parsed.rationale.trim() : ''
  return { name, costume, artStyle, rationale }
}
