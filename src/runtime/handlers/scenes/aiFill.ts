import { sceneLinkLabel, beatSegmentLabel, unknownCharacterName, whereFromScene, locationSnippet } from '../../../domain/residualLabels'
/**
 * registerScenesAiFill
 */
import type { HandlerContext } from '../context'
import type { SceneProfileFields } from '../../../types/domain'
import { chatContentText } from '../../../types/domain'
import { AppError } from '../../../types/errors'

export function registerScenesAiFill(ctx: HandlerContext): void {
  const {
    reg,
    host,
    activity
  } = ctx

reg(
  'scenes:aiFill',
  (
    async (
      payload: {
        idea?: string
        storyId?: string
        /** all | scene:<id> | beat:<timelineEntryId> */
        segmentKey?: string | null
        locale?: 'zh-HK' | 'en'
        existingDraft?: Record<string, string | undefined | null>
        suggestFromStory?: boolean
        sceneNumber?: number
        /** Gallery / external still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
      }
    ) => {
      const {
        buildSceneMasterSystemPrompt,
        buildSceneMasterUserPrompt,
        buildSceneSuggestFromStoryUserPrompt,
        extractSceneProfileJson
      } = await import('../../../domain/sceneMasterPrompt')
      const {
        buildVisionUserContent,
        resolveReadableImagePath,
        visionFillUserPreamble
      } = await import('../../../domain/chatVision')
      const locale = payload.locale ?? 'zh-HK'
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      const characterSnippets: string[] = []
      const propSnippets: string[] = []
      const priorSceneSnippets: string[] = []
      const existingTitles: string[] = []
      let segmentLabel: string | null = null
      let focusSnippets: string[] = []
      const draft = payload.existingDraft
      const hasDraft = Boolean(
        draft &&
          Object.values(draft).some((v) => typeof v === 'string' && v.trim())
      )
      const idea = payload.idea?.trim() ?? ''
      const refPath = resolveReadableImagePath(payload.referenceImagePath)
      const hasImage = Boolean(refPath)
      if (
        !idea &&
        !hasDraft &&
        !payload.suggestFromStory &&
        !hasImage
      ) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrImageRequired'
        )
      }
      if (payload.suggestFromStory && !payload.storyId?.trim()) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      // Pure invent-from-idea: only user idea (+ empty form). Inject story
      // cast/style only when refining a draft or explicitly suggesting from story.
      const { shouldInjectStoryContext } = await import('../../../domain/storyContextPolicy')
      const injectStoryContext = shouldInjectStoryContext({
        hasDraft,
        suggestFromStory: Boolean(payload.suggestFromStory)
      })
      if (payload.storyId && injectStoryContext) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: payload.storyId },
          include: {
            storyCharacters: {
              take: 12,
              include: { character: true }
            },
            storyProps: { take: 12, include: { prop: true } },
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
        if (!story) {
          throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(payload.storyId))
        }
        storyTitle = story.title
        styleNote = story.styleNote
        for (const link of story.storyCharacters ?? []) {
          const c = link.character
          characterSnippets.push(
            `${c.name}: ${(c.description || '').slice(0, 120)} | costume: ${(c.costume || '').slice(0, 80)}`
          )
        }
        for (const link of story.storyProps ?? []) {
          const p = link.prop
          propSnippets.push(`${p.name}: ${(p.description || '').slice(0, 100)}`)
        }
        for (const link of story.storyScenes ?? []) {
          const s = link.scene
          existingTitles.push(s.title || s.description.slice(0, 40))
          priorSceneSnippets.push(
            `#${link.sceneNumber} ${s.title || ''}: ${s.description.slice(0, 200)}`
          )
        }

        // Resolve plot focus for suggest-from-story
        if (payload.suggestFromStory) {
          const seg = (payload.segmentKey ?? 'all').trim() || 'all'
          if (seg === 'all') {
            segmentLabel =
              locale === 'en' ? 'Entire story (all scenes)' : '全劇（所有場次）'
            focusSnippets = story.storyScenes.map((link) => {
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
            for (const beat of story.timeline.slice(0, 12)) {
              if (!beat.dialogue?.trim()) continue
              const who = beat.character?.name ?? '?'
              focusSnippets.push(
                `Beat ${beat.order + 1} [${who}]: ${beat.dialogue.slice(0, 300)}`
              )
            }
          } else if (seg.startsWith('scene:')) {
            const sceneId = seg.slice('scene:'.length)
            const link = story.storyScenes.find((l) => l.sceneId === sceneId)
            if (!link) {
              throw new AppError(
                'VALIDATION',
                'errors.sceneNotLinked'
              )
            }
            const s = link.scene
            const script = link.scriptOverride ?? s.script
            segmentLabel =
              locale === 'en'
                ? `Scene ${link.sceneNumber}: ${s.title || s.description.slice(0, 40)}`
                : `第 ${link.sceneNumber} 場：${s.title || s.description.slice(0, 40)}`
            focusSnippets = [
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
              focusSnippets.push(
                `Dialogue [${who}]: ${beat.dialogue.slice(0, 400)}`
              )
            }
          } else if (seg.startsWith('beat:')) {
            const entryId = seg.slice('beat:'.length)
            const beat = story.timeline.find((e) => e.id === entryId)
            if (!beat) {
              throw new AppError('VALIDATION', 'errors.timelineBeatNotFound')
            }
            const who =
              beat.character?.name ??
              unknownCharacterName(locale)
            const where =
              beat.scene?.title ||
              beat.scene?.description?.slice(0, 40) ||
              ''
            segmentLabel =
              locale === 'en'
                ? `Beat ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
                : `段落 ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
            focusSnippets = [
              [
                segmentLabel,
                beat.dialogue ? `Dialogue: ${beat.dialogue}` : '',
                beat.scene
                  ? `Location: ${beat.scene.description}`
                  : '',
                beat.prop ? `Prop: ${beat.prop.name}` : ''
              ]
                .filter(Boolean)
                .join('\n')
            ]
          } else {
            throw new AppError('VALIDATION', 'errors.unknownSegmentKey', String(seg))
          }
        }
      }
      const ideaForPrompt =
        idea ||
        (hasImage
          ? locale === 'en'
            ? 'Describe and invent a full location profile from the attached reference photo.'
            : '請根據附上的參考圖，完整填寫場景資料。'
          : locale === 'en'
            ? 'Polish'
            : '全面潤飾')
      const textPrompt = payload.suggestFromStory
        ? buildSceneSuggestFromStoryUserPrompt({
            storyTitle: storyTitle || 'Untitled',
            styleNote,
            locale,
            sceneNumber: payload.sceneNumber ?? existingTitles.length + 1,
            existingSceneTitles: existingTitles,
            characterSnippets,
            propSnippets,
            priorSceneSnippets,
            segmentLabel,
            focusSnippets
          })
        : [
            hasImage ? visionFillUserPreamble(locale, 'scene') : null,
            buildSceneMasterUserPrompt({
              idea: ideaForPrompt,
              storyTitle,
              styleNote,
              locale,
              characterSnippets,
              propSnippets,
              priorSceneSnippets,
              existingDraft: (hasDraft
                ? {
                    title: draft?.title ?? undefined,
                    description: draft?.description ?? undefined,
                    script: draft?.script ?? undefined,
                    locationType: draft?.locationType ?? undefined,
                    timeOfDay: draft?.timeOfDay ?? undefined,
                    weather: draft?.weather ?? undefined,
                    mood: draft?.mood ?? undefined,
                    lighting: draft?.lighting ?? undefined,
                    colorPalette: draft?.colorPalette ?? undefined,
                    setDressing: draft?.setDressing ?? undefined,
                    soundscape: draft?.soundscape ?? undefined,
                    cameraNotes: draft?.cameraNotes ?? undefined,
                    visualTags: draft?.visualTags ?? undefined,
                    artStyle: draft?.artStyle ?? undefined
                  }
                : null) as Partial<SceneProfileFields> | null
            })
          ]
            .filter(Boolean)
            .join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildSceneMasterSystemPrompt(locale)
          },
          {
            role: 'user',
            content: payload.suggestFromStory
              ? textPrompt
              : buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 2500
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractSceneProfileJson(text)
      const { fillMissingProfileFields } = await import('../../../domain/profileFillMissing')
      const { SCENE_PROFILE_JSON_KEYS } = await import('../../../domain/sceneMasterPrompt')
      const sceneRequired = SCENE_PROFILE_JSON_KEYS.filter(
        (k) => k !== 'artStyle' && k !== 'hardRules'
      )
      const scenePatch = await fillMissingProfileFields({
        profile: profile as unknown as Record<string, unknown>,
        requiredKeys: sceneRequired,
        locale,
        chat: (req) => ctx.aiClient.chat(req),
        referenceImagePath: refPath,
        maxTokens: 1200
      })
      profile = scenePatch.profile as unknown as typeof profile
      const sceneRaw = scenePatch.raw
        ? `${text}\n---missing-fill---\n${scenePatch.raw}`
        : text
      activity.append({
        kind: 'scene',
        message: payload.suggestFromStory
          ? 'suggestScene'
          : hasImage
            ? 'aiFillSceneFromImage'
            : hasDraft
              ? 'aiRefineScene'
              : 'aiFillScene',
        storyId: payload.storyId,
        meta: {
          title: profile.title,
          segmentKey: payload.segmentKey ?? null,
          usedImage: hasImage,
          patchedKeys: scenePatch.patchedKeys
        }
      })
      return {
        profile,
        profileJson: JSON.stringify(profile, null, 2),
        raw: sceneRaw
      }
    }
  )
)
}
