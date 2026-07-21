import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersCostumeSwap } from './costumeSwap'

describe('registerCharactersCostumeSwap', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersCostumeSwap(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:swapCostume')).toBe(true)
  })

  it('validates costume description and base image', async () => {
    const ctx = makeHandlerContext({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'A',
            refGalleryJson: null,
            refImagePath: null,
            refSheetPath: null
          }))
        }) as never
    })
    registerCharactersCostumeSwap(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:swapCostume', {
        characterId: 'c1',
        costumeDescription: '  '
      })
    ).rejects.toMatchObject({ message: 'errors.costumeDescRequired' })
    await expect(
      invokeRegistered(h as never, 'characters:swapCostume', {
        characterId: 'c1',
        costumeDescription: 'red coat'
      })
    ).rejects.toMatchObject({ message: 'errors.costumeSwapNoBase' })
  })

  it('swaps costume as draft with base image', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-swap-'))
    const base = join(dir, 'base.png')
    const out = join(dir, 'swap.png')
    writeFileSync(base, 'base')
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('SWAP').toString('base64'),
      sizeUsed: '1024x1024',
      aspectUsed: '1:1'
    }))
    const gallery = [
      {
        id: 'g1',
        path: base,
        kind: 'sheet',
        label: 'Bible sheet',
        createdAt: '2020-01-01',
        layer: 'costume'
      }
    ]
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      ageRange: '20s',
      appearance: 'short hair',
      artStyle: 'photo_cinematic',
      hardRules: null,
      refGalleryJson: JSON.stringify(gallery),
      refImagePath: base,
      refSheetPath: base
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { editImage, generateImage: vi.fn(), chat: vi.fn() },
      characters: () => ({ get, update }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => out,
            characterImagePath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: false,
        imageSizeSquare: '1024x1024',
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792'
      })
    })
    registerCharactersCostumeSwap(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:swapCostume', {
      characterId: 'c1',
      costumeDescription: 'yellow raincoat',
      baseImagePath: base,
      persist: false
    })) as { path?: string; draft?: boolean }
    expect(editImage).toHaveBeenCalled()
    expect(r.path || existsSync(out)).toBeTruthy()
  })
})
