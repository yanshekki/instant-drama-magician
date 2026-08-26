import { describe, expect, it } from 'vitest'
import {
  SYSTEM_PHOTO_ACTIONS,
  SYSTEM_PHOTO_ACTION_IDS,
  getSystemPhotoAction,
  isSystemPhotoActionId,
  parseSystemPhotoActionId,
  systemPhotoActionLabelKey,
  systemPhotoActionNotes,
  systemPhotoActionStorageId
} from './systemPhotoActions'

describe('systemPhotoActions', () => {
  it('stores sys: ids that never look like library UUIDs', () => {
    expect(SYSTEM_PHOTO_ACTIONS).toHaveLength(12)
    expect(SYSTEM_PHOTO_ACTION_IDS).toHaveLength(12)
    expect(isSystemPhotoActionId('sys:walk-in')).toBe(true)
    expect(isSystemPhotoActionId('walk-in')).toBe(false)
    expect(isSystemPhotoActionId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
      false
    )
    expect(parseSystemPhotoActionId('sys:look-back')).toBe('look-back')
    expect(parseSystemPhotoActionId('sys:nope')).toBeUndefined()
    expect(systemPhotoActionStorageId('hold-prop')).toBe('sys:hold-prop')
    expect(systemPhotoActionLabelKey('wave')).toBe('systemPhotoActions.wave')
  })

  it('returns still and video prompt blocks in written Chinese or English', () => {
    const zh = systemPhotoActionNotes('sys:walk-in', 'zh-HK', 'still')
    expect(zh).toMatch(/系統動作（walk-in）/)
    expect(zh).toMatch(/步行入場/)
    expect(zh).not.toMatch(/嘅|喺|跟住|template/)
    const enVideo = systemPhotoActionNotes('sys:walk-in', 'en', 'video')
    expect(enVideo).toMatch(/System action \(walk-in\)/)
    expect(enVideo).toMatch(/Walk into frame/)
    expect(getSystemPhotoAction('sys:kneel')?.id).toBe('kneel')
    expect(systemPhotoActionNotes('nope', 'en')).toBeNull()
    for (const ac of SYSTEM_PHOTO_ACTIONS) {
      expect(ac.stillPrompt['zh-HK'], ac.id).not.toMatch(/嘅|喺|跟住|入面|讀得明/)
      expect(ac.videoPrompt['zh-HK'], ac.id).not.toMatch(/嘅|喺|跟住|入面|讀得明/)
    }
  })
})
