/**
 * Build OpenAI-compatible chat/completions JSON body aligned with
 * Grok-Cli-to-OpenAI-compatible (chat.dto + strictSampling).
 *
 * Gateway strictSampling rejects temperature | top_p | stop when present.
 * max_tokens is allowed.
 * @see Grok-Cli-to-OpenAI-compatible src/services/grok-request-builder.service.ts
 */

import type { ChatMessage } from '../types/domain'
import type { LlmProviderPreset } from './openaiCompatible'
import { inferLlmPreset } from './openaiCompatible'

export interface ChatCompletionBodyInput {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop?: string | string[]
  /**
   * When true, never include temperature / top_p / stop
   * (required when Gateway has strictSampling: true, e.g. locked preset).
   */
  omitSampling: boolean
}

export type ChatCompletionBody = {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop?: string | string[]
}

export function shouldOmitSamplingForProvider(
  llmProvider: LlmProviderPreset | undefined,
  baseUrl: string
): boolean {
  const preset = llmProvider ?? inferLlmPreset(baseUrl)
  // Local Grok CLI gateway: always omit so locked/strictSampling works
  if (preset === 'grok-gateway') return true
  // Heuristic: localhost Grok even if tagged custom
  try {
    const host = new URL(baseUrl).hostname
    const port = new URL(baseUrl).port || (baseUrl.includes(':3847') ? '3847' : '')
    if (
      (host === '127.0.0.1' || host === 'localhost') &&
      (port === '3847' || port === '39281' || baseUrl.includes(':3847'))
    ) {
      return true
    }
  } catch {
    // ignore
  }
  return false
}

export function buildChatCompletionBody(
  input: ChatCompletionBodyInput
): ChatCompletionBody {
  const body: ChatCompletionBody = {
    model: input.model,
    messages: input.messages
  }
  if (input.max_tokens != null && input.max_tokens > 0) {
    body.max_tokens = input.max_tokens
  }
  if (!input.omitSampling) {
    if (input.temperature != null) body.temperature = input.temperature
    if (input.top_p != null) body.top_p = input.top_p
    if (input.stop != null) body.stop = input.stop
  }
  return body
}
