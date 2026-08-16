/**
 * Story chapter IPC handlers.
 */
import { chatContentText } from '../../types/domain'
import type { CreateChapterInput, UpdateChapterInput } from '../../types/domain'
import { AppError } from '../../types/errors'
import { ChapterCastService } from '../../application/services'
import type { HandlerContext } from './context'
import {
  buildCastFromChaptersSystemPrompt,
  buildCastFromChaptersUserPrompt,
  buildChapterPolishSystemPrompt,
  buildChapterPolishUserPrompt,
  buildStoryChaptersSystemPrompt,
  buildStoryChaptersUserPrompt,
  chapterAiMaxTokens,
  clampChapterAiCount,
  clampChapterAiWords,
  extractCastFromChaptersJson,
  extractStoryChaptersJson,
  formatChaptersForPrompt,
  summarizeCastPlan,
  type CastFromChaptersExtract
} from '../../domain/storyChapterPrompt'

export function registerChaptersHandlers(ctx: HandlerContext): void {
  const { reg, host, stories, chapters } = ctx
  const chapterCast = (): ChapterCastService =>
    new ChapterCastService(host.getPrisma())

  reg('chapters:list', async (storyId: string) => chapters().list(storyId))
  reg('chapters:create', async (input: CreateChapterInput) =>
    chapters().create(input)
  )
  reg(
    'chapters:update',
    async (id: string, data: UpdateChapterInput) => chapters().update(id, data)
  )
  reg('chapters:delete', async (id: string) => chapters().delete(id))
  reg(
    'chapters:reorder',
    async (storyId: string, orderedIds: string[]) =>
      chapters().reorder(storyId, orderedIds)
  )

  reg(
    'chapters:aiFill',
    async (payload: {
      storyId: string
      idea?: string
      locale?: string
      replace?: boolean
      chapterCount?: number
      wordsPerChapter?: number
      promptTemplateId?: string | null
    }) => {
      if (!payload?.storyId) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      const locale = payload.locale ?? 'zh-HK'
      const chapterCount = clampChapterAiCount(payload.chapterCount)
      const wordsPerChapter = clampChapterAiWords(payload.wordsPerChapter)
      const maxTokens = chapterAiMaxTokens(chapterCount, wordsPerChapter)
      const replace = payload.replace === true
      const story = await stories().get(payload.storyId)
      const system = buildStoryChaptersSystemPrompt(
        locale,
        payload.promptTemplateId,
        { count: chapterCount, words: wordsPerChapter }
      )
      const user = buildStoryChaptersUserPrompt({
        title: story.title,
        styleNote: (story as { styleNote?: string | null }).styleNote,
        hardRules: (story as { hardRules?: string | null }).hardRules,
        idea: payload.idea,
        locale
      })
      const completion = await ctx.aiClient.chat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: maxTokens,
        timeoutMs: 240_000
      })
      const raw = chatContentText(completion.choices[0]?.message.content)
      const drafts = extractStoryChaptersJson(raw)
      const rows = replace
        ? await chapters().replaceAll(payload.storyId, drafts)
        : await chapters().appendAll(payload.storyId, drafts)
      return { chapters: rows, replaced: replace, drafts, raw }
    }
  )

  reg(
    'chapters:aiPolish',
    async (payload: {
      storyId: string
      chapterId: string
      idea?: string
      locale?: string
      promptTemplateId?: string | null
    }) => {
      if (!payload?.storyId || !payload?.chapterId) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      const locale = payload.locale ?? 'zh-HK'
      const story = await stories().get(payload.storyId)
      const list = await chapters().list(payload.storyId)
      const current = list.find((c) => c.id === payload.chapterId)
      if (!current) {
        throw new AppError(
          'NOT_FOUND',
          'errors.chapterNotFound',
          payload.chapterId
        )
      }
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildChapterPolishSystemPrompt(
              locale,
              payload.promptTemplateId
            )
          },
          {
            role: 'user',
            content: buildChapterPolishUserPrompt({
              storyTitle: story.title,
              title: current.title,
              body: current.body,
              idea: payload.idea,
              locale
            })
          }
        ],
        max_tokens: 1800
      })
      const raw = chatContentText(completion.choices[0]?.message.content)
      const drafts = extractStoryChaptersJson(raw)
      const polished = drafts[0]
      const row = await chapters().update(payload.chapterId, {
        title: polished.title || current.title,
        body: polished.body || current.body
      })
      return { chapter: row, raw }
    }
  )

  reg(
    'chapters:generateCast',
    async (payload: {
      storyId: string
      idea?: string
      locale?: string
      preview?: boolean
      drafts?: CastFromChaptersExtract
      promptTemplateId?: string | null
    }) => {
      if (!payload?.storyId) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      const locale = payload.locale ?? 'zh-HK'
      const svc = chapterCast()
      const ctxPlan = await svc.loadPlanContext(payload.storyId)
      const story = await stories().get(payload.storyId)
      let drafts = payload.drafts
      let raw = ''
      if (!drafts) {
        const existingNames = [
          ...ctxPlan.linked.characters.map((c) => c.name),
          ...ctxPlan.linked.scenes.map((s) => s.title || s.description),
          ...ctxPlan.linked.props.map((p) => p.name),
          ...ctxPlan.linked.actions.map((a) => a.name)
        ]
          .filter(Boolean)
          .join(', ')
        const completion = await ctx.aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildCastFromChaptersSystemPrompt(
                locale,
                payload.promptTemplateId
              )
            },
            {
              role: 'user',
              content: buildCastFromChaptersUserPrompt({
                title: story.title,
                styleNote: (story as { styleNote?: string | null }).styleNote,
                chaptersText: formatChaptersForPrompt(ctxPlan.chapters, locale),
                existingNames,
                locale
              })
            }
          ],
          max_tokens: 3500
        })
        raw = chatContentText(completion.choices[0]?.message.content)
        drafts = extractCastFromChaptersJson(raw)
      }
      const plan = svc.planFromDrafts(drafts, ctxPlan)
      const summary = summarizeCastPlan(plan)
      if (payload.preview) {
        return { preview: true, plan, summary, drafts, raw }
      }
      await svc.applyPlan(payload.storyId, plan, ctxPlan.artStyle)
      return { preview: false, plan, summary, drafts, raw }
    }
  )
}
