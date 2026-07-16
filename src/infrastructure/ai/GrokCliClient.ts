/**
 * OpenAI-compatible client wrapping Grok CLI
 * (https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible)
 *
 * Default endpoint: http://127.0.0.1:39281/v1
 * Override via GROK_CLI_BASE_URL / GROK_CLI_MODEL env vars.
 */

import type {
  AIProvider,
  AIProviderStatus,
  ChatCompletionRequest,
  ChatCompletionResponse
} from '../../types/domain'

const DEFAULT_BASE_URL = 'http://127.0.0.1:39281/v1'
const DEFAULT_MODEL = 'grok-cli'

export class GrokCliClient implements AIProvider {
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey: string

  constructor(options?: { baseUrl?: string; model?: string; apiKey?: string }) {
    this.baseUrl =
      options?.baseUrl ?? process.env.GROK_CLI_BASE_URL ?? DEFAULT_BASE_URL
    this.model = options?.model ?? process.env.GROK_CLI_MODEL ?? DEFAULT_MODEL
    this.apiKey = options?.apiKey ?? process.env.GROK_CLI_API_KEY ?? 'grok-cli'
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
        message: 'Grok CLI OpenAI-compatible endpoint is reachable'
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

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`
    }
  }
}
