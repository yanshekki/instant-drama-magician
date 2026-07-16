import { useCallback, useRef, useState } from 'react'
import type { TimelineEntry, UpdateTimelineEntryInput } from '../../types/domain'
import { getApi } from '../../lib/api'

const MAX = 50

type TimelineCommand =
  | {
      type: 'update'
      id: string
      before: UpdateTimelineEntryInput
      after: UpdateTimelineEntryInput
    }
  | {
      type: 'delete'
      entry: TimelineEntry
    }
  | {
      type: 'create'
      entry: TimelineEntry
    }

/**
 * Persistent undo/redo for timeline mutations (replays IPC updates).
 */
export function useTimelineHistory(): {
  canUndo: boolean
  canRedo: boolean
  recordUpdate: (
    id: string,
    before: UpdateTimelineEntryInput,
    after: UpdateTimelineEntryInput
  ) => void
  recordDelete: (entry: TimelineEntry) => void
  recordCreate: (entry: TimelineEntry) => void
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  clear: () => void
} {
  const past = useRef<TimelineCommand[]>([])
  const future = useRef<TimelineCommand[]>([])
  const [, bump] = useState(0)
  const refresh = (): void => bump((n) => n + 1)

  const recordUpdate = useCallback(
    (id: string, before: UpdateTimelineEntryInput, after: UpdateTimelineEntryInput) => {
      past.current.push({ type: 'update', id, before, after })
      if (past.current.length > MAX) past.current.shift()
      future.current = []
      refresh()
    },
    []
  )

  const recordDelete = useCallback((entry: TimelineEntry) => {
    past.current.push({ type: 'delete', entry })
    if (past.current.length > MAX) past.current.shift()
    future.current = []
    refresh()
  }, [])

  const recordCreate = useCallback((entry: TimelineEntry) => {
    past.current.push({ type: 'create', entry })
    if (past.current.length > MAX) past.current.shift()
    future.current = []
    refresh()
  }, [])

  const applyInverse = async (cmd: TimelineCommand): Promise<void> => {
    const api = getApi()
    if (cmd.type === 'update') {
      await api.timeline.update(cmd.id, cmd.before)
      return
    }
    if (cmd.type === 'delete') {
      const e = cmd.entry
      await api.timeline.create({
        storyId: e.storyId,
        startTime: e.startTime,
        endTime: e.endTime,
        characterId: e.characterId,
        sceneId: e.sceneId,
        propId: e.propId,
        dialogue: e.dialogue,
        order: e.order
      })
      return
    }
    // create → delete by matching is hard without id stability; store id on create
    await api.timeline.delete(cmd.entry.id)
  }

  const applyForward = async (cmd: TimelineCommand): Promise<void> => {
    const api = getApi()
    if (cmd.type === 'update') {
      await api.timeline.update(cmd.id, cmd.after)
      return
    }
    if (cmd.type === 'delete') {
      await api.timeline.delete(cmd.entry.id)
      return
    }
    const e = cmd.entry
    await api.timeline.create({
      storyId: e.storyId,
      startTime: e.startTime,
      endTime: e.endTime,
      characterId: e.characterId,
      sceneId: e.sceneId,
      propId: e.propId,
      dialogue: e.dialogue,
      order: e.order
    })
  }

  const undo = useCallback(async (): Promise<boolean> => {
    const cmd = past.current.pop()
    if (!cmd) return false
    await applyInverse(cmd)
    future.current.push(cmd)
    refresh()
    return true
  }, [])

  const redo = useCallback(async (): Promise<boolean> => {
    const cmd = future.current.pop()
    if (!cmd) return false
    await applyForward(cmd)
    past.current.push(cmd)
    refresh()
    return true
  }, [])

  const clear = useCallback((): void => {
    past.current = []
    future.current = []
    refresh()
  }, [])

  return {
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    recordUpdate,
    recordDelete,
    recordCreate,
    undo,
    redo,
    clear
  }
}
