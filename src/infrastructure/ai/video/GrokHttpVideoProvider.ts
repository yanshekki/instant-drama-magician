/**
 * OpenAI-style Videos client aligned with Grok-Cli-to-OpenAI-compatible:
 *   POST   {baseUrl}/videos
 *   GET    {baseUrl}/videos/:id
 *   GET    {baseUrl}/videos/:id/content
 *
 * Also keeps legacy fallbacks (output_path / url / /video/generations).
 */

import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import { snapVideoSeconds } from '../../../domain/videoDuration'
import { AppError, mapHttpStatusToVideoError } from '../../../types/errors'
import type { VideoProvider, VideoProviderStatus } from './types'
import { isRetryableError, sleep, withRetries } from './httpUtils'

export interface GrokHttpVideoOptions {
  /** e.g. http://127.0.0.1:3847/v1 */
  baseUrl: string
  apiKey: string
  model: string
  /** Optional override create URL; default `${baseUrl}/videos` */
  videosCreateUrl?: string
  pollMs?: number
  timeoutSec?: number
  maxRetries?: number
  aspectRatio?: string
  fetchImpl?: typeof fetch
}

type JobPublic = {
  id?: string
  object?: string
  status?: string
  error?: string | null
  result_asset_id?: string | null
  output_path?: string
  path?: string
  url?: string
  output_url?: string
  job_id?: string
  status_url?: string
}

export class GrokHttpVideoProvider implements VideoProvider {
  readonly id = 'grok-http'
  readonly name = 'Grok OpenAI Videos API'
  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  private readonly createUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly pollMs: number
  private readonly timeoutSec: number
  private readonly maxRetries: number
  private readonly aspectRatio: string
  lastJobId: string | null = null
  lastJobStatus: string | null = null

  constructor(
    videoPathOrOpts: string | GrokHttpVideoOptions,
    apiKey?: string,
    model?: string
  ) {
    if (typeof videoPathOrOpts === 'string') {
      // Legacy: videoPath was full create URL or generations URL
      this.createUrl = videoPathOrOpts.includes('/videos')
        ? videoPathOrOpts.replace(/\/$/, '')
        : videoPathOrOpts.replace(/\/video\/generations\/?$/, '/videos')
      this.baseUrl = this.createUrl.replace(/\/videos\/?$/, '')
      this.apiKey = apiKey ?? 'grok-cli'
      this.model = model ?? 'grok-4.5'
      this.pollMs = 2000
      this.timeoutSec = 300
      this.maxRetries = 3
      this.aspectRatio = '16:9'
      this.fetchFn = fetch.bind(globalThis)
    } else {
      this.baseUrl = videoPathOrOpts.baseUrl.replace(/\/$/, '')
      this.createUrl = (
        videoPathOrOpts.videosCreateUrl ?? `${this.baseUrl}/videos`
      ).replace(/\/$/, '')
      this.apiKey = videoPathOrOpts.apiKey
      this.model = videoPathOrOpts.model
      this.pollMs = videoPathOrOpts.pollMs ?? 2000
      this.timeoutSec = videoPathOrOpts.timeoutSec ?? 300
      this.maxRetries = videoPathOrOpts.maxRetries ?? 3
      this.aspectRatio = videoPathOrOpts.aspectRatio ?? '16:9'
      this.fetchFn = videoPathOrOpts.fetchImpl ?? fetch.bind(globalThis)
    }
  }

