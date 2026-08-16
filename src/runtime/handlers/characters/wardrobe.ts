import { PromptCatalog } from '../../../prompts'
import {
  normalizeSegmentKeys,
  PLOT_FOCUS_STORY_INCLUDE,
  resolvePlotFocus
} from '../../../domain/plotFocus'
/**
 * registerCharactersWardrobe
 */
import type { HandlerContext } from '../context'
import { chatContentText } from '../../../types/domain'
import { AppError } from '../../../types/errors'

export function registerCharactersWardrobe(ctx: HandlerContext): void {
  const {
    reg,
    host,
    characters,
    activity
  } = ctx

reg(
  'characters:suggestWardrobe',
  (
    async (
      payload: {
        characterId?: string
        storyId?: string
        /** @deprecated Prefer segmentKeys */
        segmentKey?: string | null
        segmentKeys?: string[] | null
        locale?: string
        name?: string
        appearance?: string | null
        costume?: string | null
        ageRange?: string | null
        gender?: string | null
        description?: string | null
        personality?: string | null
        visualTags?: string | null
        mannerisms?: string | null
        soulExcerpt?: string | null
        userRequest?: string | null
        existingCostumeNames?: string[]
        promptTemplateId?: string | null
      }
    ) => {
      const locale = payload.locale ?? 'zh-HK'
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      let storyId = payload.storyId
      let characterName = payload.name?.trim() || ''
      let appearance = payload.appearance
      let costume = payload.costume
      let ageRange = payload.ageRange
      let gender = payload.gender
      let description = payload.description
      let personality = payload.personality
      let visualTags = payload.visualTags
      let mannerisms = payload.mannerisms
      let soulExcerpt = payload.soulExcerpt
      const userRequest = payload.userRequest
      let existingNames = payload.existingCostumeNames ?? []
      let sceneSnippets: string[] = []
      let segmentLabel: string | null = null

      if (payload.characterId) {
        const row = await characters().get(payload.characterId)
        characterName = characterName || row.name
        appearance = appearance ?? row.appearance
        costume = costume ?? row.costume
        ageRange = ageRange ?? row.ageRange
        gender = gender ?? row.gender
        description = description ?? row.description
        personality = personality ?? row.personality
        visualTags = visualTags ?? row.visualTags
        mannerisms = mannerisms ?? row.mannerisms
        if (!existingNames.length) {
          const { parseCharacterCostumes } = await import('../../../domain/characterCostumes')
          existingNames = parseCharacterCostumes(
            (row as { costumesJson?: string | null }).costumesJson
          ).map((c) => c.name)
        }
      }
      if (!characterName) {
        throw new AppError('VALIDATION', 'errors.characterNameRequired')
      }
      if (storyId) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: storyId },
          include: PLOT_FOCUS_STORY_INCLUDE
        })
        if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))
        storyTitle = story.title
        styleNote = story.styleNote
        const focus = resolvePlotFocus(
          story,
          normalizeSegmentKeys({
            segmentKeys: payload.segmentKeys,
            segmentKey: payload.segmentKey
          }),
          locale
        )
        segmentLabel = focus.segmentLabel
        sceneSnippets = focus.focusSnippets
      } else {
        segmentLabel =
          PromptCatalog.t(locale, 'segment.noStory')
      }

      const {
        buildWardrobeSuggestSystemPrompt,
        buildWardrobeSuggestUserPrompt,
        extractWardrobeSuggestionJson
      } = await import('../../../domain/wardrobeSuggest')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildWardrobeSuggestSystemPrompt(
              locale,
              payload.promptTemplateId
            )
          },
          {
            role: 'user',
            content: buildWardrobeSuggestUserPrompt({
              characterName,
              appearance,
              currentCostume: costume,
              ageRange,
              gender,
              description,
              personality,
              visualTags,
              mannerisms,
              soulExcerpt: soulExcerpt ?? null,
              userRequest: userRequest ?? null,
              storyTitle: storyTitle ?? null,
              styleNote: styleNote ?? null,
              sceneSnippets,
              segmentLabel,
              locale,
              existingCostumeNames: existingNames
            })
          }
        ],
        max_tokens: 1200
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      const suggestion = extractWardrobeSuggestionJson(text)
      activity.append({
        kind: 'character',
        message: 'suggestWardrobe',
        storyId: storyId ?? undefined,
        meta: {
          characterId: payload.characterId ?? null,
          name: suggestion.name,
          artStyle: suggestion.artStyle,
          segmentKey: payload.segmentKey ?? 'all',
          segmentKeys: payload.segmentKeys ?? null
        }
      })
      return { suggestion, raw: text, segmentLabel, storyTitle }
    }
  )
)
}
