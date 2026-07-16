import { describe, expect, it } from 'vitest'
import { MediaStore } from './MediaStore'
import { join } from 'path'

describe('MediaStore', () => {
  const store = new MediaStore('/tmp/idm-media-test')

  it('builds clip and export paths', () => {
    expect(store.clipPath('story1', 'entry1')).toBe(
      join('/tmp/idm-media-test', 'story1', 'clips', 'entry1.mp4')
    )
    expect(store.exportsDir('story1')).toBe(
      join('/tmp/idm-media-test', 'story1', 'exports')
    )
  })
})
