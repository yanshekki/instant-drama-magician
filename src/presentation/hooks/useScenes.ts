import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { sortByUpdatedAtDesc } from '../lib/librarySort'
import type {
  CreateSceneInput,
  Scene,
  UpdateSceneInput
} from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

export function useScenes(activeStoryId: string | null): {
  items: Scene[]
  linkedIds: Set<string>
  loading: boolean
  error: AppErrorBody | null
  reload: () => Promise<void>
  create: (
    input: Omit<CreateSceneInput, 'storyId'> & { linkStoryId?: string | null }
  ) => Promise<boolean>
  update: (id: string, data: UpdateSceneInput) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  link: (sceneId: string, sceneNumber?: number) => Promise<boolean>
  unlink: (sceneId: string) => Promise<boolean>
} {
  const [items, setItems] = useState<Scene[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppErrorBody | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = (await getApi().scenes.list()) as Scene[]
      setItems(sortByUpdatedAtDesc(list))
      if (activeStoryId) {
        const cast = (await getApi().scenes.list({
          storyId: activeStoryId,
          forStory: true
        })) as Scene[]
        setLinkedIds(new Set(cast.map((s) => s.id)))
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
      input: Omit<CreateSceneInput, 'storyId'> & { linkStoryId?: string | null }
    ): Promise<boolean> => {
      try {
        await getApi().scenes.create({
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
    async (id: string, data: UpdateSceneInput): Promise<boolean> => {
      try {
        await getApi().scenes.update(id, data)
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
        await getApi().scenes.delete(id)
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
    async (sceneId: string, sceneNumber?: number): Promise<boolean> => {
      if (!activeStoryId) return false
      try {
        await getApi().stories.linkScene({
          storyId: activeStoryId,
          sceneId,
          sceneNumber
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
    async (sceneId: string): Promise<boolean> => {
      if (!activeStoryId) return false
      try {
        await getApi().stories.unlinkScene({
          storyId: activeStoryId,
          sceneId
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