  async probe(): Promise<VideoProviderStatus> {
    try {
      // Prefer models health on same base
      const modelsUrl = `${this.baseUrl}/models`
      const res = await this.fetchFn(modelsUrl, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000)
      })
      if (res.status >= 500) {
        return {
          id: this.id,
          available: false,
          message: `Gateway models error ${res.status}`
        }
      }
      return {
        id: this.id,
        available: res.ok || res.status === 401 || res.status === 403,
        message: res.ok
          ? `Gateway online; videos at ${this.createUrl}`
          : `Gateway reachable (${res.status}); check API key (agent/admin for video)`
      }
    } catch (error) {
      return {
        id: this.id,
        available: false,
        message:
          error instanceof Error
            ? `Cannot reach gateway: ${error.message}`
            : 'Cannot reach gateway'
      }
    }
  }

  async generate(request: VideoGenRequest): Promise<VideoGenResult> {
    this.lastJobId = null
    this.lastJobStatus = null

    return withRetries(
      async () => {
        const seconds = snapVideoSeconds(request.durationSeconds)
        let sourceDocumentId = request.sourceDocumentId ?? undefined
        let sourceAssetId = request.sourceAssetId ?? undefined

        // Upload local ref image as document when no asset id yet
        if (!sourceDocumentId && !sourceAssetId && request.refImagePath) {
          try {
            sourceDocumentId =
              (await this.uploadDocument(request.refImagePath)) ?? undefined
          } catch {
            // continue without source; prompt may still mention character
          }
        }

        const body: Record<string, unknown> = {
          prompt: request.prompt,
          model: this.model,
          seconds,
          aspect_ratio: request.aspectRatio ?? this.aspectRatio
        }
        if (sourceAssetId) body.source_asset_id = sourceAssetId
        if (sourceDocumentId) body.source_document_id = sourceDocumentId

        const res = await this.fetchFn(this.createUrl, {
          method: 'POST',
          headers: {
            ...this.headers(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000)
        })

        if (!res.ok) {
          // Legacy fallback endpoint
          if (res.status === 404) {
            return this.legacyGenerate(request, seconds)
          }
          const text = await res.text()
          throw mapHttpStatusToVideoError(res.status, text)
        }

        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.length < 32) throw new AppError('VALIDATION', 'errors.videoApiEmptyBody')
          writeFileSync(request.outputPath, buf)
          return { outputPath: request.outputPath }
        }

        const json = (await res.json()) as JobPublic
        if (json.id) this.lastJobId = json.id
        this.lastJobStatus = json.status ?? null

        // Immediate file paths (legacy)
        if (json.output_path && existsSync(json.output_path)) {
          return { outputPath: json.output_path }
        }
        if (json.path && existsSync(json.path)) {
          return { outputPath: json.path }
        }
        if (json.url || json.output_url) {
          await this.downloadTo(json.url ?? json.output_url!, request.outputPath)
          return { outputPath: request.outputPath }
        }

        const jobId = json.id ?? json.job_id
        if (!jobId) {
          throw new AppError('VALIDATION', 'errors.videoApiMissingJobId')
        }
        this.lastJobId = jobId

        await this.pollUntilDone(jobId)
        await this.downloadContent(jobId, request.outputPath)
        return { outputPath: request.outputPath, jobId }
      },
      {
        maxRetries: this.maxRetries,
        shouldRetry: (e) => isRetryableError(e)
      }
    )
  }

  /** Upload image via POST /v1/documents for source_document_id */
  async uploadDocument(filePath: string): Promise<string | null> {
    if (!existsSync(filePath)) return null
    const buf = readFileSync(filePath)
    const form = new FormData()
    const blob = new Blob([buf])
    form.append('file', blob, basename(filePath))

    const res = await this.fetchFn(`${this.baseUrl}/documents`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(60_000)
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { id?: string }; id?: string }
    return json.data?.id ?? json.id ?? null
  }

  private async pollUntilDone(jobId: string): Promise<void> {
    const deadline = Date.now() + this.timeoutSec * 1000
    const statusUrl = `${this.createUrl}/${jobId}`
    while (Date.now() < deadline) {
      const res = await this.fetchFn(statusUrl, {
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000)
      })
      if (!res.ok) {
        throw new AppError('AI_FAILED', 'errors.videoPollHttpFailed', String(res.status))
      }
      const json = (await res.json()) as JobPublic
      this.lastJobStatus = json.status ?? null
      const status = (json.status ?? '').toLowerCase()
      if (
        status === 'completed' ||
        status === 'succeeded' ||
        status === 'ready' ||
        status === 'success'
      ) {
        return
      }
      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        throw new AppError(
          'VIDEO_JOB_FAILED',
          json.error ?? `Video job ${status}`,
          'Retry this clip or check Gateway logs.'
        )
      }
      // queued | in_progress | processing
      await sleep(this.pollMs)
    }
    throw new AppError(
      'VIDEO_TIMEOUT',
      'errors.videoJobTimedOut',
      String(this.timeoutSec)
    )
  }

  private async downloadContent(jobId: string, dest: string): Promise<void> {
    const contentUrl = `${this.createUrl}/${jobId}/content`
    const res = await this.fetchFn(contentUrl, {
      headers: this.headers(),
      signal: AbortSignal.timeout(180_000)
    })
    if (!res.ok) {
      throw new AppError('AI_FAILED', 'errors.videoContentHttpFailed', String(res.status))
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32) throw new AppError('VALIDATION', 'errors.videoContentEmpty')
    writeFileSync(dest, buf)
  }

  private async legacyGenerate(
    request: VideoGenRequest,
    seconds: number
  ): Promise<VideoGenResult> {
    const legacyUrl = `${this.baseUrl}/video/generations`
    const res = await this.fetchFn(legacyUrl, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        prompt: request.prompt,
        duration: seconds,
        output_path: request.outputPath
      }),
      signal: AbortSignal.timeout(180_000)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new AppError('AI_FAILED', 'errors.videoHttpFailed', `${res.status}: ${text.slice(0, 300)}`)
    }
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const json = (await res.json()) as JobPublic
      if (json.output_path && existsSync(json.output_path)) {
        return { outputPath: json.output_path }
      }
      if (json.url) {
        await this.downloadTo(json.url, request.outputPath)
        return { outputPath: request.outputPath }
      }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(request.outputPath, buf)
    return { outputPath: request.outputPath }
  }

  private async downloadTo(url: string, dest: string): Promise<void> {
    const res = await this.fetchFn(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(180_000)
    })
    if (!res.ok || !res.body) {
      throw new AppError('IO', 'errors.videoDownloadFailed', String(res.status))
    }
    const nodeStream = Readable.fromWeb(
      res.body as import('stream/web').ReadableStream
    )
    await pipeline(nodeStream, createWriteStream(dest))
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` }
  }
}
