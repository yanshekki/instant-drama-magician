import { describe, expect, it } from 'vitest'
import { createTempRuntime } from '../test/tempRuntime'

/** Safe no-arg / light-arg channels that must not be NOT_FOUND */
/** Safe no/light-arg channels (must not NOT_FOUND; may VALIDATION without payload). */
const SAFE = [
  'stories:list',
  'characters:list',
  'scenes:list',
  'props:list',
  'costumes:list',
  'actions:list',
  'settings:get',
  'ai:status',
  'ai:listModels',
  'app:getInfo',
  'media:checkFfmpeg',
  'activity:recent',
  'activity:getPath',
  'diagnostics:full',
  'updates:status',
  'generation:progress',
  'gateway:status',
  'souls:categories',
  'souls:list',
  'webServer:status',
  'timeline:list'
]

/**
 * Channels that trigger heavy dynamic imports when invoked with empty/invalid
 * args — must resolve modules (path depth) even if they throw VALIDATION.
 */
const DYNAMIC_IMPORT_SMOKE: Array<{ channel: string; args: unknown[] }> = [
  { channel: 'videoPrep:create', args: [{}] },
  { channel: 'characters:aiFill', args: [{}] },
  { channel: 'scenes:aiFill', args: [{}] },
  { channel: 'props:aiFill', args: [{}] },
  { channel: 'actions:aiFill', args: [{}] },
  { channel: 'costumes:aiFill', args: [{}] }
]

describe('channel invoke matrix (safe channels)', () => {
  it('invokes all safe channels without NOT_FOUND', async () => {
    const { runtime, dispose } = await createTempRuntime({
      prefix: 'idm-matrix-'
    })
    try {
      const missing: string[] = []
      for (const ch of SAFE) {
        try {
          await runtime.invoke(ch, ch === 'activity:recent' ? [5] : [])
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          const code = (e as { code?: string }).code
          if (code === 'NOT_FOUND' || /not available/i.test(msg)) {
            missing.push(ch)
          }
        }
      }
      expect(missing).toEqual([])
    } finally {
      await dispose()
    }
  }, 90_000)

  it('dynamic-import heavy channels resolve modules (not MODULE_NOT_FOUND)', async () => {
    const { runtime, dispose } = await createTempRuntime({
      prefix: 'idm-dynimport-'
    })
    try {
      const moduleMiss: string[] = []
      for (const { channel, args } of DYNAMIC_IMPORT_SMOKE) {
        try {
          await runtime.invoke(channel, args)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          const code = (e as { code?: string }).code
          if (
            code === 'NOT_FOUND' &&
            /channel not available/i.test(msg)
          ) {
            moduleMiss.push(`${channel}: channel missing`)
          } else if (
            /Cannot find module|MODULE_NOT_FOUND|Failed to resolve/i.test(msg)
          ) {
            moduleMiss.push(`${channel}: ${msg.slice(0, 120)}`)
          }
          // VALIDATION / other app errors are expected with empty payload
        }
      }
      expect(moduleMiss).toEqual([])
    } finally {
      await dispose()
    }
  }, 120_000)
})
