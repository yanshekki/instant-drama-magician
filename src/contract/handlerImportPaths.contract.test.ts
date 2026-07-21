/**
 * Guards against wrong relative imports after splitting handlers into
 * src/runtime/handlers/* (and nested subfolders like videoPrep/).
 *
 * From handlers/: domain|application|infrastructure|types must be ../../
 * From handlers/<sub>/: same tops must be ../../../
 * Only ../HandlerHost, ./context, ../context, and ./sibling are valid local relatives.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const HANDLERS = join(__dirname, '../runtime/handlers')

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkTs(p, out)
    else if (name.endsWith('.ts') && !name.includes('.test.')) out.push(p)
  }
  return out
}

describe('handler import path contract', () => {
  it('uses correct relative depth for domain|application|infrastructure|types', () => {
    const bad: string[] = []
    const re =
      /(?:from|import)\s*\(?\s*['"]((?:\.\.\/)+(domain|application|infrastructure|types)\/)/g
    for (const file of walkTs(HANDLERS)) {
      if (file.endsWith('context.ts') && relative(HANDLERS, file) === 'context.ts') {
        continue
      }
      const rel = relative(HANDLERS, file).replace(/\\/g, '/')
      const depth = rel.split('/').length - 1 // 0 for handlers/*.ts, 1 for handlers/sub/*.ts
      const expectedUps = 2 + depth
      const text = readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const importPath = m[1] // e.g. ../../domain/
        const ups = (importPath.match(/\.\.\//g) || []).length
        if (ups !== expectedUps) {
          const line = text.slice(0, m.index).split('\n').length
          bad.push(
            `${rel}:${line} → ${importPath} (expected ${'../'.repeat(expectedUps)}${m[2]}/)`
          )
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('does not use single-level ../domain from handlers root', () => {
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
