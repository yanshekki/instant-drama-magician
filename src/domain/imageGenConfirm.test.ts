import { describe, expect, it } from 'vitest'
import {
  allRefPaths,
  appendMultiRefNote,
  pickPrimaryRefPath,
  resolveIdentityPaths,
  toggleGallerySelection
} from './imageGenConfirm'

describe('imageGenConfirm', () => {
  it('resolveIdentityPaths requires checkbox + selection', () => {
    expect(
      resolveIdentityPaths({
        useIdentityRef: false,
        selectedPaths: ['/a.png']
      }).useEdit
    ).toBe(false)
    expect(
      resolveIdentityPaths({
        useIdentityRef: true,
        selectedPaths: []
      }).useEdit
    ).toBe(false)
    const r = resolveIdentityPaths({
      useIdentityRef: true,
      selectedPaths: ['/a.png', '/b.png']
    })
    expect(r.useEdit).toBe(true)
    expect(r.primaryPath).toBe('/a.png')
    expect(r.paths).toHaveLength(2)
  })

  it('appendMultiRefNote only when 2+', () => {
    expect(appendMultiRefNote('P', ['/a'], 'en')).toBe('P')
    expect(appendMultiRefNote('P', ['/a', '/b'], 'en')).toMatch(/Additional/)
    expect(appendMultiRefNote('P', ['/a', '/b'], 'zh-HK')).toMatch(/另有/)
  })

  it('pickPrimaryRefPath prefers paths array then single', () => {
    expect(pickPrimaryRefPath('/old', ['/a', '/b'])).toBe('/a')
    expect(pickPrimaryRefPath('/old', [])).toBe('/old')
    expect(pickPrimaryRefPath(null, null)).toBeNull()
  })

  it('allRefPaths merges unique', () => {
    expect(allRefPaths('/a', ['/b', '/a'])).toEqual(['/a', '/b'])
  })

  it('toggleGallerySelection multi vs single', () => {
    expect(toggleGallerySelection(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleGallerySelection(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleGallerySelection(['a'], 'b', { multi: false })).toEqual(['b'])
  })
})
