/**
 * OpenAI-compatible client wrapping Grok CLI + pluggable video providers.
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
import { CompositeVideoProvider } from './video/CompositeVideoProvider'

export class GrokCliClient implements AIProvider {
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey: string
  private readonly video: CompositeVideoProvider

  constructor(settings?: Partial<AppSettings>) {
    const s = { ...DEFAULT_SETTINGS, ...settings }
    this.baseUrl = s.baseUrl
    this.model = s.model
    this.apiKey = s.apiKey
    this.video = new CompositeVideoProvider(
      s.videoMode,
      s.videoPath || `${s.baseUrl}/video/generations`,
      s.apiKey,
      s.model,
      {
        videoPollMs: s.videoPollMs,
        videoTimeoutSec: s.videoTimeoutSec,
        videoMaxRetries: s.videoMaxRetries
      }
    )
  }

  get videoProvider(): CompositeVideoProvider {
    return this.video
  }

  async getStatus(): Promise<AIProviderStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000)
      })
      const videoProbe = await this.video.probe()
      if (!res.ok) {
        return {
          available: false,
          baseUrl: this.baseUrl,
          model: this.model,
          message: `Chat ${res.status}; video: ${videoProbe.message}`
        }
      }
      return {
        available: true,
        baseUrl: this.baseUrl,
        model: this.model,
        message: `Chat online; video: ${videoProbe.message}`
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown connection error'
      const videoProbe = await this.video.probe()
      return {
        available: false,
        baseUrl: this.baseUrl,
        model: this.model,
        message: `Chat offline (${message}); video: ${videoProbe.message}`
      }
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const body = {
      model: request.model ?? this.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Grok CLI chat failed (${res.status}): ${text}`)
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
