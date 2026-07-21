/**
 * LLM polish for video-prep professional director prompt (no video call yet).
 * Always re-appends hardRules after polish so the review textarea still shows them
 * even if the LLM drops the HARD RULES block.
 */
import type { AIProvider } from '../../types/domain'
import { chatContentText } from '../../types/domain'
import { ensureHardRules } from '../../domain/promptHardRules'
import {
  buildVideoPromptPolishSystemPrompt,
  extractPolishedVideoPrompt
} from '../../domain/videoPromptPolish'

export async function polishProfessionalVideoPrompt(options: {
  ai: AIProvider
  locale?: 'zh-HK' | 'en'
  fallbackPrompt: string
  polishUserContent: string
  /** Entity / merged timeline hard rules — forced onto the returned prompt. */
  hardRules?: string | null
  maxTokens?: number
  signal?: AbortSignal
}): Promise<{ prompt: string; polished: boolean }> {
  const locale = options.locale ?? 'zh-HK'
  const fallback = options.fallbackPrompt.trim()
  if (!fallback) throw new Error('fallbackPrompt is required')
  if (options.signal?.aborted) throw new Error('errors.cancelled')

  const seal = (prompt: string): string =>
    ensureHardRules(prompt, options.hardRules)

  try {
    const completion = await options.ai.chat({
      messages: [
        {
          role: 'system',
          content: buildVideoPromptPolishSystemPrompt(locale)
        },
        { role: 'user', content: options.polishUserContent }
      ],
      max_tokens: options.maxTokens ?? 900
    })
    if (options.signal?.aborted) throw new Error('errors.cancelled')
    const raw = chatContentText(completion.choices[0]?.message?.content)
    const extracted = extractPolishedVideoPrompt(raw)
    if (extracted.length >= 40) {
      return { prompt: seal(extracted), polished: true }
    }
  } catch {
    /* use fallback */
  }
  return { prompt: seal(fallback), polished: false }
}
