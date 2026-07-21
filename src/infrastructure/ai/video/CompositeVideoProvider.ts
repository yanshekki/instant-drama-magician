import type { AppSettings, VideoMode } from '../../../types/settings'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import type { VideoProvider, VideoProviderStatus } from './types'
import { GrokHttpVideoProvider } from './GrokHttpVideoProvider'
import { StubVideoProvider } from './StubVideoProvider'
import { AppError } from '../../../types/errors'

export class CompositeVideoProvider implements VideoProvider {
  readonly id = 'composite'
  readonly name = 'Composite video'
  private readonly http: GrokHttpVideoProvider
  private readonly stub: StubVideoProvider
  private lastProviderId = 'stub'

  constructor(
    private readonly mode: VideoMode,
    baseUrl: string,
    apiKey: string,
    model: string,
    opts?: Partial<
      Pick<
        AppSettings,
        | 'videoPollMs'
        | 'videoTimeoutSec'
        | 'videoMaxRetries'
        | 'videoPath'
        | 'aspectRatio'
      >
    >,
    stub?: StubVideoProvider
  ) {
    const base = baseUrl.replace(/\/$/, '')
    this.http = new GrokHttpVideoProvider({
      baseUrl: base,
      videosCreateUrl: opts?.videoPath?.includes('/videos')
        ? opts.videoPath
        : `${base}/videos`,
      apiKey,
      model,
      pollMs: opts?.videoPollMs,
      timeoutSec: opts?.videoTimeoutSec,
      maxRetries: opts?.videoMaxRetries,
      aspectRatio: opts?.aspectRatio
    })
    this.stub = stub ?? new StubVideoProvider()
  }

  get lastUsedId(): string {
    return this.lastProviderId
  }

  get httpProvider(): GrokHttpVideoProvider {
    return this.http
  }

  async probe(): Promise<VideoProviderStatus> {
    if (this.mode === 'stub') return this.stub.probe()
    if (this.mode === 'http') return this.http.probe()
    const httpStatus = await this.http.probe()
    if (httpStatus.available) return httpStatus
    const stubStatus = await this.stub.probe()
    return {
      id: this.id,
      available: stubStatus.available,
      message: `auto: http unavailable (${httpStatus.message}); stub: ${stubStatus.message}`
    }
  }

  async generate(request: VideoGenRequest): Promise<VideoGenResult> {
    if (this.mode === 'stub') {
      this.lastProviderId = this.stub.id
      return this.stub.generate(request)
    }

    if (this.mode === 'http') {
      this.lastProviderId = this.http.id
      return this.http.generate(request)
    }

    // auto: use real HTTP when available. If HTTP is up but generation fails,
    // rethrow — do NOT silently write a purple ffmpeg placeholder (that looks
    // like a "successful" clip with the prompt burned as text).
    let probeAvailable = false
    let probeMessage = ''
    try {
      const probe = await this.http.probe()
      probeAvailable = probe.available
      probeMessage = probe.message ?? ''
      if (probe.available) {
        this.lastProviderId = this.http.id
        return await this.http.generate(request)
      }
    } catch (err) {
      // probe or generate failed while we thought HTTP was reachable
      if (probeAvailable) throw err
      // probe itself failed — fall through to stub only if ffmpeg works
    }

    try {
      this.lastProviderId = this.stub.id
      const stub = await this.stub.generate(request)
      return {
        ...stub,
        degraded: true,
        // Surface why we stubbed so UI/logs can explain purple clips
        jobId: stub.jobId ?? `stub-fallback:${probeMessage || 'http-unavailable'}`
      }
    } catch (stubErr) {
      throw new AppError(
        'AI_UNAVAILABLE',
        'errors.videoUnavailable',
        stubErr instanceof Error ? stubErr.message : String(stubErr)
      )
    }
  }
}
