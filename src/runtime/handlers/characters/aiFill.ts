/**
 * registerCharactersAiFill
 */
import { PromptCatalog } from '../../../prompts'
import type { HandlerContext } from '../context'
import { chatContentText } from '../../../types/domain'
import { AppError } from '../../../types/errors'
import { buildCharacterMasterSystemPrompt, buildCharacterMasterUserPrompt, extractCharacterProfileJson } from '../../../domain/characterMasterPrompt'

export function registerCharactersAiFill(ctx: HandlerContext): void {
  const {
    reg,
    activity
  } = ctx

reg(
  'characters:aiFill',
  (
    async (
      payload: {
        idea?: string
        storyId?: string
        locale?: string
        /** Current form fields — enables create + edit refine */
        existingDraft?: Record<string, unknown>
        /** Full soul.md / hub markdown for identity merge */
        soulContent?: string | null
        /** Gallery / external still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
        promptTemplateId?: string | null
      }
    ) => {
      const idea = payload.idea?.trim() ?? ''
      const draft = payload.existingDraft
      const soulContent = payload.soulContent?.trim() ?? ''
      const hasDraft = Boolean(
        draft &&
          Object.values(draft).some((v) => {
            if (typeof v === 'string') return v.trim().length > 0
            if (Array.isArray(v)) return v.length > 0
            return v != null && String(v).trim().length > 0
          })
      )
      const hasSoul = soulContent.length > 0
      const {
        buildVisionUserContent,
        resolveReadableImagePath,
        visionFillUserPreamble
      } = await import('../../../domain/chatVision')
      const { templateFlags } = await import('../../../domain/promptTemplates')
      const tplFlags = templateFlags(payload.promptTemplateId, 'copy')
      const refPath = resolveReadableImagePath(payload.referenceImagePath)
      const hasImage = Boolean(refPath)
      if (!idea && !hasDraft && !hasSoul && !hasImage) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrImageRequired'
        )
      }
      // Character invent uses only idea + form + soul unless the user picked from-story.
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      const locale = payload.locale ?? 'zh-HK'
      if (tplFlags.injectStory && payload.storyId?.trim()) {
        const story = await ctx.host.getPrisma().story.findUnique({
          where: { id: payload.storyId }
        })
        storyTitle = story?.title
        styleNote = story?.styleNote
      }

      const str = (k: string): string | undefined => {
        const v = draft?.[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
        return undefined
      }
      const spokenRaw = draft?.spokenLanguages
      const spokenLanguages = Array.isArray(spokenRaw)
        ? spokenRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : typeof spokenRaw === 'string' && spokenRaw.trim()
          ? spokenRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
          : undefined
      const existingDraft = hasDraft
        ? {
            name: str('name'),
            description: str('description'),
            appearance: str('appearance'),
            personality: str('personality'),
            backstory: str('backstory'),
            costume: str('costume'),
            ageRange: str('ageRange'),
            gender: str('gender'),
            voiceDesc: str('voiceDesc'),
            spokenLanguages:
              spokenLanguages && spokenLanguages.length > 0
                ? spokenLanguages
                : undefined,
            mannerisms: str('mannerisms'),
            relationships: str('relationships'),
            visualTags: str('visualTags')
          }
        : null
      const ideaForPrompt =
        idea ||
        (hasImage
          ? PromptCatalog.t(locale, 'vision.inventFromImage', {
              kind: PromptCatalog.t(locale, 'vision.character')
            })
          : PromptCatalog.t(locale, 'vision.polishAll'))
      const textPrompt = [
        hasImage ? visionFillUserPreamble(locale, 'character') : null,
        buildCharacterMasterUserPrompt({
          idea: ideaForPrompt,
          storyTitle,
          styleNote,
          locale,
          existingDraft,
          soulContent: hasSoul ? soulContent : null
        })
      ]
        .filter(Boolean)
        .join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildCharacterMasterSystemPrompt(
              locale,
              payload.promptTemplateId
            )
          },
          {
            role: 'user',
            content: buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 3000
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractCharacterProfileJson(text)
      const { fillMissingProfileFields } = await import('../../../domain/profileFillMissing')
      const { shouldFillMissingKeys } = await import('../../../domain/promptTemplates')
      const { CHARACTER_PROFILE_JSON_KEYS: charKeys } = await import('../../../domain/characterMasterPrompt')
      const charRequired = charKeys.filter((k) => k !== 'spokenLanguages' && k !== 'hardRules')
      let rawOut = text
      let patchedKeys: string[] = []
      if (shouldFillMissingKeys(payload.promptTemplateId)) {
        const charPatch = await fillMissingProfileFields({
          profile: profile as unknown as Record<string, unknown>,
          requiredKeys: charRequired,
          locale,
          chat: (req) => ctx.aiClient.chat(req),
          referenceImagePath: refPath,
          maxTokens: 1200,
          promptTemplateId: payload.promptTemplateId
        })
        profile = charPatch.profile as unknown as typeof profile
        patchedKeys = charPatch.patchedKeys
        rawOut = charPatch.raw
          ? `${text}\n---missing-fill---\n${charPatch.raw}`
          : text
      }
      activity.append({
        kind: 'character',
        message: hasImage
          ? 'aiFillFromImage'
          : hasDraft || hasSoul
            ? 'aiRefine'
            : 'aiFill',
        storyId: payload.storyId,
        meta: {
          name: profile.name,
          usedSoul: hasSoul,
          usedDraft: hasDraft,
          usedImage: hasImage,
          patchedKeys
        }
      })
      return {
        profile,
        profileJson: JSON.stringify(profile, null, 2),
        raw: rawOut
      }
    }
  )
)

/** Generate local soul.md markdown from character profile fields (Gateway chat). */
}
