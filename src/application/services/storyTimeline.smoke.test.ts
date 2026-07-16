import { describe, expect, it } from 'vitest'
import { MediaStore } from '../../infrastructure/media/MediaStore'
import { buildSrt } from '../../domain/subtitle'
import { suggestNextSlot, clampDuration } from '../../domain/timeline'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

/**
 * Lightweight integration-style smoke (no Electron / Prisma):
 * story timeline planning + media paths + srt for export pipeline.
 */
describe('story → timeline → export artifacts smoke', () => {
  it('plans clips, allocates media paths, builds srt', () => {
    const root = mkdtempSync(join(tmpdir(), 'idm-smoke-'))
    const store = new MediaStore(root)
    const storyId = 'story_demo'

    const slot0 = suggestNextSlot([], 5)
    const range0 = clampDuration(slot0.startTime, slot0.endTime, 10)
    const slot1 = suggestNextSlot(
      [
        {
          id: 'e0',
          storyId,
          order: 0,
          startTime: range0.startTime,
          endTime: range0.endTime,
          characterId: null,
          sceneId: null,
          propId: null,
          dialogue: 'Hello',
          mediaPath: null,
          mediaStatus: 'EMPTY',
          mediaError: null,
          videoJobId: null
        }
      ],
      4
    )

    store.ensureStoryDirs(storyId)
    const clip0 = store.clipPath(storyId, 'e0')
    const clip1 = store.clipPath(storyId, 'e1')
    expect(clip0).toContain(join(storyId, 'clips', 'e0.mp4'))
    expect(clip1).toContain('e1.mp4')

    const srt = buildSrt([
      {
        startSeconds: range0.startTime,
        endSeconds: range0.endTime,
        text: 'Hello'
      },
      {
        startSeconds: slot1.startTime,
        endSeconds: slot1.endTime,
        text: 'World'
      }
    ])
    expect(srt).toContain('Hello')
    expect(srt).toContain('World')
    expect(store.exportsDir(storyId)).toContain(join(storyId, 'exports'))
  })
})
