import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'

export interface VideoProviderStatus {
  id: string
  available: boolean
  message: string
}

export interface VideoProvider {
  readonly id: string
  readonly name: string
  probe(): Promise<VideoProviderStatus>
  generate(request: VideoGenRequest): Promise<VideoGenResult>
}
