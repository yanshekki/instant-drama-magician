import { useCallback, useEffect, useState } from 'react'
import { TimelineService } from '../../application/TimelineService'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type {
  CreateTimelineEntryInput,
  TimelineEntry,
  UpdateTimelineEntryInput
} from '../../types/domain'
import type { AppErrorBody } from '../../types/errors'

export function useTimeline(storyId: string | null): {
  entries: TimelineEntry[]
  loading: boolean
  error: AppErrorBody | null
  totalDuration: number
  reload: () => Promise<void>
  create: (input: Omit<CreateTimelineEntryInput, 'storyId'>) => Promise<boolean>
  update: (id: string, data: UpdateTimelineEntryInput) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  reorder: (orderedIds: string[]) => Promise<boolean>
} {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppErrorBody | null>(null)

  const reload = useCallback(async () => {
    if (!storyId) {
      setEntries([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = (await getApi().timeline.list(storyId)) as TimelineEntry[]
      setEntries(TimelineService.sort(list))
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
    async (input: Omit<CreateTimelineEntryInput, 'storyId'>): Promise<boolean> => {
      if (!storyId) return false
      try {
        await getApi().timeline.create({ ...input, storyId })
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
    async (id: string, data: UpdateTimelineEntryInput): Promise<boolean> => {
      try {
        await getApi().timeline.update(id, data)
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
        await getApi().timeline.delete(id)
        await reload()
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [reload]
  )

  const reorder = useCallback(
    async (orderedIds: string[]): Promise<boolean> => {
      if (!storyId) return false
      try {
        const list = (await getApi().timeline.reorder(
          storyId,
          orderedIds
        )) as TimelineEntry[]
        setEntries(TimelineService.sort(list))
        return true
      } catch (e) {
        setError(parseIpcError(e))
        return false
      }
    },
    [storyId]
  )

  return {
    entries,
    loading,
    error,
    totalDuration: TimelineService.totalDuration(entries),
    reload,
    create,
    update,
    remove,
    reorder
  }
}
