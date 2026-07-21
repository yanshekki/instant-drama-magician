/**
 * Build OpenAI-compatible chat/completions JSON body aligned with
 * Grok-Cli-to-OpenAI-compatible (chat.dto + strictSampling).
 *
 * Gateway strictSampling rejects temperature | top_p | stop when present.
 * max_tokens is allowed.
 *
 * Vision: Grok CLI expects ACP blocks `{ type:'image', data, mimeType }`.
 * Older gateway builds mis-convert OpenAI `image_url` data URLs, so when
 * omitSampling (grok-gateway) we rewrite multimodal parts to ACP form.
 * @see Grok-Cli-to-OpenAI-compatible src/services/grok-request-builder.service.ts
 */

import type { ChatContentPart, ChatMessage } from '../types/domain'
import type { LlmProviderPreset } from './openaiCompatible'
import { inferLlmPreset } from './openaiCompatible'
import { dataUrlToGrokImagePart } from './chatVision'

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
   * Also rewrites vision parts for Grok ACP.
   */
  omitSampling: boolean
}

/** Body may include Grok ACP image parts after vision rewrite. */
export type ChatCompletionBodyMessage = {
  role: ChatMessage['role']
  content: string | Array<Record<string, unknown>>
}

export type ChatCompletionBody = {
  model: string
  messages: ChatCompletionBodyMessage[]
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

/**
 * Convert OpenAI vision parts → Grok CLI ACP image blocks for the gateway.
 * Text / unknown parts pass through.
 */
export function rewriteVisionContentForGrokGateway(
  content: string | ChatContentPart[]
): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content as unknown as string
  return content.map((part) => {
    if (!part || typeof part !== 'object') {
      return part as unknown as Record<string, unknown>
    }
    if (part.type === 'text') {
      return { type: 'text', text: part.text }
    }
    if (part.type === 'image_url') {
      const url = part.image_url?.url ?? ''
      const acp = dataUrlToGrokImagePart(url)
      if (acp) return acp
      // Non-data URL: leave as-is (gateway may still fail; rare for local stills)
      return part as unknown as Record<string, unknown>
    }
    return part as unknown as Record<string, unknown>
  })
}

export function buildChatCompletionBody(
  input: ChatCompletionBodyInput
): ChatCompletionBody {
  const messages: ChatCompletionBodyMessage[] = input.messages.map((m) => ({
    role: m.role,
    content: input.omitSampling
      ? rewriteVisionContentForGrokGateway(m.content)
      : (m.content as string | Array<Record<string, unknown>>)
  }))

  const body: ChatCompletionBody = {
    model: input.model,
    messages
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
