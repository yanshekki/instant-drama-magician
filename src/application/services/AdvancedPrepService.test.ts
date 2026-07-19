import { describe, expect, it } from 'vitest'
import { AdvancedPrepService } from './AdvancedPrepService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('AdvancedPrepService', () => {
  it('is constructible with deps', () => {
    const prisma = createMockPrisma()
    const store = {
      ensureTmpDir: () => undefined,
      mediaRoot: '/tmp/media'
    }
    const svc = new AdvancedPrepService(
      prisma as never,
      store as never,
      () =>
        ({
          generateImage: async () => ({ b64: '' }),
          editImage: async () => ({ b64: '' })
        }) as never,
      () => ({ aspectRatio: '16:9' })
    )
    expect(svc).toBeTruthy()
  })
})
