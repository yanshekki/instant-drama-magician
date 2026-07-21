import { describe, expect, it } from 'vitest'
import { isCoverPathInList, moveById, shiftById } from './galleryOrder'

describe('galleryOrder', () => {
  const list = [
    { id: 'a', n: 1 },
    { id: 'b', n: 2 },
    { id: 'c', n: 3 }
  ]

  it('moves by id', () => {
    expect(moveById(list, 'c', 'a').map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(moveById(list, 'a', 'c').map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('no-ops when ids equal or missing', () => {
    expect(moveById(list, 'a', 'a')).toBe(list)
    expect(moveById(list, 'x', 'a')).toBe(list)
    expect(moveById(list, 'a', 'x')).toBe(list)
  })

  it('shifts by one', () => {
    expect(shiftById(list, 'b', 1).map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(shiftById(list, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('no-ops shift at edges or missing id', () => {
    expect(shiftById(list, 'a', -1)).toBe(list)
    expect(shiftById(list, 'c', 1)).toBe(list)
    expect(shiftById(list, 'z', 1)).toBe(list)
  })

  it('isCoverPathInList checks presence', () => {
    const items = [{ path: '/a.png' }, { path: '/b.png' }]
    expect(isCoverPathInList(items, '/a.png')).toBe(true)
    expect(isCoverPathInList(items, '/c.png')).toBe(false)
    expect(isCoverPathInList(items, null)).toBe(false)
    expect(isCoverPathInList(items, undefined)).toBe(false)
    expect(isCoverPathInList(items, '')).toBe(false)
  })
})
