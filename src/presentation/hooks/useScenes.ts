import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { CreateSceneInput, Scene } from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

export function useScenes(storyId: string | null): {
  items: Scene[]
  loading: boolean
  error: AppErrorBody | null
  reload: () => Promise<void>
  create: (input: Omit<CreateSceneInput, 'storyId'>) => Promise<boolean>
  update: (
    id: string,
    data: Partial<Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script' | 'status'>>
  ) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
} {
  const [items, setItems] = useState<Scene[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppErrorBody | null>(null)

  const reload = useCallback(async () => {
    if (!storyId) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = (await getApi().scenes.list(storyId)) as Scene[]
      setItems(list)
    } catch (e) {
      setError(parseIpcError(e))
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (input: Omit<CreateSceneInput, 'storyId'>): Promise<boolean> => {
      if (!storyId) return false
      try {
        await getApi().scenes.create({ ...input, storyId })
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [storyId, reload]
  )

  const update = useCallback(
    async (
      id: string,
      data: Partial<
        Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script' | 'status'>
      >
    ): Promise<boolean> => {
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

  return { items, loading, error, reload, create, update, remove }
}
