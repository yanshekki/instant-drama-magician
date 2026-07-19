import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DESKTOP_CHANNEL_NAMES } from '../src/runtime/channelManifest'

describe('preload channel contract', () => {
  const preload = readFileSync(
    join(__dirname, 'preload/index.ts'),
    'utf8'
  )

  it('invoke channels referenced in preload are known desktop channels or events', () => {
    const channels = [
      ...preload.matchAll(/['"]([a-zA-Z][a-zA-Z0-9]*:[a-zA-Z0-9]+)['"]/g)
    ].map((m) => m[1])
    const set = new Set(DESKTOP_CHANNEL_NAMES)
    const eventOnly = new Set([
      'menu:action',
      'updates:state',
      'generation:progress'
    ])
    for (const c of channels) {
      if (eventOnly.has(c)) continue
      // allow generation:progress as event name in on()
      expect(set.has(c) || eventOnly.has(c), `unknown channel ${c}`).toBe(true)
    }
  })

  it('exposes onProgress / onMenuAction / onState subscribers', () => {
    expect(preload).toContain('onProgress')
    expect(preload).toContain('onMenuAction')
    expect(preload).toContain('onState')
  })
})
