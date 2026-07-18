/**
 * Shared: chat-LLM polish → generateVideo for all app video paths.
 */
import type {
  AIProvider,
  VideoGenRequest,
  VideoGenResult
} from '../../types/domain'
import {
  buildVideoPromptPolishSystemPrompt,
  extractPolishedVideoPrompt
} from '../../domain/videoPromptPolish'

export interface PolishThenGenerateOptions {
  ai: AIProvider
  /** Template / raw prompt if LLM fails or returns empty. */
  fallbackPrompt: string
  /** Full user message for the polish chat (materials + task). */
  polishUserContent: string
  locale?: 'zh-HK' | 'en'
  videoRequest: Omit<VideoGenRequest, 'prompt'>
  signal?: AbortSignal
  /** Optional progress: 'llm' | 'generate' */
  onPhase?: (phase: 'llm' | 'generate') => void
  maxTokens?: number
}

export type PolishThenGenerateResult = VideoGenResult & {
  promptUsed: string
  polished: boolean
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Cancelled')
  }
}

/**
 * Always try LLM to polish the video prompt, then call generateVideo.
 * On chat failure or empty extract → use fallbackPrompt.
 */
export async function polishThenGenerateVideo(
  options: PolishThenGenerateOptions
): Promise<PolishThenGenerateResult> {
  const locale = options.locale ?? 'zh-HK'
  const fallback = options.fallbackPrompt.trim()
  if (!fallback) {
    throw new Error('fallbackPrompt is required')
  }
  if (!options.ai.generateVideo) {
    throw new Error('AI provider has no generateVideo')
  }

  assertNotAborted(options.signal)
  options.onPhase?.('llm')

  let promptUsed = fallback
  let polished = false

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
    assertNotAborted(options.signal)
    const raw = completion.choices[0]?.message?.content ?? ''
    const extracted = extractPolishedVideoPrompt(raw)
    if (extracted.length >= 40) {
      promptUsed = extracted
      polished = true
    }
  } catch {
    polished = false
    promptUsed = fallback
  }

  assertNotAborted(options.signal)
  options.onPhase?.('generate')

  const result = await options.ai.generateVideo!({
    ...options.videoRequest,
    prompt: promptUsed
  })

  return {
    ...result,
    promptUsed,
    polished
  }
}
