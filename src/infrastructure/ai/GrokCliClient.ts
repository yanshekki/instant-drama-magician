/**
 * OpenAI-compatible client wrapping Grok CLI
 * (https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible)
 *
 * Video: optional endpoint or ffmpeg stub when GROK_VIDEO_STUB=1 (default).
 */

import type {
  AIProvider,
  AIProviderStatus,
  ChatCompletionRequest,
  ChatCompletionResponse,
  VideoGenRequest,
  VideoGenResult
} from '../../types/domain'
import { FfmpegService } from '../ffmpeg/FfmpegService'

const DEFAULT_BASE_URL = 'http://127.0.0.1:39281/v1'
const DEFAULT_MODEL = 'grok-cli'

export class GrokCliClient implements AIProvider {
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey: string
  private readonly videoEnabled: boolean
  private readonly videoStub: boolean
  private readonly videoPath: string
  private readonly ffmpeg: FfmpegService

  constructor(options?: {
    baseUrl?: string
    model?: string
    apiKey?: string
    ffmpeg?: FfmpegService
  }) {
    this.baseUrl =
      options?.baseUrl ?? process.env.GROK_CLI_BASE_URL ?? DEFAULT_BASE_URL
    this.model = options?.model ?? process.env.GROK_CLI_MODEL ?? DEFAULT_MODEL
    this.apiKey = options?.apiKey ?? process.env.GROK_CLI_API_KEY ?? 'grok-cli'
    this.videoEnabled = (process.env.GROK_VIDEO_ENABLED ?? '1') !== '0'
    this.videoStub = (process.env.GROK_VIDEO_STUB ?? '1') !== '0'
    this.videoPath =
      process.env.GROK_CLI_VIDEO_PATH ?? `${this.baseUrl}/video/generations`
    this.ffmpeg = options?.ffmpeg ?? new FfmpegService()
  }

  async getStatus(): Promise<AIProviderStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000)
      })
      if (!res.ok) {
        return {
          available: false,
          baseUrl: this.baseUrl,
          model: this.model,
          message: `Grok CLI wrapper responded ${res.status}`
        }
      }
      return {
        available: true,
        baseUrl: this.baseUrl,
        model: this.model,
        message: this.videoStub
          ? 'Grok CLI online (video stub mode)'
          : 'Grok CLI OpenAI-compatible endpoint is reachable'
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown connection error'
      return {
        available: false,
        baseUrl: this.baseUrl,
        model: this.model,
        message: `Cannot reach Grok CLI wrapper at ${this.baseUrl}: ${message}`
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
    if (!this.videoEnabled) {
      throw new Error('Video generation disabled (GROK_VIDEO_ENABLED=0)')
    }

    if (!this.videoStub) {
      try {
        const res = await fetch(this.videoPath, {
          method: 'POST',
          headers: {
            ...this.headers(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            prompt: request.prompt,
            duration: request.durationSeconds,
            ref_image: request.refImagePath,
            output_path: request.outputPath
          }),
          signal: AbortSignal.timeout(120_000)
        })
        if (res.ok) {
          const json = (await res.json()) as { output_path?: string; path?: string }
          return {
            outputPath: json.output_path ?? json.path ?? request.outputPath
          }
        }
      } catch {
        // fall through to stub
      }
    }

    // Stub: solid-color clip so pipeline remains demoable offline
    await this.ffmpeg.makeColorClip({
      outputPath: request.outputPath,
      durationSeconds: request.durationSeconds,
      label: request.prompt.slice(0, 60) || 'stub clip',
      color: '0x4c1d95'
    })
    return { outputPath: request.outputPath, degraded: true }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`
    }
  }
}
