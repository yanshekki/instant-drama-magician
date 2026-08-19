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
import {
  appendGrokVoicePromptHints,
  sanitizeGrokVoices
} from '../../../domain/grokVideoVoices'
import { AppError, mapHttpStatusToVideoError } from '../../../types/errors'
import type { VideoProvider, VideoProviderStatus } from './types'
import { isRetryableError, sleep, withRetries } from './httpUtils'

/** Reject empty / smoke stubs / HTML interstitials / stills stored as "video". */
export function isUsableVideoBytes(buf: Buffer): boolean {
  if (!buf || buf.length < 32) return false
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return false
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) return false
  const head = buf
    .subarray(0, Math.min(64, buf.length))
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart()
  if (/^(<!doctype|<html|<head|<body|<\?xml|\{|\[)/i.test(head)) return false
  if (head.startsWith('<')) return false
  if (/^smoke$/i.test(buf.toString('utf8').trim())) return false
  const sample = buf.subarray(0, Math.min(buf.length, 64))
  const asciiOnly = sample.every(
    (b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)
  )
  if (asciiOnly) return false
  return true
}

export function isHtmlOrTextContentType(contentType: string | null): boolean {
  const ct = (contentType || '').toLowerCase()
  return (
    ct.includes('text/html') ||
    ct.includes('text/plain') ||
    ct.includes('application/json') ||
    ct.includes('application/xml')
  )
}

/** Gateway rejects JPEG bytes uploaded as image/png. Sniff magic instead. */
export function sniffImageUpload(
  buf: Buffer,
  filePath: string
): { mime: string; filename: string } {
  const raw = basename(filePath) || 'frame'
  const stem = raw.replace(/\.[^.]+$/, '') || 'frame'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', filename: `${stem}.jpg` }
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { mime: 'image/png', filename: `${stem}.png` }
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', filename: `${stem}.webp` }
  }
  return { mime: 'application/octet-stream', filename: raw }
}

/** File-share interstitial (filebin etc.) often embeds the real mp4 URL. */
export function extractRemoteVideoUrl(html: string): string | null {
  const text = html || ''
  const hosted =
    /https?:\/\/[^\s"'<>]+(?:filebin\.net|transfer\.sh|0x0\.st|catbox\.moe|litterbox\.catbox\.moe)[^\s"'<>]*\.(?:mp4|webm)(?:\?[^\s"'<>]*)?/i.exec(
      text
    )
  if (hosted?.[0]) return hosted[0]
  const any = /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/i.exec(text)
  return any?.[0] ?? null
}

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

        const requestedVoices =
          request.generateAudio === true
            ? sanitizeGrokVoices(
                request.voices?.length ? request.voices : ['ara']
              )
            : []
        const voices =
          request.generateAudio === true && requestedVoices.length === 0
            ? (['ara'] as const).slice()
            : requestedVoices
        const promptWithVoices = voices.length
          ? appendGrokVoicePromptHints(request.prompt, voices)
          : request.prompt

        const postCreate = (opts: { prompt: string; voices: string[] }) => {
          const body: Record<string, unknown> = {
            prompt: opts.prompt,
            model: this.model,
            seconds,
            aspect_ratio: request.aspectRatio ?? this.aspectRatio
          }
          if (sourceAssetId) body.source_asset_id = sourceAssetId
          if (sourceDocumentId) body.source_document_id = sourceDocumentId
          if (opts.voices.length) body.voices = opts.voices
          return this.fetchFn(this.createUrl, {
            method: 'POST',
            headers: {
              ...this.headers(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60_000)
          })
        }

        let voicesDropped = false
        let res = await postCreate({ prompt: promptWithVoices, voices })
        if (!res.ok && res.status === 400 && voices.length > 0) {
          await res.text().catch(() => '')
          voicesDropped = true
          res = await postCreate({ prompt: request.prompt, voices: [] })
        }

        const finish = (result: VideoGenResult): VideoGenResult =>
          voicesDropped ? { ...result, voicesDropped: true } : result

        if (!res.ok) {
          // Legacy fallback endpoint
          if (res.status === 404) {
            return finish(await this.legacyGenerate(request, seconds))
          }
          const text = await res.text()
          throw mapHttpStatusToVideoError(res.status, text)
        }

        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          if (isHtmlOrTextContentType(contentType)) {
            throw new AppError(
              'VALIDATION',
              'errors.videoContentEmpty',
              'errors.videoContentEmptyHint'
            )
          }
          const buf = Buffer.from(await res.arrayBuffer())
          if (!isUsableVideoBytes(buf)) {
            throw new AppError(
              'VALIDATION',
              'errors.videoContentEmpty',
              'errors.videoContentEmptyHint'
            )
          }
          writeFileSync(request.outputPath, buf)
          return finish({ outputPath: request.outputPath })
        }

        const json = (await res.json()) as JobPublic
        if (json.id) this.lastJobId = json.id
        this.lastJobStatus = json.status ?? null

        // Immediate file paths (legacy)
        if (json.output_path && existsSync(json.output_path)) {
          return finish({ outputPath: json.output_path })
        }
        if (json.path && existsSync(json.path)) {
          return finish({ outputPath: json.path })
        }
        if (json.url || json.output_url) {
          await this.downloadTo(json.url ?? json.output_url!, request.outputPath)
          return finish({ outputPath: request.outputPath })
        }

        const jobId = json.id ?? json.job_id
        if (!jobId) {
          throw new AppError('VALIDATION', 'errors.videoApiMissingJobId')
        }
        this.lastJobId = jobId

        await this.pollUntilDone(jobId)
        await this.downloadContent(jobId, request.outputPath)
        return finish({ outputPath: request.outputPath, jobId })
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
    const sniffed = sniffImageUpload(buf, filePath)
    const form = new FormData()
    const blob = new Blob([new Uint8Array(buf)], { type: sniffed.mime })
    form.append('file', blob, sniffed.filename)

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
    if (isUsableVideoBytes(buf)) {
      writeFileSync(dest, buf)
      return
    }
    const remote = extractRemoteVideoUrl(buf.toString('utf8'))
    if (remote) {
      await this.downloadTo(remote, dest, { sendAuth: false })
      if (existsSync(dest) && isUsableVideoBytes(readFileSync(dest))) return
    }
    throw new AppError(
      'VALIDATION',
      'errors.videoContentEmpty',
      'errors.videoContentEmptyHint'
    )
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

  private async downloadTo(
    url: string,
    dest: string,
    opts?: { sendAuth?: boolean }
  ): Promise<void> {
    const sendAuth = opts?.sendAuth !== false
    const res = await this.fetchFn(url, {
      headers: sendAuth ? this.headers() : {},
      redirect: 'follow',
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
