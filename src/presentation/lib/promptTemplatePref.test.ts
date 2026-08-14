import { describe, expect, it } from 'vitest'
import {
  PROMPT_TEMPLATE_PREF_KEY,
  clearPromptTemplatePrefs,
  hasRememberedAlways,
  readPromptTemplatePrefs,
  rememberedTemplate,
  withRemembered,
  writePromptTemplatePrefs
} from './promptTemplatePref'

describe('promptTemplatePref', () => {
  it('reads empty / corrupt storage', () => {
    expect(readPromptTemplatePrefs(null)).toEqual({})
    expect(
      readPromptTemplatePrefs({
        getItem: () => 'nope'
      })
    ).toEqual({})
  })

  it('remembers last + always', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      }
    }
    writePromptTemplatePrefs(
      withRemembered({}, 'copy', 'invent', true),
      storage
    )
    expect(mem.get(PROMPT_TEMPLATE_PREF_KEY)).toMatch(/invent/)
    const store = readPromptTemplatePrefs(storage)
    expect(rememberedTemplate('copy', store)).toEqual({
      id: 'invent',
      always: true
    })
    expect(rememberedTemplate('media', store).id).toBe('follow-asset')
    expect(hasRememberedAlways(store)).toBe(true)
    clearPromptTemplatePrefs({
      removeItem: (k) => {
        mem.delete(k)
      }
    })
    expect(mem.get(PROMPT_TEMPLATE_PREF_KEY)).toBeUndefined()
    expect(hasRememberedAlways(readPromptTemplatePrefs(storage))).toBe(false)
  })
})
