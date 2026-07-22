/**
 * LLM polish for video-prep professional director prompt (no video call yet).
 * Always re-appends hardRules after polish so the review textarea still shows them
 * even if the LLM drops the HARD RULES block.
 *
 * Optional multi-image vision: attach reference stills as image_url parts so the
 * polish LLM can see cast/location (chat supports N images; video export is still one).
 */
import type { AIProvider } from '../../types/domain'
import { chatContentText } from '../../types/domain'
import { ensureHardRules } from '../../domain/promptHardRules'
import { buildMultiVisionUserContent } from '../../domain/chatVision'
import {
  buildVideoPromptPolishSystemPrompt,
  extractPolishedVideoPrompt
} from '../../domain/videoPromptPolish'
import { AppError } from '../../types/errors'

export async function polishProfessionalVideoPrompt(options: {
  ai: AIProvider
  locale?: 'zh-HK' | 'en'
  fallbackPrompt: string
  polishUserContent: string
  /** Entity / merged timeline hard rules — forced onto the returned prompt. */
  hardRules?: string | null
  /** Optional identity / cast / scene stills for multi-vision polish. */
  referenceImagePaths?: Array<string | null | undefined> | null
  maxTokens?: number
  signal?: AbortSignal
}): Promise<{ prompt: string; polished: boolean; imageCount?: number }> {
  const locale = options.locale ?? 'zh-HK'
  const fallback = options.fallbackPrompt.trim()
  if (!fallback) throw new AppError('VALIDATION', 'errors.fallbackPromptRequired')
  if (options.signal?.aborted) throw new AppError('CANCELLED', 'errors.cancelled')

  const seal = (prompt: string): string =>
    ensureHardRules(prompt, options.hardRules)

  const paths = (options.referenceImagePaths ?? [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)

  let userContent: string | ReturnType<typeof buildMultiVisionUserContent> =
    options.polishUserContent
  let imageCount = 0
  if (paths.length > 0) {
    try {
      userContent = buildMultiVisionUserContent(
        options.polishUserContent,
        paths
      )
      if (Array.isArray(userContent)) {
        imageCount = userContent.filter((p) => p.type === 'image_url').length
      }
    } catch {
      userContent = options.polishUserContent
      imageCount = 0
    }
  }

  try {
    const completion = await options.ai.chat({
      messages: [
        {
          role: 'system',
          content: buildVideoPromptPolishSystemPrompt(locale)
        },
        { role: 'user', content: userContent }
      ],
      max_tokens: options.maxTokens ?? 900
    })
    if (options.signal?.aborted) throw new AppError('CANCELLED', 'errors.cancelled')
    const raw = chatContentText(completion.choices[0]?.message?.content)
    const extracted = extractPolishedVideoPrompt(raw)
    if (extracted.length >= 40) {
      return { prompt: seal(extracted), polished: true, imageCount }
    }
  } catch {
    /* use fallback */
  }
  return { prompt: seal(fallback), polished: false, imageCount }
}
