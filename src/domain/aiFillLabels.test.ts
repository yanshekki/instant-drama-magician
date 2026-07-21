/**
 * Guard: profile AI-fill CTAs share one label family across entities.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadLocale(name: string): Record<string, unknown> {
  const raw = readFileSync(
    join(process.cwd(), 'src/locales', `${name}.json`),
    'utf8'
  )
  return JSON.parse(raw) as Record<string, unknown>
}

function nest(
  root: Record<string, unknown>,
  path: string
): string {
  const parts = path.split('.')
  let cur: unknown = root
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : ''
}

describe('AI fill label consistency', () => {
  for (const lang of ['en', 'zh-HK', 'zh-CN'] as const) {
    it(`${lang}: entity aiFill matches common.aiFill`, () => {
      const loc = loadLocale(lang)
      const common = nest(loc, 'common.aiFill')
      expect(common.length).toBeGreaterThan(0)
      for (const ns of ['costumes', 'scenes', 'props', 'actions'] as const) {
        expect(nest(loc, `${ns}.aiFill`)).toBe(common)
      }
      expect(nest(loc, 'characters.runMasterPrompt')).toBe(common)
      expect(nest(loc, 'characters.runMasterPromptImprove')).toBe(common)
    })

    it(`${lang}: section titles match common.aiTitle`, () => {
      const loc = loadLocale(lang)
      const title = nest(loc, 'common.aiTitle')
      expect(title.length).toBeGreaterThan(0)
      for (const ns of ['costumes', 'scenes', 'props'] as const) {
        expect(nest(loc, `${ns}.aiTitle`)).toBe(title)
      }
    })

    it(`${lang}: no legacy mixed button phrases in aiFill keys`, () => {
      const loc = loadLocale(lang)
      const fill = nest(loc, 'common.aiFill')
      // Must not be entity-specific button ("AI fill action") or ultra-long only
      expect(fill.toLowerCase()).not.toMatch(/fill action|填寫動作|填充/)
      expect(nest(loc, 'common.aiUsingImage')).not.toMatch(/填充/)
    })
  }

  it('zh-HK uses AI 填寫／改進 family', () => {
    const loc = loadLocale('zh-HK')
    expect(nest(loc, 'common.aiFill')).toBe('AI 填寫／改進')
    expect(nest(loc, 'common.aiTitle')).toBe('AI 填寫')
    expect(nest(loc, 'characters.aiCreate')).toBe('AI 填寫')
    expect(nest(loc, 'characters.aiImproveTitle')).toBe('AI 改進')
    expect(nest(loc, 'stories.aiFillMeta')).toMatch(/^AI /)
    expect(nest(loc, 'stories.aiFillScript')).toMatch(/^AI /)
  })
})
