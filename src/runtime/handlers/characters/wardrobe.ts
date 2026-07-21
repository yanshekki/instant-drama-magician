import { beatSegmentLabel, locationSnippet, sceneLinkLabel, unknownCharacterName, whereFromScene } from '../../../domain/residualLabels'
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
        /** all | scene:<id> | beat:<timelineEntryId> */
        segmentKey?: string | null
        locale?: 'zh-HK' | 'en'
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
          include: {
            storyScenes: {
              orderBy: { sceneNumber: 'asc' },
              take: 40,
              include: { scene: true }
            },
            timeline: {
              orderBy: { order: 'asc' },
              take: 80,
              include: {
                character: true,
                scene: true,
                prop: true
              }
            }
          }
        })
        if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))
        storyTitle = story.title
        styleNote = story.styleNote
        const seg = (payload.segmentKey ?? 'all').trim() || 'all'

        if (seg === 'all') {
          segmentLabel =
            locale === 'en' ? 'Entire story (all scenes)' : '全劇（所有場次）'
          sceneSnippets = story.storyScenes.map((link) => {
            const s = link.scene
            const script = link.scriptOverride ?? s.script
            return [
              `Scene ${link.sceneNumber}: ${s.title || s.description}`,
              s.description,
              script ? String(script).slice(0, 500) : ''
            ]
              .filter(Boolean)
              .join('\n')
          })
          // Also fold short dialogue beats when available
          for (const beat of story.timeline.slice(0, 12)) {
            if (!beat.dialogue?.trim()) continue
            const who = beat.character?.name ?? '?'
            sceneSnippets.push(
              `Beat ${beat.order + 1} [${who}]: ${beat.dialogue.slice(0, 300)}`
            )
          }
        } else if (seg.startsWith('scene:')) {
          const sceneId = seg.slice('scene:'.length)
          const link = story.storyScenes.find((l) => l.sceneId === sceneId)
          if (!link) {
            throw new AppError('VALIDATION', 'errors.sceneNotLinked')
          }
          const s = link.scene
          const script = link.scriptOverride ?? s.script
          segmentLabel =
            sceneLinkLabel(
              locale,
              link.sceneNumber,
              s.title,
              s.description
            )
          sceneSnippets = [
            [
              segmentLabel,
              s.description,
              script ? String(script).slice(0, 800) : '',
              s.mood ? `mood: ${s.mood}` : '',
              s.timeOfDay ? `time: ${s.timeOfDay}` : '',
              s.weather ? `weather: ${s.weather}` : ''
            ]
              .filter(Boolean)
              .join('\n')
          ]
          for (const beat of story.timeline) {
            if (beat.sceneId !== sceneId || !beat.dialogue?.trim()) continue
            const who = beat.character?.name ?? '?'
            sceneSnippets.push(
              `Dialogue [${who}]: ${beat.dialogue.slice(0, 400)}`
            )
          }
        } else if (seg.startsWith('beat:')) {
          const entryId = seg.slice('beat:'.length)
          const beat = story.timeline.find((e) => e.id === entryId)
          if (!beat) {
            throw new AppError('VALIDATION', 'errors.timelineBeatNotFound')
          }
          const who = beat.character?.name ?? unknownCharacterName(locale)
          const where =
            whereFromScene(beat.scene)
          segmentLabel =
            beatSegmentLabel(locale, beat.order, who, where)
          sceneSnippets = [
            [
              segmentLabel,
              beat.dialogue ? `Dialogue: ${beat.dialogue}` : '',
              locationSnippet(
                Boolean(beat.scene),
                beat.scene?.description || ''
              ),
              beat.prop ? `Prop: ${beat.prop.name}` : ''
            ]
              .filter(Boolean)
              .join('\n')
          ]
        } else {
          throw new AppError('VALIDATION', 'errors.unknownSegmentKey', String(seg))
        }
      } else {
        segmentLabel =
          locale === 'en' ? 'No story selected' : '未選故事（僅角色資料）'
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
            content: buildWardrobeSuggestSystemPrompt(locale)
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
          segmentKey: payload.segmentKey ?? 'all'
        }
      })
      return { suggestion, raw: text, segmentLabel, storyTitle }
    }
  )
)
}
