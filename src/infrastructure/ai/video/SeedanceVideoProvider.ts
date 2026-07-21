/**
 * ByteDance Seedance via Volcengine Ark / BytePlus ModelArk task API.
 *
 *   POST {base}/contents/generations/tasks
 *   GET  {base}/contents/generations/tasks/{id}
 *
 * Not OpenAI /v1/videos — use only when videoProvider === 'seedance'.
 */
import {
  createWriteStream,
  existsSync,
  readFileSync,
  writeFileSync
} from 'fs'
import { basename, extname } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import { snapVideoSeconds } from '../../../domain/videoDuration'
import { DEFAULT_SEEDANCE_MODEL } from '../../../domain/openaiCompatible'
import { AppError, mapHttpStatusToVideoError } from '../../../types/errors'
import type { VideoProvider, VideoProviderStatus } from './types'
import { isRetryableError, sleep, withRetries } from './httpUtils'

export interface SeedanceVideoOptions {
  /** e.g. https://ark.cn-beijing.volces.com/api/v3 */
  baseUrl: string
  apiKey: string
  model?: string
  pollMs?: number
  timeoutSec?: number
  maxRetries?: number
  aspectRatio?: string
  resolution?: string
  fetchImpl?: typeof fetch
}

type TaskJson = {
  id?: string
  status?: string
  error?: { message?: string; code?: string } | string | null
  content?: {
    video_url?: string
    file_url?: string
    url?: string
  }
  output?: {
    video_url?: string
    url?: string
  }
  result?: {
    video_url?: string
    url?: string
  }
  video_url?: string
  data?: {
    video_url?: string
    url?: string
  }
}

function mimeFromPath(p: string): string {
  switch (extname(p).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg'
  }
}

function localImageDataUrl(filePath: string): string {
  const buf = readFileSync(filePath)
  const mime = mimeFromPath(filePath)
  return `data:${mime};base64,${buf.toString('base64')}`
}

function extractVideoUrl(json: TaskJson): string | null {
  return (
    json.content?.video_url ||
    json.content?.file_url ||
    json.content?.url ||
    json.output?.video_url ||
    json.output?.url ||
    json.result?.video_url ||
    json.result?.url ||
    json.video_url ||
    json.data?.video_url ||
    json.data?.url ||
    null
  )
}

function errorMessage(json: TaskJson): string {
  if (!json.error) return 'Seedance task failed'
  if (typeof json.error === 'string') return json.error
  return json.error.message || json.error.code || 'Seedance task failed'
}

export class SeedanceVideoProvider implements VideoProvider {
  readonly id = 'seedance'
  readonly name = 'Seedance (Volcengine Ark)'
  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly pollMs: number
  private readonly timeoutSec: number
  private readonly maxRetries: number
  private readonly aspectRatio: string
  private readonly resolution: string
  lastJobId: string | null = null
  lastJobStatus: string | null = null

