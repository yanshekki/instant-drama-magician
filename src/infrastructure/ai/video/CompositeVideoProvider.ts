import type { VideoMode } from '../../../types/settings'
import type { AppSettings } from '../../../types/settings'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import type { VideoProvider, VideoProviderStatus } from './types'
import { GrokHttpVideoProvider } from './GrokHttpVideoProvider'
import { StubVideoProvider } from './StubVideoProvider'

export class CompositeVideoProvider implements VideoProvider {
  readonly id = 'composite'
  readonly name = 'Composite video'
  private readonly http: GrokHttpVideoProvider
  private readonly stub: StubVideoProvider
  private lastProviderId = 'stub'

  constructor(
    private readonly mode: VideoMode,
    videoPath: string,
    apiKey: string,
    model: string,
    opts?: Partial<Pick<AppSettings, 'videoPollMs' | 'videoTimeoutSec' | 'videoMaxRetries'>>,
    stub?: StubVideoProvider
  ) {
    this.http = new GrokHttpVideoProvider({
      videoPath,
      apiKey,
      model,
      pollMs: opts?.videoPollMs,
      timeoutSec: opts?.videoTimeoutSec,
      maxRetries: opts?.videoMaxRetries
    })
    this.stub = stub ?? new StubVideoProvider()
  }

  get lastUsedId(): string {
    return this.lastProviderId
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

    try {
      const probe = await this.http.probe()
      if (probe.available) {
        try {
          this.lastProviderId = this.http.id
          return await this.http.generate(request)
        } catch {
          // fall through to stub
        }
      }
    } catch {
      // fall through
    }
    this.lastProviderId = this.stub.id
    return this.stub.generate(request)
  }
}
