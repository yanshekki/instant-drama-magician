import { createWriteStream, existsSync, writeFileSync } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import type { VideoProvider, VideoProviderStatus } from './types'
import { isRetryableError, sleep, withRetries } from './httpUtils'

export interface GrokHttpVideoOptions {
  videoPath: string
  apiKey: string
  model: string
  pollMs?: number
  timeoutSec?: number
  maxRetries?: number
  fetchImpl?: typeof fetch
}

type JobJson = {
  output_path?: string
  path?: string
  url?: string
  output_url?: string
  job_id?: string
  id?: string
  status_url?: string
  status?: string
}

export class GrokHttpVideoProvider implements VideoProvider {
  readonly id = 'grok-http'
  readonly name = 'Grok HTTP video'
  private readonly fetchFn: typeof fetch
  private readonly pollMs: number
  private readonly timeoutSec: number
  private readonly maxRetries: number

  constructor(
    videoPathOrOpts: string | GrokHttpVideoOptions,
    apiKey?: string,
    model?: string
  ) {
    if (typeof videoPathOrOpts === 'string') {
      this.videoPath = videoPathOrOpts
      this.apiKey = apiKey ?? 'grok-cli'
      this.model = model ?? 'grok-cli'
      this.pollMs = 2000
      this.timeoutSec = 300
      this.maxRetries = 3
      this.fetchFn = fetch.bind(globalThis)
    } else {
      this.videoPath = videoPathOrOpts.videoPath
      this.apiKey = videoPathOrOpts.apiKey
      this.model = videoPathOrOpts.model
      this.pollMs = videoPathOrOpts.pollMs ?? 2000
      this.timeoutSec = videoPathOrOpts.timeoutSec ?? 300
      this.maxRetries = videoPathOrOpts.maxRetries ?? 3
      this.fetchFn = videoPathOrOpts.fetchImpl ?? fetch.bind(globalThis)
    }
  }

  private readonly videoPath: string
  private readonly apiKey: string
  private readonly model: string

  async probe(): Promise<VideoProviderStatus> {
    try {
      const res = await this.fetchFn(this.videoPath, {
        method: 'OPTIONS',
        headers: this.headers(),
        signal: AbortSignal.timeout(3000)
      })
      if (res.status >= 500) {
        return {
          id: this.id,
          available: false,
          message: `Video endpoint error ${res.status}`
        }
      }
      return {
        id: this.id,
        available: true,
        message: `Video endpoint reachable (${res.status})`
      }
    } catch (error) {
      return {
        id: this.id,
        available: false,
        message:
          error instanceof Error
            ? `Cannot reach video endpoint: ${error.message}`
            : 'Cannot reach video endpoint'
      }
    }
  }

  async generate(request: VideoGenRequest): Promise<VideoGenResult> {
    return withRetries(
      async () => {
        const res = await this.fetchFn(this.videoPath, {
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
          signal: AbortSignal.timeout(Math.min(180_000, this.timeoutSec * 1000))
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Video HTTP ${res.status}: ${text.slice(0, 500)}`)
        }

        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          const json = (await res.json()) as JobJson
          return this.resolveJsonResult(json, request.outputPath)
        }

        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length < 32) throw new Error('Video API returned empty body')
        writeFileSync(request.outputPath, buf)
        return { outputPath: request.outputPath }
      },
      {
        maxRetries: this.maxRetries,
        shouldRetry: (e) => isRetryableError(e)
      }
    )
  }

  private async resolveJsonResult(
    json: JobJson,
    outputPath: string
  ): Promise<VideoGenResult> {
    if (json.output_path && existsSync(json.output_path)) {
      return { outputPath: json.output_path }
    }
    if (json.path && existsSync(json.path)) {
      return { outputPath: json.path }
    }
    if (json.url || json.output_url) {
      await this.downloadTo(json.url ?? json.output_url!, outputPath)
      return { outputPath }
    }
    if (existsSync(outputPath)) {
      return { outputPath }
    }

    // Async job polling
    const statusUrl =
      json.status_url ??
      (json.job_id || json.id
        ? `${this.videoPath.replace(/\/$/, '')}/jobs/${json.job_id ?? json.id}`
        : null)

    if (statusUrl) {
      return this.pollJob(statusUrl, outputPath)
    }

    throw new Error('Video API JSON missing usable path/url/job')
  }

  private async pollJob(statusUrl: string, outputPath: string): Promise<VideoGenResult> {
    const deadline = Date.now() + this.timeoutSec * 1000
    while (Date.now() < deadline) {
      const res = await this.fetchFn(statusUrl, {
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000)
      })
      if (!res.ok) {
        throw new Error(`Video job poll HTTP ${res.status}`)
      }
      const json = (await res.json()) as JobJson & { error?: string }
      const status = (json.status ?? '').toLowerCase()
      if (status === 'succeeded' || status === 'completed' || status === 'ready') {
        if (json.output_path && existsSync(json.output_path)) {
          return { outputPath: json.output_path }
        }
        if (json.path && existsSync(json.path)) return { outputPath: json.path }
        if (json.url || json.output_url) {
          await this.downloadTo(json.url ?? json.output_url!, outputPath)
          return { outputPath }
        }
        if (existsSync(outputPath)) return { outputPath }
        throw new Error('Job succeeded but no output file')
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(json.error ?? 'Video job failed')
      }
      await sleep(this.pollMs)
    }
    throw new Error(`Video job timed out after ${this.timeoutSec}s`)
  }

  private async downloadTo(url: string, dest: string): Promise<void> {
    const res = await this.fetchFn(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(180_000)
    })
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download video (${res.status})`)
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
