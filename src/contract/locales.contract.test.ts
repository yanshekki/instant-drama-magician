import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

function flatten(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key))
    } else if (typeof v === 'string') {
      out[key] = v
    }
  }
  return out
}

describe('locales contract', () => {
  const dir = join(__dirname, '../locales')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

  it('has 10 language packs', () => {
    expect(files.length).toBe(10)
    expect(files).toContain('en.json')
    expect(files).toContain('zh-HK.json')
  })

  it('all locales match en leaf key set', () => {
    const en = flatten(
      JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')) as Record<
        string,
        unknown
      >
    )
    const enKeys = Object.keys(en).sort()
    for (const f of files) {
      if (f === 'en.json') continue
      const flat = flatten(
        JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<
          string,
          unknown
        >
      )
      const keys = Object.keys(flat).sort()
      const missing = enKeys.filter((k) => !(k in flat))
      const extra = keys.filter((k) => !(k in en))
      expect(missing, `${f} missing`).toEqual([])
      expect(extra, `${f} extra`).toEqual([])
      expect(keys.length).toBe(enKeys.length)
    }
  })
})
