import { describe, expect, it } from 'vitest'
import { createTempRuntime } from '../test/tempRuntime'

describe('createRuntime integration', () => {
  it('creates story and lists it', async () => {
    const { runtime, dispose } = await createTempRuntime({
      prefix: 'idm-rt-int-'
    })
    try {
      const created = (await runtime.invoke('stories:create', [
        { title: 'Integration Story' }
      ])) as { id: string; title: string }
      expect(created.id).toBeTruthy()
      expect(created.title).toBe('Integration Story')

      const list = (await runtime.invoke('stories:list', [])) as Array<{
        id: string
      }>
      expect(list.some((s) => s.id === created.id)).toBe(true)

      const info = (await runtime.invoke('app:getInfo', [])) as {
        channels: number
      }
      expect(info.channels).toBe(138)

      await runtime.invoke('stories:delete', [created.id])
    } finally {
      await dispose()
    }
  }, 60_000)
})
