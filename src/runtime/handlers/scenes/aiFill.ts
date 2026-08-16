import { PromptCatalog } from '../../../prompts'
import {
  normalizeSegmentKeys,
  PLOT_FOCUS_STORY_INCLUDE,
  resolvePlotFocus
} from '../../../domain/plotFocus'
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
        /** @deprecated Prefer segmentKeys */
        segmentKey?: string | null
        segmentKeys?: string[] | null
        locale?: string
        existingDraft?: Record<string, string | undefined | null>
        suggestFromStory?: boolean
        sceneNumber?: number
        /** Gallery / external still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
        promptTemplateId?: string | null
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
      // Inject story cast/style/scenes only on explicit suggestFromStory.
      // Draft refine = improve form only — never silent activeStory / Demo sample.
      const { shouldInjectStoryContext } = await import('../../../domain/storyContextPolicy')
      const { templateFlags } = await import('../../../domain/promptTemplates')
      const tplFlags = templateFlags(payload.promptTemplateId, 'copy')
      const injectStoryContext = shouldInjectStoryContext({
        suggestFromStory: Boolean(payload.suggestFromStory),
        injectStory: tplFlags.injectStory
      })
      if (payload.storyId && injectStoryContext) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: payload.storyId },
          include: {
            ...PLOT_FOCUS_STORY_INCLUDE,
            storyCharacters: {
              take: 12,
              include: { character: true }
            },
            storyProps: { take: 12, include: { prop: true } }
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
          const focus = resolvePlotFocus(
            story,
            normalizeSegmentKeys({
              segmentKeys: payload.segmentKeys,
              segmentKey: payload.segmentKey
            }),
            locale
          )
          segmentLabel = focus.segmentLabel
          focusSnippets = focus.focusSnippets
        }
      }
      const ideaForPrompt =
        idea ||
        (hasImage
          ? PromptCatalog.t(locale, 'scene.ideaFromImage')
          : PromptCatalog.t(locale, 'scene.polishIdea'))
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
            content: buildSceneMasterSystemPrompt(
              locale,
              payload.promptTemplateId
            )
          },
          {
            role: 'user',
            content: payload.suggestFromStory
              ? textPrompt
              : buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 2500,
        timeoutMs: 240_000
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractSceneProfileJson(text)
      const { fillMissingProfileFields } = await import('../../../domain/profileFillMissing')
      const { shouldFillMissingKeys } = await import('../../../domain/promptTemplates')
      const { SCENE_PROFILE_JSON_KEYS } = await import('../../../domain/sceneMasterPrompt')
      const sceneRequired = SCENE_PROFILE_JSON_KEYS.filter(
        (k) => k !== 'artStyle' && k !== 'hardRules'
      )
      let sceneRaw = text
      let patchedKeys: string[] = []
      if (shouldFillMissingKeys(payload.promptTemplateId)) {
        const scenePatch = await fillMissingProfileFields({
          profile: profile as unknown as Record<string, unknown>,
          requiredKeys: sceneRequired,
          locale,
          chat: (req) => ctx.aiClient.chat(req),
          referenceImagePath: refPath,
          maxTokens: 1200,
          promptTemplateId: payload.promptTemplateId
        })
        profile = scenePatch.profile as unknown as typeof profile
        patchedKeys = scenePatch.patchedKeys
        sceneRaw = scenePatch.raw
          ? `${text}\n---missing-fill---\n${scenePatch.raw}`
          : text
      }
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
          segmentKeys: payload.segmentKeys ?? null,
          usedImage: hasImage,
          patchedKeys
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
