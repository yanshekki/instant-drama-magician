import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeClipContinuityStillFromVideo } from './writeClipContinuityStill'

describe('writeClipContinuityStillFromVideo', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('extracts end frame to continuity path', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cont-'))
    const video = join(dir, 'c.mp4')
    writeFileSync(video, 'mp4')
    const cont = join(dir, 'e1_continuity.png')
    const extractStillFrame = vi.fn(async ({ outputPath, atSeconds }) => {
      expect(atSeconds).toBe('end')
      writeFileSync(outputPath, 'end-frame')
      return outputPath
    })
    const store = {
      ensureStoryDirs: vi.fn(),
      clipContinuityStillPath: () => cont,
      isEntryStillUserCleared: () => false
    }
    const path = await writeClipContinuityStillFromVideo({
      ffmpeg: { extractStillFrame },
      store: store as never,
      storyId: 's1',
      entryId: 'e1',
      videoPath: video
    })
    expect(path).toBe(cont)
    expect(readFileSync(cont, 'utf8')).toBe('end-frame')
  })

  it('falls back to still copy when extract fails', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cont-fb-'))
    const video = join(dir, 'c.mp4')
    const still = join(dir, 'still.png')
    const cont = join(dir, 'e1_continuity.png')
    writeFileSync(video, 'mp4')
    writeFileSync(still, 'keyframe')
    const store = {
      ensureStoryDirs: vi.fn(),
      clipContinuityStillPath: () => cont,
      isEntryStillUserCleared: () => false
    }
    const path = await writeClipContinuityStillFromVideo({
      ffmpeg: {
        extractStillFrame: vi.fn().mockRejectedValue(new Error('ff'))
      },
      store: store as never,
      storyId: 's1',
      entryId: 'e1',
      videoPath: video,
      fallbackStillPath: still
    })
    expect(path).toBe(cont)
    expect(existsSync(cont)).toBe(true)
  })

  it('skips when user cleared still', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cont-clr-'))
    const video = join(dir, 'c.mp4')
    writeFileSync(video, 'mp4')
    const extractStillFrame = vi.fn()
    const path = await writeClipContinuityStillFromVideo({
      ffmpeg: { extractStillFrame },
      store: {
        ensureStoryDirs: vi.fn(),
        clipContinuityStillPath: () => join(dir, 'c.png'),
        isEntryStillUserCleared: () => true
      } as never,
      storyId: 's1',
      entryId: 'e1',
      videoPath: video
    })
    expect(path).toBeNull()
    expect(extractStillFrame).not.toHaveBeenCalled()
  })
})
