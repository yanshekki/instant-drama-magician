import { describe, expect, it } from 'vitest'
import {
  castSaveToast,
  stillReadyDecrement,
  batchTargets,
  genLockedExtra,
  readyVideoEntryIds
} from './timelineAdvancedPure'

describe('timelineAdvancedPure', () => {
  it('covers all residual pure branches', () => {
    expect(castSaveToast(true)).toBe('skip')
    expect(castSaveToast(false)).toBe('success')
    expect(castSaveToast(undefined)).toBe('success')

    expect(stillReadyDecrement('ready')).toBe(1)
    expect(stillReadyDecrement('missing')).toBe(0)

    const cells = [
      { stillStatus: 'ready', entryId: 'a' },
      { stillStatus: 'missing', entryId: 'b' },
      { stillStatus: 'stale', entryId: 'c' }
    ]
    expect(batchTargets(cells, 'all')).toHaveLength(3)
    expect(batchTargets(cells, 'missing')).toHaveLength(2)

    expect(genLockedExtra({ current: 1, total: 2 }, null, 'B', 'G')).toBe(' · B')
    expect(genLockedExtra(null, 'e1', 'B', 'G')).toBe(' · G')
    expect(genLockedExtra(null, null, 'B', 'G')).toBe('')

    expect(readyVideoEntryIds(cells)).toEqual(['a', 'c'])
  })
})
