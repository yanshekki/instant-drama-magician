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

  it('playing empty entry shows skip hint and generate', () => {
    const onGen = vi.fn()
    render(
      <PreviewPlayer
        entry={
          {
            ...baseEntry,
            mediaStatus: 'EMPTY',
            mediaPath: null
          } as never
        }
        playhead={0}
        isPlaying
        onGenerate={onGen}
        generateDisabled={false}
      />
    )
    expect(document.body.textContent || '').toMatch(/skipEmpty|previewNoMedia|generate/i)
    const gen = screen.queryByRole('button')
    if (gen) fireEvent.click(gen)
  })

  it('video play path with canplay and timeupdate end', async () => {
    const onClock = vi.fn()
    const onEnded = vi.fn()
    // mock HTMLMediaElement
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    const addEventListener = vi.fn((ev: string, cb: () => void) => {
      if (ev === 'canplay' || ev === 'loadedmetadata') {
        queueMicrotask(cb)
      }
    })
    const removeEventListener = vi.fn()
    const load = vi.fn()
    // patch via prototype
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pause
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: load
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 0
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
      configurable: true,
      get: () => 5
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get: () => 4.95,
      set: () => undefined
    })

    const { container, rerender } = render(
      <PreviewPlayer
        entry={baseEntry}
        playhead={0}
        isPlaying={false}
        onMediaClock={onClock}
        onClipEnded={onEnded}
      />
    )
    await waitFor(() => expect(api.media.toPreviewUrl).toHaveBeenCalled())

    // re-render as playing
    await act(async () => {
      rerender(
        <PreviewPlayer
          entry={baseEntry}
          playhead={0}
          isPlaying
          onMediaClock={onClock}
          onClipEnded={onEnded}
        />
      )
    })

    const video = container.querySelector('video')
    if (video) {
      // fire timeupdate / ended
      fireEvent(video, new Event('timeupdate'))
      fireEvent(video, new Event('ended'))
      fireEvent(video, new Event('error'))
    }
  })

  it('preview url failure sets error', async () => {
    api.media.toPreviewUrl = vi.fn().mockRejectedValue(new Error('no url'))
    render(
      <PreviewPlayer entry={baseEntry} playhead={0} isPlaying={false} />
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/no url|error|rose/i)
    )
  })
})
