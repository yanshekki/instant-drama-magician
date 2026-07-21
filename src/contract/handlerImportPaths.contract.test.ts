/**
 * Guards against wrong relative imports after splitting handlers into
 * src/runtime/handlers/* (one level deeper than registerAllHandlers).
 *
 * From handlers/: domain/application/infrastructure/types must be ../../
 * Only ../HandlerHost and ./context are valid single-dot relatives.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const HANDLERS = join(__dirname, '../runtime/handlers')

describe('handler import path contract', () => {
  it('does not import ../domain|application|infrastructure|types from handlers/', () => {
    const bad: string[] = []
    const re =
      /(?:from|import)\s*\(?\s*['"]\.\.\/(domain|application|infrastructure|types)\//g
    for (const name of readdirSync(HANDLERS)) {
      if (!name.endsWith('.ts') || name === 'context.ts') continue
      const text = readFileSync(join(HANDLERS, name), 'utf8')
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const line = text.slice(0, m.index).split('\n').length
        bad.push(`${name}:${line} → ../${m[1]}/ (use ../../${m[1]}/)`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
