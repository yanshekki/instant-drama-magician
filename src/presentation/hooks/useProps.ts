import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { CreatePropInput, Prop } from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

export function useProps(storyId: string | null): {
  items: Prop[]
  loading: boolean
  error: AppErrorBody | null
  reload: () => Promise<void>
  create: (input: Omit<CreatePropInput, 'storyId'>) => Promise<boolean>
  update: (
    id: string,
    data: Partial<Pick<CreatePropInput, 'name' | 'description'>>
  ) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
} {
  const [items, setItems] = useState<Prop[]>([])
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
      const list = (await getApi().props.list(storyId)) as Prop[]
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
    async (input: Omit<CreatePropInput, 'storyId'>): Promise<boolean> => {
      if (!storyId) return false
      try {
        await getApi().props.create({ ...input, storyId })
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
      data: Partial<Pick<CreatePropInput, 'name' | 'description'>>
    ): Promise<boolean> => {
      try {
        await getApi().props.update(id, data)
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
        await getApi().props.delete(id)
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
