import { describe, expect, it } from 'vitest'
import {
  collageSourcePaths,
  galleryHasPersistedIdentityLock,
  identityEditCap,
  isIdentityLockLabel,
  markGalleryIdentityLock,
  pickAdvancedIdentityRefs,
  pickIdentityEditBase,
  toggleGalleryIdentityLock
} from './advancedIdentity'
import { MAX_IMAGE_EDIT_REFERENCES } from './characterGallery'

const item = (
  path: string,
  extra: Record<string, unknown> = {}
): {
  id: string
  path: string
  kind: 'sheet' | 'upload'
  label: string
  createdAt: string
  layer?: 'identity'
  identityLock?: boolean
} => ({
  id: path,
  path,
  kind: extra.kind === 'upload' ? 'upload' : 'sheet',
  label: String(extra.label ?? 'Image'),
  createdAt: '2020-01-01',
  ...extra
})

describe('advancedIdentity', () => {
  it('keeps edits cap at 1', () => {
    expect(identityEditCap()).toBe(MAX_IMAGE_EDIT_REFERENCES)
    expect(identityEditCap()).toBe(1)
    expect(pickIdentityEditBase(['/a.png', '/b.png'])).toBe('/a.png')
  })

  it('prefers identity layer and selected paths', () => {
    const items = [
      item('/body.png', { kind: 'upload', label: 'Body' }),
      item('/face.png', { layer: 'identity', label: 'Face ID' }),
      item('/bible.png', { label: 'Bible sheet' })
    ]
    const picked = pickAdvancedIdentityRefs(items, {
      selectedPaths: ['/body.png'],
      pathExists: () => true
    })
    expect(picked[0]).toBe('/body.png')
    expect(picked).toContain('/face.png')
    expect(picked).toContain('/bible.png')
  })

  it('marks identityLock on gallery items', () => {
    const next = markGalleryIdentityLock(
      [item('/a.png'), item('/b.png')],
      ['/a.png']
    )
    expect(next[0]?.identityLock).toBe(true)
    expect(next[1]?.identityLock).toBeUndefined()
  })

  it('toggles identityLock and restores from persisted flags', () => {
    const marked = markGalleryIdentityLock(
      [item('/a.png'), item('/b.png')],
      ['/a.png']
    )
    expect(galleryHasPersistedIdentityLock(marked)).toBe(true)
    expect(galleryHasPersistedIdentityLock([item('/plain.png')])).toBe(false)
    expect(
      galleryHasPersistedIdentityLock([
        item('/face.png', { layer: 'identity' })
      ])
    ).toBe(true)
    const off = toggleGalleryIdentityLock(marked, '/a.png')
    expect(off[0]?.identityLock).toBeUndefined()
    const on = toggleGalleryIdentityLock(off, '/a.png')
    expect(on[0]?.identityLock).toBe(true)
    expect(toggleGalleryIdentityLock(marked, '')).toBe(marked)
  })

  it('collage sources cap at 4 unique', () => {
    expect(collageSourcePaths(['/a', '/a', '/b', '/c', '/d', '/e'])).toEqual([
      '/a',
      '/b',
      '/c',
      '/d'
    ])
    expect(isIdentityLockLabel('Identity lock')).toBe(true)
    expect(isIdentityLockLabel('random')).toBe(false)
  })
})
