/**
 * OpenAI-compatible LLM client (single implementation for all presets).
 *
 * Works with any OpenAI-style base:
 * - Grok-Cli-to-OpenAI-compatible (default preset, :3847)
 * - OpenAI API (api.openai.com)
 * - Custom OpenAI-compatible gateways
 *
 * Paths: GET /v1/models · POST /v1/chat/completions
 * Video (when supported by host): CompositeVideoProvider → /v1/videos
 */

import type {
  AIProvider,
  AIProviderStatus,
  ChatCompletionRequest,
  ChatCompletionResponse,
  VideoGenRequest,
  VideoGenResult
} from '../../types/domain'
import type { AppSettings } from '../../types/settings'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { AppError, mapChatHttpStatus, mapChatMessage } from '../../types/errors'
import { healthUrlFromBase } from '../../domain/gatewayDefaults'
import { CompositeVideoProvider } from './video/CompositeVideoProvider'

export interface ModelInfo {
  id: string
  ownedBy?: string
}

export interface ChatProbeResult {
  available: boolean
  message: string
  models?: ModelInfo[]
  latencyMs?: number
  healthOk?: boolean
}

export interface ChatTestResult {
  ok: boolean
  latencyMs: number
  model: string
  replyPreview: string
  message: string
}

export class GrokCliClient implements AIProvider {
  /** Alias for clarity in new code */
  static readonly protocol = 'openai-compatible' as const

  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey: string
  private readonly chatTimeoutMs: number
  private readonly video: CompositeVideoProvider

  constructor(settings?: Partial<AppSettings>) {
    const s = { ...DEFAULT_SETTINGS, ...settings }
    this.baseUrl = s.baseUrl.replace(/\/$/, '')
    this.model = s.model
    this.apiKey = s.apiKey
    this.chatTimeoutMs = s.chatTimeoutMs ?? 120_000
    this.video = new CompositeVideoProvider(
      s.videoMode,
      s.baseUrl,
      s.apiKey,
      s.model,
      {
        videoPollMs: s.videoPollMs,
        videoTimeoutSec: s.videoTimeoutSec,
        videoMaxRetries: s.videoMaxRetries,
        videoPath: s.videoPath,
        aspectRatio: s.aspectRatio
      }
    )
  }

  get videoProvider(): CompositeVideoProvider {
    return this.video
  }

  async getStatus(): Promise<AIProviderStatus> {
    const chat = await this.probeChat()
    const videoProbe = await this.video.probe()
    return {
      available: chat.available,
      baseUrl: this.baseUrl,
      model: this.model,
      message: `Chat: ${chat.message}; video: ${videoProbe.message}`
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) {
      throw mapChatHttpStatus(res.status, await res.text())
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string; owned_by?: string }>
    }
    const list = (json.data ?? [])
      .map((m) => ({
        id: m.id ?? '',
        ownedBy: m.owned_by
      }))
      .filter((m) => m.id.length > 0)
    return list
  }

  async probeChat(): Promise<ChatProbeResult> {
    const started = Date.now()
    let healthOk: boolean | undefined
    try {
      const healthUrl = healthUrlFromBase(this.baseUrl)
      const h = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) })
      healthOk = h.ok
    } catch {
      healthOk = false
    }

    if (!this.apiKey.trim()) {
      return {
        available: false,
        message: 'No API key — create gk_live_… in Gateway Admin → Keys',
        healthOk,
        latencyMs: Date.now() - started
      }
    }

    try {
      const models = await this.listModels()
      return {
        available: true,
        message: `Online · ${models.length} model(s)`,
        models,
        healthOk,
        latencyMs: Date.now() - started
      }
    } catch (error) {
      const mapped =
        error instanceof AppError
          ? error
          : mapChatMessage(error instanceof Error ? error.message : String(error))
      return {
        available: false,
        message: mapped
          ? `${mapped.message}${mapped.details ? ` — ${mapped.details}` : ''}`
          : error instanceof Error
            ? error.message
            : String(error),
        healthOk,
        latencyMs: Date.now() - started
      }
    }
  }

  async testChat(prompt = 'Reply with exactly: OK'): Promise<ChatTestResult> {
    const started = Date.now()
    if (!this.apiKey.trim()) {
      throw new AppError(
        'AI_UNAUTHORIZED',
        'No API key',
        'Paste gk_live_… from Gateway Admin → Keys'
      )
    }
    try {
      const completion = await this.chat({
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 32
      })
      const reply =
        completion.choices[0]?.message.content?.trim() ?? '(empty)'
      const latencyMs = Date.now() - started
      return {
        ok: true,
        latencyMs,
        model: completion.model ?? this.model,
        replyPreview: reply.slice(0, 200),
        message: `Chat OK (${latencyMs}ms)`
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      const mapped = mapChatMessage(
        error instanceof Error ? error.message : String(error)
      )
      if (mapped) {
        throw new AppError(mapped.code, mapped.message, mapped.details)
      }
      throw error
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey.trim()) {
      throw new AppError(
        'AI_UNAUTHORIZED',
        'No API key',
        'Set Settings → API Key (gk_live_… from Grok Gateway Admin)'
      )
    }

    const body = {
      model: request.model ?? this.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048
    }

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.chatTimeoutMs)
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/abort|timeout/i.test(msg)) {
        throw new AppError(
          'AI_FAILED',
          `Chat timed out after ${this.chatTimeoutMs}ms`,
          'Raise chatTimeoutMs or check Gateway queue'
        )
      }
      throw new AppError(
        'AI_UNAVAILABLE',
        `Cannot reach Grok Gateway at ${this.baseUrl}`,
        'Start gateway: gctoac start (default :3847). See docs/grok-gateway.md'
      )
    }

    if (!res.ok) {
      const text = await res.text()
      throw mapChatHttpStatus(res.status, text)
    }

    return (await res.json()) as ChatCompletionResponse
  }

  async generateVideo(request: VideoGenRequest): Promise<VideoGenResult> {
    return this.video.generate(request)
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`
    }
  }
}

/** Preferred name — identical to GrokCliClient (OpenAI-compatible HTTP). */
export { GrokCliClient as OpenAiCompatibleClient }
