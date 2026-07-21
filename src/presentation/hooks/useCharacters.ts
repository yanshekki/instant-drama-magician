import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { sortByUpdatedAtDesc } from '../lib/librarySort'
import type {
  CreateCharacterInput,
  Character,
  UpdateCharacterInput
} from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

/**
 * Global character library. When activeStoryId is set, also loads
 * which IDs are linked to that story (cast).
 */
export function useCharacters(activeStoryId: string | null): {
  items: Character[]
  linkedIds: Set<string>
  loading: boolean
  error: AppErrorBody | null
  reload: () => Promise<void>
  create: (
    input: Omit<CreateCharacterInput, 'storyId'> & { linkStoryId?: string | null }
  ) => Promise<boolean>
  update: (id: string, data: UpdateCharacterInput) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  link: (characterId: string) => Promise<boolean>
  unlink: (characterId: string) => Promise<boolean>
} {
  const [items, setItems] = useState<Character[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppErrorBody | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = (await getApi().characters.list()) as Character[]
      setItems(sortByUpdatedAtDesc(list))
      if (activeStoryId) {
        const cast = (await getApi().characters.list({
          storyId: activeStoryId,
          forStory: true
        })) as Character[]
        setLinkedIds(new Set(cast.map((c) => c.id)))
      } else {
        setLinkedIds(new Set())
      }
    } catch (e) {
      setError(parseIpcError(e))
    } finally {
      setLoading(false)
    }
  }, [activeStoryId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (
      input: Omit<CreateCharacterInput, 'storyId'> & {
        linkStoryId?: string | null
      }
    ): Promise<boolean> => {
      try {
        await getApi().characters.create({
          ...input,
          linkStoryId: input.linkStoryId ?? activeStoryId
        })
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [activeStoryId, reload]
  )

  const update = useCallback(
    async (id: string, data: UpdateCharacterInput): Promise<boolean> => {
      try {
        await getApi().characters.update(id, data)
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [reload]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await getApi().characters.delete(id)
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [reload]
  )

  const link = useCallback(
    async (characterId: string): Promise<boolean> => {
      if (!activeStoryId) return false
      try {
        await getApi().stories.linkCharacter({
          storyId: activeStoryId,
          characterId
        })
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [activeStoryId, reload]
  )

  const unlink = useCallback(
    async (characterId: string): Promise<boolean> => {
      if (!activeStoryId) return false
      try {
        await getApi().stories.unlinkCharacter({
          storyId: activeStoryId,
          characterId
        })
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [activeStoryId, reload]
  )

  return {
    items,
    linkedIds,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    link,
    unlink
  }
}
