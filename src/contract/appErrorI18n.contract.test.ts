/**
 * Guard: user-facing AppError messages should be stable i18n keys (errors.*),
 * not free-form English that skips formatUserError.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'types' || name === 'test') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkTs(p, out)
    else if (
      (name.endsWith('.ts') || name.endsWith('.tsx')) &&
      !name.includes('.test.')
    ) {
      out.push(p)
    }
  }
  return out
}

describe('AppError i18n contract', () => {
  it('all AppError messages use errors.* keys (not free-form English)', () => {
    const files = walkTs(ROOT)
    const free: string[] = []
    const re =
      /AppError\(\s*['"][A-Z_]+['"]\s*,\s*['"]([^'"]+)['"]/g
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const msg = m[1]
        if (msg.startsWith('errors.')) continue
        if (/^[A-Z][A-Z0-9_]+$/.test(msg)) continue
        free.push(`${f.replace(ROOT + '/', '')}: ${msg}`)
      }
    }
    expect(
      free,
      `Free-form AppError messages (use errors.* keys):\n${free.join('\n')}`
    ).toHaveLength(0)
  })

  it('all AppError template messages use errors.* keys (not free-form English)', () => {
    const files = walkTs(ROOT)
    const free: string[] = []
    const re =
      /AppError\(\s*['"][A-Z_]+['"]\s*,\s*`([^`$]*)`/g
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const msg = m[1]
        if (msg.startsWith('errors.')) continue
        // allow pure interpolation-only templates if key is static elsewhere — still flag free English
        if (!/[A-Za-z]{3,}/.test(msg.replace(/\$\{[^}]+\}/g, ''))) continue
        free.push(`${f.replace(ROOT + '/', '')}: \`${msg}\``)
      }
    }
    expect(
      free,
      `Free-form AppError template messages (use errors.* keys):\n${free.join('\n')}`
    ).toHaveLength(0)
  })

})