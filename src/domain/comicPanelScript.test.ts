import { describe, expect, it } from 'vitest'
import {
  boundTimelineIdsFromSlots,
  captionFromTimelineBeat,
  captionsFromSlots,
  emptyPanelSlot,
  normalizePanelSlots,
  paginateTimelineBeats,
  parsePanelScriptJson,
  serializePanelScript
} from './comicPanelScript'

describe('comicPanelScript', () => {
  it('normalizes and serializes slots', () => {
    const slots = normalizePanelSlots(
      [{ caption: 'a', timelineEntryId: 'e1', characterIds: ['c1'] }],
      4
    )
    expect(slots).toHaveLength(4)
    expect(slots[0].characterIds).toEqual(['c1'])
    expect(emptyPanelSlot().caption).toBe('')
    expect(parsePanelScriptJson(serializePanelScript(slots), 'grid-2x2')).toHaveLength(
      4
    )
    expect(captionsFromSlots(slots)[0]).toBe('a')
    expect(boundTimelineIdsFromSlots(slots)).toEqual(['e1'])
    expect(
      parsePanelScriptJson(
        JSON.stringify([
          {
            caption: 'x',
            sceneId: '  sc1  ',
            propId: '  p1  ',
            actionId: '  a1  ',
            characterIds: ['c1', '']
          }
        ]),
        'strip-3'
      )[0]
    ).toMatchObject({
      sceneId: 'sc1',
      propId: 'p1',
      actionId: 'a1',
      characterIds: ['c1']
    })
  })

  it('paginates leftover beats', () => {
    expect(
      paginateTimelineBeats([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, ['a'])
    ).toHaveLength(1)
    expect(captionFromTimelineBeat({ dialogue: 'hi' })).toBe('hi')
    expect(
      captionFromTimelineBeat({
        dialogue: '',
        beatContentJson: JSON.stringify({
          units: [{ type: 'action', text: 'run' }]
        })
      })
    ).toBe('run')
  })
})
