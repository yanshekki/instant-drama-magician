import { createWriteStream, existsSync } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import type { VideoProvider, VideoProviderStatus } from './types'

export class GrokHttpVideoProvider implements VideoProvider {
  readonly id = 'grok-http'
  readonly name = 'Grok HTTP video'

  constructor(
    private readonly videoPath: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async probe(): Promise<VideoProviderStatus> {
    try {
      // OPTIONS or lightweight GET on parent; try HEAD/GET models-like health on video path host
      const res = await fetch(this.videoPath, {
        method: 'OPTIONS',
        headers: this.headers(),
        signal: AbortSignal.timeout(3000)
      })
      // Many servers return 404/405 for OPTIONS — treat network success as available enough to try
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
      // Fall back: try POST-less connectivity via base models is handled by auto mode
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
      signal: AbortSignal.timeout(180_000)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Video HTTP ${res.status}: ${text.slice(0, 500)}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as {
        output_path?: string
        path?: string
        url?: string
      }
      if (json.output_path && existsSync(json.output_path)) {
        return { outputPath: json.output_path }
      }
      if (json.path && existsSync(json.path)) {
        return { outputPath: json.path }
      }
      if (json.url) {
        await this.downloadTo(json.url, request.outputPath)
        return { outputPath: request.outputPath }
      }
      if (existsSync(request.outputPath)) {
        return { outputPath: request.outputPath }
      }
      throw new Error('Video API JSON missing usable path/url')
    }

    // Binary body → write file
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32) throw new Error('Video API returned empty body')
    const { writeFileSync } = await import('fs')
    writeFileSync(request.outputPath, buf)
    return { outputPath: request.outputPath }
  }

  private async downloadTo(url: string, dest: string): Promise<void> {
    const res = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(180_000)
    })
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download video (${res.status})`)
    }
    // Node 20 fetch body is web stream
    const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
    await pipeline(nodeStream, createWriteStream(dest))
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` }
  }
}
