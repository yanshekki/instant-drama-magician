/**
 * OpenAI-compatible LLM client (single implementation for all presets).
 *
 * Chat body aligned with Grok-Cli-to-OpenAI-compatible:
 * - POST /v1/chat/completions
 * - When strictSampling is on (Gateway locked preset), temperature/top_p/stop
 *   must be omitted entirely (see grok-request-builder.service.ts).
 * - max_tokens remains allowed.
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
import { chatContentText } from '../../types/domain'
import type { AppSettings } from '../../types/settings'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { AppError, mapChatHttpStatus, mapChatMessage } from '../../types/errors'
import {
  buildChatCompletionBody,
  shouldOmitSamplingForProvider
} from '../../domain/chatCompletionBody'
import { healthUrlFromBase } from '../../domain/gatewayDefaults'
import {
  coerceLlmProviderPreset,
  type LlmProviderPreset
} from '../../domain/openaiCompatible'
import { CompositeVideoProvider } from './video/CompositeVideoProvider'
import { SeedanceVideoProvider } from './video/SeedanceVideoProvider'
import type { VideoProvider } from './video/types'
import {
  resolveChatEndpoint,
  resolveImageEndpoint,
  resolveVideoEndpoint
} from '../../domain/providerEndpoints'

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
  static readonly protocol = 'openai-compatible' as const

  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey: string
  private readonly chatTimeoutMs: number
  private readonly imageTimeoutMs: number
  private readonly omitSampling: boolean
  private readonly video: VideoProvider

  private readonly imageBaseUrl: string
  private readonly imageApiKey: string
  private readonly imageModel: string
  private readonly imageProvider: string
  private readonly videoProviderMode: string
  private readonly llmProvider: LlmProviderPreset

  constructor(settings?: Partial<AppSettings>) {
    const s = { ...DEFAULT_SETTINGS, ...settings }
    const chat = resolveChatEndpoint(s)
    const image = resolveImageEndpoint(s)
    const videoEp = resolveVideoEndpoint(s)
    this.baseUrl = chat.baseUrl.replace(/\/$/, '')
    this.model = chat.model
    this.apiKey = chat.apiKey
    this.imageBaseUrl = image.baseUrl.replace(/\/$/, '')
    this.imageApiKey = image.apiKey
    this.imageModel = image.model || chat.model
    this.imageProvider = s.imageProvider || 'same-as-llm'
    this.videoProviderMode = s.videoProvider || 'same-as-llm'
    this.llmProvider = coerceLlmProviderPreset(
      s.llmProvider as LlmProviderPreset | undefined,
      chat.baseUrl
    )
    this.chatTimeoutMs = s.chatTimeoutMs ?? 120_000
    this.imageTimeoutMs = s.imageTimeoutMs ?? DEFAULT_SETTINGS.imageTimeoutMs
    this.omitSampling = shouldOmitSamplingForProvider(
      this.llmProvider,
      chat.baseUrl
    )
    if (s.videoProvider === 'seedance') {
      this.video = new SeedanceVideoProvider({
        baseUrl: videoEp.baseUrl,
        apiKey: videoEp.apiKey,
        model: videoEp.model,
        pollMs: s.videoPollMs,
        timeoutSec: s.videoTimeoutSec,
        maxRetries: s.videoMaxRetries,
        aspectRatio: s.aspectRatio
      })
    } else {
      this.video = new CompositeVideoProvider(
        videoEp.mode,
        videoEp.baseUrl,
        videoEp.apiKey,
        videoEp.model,
        {
          videoPollMs: s.videoPollMs,
          videoTimeoutSec: s.videoTimeoutSec,
          videoMaxRetries: s.videoMaxRetries,
          videoPath: videoEp.videoPath,
          aspectRatio: s.aspectRatio
        }
      )
    }
  }

  get videoProvider(): VideoProvider {
    return this.video
  }

  /** Lightweight probe of the image base (OpenAI-compatible /models). */
  async probeImage(): Promise<{ available: boolean; message: string }> {
    if (!this.imageApiKey.trim() && !this.imageBaseUrl.includes('127.0.0.1')) {
      return {
        available: false,
        message: 'No image API key'
      }
    }
    // Seedream / Ark: key configured is enough (models list may 404)
    if (this.imageProvider === 'seedream') {
      return {
        available: Boolean(this.imageApiKey.trim()),
        message: this.imageApiKey.trim()
          ? `Seedream · ${this.imageBaseUrl} · ${this.imageModel}`
          : 'No Seedream / Ark API key'
      }
    }
    try {
      const res = await fetch(`${this.imageBaseUrl}/models`, {
        headers: this.imageHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        return {
          available: true,
          message: `Online · ${this.imageBaseUrl}`
        }
      }
      return {
        available: false,
        message: `HTTP ${res.status} · ${this.imageBaseUrl}`
      }
    } catch (error) {
      return {
        available: false,
        message:
          error instanceof Error
            ? error.message
            : `Unreachable · ${this.imageBaseUrl}`
      }
    }
  }

  async getStatus(): Promise<AIProviderStatus> {
    const chat = await this.probeChat()
    const imageSeparate = this.imageProvider !== 'same-as-llm'
    const videoSeparate = this.videoProviderMode !== 'same-as-llm'

    const image: AIProviderStatus['image'] = imageSeparate
      ? {
          ...(await this.probeImage()),
          provider: this.imageProvider
        }
      : null

    let video: AIProviderStatus['video'] = null
    let sharedVideoMsg: string | null = null
    if (videoSeparate) {
      if (this.videoProviderMode === 'stub') {
        video = {
          available: true,
          message: 'Stub placeholders',
          provider: 'stub'
        }
      } else {
        const videoProbe = await this.video.probe()
        video = {
          available: videoProbe.available,
          message: videoProbe.message,
          provider: this.videoProviderMode
        }
      }
    } else {
      const videoProbe = await this.video.probe()
      sharedVideoMsg = videoProbe.message
    }

    const parts = [`Chat: ${chat.message}`]
    if (image) {
      parts.push(`Image(${this.imageProvider}): ${image.message}`)
    }
    if (video) {
      parts.push(`Video(${this.videoProviderMode}): ${video.message}`)
    } else if (sharedVideoMsg) {
      parts.push(`Video: ${sharedVideoMsg}`)
    }

    return {
      available: chat.available,
      baseUrl: this.baseUrl,
      model: this.model,
      message: parts.join('; '),
      llmProvider: this.llmProvider,
      chat: {
        available: chat.available,
        message: chat.message,
        provider: this.llmProvider
      },
      image,
      video
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8000)
      })
      if (!res.ok) {
        // Rate limit / transient: fall back to known Grok models so Settings still works
        if (res.status === 429 || res.status === 503) {
          return this.fallbackModelList()
        }
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
      return list.length > 0 ? list : this.fallbackModelList()
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_RATE_LIMIT') {
        return this.fallbackModelList()
      }
      // Network blip while gateway is up — prefer fallback over red toast for list
      const msg = error instanceof Error ? error.message : String(error)
      if (/429|rate limit|timeout|abort/i.test(msg)) {
        return this.fallbackModelList()
      }
      throw error
    }
  }

  /** Built-in models when /models is rate-limited or empty (Grok gateway). */
  private fallbackModelList(): ModelInfo[] {
    const current = this.model?.trim()
    const defaults = [
      'grok-4.5',
      'grok-4',
      'grok-3',
      'grok-3-mini',
      'grok-2'
    ]
    const ids = new Set<string>(defaults)
    if (current) ids.add(current)
    return [...ids].map((id) => ({ id, ownedBy: 'fallback' }))
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
          : mapChatMessage(
              error instanceof Error ? error.message : String(error)
            )
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
        'errors.noApiKey',
        'Paste gk_live_… from Gateway Admin → Keys'
      )
    }
    try {
      // Do not pass temperature — Grok strictSampling rejects it
      const completion = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 32
      })
      const reply =
        chatContentText(completion.choices[0]?.message.content).trim() ||
        '(empty)'
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

  /**
   * Local Grok gateway only: try ensureRunning once (no-op if already up).
   * Best-effort — never throws into chat path.
   */
  private async tryEnsureLocalGateway(): Promise<void> {
    if (!this.omitSampling) return
    try {
      const { getGrokGatewayService } = await import(
        '../gateway/GrokGatewayService'
      )
      await getGrokGatewayService().ensureRunning()
    } catch {
      /* ignore — caller still surfaces AI_UNAVAILABLE */
    }
  }

  private isNetworkFetchError(msg: string): boolean {
    return /cannot reach|econnrefused|fetch failed|failed to fetch|networkerror|enotfound|net::err_|econnreset|socket hang up/i.test(
      msg
    )
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey.trim()) {
      throw new AppError(
        'AI_UNAUTHORIZED',
        'errors.noApiKey',
        'Set Settings → API Key (gk_live_… from Grok Gateway Admin)'
      )
    }

    const body = buildChatCompletionBody({
      model: request.model ?? this.model,
      messages: request.messages,
      max_tokens: request.max_tokens ?? 2048,
      temperature: request.temperature,
      omitSampling: this.omitSampling
    })

    const doFetch = (): Promise<Response> =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.chatTimeoutMs)
      })

    let res: Response
    try {
      res = await doFetch()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/abort|timeout/i.test(msg)) {
        throw new AppError(
          'AI_FAILED',
          `Chat timed out after ${this.chatTimeoutMs}ms`,
          'Raise chatTimeoutMs or check Gateway queue'
        )
      }
      // One auto-recover: start local gateway then retry once
      if (this.isNetworkFetchError(msg) && this.omitSampling) {
        await this.tryEnsureLocalGateway()
        try {
          res = await doFetch()
        } catch (retryErr) {
          const retryMsg =
            retryErr instanceof Error ? retryErr.message : String(retryErr)
          if (/abort|timeout/i.test(retryMsg)) {
            throw new AppError(
              'AI_FAILED',
              `Chat timed out after ${this.chatTimeoutMs}ms`,
              'Raise chatTimeoutMs or check Gateway queue'
            )
          }
          throw new AppError(
            'AI_UNAVAILABLE',
            'errors.networkFailed',
            'errors.aiUnavailable'
          )
        }
      } else {
        throw new AppError(
          'AI_UNAVAILABLE',
          'errors.networkFailed',
          'errors.aiUnavailable'
        )
      }
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

  /**
   * OpenAI-compatible image generation (Grok Gateway: POST /v1/images/generations).
   * Max sizes (OPENAI_IMAGE_SIZES): 1024x1024 | 1792x1024 | 1024x1792.
   * Requires apiFeatures.imagesApi when using Grok-Cli-to-OpenAI-compatible.
   */
  async generateImage(options: {
    prompt: string
    aspectRatio?: string
    /** Prefer max: 1792x1024 (wide) | 1024x1792 (tall) | 1024x1024 (square) */
    size?: string
    n?: number
  }): Promise<{ b64: string; mime: string; sizeUsed: string; aspectUsed: string }> {
    this.assertImageKey()
    const { size, aspectRatio } = this.resolveImageSize(options)

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      model: this.imageModel || this.model,
      n: options.n ?? 1,
      response_format: 'b64_json',
      size,
      aspect_ratio: aspectRatio
    }

    const res = await fetch(`${this.imageBaseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        ...this.imageHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.imageTimeoutMs)
    })
    return this.parseImageResponse(res, size, aspectRatio)
  }

  /**
   * OpenAI-compatible image edit (Grok Gateway: POST /v1/images/edits).
   * Multipart field `image` only — gateway maxCount is 1 (optional `mask`).
   * Use when the character already has a gallery image so identity stays consistent.
   */
  async editImage(options: {
    prompt: string
    /** Absolute path to the single reference image (API limit: 1). */
    imagePath: string
    aspectRatio?: string
    size?: string
    n?: number
  }): Promise<{ b64: string; mime: string; sizeUsed: string; aspectUsed: string }> {
    this.assertImageKey()
    const { size, aspectRatio } = this.resolveImageSize(options)

    const { existsSync } = await import('fs')
    const { basename } = await import('path')
    if (!existsSync(options.imagePath)) {
      throw new AppError(
        'VALIDATION',
        'errors.visionImageUnreadable',
        'errors.visionImageUnreadableDetail'
      )
    }
    // Downscale large stills (same limits as chat vision) to avoid slow uploads
    const { loadImageBytesForAi } = await import('../../domain/chatVision')
    const prepared = loadImageBytesForAi(options.imagePath)
    const form = new FormData()
    form.append('prompt', options.prompt)
    form.append('model', this.imageModel || this.model)
    form.append('n', String(options.n ?? 1))
    form.append('response_format', 'b64_json')
    form.append('size', size)
    form.append('aspect_ratio', aspectRatio)
    // Do not set Content-Type — boundary must be set by fetch/FormData
    const uploadName = prepared.resized
      ? basename(options.imagePath).replace(/\.[^.]+$/, '') + '.jpg'
      : basename(options.imagePath)
    form.append(
      'image',
      new Blob([new Uint8Array(prepared.bytes)], {
        type: prepared.mime || mimeFromPath(options.imagePath)
      }),
      uploadName
    )

    const res = await fetch(`${this.imageBaseUrl}/images/edits`, {
      method: 'POST',
      headers: this.imageHeaders(),
      body: form,
      signal: AbortSignal.timeout(this.imageTimeoutMs)
    })
    return this.parseImageResponse(res, size, aspectRatio)
  }

  private assertImageKey(): void {
    if (!this.imageApiKey.trim()) {
      throw new AppError(
        'AI_UNAUTHORIZED',
        'errors.noApiKey',
        'Image gen needs a valid API key on the image provider'
      )
    }
  }

  private imageHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.imageApiKey}`
    }
  }

  private resolveImageSize(options: {
    size?: string
    aspectRatio?: string
  }): { size: string; aspectRatio: string } {
    const size = options.size ?? '1792x1024'
    const aspectRatio =
      options.aspectRatio ??
      (size === '1024x1792'
        ? '9:16'
        : size === '1024x1024'
          ? '1:1'
          : '16:9')
    return { size, aspectRatio }
  }

  private async parseImageResponse(
    res: Response,
    size: string,
    aspectRatio: string
  ): Promise<{ b64: string; mime: string; sizeUsed: string; aspectUsed: string }> {
    if (!res.ok) {
      const text = await res.text()
      throw mapChatHttpStatus(res.status, text)
    }
    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>
    }
    const b64 = json.data?.[0]?.b64_json
    if (!b64) {
      throw new AppError(
        'AI_FAILED',
        'errors.imageApiNoB64',
        'IMAGE_NO_SANDBOX: Enable imagesApi on Gateway; if using body/nude plates, content filters may block — try base-layer or costume packages first.'
      )
    }
    return { b64, mime: 'image/png', sizeUsed: size, aspectUsed: aspectRatio }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`
    }
  }
}

function mimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

/** Preferred name — identical to GrokCliClient (OpenAI-compatible HTTP). */
export { GrokCliClient as OpenAiCompatibleClient }
