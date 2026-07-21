import { describe, expect, it, vi } from 'vitest'
import {
  buildFillMissingSystemPrompt,
  fillMissingProfileFields,
  isProfileFieldEmpty,
  listMissingProfileKeys,
  mergeProfilePatch
} from './profileFillMissing'

describe('profileFillMissing', () => {
  it('isProfileFieldEmpty', () => {
    expect(isProfileFieldEmpty(undefined)).toBe(true)
    expect(isProfileFieldEmpty('')).toBe(true)
    expect(isProfileFieldEmpty('  ')).toBe(true)
    expect(isProfileFieldEmpty('x')).toBe(false)
    expect(isProfileFieldEmpty([])).toBe(true)
    expect(isProfileFieldEmpty(['a'])).toBe(false)
  })

  it('listMissingProfileKeys', () => {
    expect(
      listMissingProfileKeys(
        { name: 'A', description: 'd', visualTags: '' },
        ['name', 'description', 'visualTags', 'material']
      )
    ).toEqual(['visualTags', 'material'])
  })

  it('mergeProfilePatch only fills empty keys', () => {
    const merged = mergeProfilePatch(
      { name: 'Keep', visualTags: '', material: undefined },
      { name: 'Ignore', visualTags: ['gold', 'heart'], material: 'metal' },
      ['name', 'visualTags', 'material']
    )
    expect(merged.name).toBe('Keep')
    expect(merged.visualTags).toBe('gold, heart')
    expect(merged.material).toBe('metal')
  })

  it('buildFillMissingSystemPrompt lists keys', () => {
    expect(buildFillMissingSystemPrompt('zh-HK', ['visualTags', 'material'])).toContain(
      'visualTags'
    )
  })

  it('fillMissingProfileFields skips chat when complete', async () => {
    const chat = vi.fn()
    const r = await fillMissingProfileFields({
      profile: { name: 'A', description: 'B', visualTags: 'x' },
      requiredKeys: ['name', 'description', 'visualTags'],
      locale: 'zh-HK',
      chat
    })
    expect(chat).not.toHaveBeenCalled()
    expect(r.patchedKeys).toEqual([])
  })

  it('fillMissingProfileFields calls LLM only for missing keys', async () => {
    const chat = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              visualTags: ['gold', 'necklace'],
              material: '18K gold'
            })
          }
        }
      ]
    })
    const r = await fillMissingProfileFields({
      profile: {
        name: '心形項鍊',
        description: '金色吊墜',
        visualTags: '',
        material: undefined,
        condition: 'new'
      },
      requiredKeys: [
        'name',
        'description',
        'material',
        'sizeNotes',
        'condition',
        'visualTags'
      ],
      locale: 'zh-HK',
      chat
    })
    expect(chat).toHaveBeenCalledTimes(1)
    const body = chat.mock.calls[0][0]
    expect(body.messages[0].content).toMatch(/visualTags|material|sizeNotes/)
    expect(r.profile.visualTags).toBe('gold, necklace')
    expect(r.profile.material).toBe('18K gold')
    expect(r.profile.name).toBe('心形項鍊')
    expect(r.patchedKeys).toEqual(
      expect.arrayContaining(['visualTags', 'material'])
    )
  })
})
