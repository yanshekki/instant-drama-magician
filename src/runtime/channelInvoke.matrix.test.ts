import { describe, expect, it } from 'vitest'
import { createTempRuntime } from '../test/tempRuntime'

/** Safe no-arg / light-arg channels that must not be NOT_FOUND */
const SAFE = [
  'stories:list',
  'characters:list',
  'scenes:list',
  'props:list',
  'costumes:list',
  'actions:list',
  'settings:get',
  'ai:status',
  'app:getInfo',
  'media:checkFfmpeg',
  'activity:recent',
  'activity:getPath',
  'diagnostics:full',
  'updates:status',
  'generation:progress',
  'gateway:status',
  'souls:categories',
  'webServer:status',
  'timeline:list',
  'souls:list'
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
})