  constructor(opts: SeedanceVideoOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.apiKey = opts.apiKey
    this.model = opts.model?.trim() || DEFAULT_SEEDANCE_MODEL
    this.pollMs = opts.pollMs ?? 2000
    this.timeoutSec = opts.timeoutSec ?? 600
    this.maxRetries = opts.maxRetries ?? 2
    this.aspectRatio = opts.aspectRatio ?? '16:9'
    this.resolution = opts.resolution ?? '720p'
    this.fetchFn = opts.fetchImpl ?? fetch.bind(globalThis)
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  async probe(): Promise<VideoProviderStatus> {
    if (!this.apiKey.trim()) {
      return {
        id: this.id,
        available: false,
        message: 'No Seedance / Ark API key'
      }
    }
    // Ark has no lightweight /models list for video only; treat key+base as configured.
    return {
      id: this.id,
      available: true,
      message: `Seedance ready · ${this.baseUrl} · ${this.model}`
    }
  }

  async generate(request: VideoGenRequest): Promise<VideoGenResult> {
    this.lastJobId = null
    this.lastJobStatus = null

    if (!this.apiKey.trim()) {
      throw new AppError(
        'VALIDATION',
        'errors.seedanceKeyRequired',
        'Set video API key in Settings → Video → Seedance'
      )
    }

    return withRetries(
      async () => {
        const seconds = snapVideoSeconds(request.durationSeconds)
        const ratio = request.aspectRatio ?? this.aspectRatio
        // Official examples often put flags in the text body
        const promptText = [
          request.prompt.trim(),
          `--resolution ${this.resolution}`,
          `--duration ${seconds}`,
          `--ratio ${ratio}`,
          '--camerafixed false'
        ].join(' ')

        const content: Array<Record<string, unknown>> = [
          { type: 'text', text: promptText }
        ]

        if (request.refImagePath && existsSync(request.refImagePath)) {
          try {
            content.push({
              type: 'image_url',
              image_url: {
                url: localImageDataUrl(request.refImagePath)
              },
              role: 'first_frame'
            })
          } catch {
            // continue text-only
          }
        }

        const body: Record<string, unknown> = {
          model: this.model,
          content,
          // Prefer structured fields when API supports them (Seedance 2.x)
          duration: seconds,
          ratio,
          resolution: this.resolution,
          watermark: false
        }

        const createUrl = `${this.baseUrl}/contents/generations/tasks`
        const res = await this.fetchFn(createUrl, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000)
        })

        if (!res.ok) {
          const text = await res.text()
          throw mapHttpStatusToVideoError(res.status, text)
        }

        const created = (await res.json()) as TaskJson
        const taskId = created.id
        if (!taskId) {
          throw new AppError(
            'VIDEO_JOB_FAILED',
            'errors.seedanceNoTaskId',
            JSON.stringify(created).slice(0, 400)
          )
        }
        this.lastJobId = taskId

        const done = await this.pollUntilDone(taskId)
        const videoUrl = extractVideoUrl(done)
        if (!videoUrl) {
          throw new AppError(
            'VIDEO_JOB_FAILED',
            'errors.seedanceNoVideoUrl',
            JSON.stringify(done).slice(0, 500)
          )
        }
        await this.downloadTo(videoUrl, request.outputPath)
        return { outputPath: request.outputPath, jobId: taskId }
      },
      {
        maxRetries: this.maxRetries,
        shouldRetry: (e) => isRetryableError(e)
      }
    )
  }

  private async pollUntilDone(taskId: string): Promise<TaskJson> {
    const deadline = Date.now() + this.timeoutSec * 1000
    const url = `${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`

    while (Date.now() < deadline) {
      const res = await this.fetchFn(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000)
      })
      if (!res.ok) {
        const text = await res.text()
        throw mapHttpStatusToVideoError(res.status, text)
      }
      const json = (await res.json()) as TaskJson
      const status = (json.status ?? '').toLowerCase()
      this.lastJobStatus = status || null

      if (
        status === 'succeeded' ||
        status === 'success' ||
        status === 'completed'
      ) {
        return json
      }
      if (
        status === 'failed' ||
        status === 'error' ||
        status === 'cancelled' ||
        status === 'canceled'
      ) {
        throw new AppError('VIDEO_JOB_FAILED', errorMessage(json), status)
      }
      await sleep(this.pollMs)
    }
    throw new AppError(
      'VIDEO_TIMEOUT',
      'errors.seedanceTimedOut',
      taskId
    )
  }

  private async downloadTo(url: string, dest: string): Promise<void> {
    if (url.startsWith('data:')) {
      const m = /^data:([^;]+);base64,(.+)$/s.exec(url)
      if (!m) throw new AppError('IO', 'errors.seedanceInvalidDataUrl')
      writeFileSync(dest, Buffer.from(m[2], 'base64'))
      return
    }
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(120_000)
    })
    if (!res.ok) {
      throw new AppError('IO', 'errors.seedanceDownloadFailed', String(res.status))
    }
    if (!res.body) {
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(dest, buf)
      return
    }
    const nodeStream = Readable.fromWeb(
      res.body as import('stream/web').ReadableStream
    )
    await pipeline(nodeStream, createWriteStream(dest))
    // touch basename for debug
    void basename(dest)
  }
}
