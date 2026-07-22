import { describe, expect, it, vi } from 'vitest'
import {
  castSaveToast,
  stillReadyDecrement,
  batchTargets,
  expandBatchTargetsForContinuity,
  stillStatusHintKey,
  genLockedExtra,
  readyVideoEntryIds,
  shouldSilentPersistOnGen,
  shouldSilentPersistOnBatch,
  stillStatusOrMissing,
  runSaveCast,
  maybeSilentPersistDirty,
  maybeSilentPersistBatch,
  fireVideoQueue,
  notifyCastSaved
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
    expect(shouldSilentPersistOnGen(true)).toBe(true)
    expect(shouldSilentPersistOnGen(false)).toBe(false)
    expect(shouldSilentPersistOnBatch(true)).toBe(true)
    expect(stillStatusOrMissing(undefined)).toBe('missing')
    expect(stillStatusOrMissing('ready')).toBe('ready')

    const chain = [
      {
        entryId: 'e0',
        stillStatus: 'missing',
        continuityKind: 'first' as const
      },
      {
        entryId: 'e1',
        stillStatus: 'missing',
        continuityKind: 'text-only' as const
      },
      {
        entryId: 'e2',
        stillStatus: 'ready',
        continuityKind: 'locked' as const
      }
    ]
    const expanded = expandBatchTargetsForContinuity(
      chain,
      batchTargets(chain, 'missing')
    )
    expect(expanded.map((c) => c.entryId)).toEqual(['e0', 'e1'])
    expect(stillStatusHintKey('stale')).toBe('stillStaleHint')
    expect(stillStatusHintKey('missing', 'text-only')).toBe('stillNeedPrevHint')
    expect(stillStatusHintKey('missing')).toBe('stillMissingHint')
    expect(stillStatusHintKey('ready')).toBe('stillReadyHint')
  })

  it('async residual helpers', async () => {
    const persist = vi.fn(async () => undefined)
    const reload = vi.fn(async () => undefined)
    await runSaveCast(persist, reload)
    expect(persist).toHaveBeenCalled()
    expect(reload).toHaveBeenCalled()

    const setProgress = vi.fn()
    await maybeSilentPersistDirty(false, setProgress, persist)
    expect(setProgress).not.toHaveBeenCalled()
    await maybeSilentPersistDirty(true, setProgress, persist)
    expect(setProgress).toHaveBeenCalledWith(15, 'start')

    await maybeSilentPersistBatch(false, persist)
    await maybeSilentPersistBatch(true, persist)

    const onClose = vi.fn()
    const onStart = vi.fn()
    fireVideoQueue(onClose, onStart, ['e1'])
    expect(onClose).toHaveBeenCalled()
    expect(onStart).toHaveBeenCalledWith(['e1'], { skipStill: true })

    const toast = vi.fn()
    notifyCastSaved(false, toast)
    expect(toast).not.toHaveBeenCalled()
    notifyCastSaved(true, toast)
    expect(toast).toHaveBeenCalled()
  })
})
