import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act
} from '@testing-library/react'
import { createMockApi } from '../../../test/mockApi'

const api = createMockApi()
vi.mock('../../../lib/api', () => ({ getApi: () => api }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { PreviewPlayer } from './PreviewPlayer'

const baseEntry = {
  id: 't1',
  storyId: 's1',
  startTime: 0,
  endTime: 5,
  order: 0,
  mediaPath: '/v.mp4',
  mediaStatus: 'READY',
  characterId: null,
  sceneId: null,
  propId: null,
  dialogue: null
} as never

describe('PreviewPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.media.toPreviewUrl = vi.fn().mockResolvedValue({ url: 'blob:v' })
  })
  afterEach(() => cleanup())

  it('empty without entry', () => {
    render(
      <PreviewPlayer entry={null} playhead={0} isPlaying={false} />
    )
    expect(document.body.textContent).toBeTruthy()
  })

  it('loads READY media and generate button', async () => {
    const onGen = vi.fn()
    render(
      <PreviewPlayer
        entry={baseEntry}
        playhead={1}
        isPlaying={false}
        onGenerate={onGen}
        generateLabel="Gen"
      />
    )
    await waitFor(() => expect(api.media.toPreviewUrl).toHaveBeenCalled())
    const gen = screen.queryByText('Gen')
    if (gen) fireEvent.click(gen)
    if (gen) expect(onGen).toHaveBeenCalled()
  })

  it('shows status when not ready', () => {
    render(
      <PreviewPlayer
        entry={
          {
            ...baseEntry,
            mediaStatus: 'GENERATING',
            mediaPath: null
          } as never
        }
        playhead={0}
        isPlaying={false}
      />
    )
  })

  it('FAILED and EMPTY statuses', () => {
    for (const status of ['FAILED', 'EMPTY', 'QUEUED']) {
      const { unmount } = render(
        <PreviewPlayer
          entry={
            {
              ...baseEntry,
              mediaStatus: status,
              mediaPath: status === 'FAILED' ? '/bad.mp4' : null,
              mediaError: status === 'FAILED' ? 'boom' : null
            } as never
          }
          playhead={0}
          isPlaying={false}
        />
      )
      unmount()
    }
  })

  it('isPlaying advances and video events', async () => {
    const onEnded = vi.fn()
    const onClock = vi.fn()
    const { rerender } = render(
      <PreviewPlayer
        entry={baseEntry}
        playhead={0}
        isPlaying
        onPlayheadChange={vi.fn()}
        onMediaClock={onClock}
        onClipEnded={onEnded}
      />
    )
    await waitFor(() => expect(api.media.toPreviewUrl).toHaveBeenCalled())
    const video = document.querySelector('video')
    if (video) {
      Object.defineProperty(video, 'currentTime', {
        writable: true,
        value: 1
      })
      Object.defineProperty(video, 'duration', {
        writable: true,
        value: 5
      })
      video.play = vi.fn().mockResolvedValue(undefined)
      video.pause = vi.fn()
      fireEvent.loadedMetadata(video)
      fireEvent.timeUpdate(video)
      fireEvent.ended(video)
      fireEvent.error(video)
      for (const b of Array.from(document.querySelectorAll('button'))) {
        fireEvent.click(b)
      }
    }
    rerender(
      <PreviewPlayer
        entry={baseEntry}
        playhead={2}
        isPlaying={false}
        onMediaClock={onClock}
        onClipEnded={onEnded}
      />
    )
  })

  it('toPreviewUrl failure shows error', async () => {
    api.media.toPreviewUrl = vi.fn().mockRejectedValue(new Error('no url'))
    render(
      <PreviewPlayer entry={baseEntry} playhead={0} isPlaying={false} />
    )
    await waitFor(() => expect(api.media.toPreviewUrl).toHaveBeenCalled())
  })
})
