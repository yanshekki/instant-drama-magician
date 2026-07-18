import { describe, expect, it } from 'vitest'
import { moveById, shiftById } from './galleryOrder'

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

  it('shifts by one', () => {
    expect(shiftById(list, 'b', 1).map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(shiftById(list, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
})
