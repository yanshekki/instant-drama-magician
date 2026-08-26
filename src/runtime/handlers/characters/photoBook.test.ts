import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersPhotoBook } from './photoBook'

vi.mock('../../../infrastructure/ffmpeg/FfmpegService', () => {
  class FfmpegService {
    stitchStillsSlideshow = vi.fn(async (opts: { outputPath: string }) => {
      writeFileSync(opts.outputPath, 'mp4')
      return opts.outputPath
    })
    exportConcat = vi.fn(async (opts: { outDir: string; fileName: string }) => {
      const out = join(opts.outDir, opts.fileName)
      writeFileSync(out, 'mp4')
      return out
    })
  }
  return { FfmpegService }
})

describe('registerCharactersPhotoBook', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers the channel and validates stills', async () => {
    const ctx = makeHandlerContext({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              photoBook: { shots: [{ id: 's1', sceneId: 'sc1', propIds: [] }] }
            })
          }))
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('characters:renderPhotoBook')).toBe(true)
    await expect(
      invokeRegistered(h as never, 'characters:renderPhotoBook', {
        characterId: 'c1',
        mode: 'slideshow'
      })
    ).rejects.toMatchObject({ message: 'errors.photoBookNeedStill' })
  })

  it('slideshow stitches stills and writes profileJson.photoBook', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 'png')
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              costumeKit: { base: 'keep' },
              photoBook: {
                shots: [
                  {
                    id: 's1',
                    sceneId: 'sc1',
                    propIds: [],
                    stillPath: still
                  }
                ]
              }
            })
          })),
          update
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: (_id: string, kind: string) =>
              join(dir!, `${kind}.mp4`)
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:renderPhotoBook', {
      characterId: 'c1',
      mode: 'slideshow'
    })) as { path: string; videoMode: string; photoBook: { albums: Array<{ videoPath?: string; videoMode?: string }> } }
    expect(r.videoMode).toBe('slideshow')
    expect(r.path).toContain('photoshoot.mp4')
    expect(update).toHaveBeenCalled()
    const saved = JSON.parse(
      (update.mock.calls[0]![1] as { profileJson: string }).profileJson
    ) as {
      costumeKit: unknown
      photoBook: { albums: Array<{ videoMode: string }> }
    }
    expect(saved.costumeKit).toEqual({ base: 'keep' })
    expect(saved.photoBook.albums[0]?.videoMode).toBe('slideshow')
  })

  it('ai-clips generates per still then concats', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb2-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 'png')
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const chat = vi.fn(async () => ({
      choices: [
        {
          message: {
            content:
              'POLISHED PHOTO BOOK CLIP PROMPT WITH ENOUGH CHARACTERS HERE'
          }
        }
      ]
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            description: 'detective',
            profileJson: JSON.stringify({
              photoBook: {
                shots: [
                  {
                    id: 's1',
                    sceneId: 'sc1',
                    propIds: [],
                    stillPath: still
                  }
                ]
              }
            })
          })),
          update
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: (_id: string, kind: string) =>
              join(dir!, `${kind}-${Math.random().toString(36).slice(2, 6)}.mp4`)
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    ctx.rebindAi({ aspectRatio: '1:1' })
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:renderPhotoBook', {
      characterId: 'c1',
      mode: 'ai-clips',
      durationSeconds: 4
    })) as {
      videoMode: string
      photoBook: { albums: Array<{ shots: Array<{ clipPath?: string }> }> }
    }
    expect(r.videoMode).toBe('ai-clips')
    expect(generateVideo).toHaveBeenCalled()
    expect(r.photoBook.albums[0]?.shots[0]?.clipPath).toBeTruthy()
  })

  it('ai-clips injects introTemplateId into polish user content', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-tpl-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 'png')
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const chat = vi.fn(async () => ({
      choices: [
        {
          message: {
            content:
              'POLISHED PHOTO BOOK CLIP PROMPT WITH ENOUGH CHARACTERS HERE'
          }
        }
      ]
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            description: 'detective',
            profileJson: JSON.stringify({
              photoBook: {
                shots: [
                  {
                    id: 's1',
                    sceneId: 'sc1',
                    propIds: [],
                    stillPath: still
                  }
                ]
              }
            })
          })),
          update
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: (_id: string, kind: string) =>
              join(dir!, `${kind}-${Math.random().toString(36).slice(2, 6)}.mp4`)
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h as never, 'characters:renderPhotoBook', {
      characterId: 'c1',
      mode: 'ai-clips',
      introTemplateId: 'hero-walkin',
      locale: 'en'
    })
    expect(chat).toHaveBeenCalled()
    const user = (chat.mock.calls[0]![0] as { messages: Array<{ content: string }> })
      .messages[1]?.content
    expect(user).toContain('hero-walkin')
    expect(user).toMatch(/Hero walk-in/i)
  })

  it('concatOnly stitches existing clipPath files without generateVideo', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-concat-'))
    const still = join(dir, 's.png')
    const clip = join(dir, 'c.mp4')
    writeFileSync(still, 'png')
    writeFileSync(clip, 'mp4')
    const generateVideo = vi.fn()
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      aiClient: { generateVideo, chat: vi.fn() },
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              photoBook: {
                shots: [
                  {
                    id: 's1',
                    sceneId: 'sc1',
                    propIds: [],
                    stillPath: still,
                    clipPath: clip
                  }
                ]
              }
            })
          })),
          update
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: (_id: string, kind: string) =>
              join(dir!, `${kind}.mp4`)
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:renderPhotoBook', {
      characterId: 'c1',
      mode: 'ai-clips',
      concatOnly: true
    })) as { path: string; videoMode: string; photoBook: { albums: Array<{ videoPath?: string }> } }
    expect(generateVideo).not.toHaveBeenCalled()
    expect(r.videoMode).toBe('ai-clips')
    expect(r.path).toContain('photoshoot.mp4')
    expect(r.photoBook.albums[0]?.videoPath).toBe(r.path)
  })

  it('concatOnly requires clipPath on selected shots', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-concat-miss-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 'png')
    const ctx = makeHandlerContext({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              photoBook: {
                shots: [
                  {
                    id: 's1',
                    sceneId: 'sc1',
                    propIds: [],
                    stillPath: still
                  }
                ]
              }
            })
          }))
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: () => join(dir!, 'x.mp4')
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:renderPhotoBook', {
        characterId: 'c1',
        mode: 'ai-clips',
        concatOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.photoBookNeedClip' })
  })

  it('ai-clips requires video capability', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb3-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 'png')
    const ctx = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat: vi.fn() },
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              photoBook: {
                shots: [
                  { id: 's1', sceneId: 'sc1', propIds: [], stillPath: still }
                ]
              }
            })
          }))
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: () => join(dir!, 'x.mp4')
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:renderPhotoBook', {
        characterId: 'c1',
        mode: 'ai-clips'
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })
  })

  it('concatOnly with albumId writes film onto that album only', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-album-'))
    const still = join(dir, 's.png')
    const clip = join(dir, 'c.mp4')
    writeFileSync(still, 'png')
    writeFileSync(clip, 'mp4')
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              photoBook: {
                albums: [
                  {
                    id: 'album_default',
                    name: '',
                    shots: []
                  },
                  {
                    id: 'pba_night',
                    name: 'Night',
                    shots: [
                      {
                        id: 's1',
                        sceneId: 'sc1',
                        propIds: [],
                        stillPath: still,
                        clipPath: clip,
                        cameraTemplateId: 'low-angle-hero'
                      }
                    ]
                  }
                ]
              }
            })
          })),
          update
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: (_id: string, kind: string) =>
              join(dir!, `${kind}.mp4`)
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:renderPhotoBook', {
      characterId: 'c1',
      mode: 'ai-clips',
      concatOnly: true,
      albumId: 'pba_night'
    })) as {
      path: string
      photoBook: {
        albums: Array<{ id: string; videoPath?: string; shots: Array<{ clipPath?: string }> }>
      }
    }
    const night = r.photoBook.albums.find((a) => a.id === 'pba_night')
    const def = r.photoBook.albums.find((a) => a.id === 'album_default')
    expect(night?.videoPath).toBe(r.path)
    expect(def?.videoPath).toBeUndefined()
    expect(night?.shots[0]?.clipPath).toBe(clip)
  })

  it('requires characterId and honors durationSeconds', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-dur-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 'png')
    const ctx = makeHandlerContext({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            profileJson: JSON.stringify({
              photoBook: {
                shots: [
                  { id: 's1', sceneId: 'sc1', propIds: [], stillPath: still }
                ]
              }
            })
          })),
          update: vi.fn(async (id: string, data: unknown) => ({
            id,
            ...(data as object)
          }))
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: () => join(dir!, 'book.mp4')
          })
        }) as never
    })
    registerCharactersPhotoBook(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:renderPhotoBook', {
        mode: 'slideshow'
      })
    ).rejects.toMatchObject({ message: 'errors.characterIdRequired' })
    ctx.rebindAi({ aspectRatio: '1:1' })
    const r = (await invokeRegistered(h as never, 'characters:renderPhotoBook', {
      characterId: 'c1',
      mode: 'slideshow',
      durationSeconds: 1
    })) as { path: string }
    expect(r.path).toContain('.mp4')
  })
})
