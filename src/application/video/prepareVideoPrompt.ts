/**
 * LLM polish for video-prep professional director prompt (no video call yet).
 */
import type { AIProvider } from '../../types/domain'
import {
  buildVideoPromptPolishSystemPrompt,
  extractPolishedVideoPrompt
} from '../../domain/videoPromptPolish'

export async function polishProfessionalVideoPrompt(options: {
  ai: AIProvider
  locale?: 'zh-HK' | 'en'
  fallbackPrompt: string
  polishUserContent: string
  maxTokens?: number
  signal?: AbortSignal
}): Promise<{ prompt: string; polished: boolean }> {
  const locale = options.locale ?? 'zh-HK'
  const fallback = options.fallbackPrompt.trim()
  if (!fallback) throw new Error('fallbackPrompt is required')
  if (options.signal?.aborted) throw new Error('Cancelled')

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
    if (options.signal?.aborted) throw new Error('Cancelled')
    const raw = completion.choices[0]?.message?.content ?? ''
    const extracted = extractPolishedVideoPrompt(raw)
    if (extracted.length >= 40) {
      return { prompt: extracted, polished: true }
    }
  } catch {
    /* use fallback */
  }
  return { prompt: fallback, polished: false }
}
