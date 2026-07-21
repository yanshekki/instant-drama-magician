/**
 * registerCharactersSoul
 */
import { writeFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { chatContentText } from '../../../types/domain'
import { AppError } from '../../../types/errors'
import {
  buildSoulGenerateSystemPrompt,
  buildSoulGenerateUserPrompt,
  normalizeSoulMarkdown,
  profileHasSoulSource
} from '../../../domain/soulGenerate'
import { extractNameFromSoulMd } from '../../../domain/character'

export function registerCharactersSoul(ctx: HandlerContext): void {
  const {
    reg,
    generation,
    activity
  } = ctx

reg(
  'characters:generateSoul',
  (
    async (
      payload: {
        storyId?: string
        locale?: 'zh-HK' | 'en'
        profile: Record<string, unknown>
        existingSoul?: string | null
        userRequest?: string | null
      }
    ) => {
      const spokenRaw = payload.profile?.spokenLanguages
      const spokenLanguages = Array.isArray(spokenRaw)
        ? spokenRaw.filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : undefined
      const str = (k: string): string | undefined => {
        const v = payload.profile?.[k]
        return typeof v === 'string' && v.trim() ? v.trim() : undefined
      }
      const profile = {
        name: str('name'),
        description: str('description'),
        appearance: str('appearance'),
        personality: str('personality'),
        backstory: str('backstory'),
        costume: str('costume'),
        ageRange: str('ageRange'),
        gender: str('gender'),
        voiceDesc: str('voiceDesc'),
        spokenLanguages,
        mannerisms: str('mannerisms'),
        relationships: str('relationships'),
        visualTags: str('visualTags')
      }
      const hasExistingSoul = Boolean(payload.existingSoul?.trim())
      if (!profileHasSoulSource(profile) && !hasExistingSoul) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrDraftRequired',
          'Fill name or appearance / personality first'
        )
      }
      // Soul from profile + existing soul + user request only.
      const locale = payload.locale ?? 'zh-HK'
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildSoulGenerateSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildSoulGenerateUserPrompt({
              profile,
              locale,
              existingSoul: payload.existingSoul,
              userRequest: payload.userRequest
            })
          }
        ],
        max_tokens: 4000
      })
      const raw = chatContentText(completion.choices[0]?.message.content)
      const content = normalizeSoulMarkdown(raw)
      if (!content || content.length < 40) {
        throw new AppError(
          'AI_FAILED',
          'errors.aiUnavailable',
          'Retry or fill more profile fields'
        )
      }
      // Persist draft under media/tmp so reload path works without Hub id
      const store = generation().getMediaStore()
      store.ensureTmpDir()
      const slug = (profile.name ?? 'character')
        .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
        .slice(0, 40)
      const filePath = store.tmpImagePath(`soul_${slug}`, '.md')
      writeFileSync(filePath, content, 'utf8')
      const title =
        extractNameFromSoulMd(content) || profile.name?.trim() || 'Soul'
      activity.append({
        kind: 'character',
        message: 'generateSoul',
        storyId: payload.storyId,
        meta: { title, path: filePath, chars: content.length }
      })
      return {
        content,
        filePath,
        title,
        raw
      }
    }
  )
)
}
