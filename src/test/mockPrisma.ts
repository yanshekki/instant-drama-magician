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
  timelineEntry?: Row | Row[] | null
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

  const timelineEntry = chainable(
    Array.isArray(seed?.timelineEntry)
      ? seed?.timelineEntry
      : seed?.timelineEntry
        ? [seed.timelineEntry]
        : []
  )

  const storyCharacter = chainable([])
  const storyScene = chainable([])
  const storyProp = chainable([])
  const costumeCharacter = chainable([])

  return {
    story,
    character,
    scene,
    prop,
    costume,
    timelineEntry,
    storyCharacter,
    storyScene,
    storyProp,
    costumeCharacter,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      if (typeof fn === 'function') {
        return fn({
          story,
          character,
          scene,
          prop,
          costume,
          timelineEntry,
          storyCharacter,
          storyScene,
          storyProp,
          costumeCharacter
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
