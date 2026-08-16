/**
 * Lightweight PrismaClient mock for service unit tests.
 */
import { vi } from 'vitest'

type Row = Record<string, unknown>

function chainable(result: unknown = []) {
  const p = Promise.resolve(result)
  const api: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p)
  }
  for (const m of [
    'findMany',
    'findUnique',
    'findFirst',
    'create',
    'update',
    'delete',
    'deleteMany',
    'updateMany',
    'count',
    'upsert',
    'createMany',
    'aggregate'
  ]) {
    api[m] = vi.fn().mockResolvedValue(
      m === 'aggregate' ? { _max: { sortOrder: 0 }, _count: 0 } : result
    )
  }
  return api
}

export function createMockPrisma(seed?: {
  story?: Row | Row[] | null
  character?: Row | Row[] | null
  scene?: Row | Row[] | null
  prop?: Row | Row[] | null
  costume?: Row | Row[] | null
  action?: Row | Row[] | null
  timelineEntry?: Row | Row[] | null
  chapter?: Row | Row[] | null
  comic?: Row | Row[] | null
  comicPage?: Row | Row[] | null
  keyArt?: Row | Row[] | null
  keyArtShot?: Row | Row[] | null
}) {
  const story = chainable(
    Array.isArray(seed?.story) ? seed?.story : seed?.story ? [seed.story] : []
  )
  if (seed?.story && !Array.isArray(seed.story)) {
    ;(story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(seed.story)
    ;(story.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(seed.story)
  } else {
    ;(story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const character = chainable(
    Array.isArray(seed?.character)
      ? seed?.character
      : seed?.character
        ? [seed.character]
        : []
  )
  if (seed?.character && !Array.isArray(seed.character)) {
    ;(character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.character
    )
  } else {
    ;(character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const scene = chainable(
    Array.isArray(seed?.scene) ? seed?.scene : seed?.scene ? [seed.scene] : []
  )
  if (seed?.scene && !Array.isArray(seed.scene)) {
    ;(scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(seed.scene)
  } else {
    ;(scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const prop = chainable(
    Array.isArray(seed?.prop) ? seed?.prop : seed?.prop ? [seed.prop] : []
  )
  if (seed?.prop && !Array.isArray(seed.prop)) {
    ;(prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(seed.prop)
  } else {
    ;(prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const costume = chainable(
    Array.isArray(seed?.costume)
      ? seed?.costume
      : seed?.costume
        ? [seed.costume]
        : []
  )
  if (seed?.costume && !Array.isArray(seed.costume)) {
    ;(costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.costume
    )
  } else {
    ;(costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const action = chainable(
    Array.isArray(seed?.action)
      ? seed?.action
      : seed?.action
        ? [seed.action]
        : []
  )
  if (seed?.action && !Array.isArray(seed.action)) {
    ;(action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.action
    )
  } else {
    ;(action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const timelineEntry = chainable(
    Array.isArray(seed?.timelineEntry)
      ? seed?.timelineEntry
      : seed?.timelineEntry
        ? [seed.timelineEntry]
        : []
  )

  const chapter = chainable(
    Array.isArray(seed?.chapter) ? seed?.chapter : seed?.chapter ? [seed.chapter] : []
  )
  if (seed?.chapter && !Array.isArray(seed.chapter)) {
    ;(chapter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.chapter
    )
  } else {
    ;(chapter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const comic = chainable(
    Array.isArray(seed?.comic) ? seed?.comic : seed?.comic ? [seed.comic] : []
  )
  if (seed?.comic && !Array.isArray(seed.comic)) {
    ;(comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(seed.comic)
  } else {
    ;(comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const comicPage = chainable(
    Array.isArray(seed?.comicPage)
      ? seed?.comicPage
      : seed?.comicPage
        ? [seed.comicPage]
        : []
  )
  if (seed?.comicPage && !Array.isArray(seed.comicPage)) {
    ;(comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.comicPage
    )
  } else {
    ;(comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const keyArt = chainable(
    Array.isArray(seed?.keyArt)
      ? seed?.keyArt
      : seed?.keyArt
        ? [seed.keyArt]
        : []
  )
  if (seed?.keyArt && !Array.isArray(seed.keyArt)) {
    ;(keyArt.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.keyArt
    )
  } else {
    ;(keyArt.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const keyArtShot = chainable(
    Array.isArray(seed?.keyArtShot)
      ? seed?.keyArtShot
      : seed?.keyArtShot
        ? [seed.keyArtShot]
        : []
  )
  if (seed?.keyArtShot && !Array.isArray(seed.keyArtShot)) {
    ;(keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      seed.keyArtShot
    )
  } else {
    ;(keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  }

  const storyCharacter = chainable([])
  const storyScene = chainable([])
  const storyProp = chainable([])
  const storyAction = chainable([])
  const costumeCharacter = chainable([])
  const characterCostume = chainable([])

  return {
    story,
    character,
    scene,
    prop,
    costume,
    action,
    timelineEntry,
    chapter,
    comic,
    comicPage,
    keyArt,
    keyArtShot,
    storyCharacter,
    storyScene,
    storyProp,
    storyAction,
    costumeCharacter,
    characterCostume,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      if (typeof fn === 'function') {
        return fn({
          story,
          character,
          scene,
          prop,
          costume,
          action,
          timelineEntry,
          chapter,
          comic,
          comicPage,
          keyArt,
          keyArtShot,
          storyCharacter,
          storyScene,
          storyProp,
          storyAction,
          costumeCharacter,
          characterCostume
        })
      }
      return fn
    }),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $connect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }])
  }
}

export type MockPrisma = ReturnType<typeof createMockPrisma>
