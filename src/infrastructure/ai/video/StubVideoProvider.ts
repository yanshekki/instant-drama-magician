import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import { FfmpegService } from '../../ffmpeg/FfmpegService'
import type { VideoProvider, VideoProviderStatus } from './types'

export class StubVideoProvider implements VideoProvider {
  readonly id = 'stub'
  readonly name = 'FFmpeg color stub'

  constructor(private readonly ffmpeg = new FfmpegService()) {}

  async probe(): Promise<VideoProviderStatus> {
    try {
      await this.ffmpeg.ensureAvailable()
      return {
        id: this.id,
        available: true,
        message: 'Stub provider ready (ffmpeg color clips)'
      }
    } catch (error) {
      return {
        id: this.id,
        available: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async generate(request: VideoGenRequest): Promise<VideoGenResult> {
    await this.ffmpeg.makeColorClip({
      outputPath: request.outputPath,
      durationSeconds: request.durationSeconds,
      label: request.prompt.slice(0, 60) || 'stub clip',
      color: '0x4c1d95'
    })
    return { outputPath: request.outputPath, degraded: true }
  }
}
