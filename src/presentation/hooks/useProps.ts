import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type {
  CreatePropInput,
  Prop,
  UpdatePropInput
} from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

export function useProps(activeStoryId: string | null): {
  items: Prop[]
  linkedIds: Set<string>
  loading: boolean
  error: AppErrorBody | null
  reload: () => Promise<void>
  create: (
    input: Omit<CreatePropInput, 'storyId'> & { linkStoryId?: string | null }
  ) => Promise<boolean>
  update: (id: string, data: UpdatePropInput) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  link: (propId: string) => Promise<boolean>
  unlink: (propId: string) => Promise<boolean>
} {
  const [items, setItems] = useState<Prop[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppErrorBody | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = (await getApi().props.list()) as Prop[]
      setItems(list)
      if (activeStoryId) {
        const cast = (await getApi().props.list({
          storyId: activeStoryId,
          forStory: true
        })) as Prop[]
        setLinkedIds(new Set(cast.map((p) => p.id)))
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
      input: Omit<CreatePropInput, 'storyId'> & { linkStoryId?: string | null }
    ): Promise<boolean> => {
      try {
        await getApi().props.create({
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
    async (id: string, data: UpdatePropInput): Promise<boolean> => {
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

  const link = useCallback(
    async (propId: string): Promise<boolean> => {
      if (!activeStoryId) return false
      try {
        await getApi().stories.linkProp({ storyId: activeStoryId, propId })
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
    async (propId: string): Promise<boolean> => {
      if (!activeStoryId) return false
      try {
        await getApi().stories.unlinkProp({ storyId: activeStoryId, propId })
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
