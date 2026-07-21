import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { sortByUpdatedAtDesc } from '../lib/librarySort'
import type {
  Action,
  CreateActionInput,
  UpdateActionInput
} from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

export function useActions(activeStoryId: string | null): {
  items: Action[]
  loading: boolean
  error: AppErrorBody | null
  reload: () => Promise<void>
  create: (
    input: Omit<CreateActionInput, 'storyId'> & { linkStoryId?: string | null }
  ) => Promise<boolean>
  update: (id: string, data: UpdateActionInput) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
} {
  const [items, setItems] = useState<Action[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppErrorBody | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = (await getApi().actions.list()) as Action[]
      // Always newest-first (server orderBy + client re-sort after IPC/JSON).
      setItems(sortByUpdatedAtDesc(list))
    } catch (e) {
      setError(parseIpcError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (
      input: Omit<CreateActionInput, 'storyId'> & { linkStoryId?: string | null }
    ): Promise<boolean> => {
      try {
        await getApi().actions.create({
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
    async (id: string, data: UpdateActionInput): Promise<boolean> => {
      try {
        await getApi().actions.update(id, data)
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
        await getApi().actions.delete(id)
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
