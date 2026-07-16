import { useCallback, useRef, useState } from 'react'
import type { TimelineEntry } from '../../types/domain'

const MAX = 50

/**
 * Lightweight undo/redo snapshots of timeline entry lists (client-side).
 * Call `push(entries)` after successful mutations; undo restores previous snapshot
 * and invokes `onRestore` so caller can persist (optional) or re-render.
 */
export function useTimelineHistory(): {
  canUndo: boolean
  canRedo: boolean
  push: (entries: TimelineEntry[]) => void
  undo: () => TimelineEntry[] | null
  redo: () => TimelineEntry[] | null
  clear: () => void
} {
  const past = useRef<TimelineEntry[][]>([])
  const future = useRef<TimelineEntry[][]>([])
  const [, bump] = useState(0)
  const refresh = (): void => bump((n) => n + 1)

  const push = useCallback((entries: TimelineEntry[]) => {
    past.current.push(structuredClone(entries))
    if (past.current.length > MAX) past.current.shift()
    future.current = []
    refresh()
  }, [])

  const undo = useCallback((): TimelineEntry[] | null => {
    const prev = past.current.pop()
    if (!prev) return null
    future.current.push(prev)
    const older = past.current[past.current.length - 1]
    refresh()
    return older ? structuredClone(older) : []
  }, [])

  const redo = useCallback((): TimelineEntry[] | null => {
    const next = future.current.pop()
    if (!next) return null
    past.current.push(next)
    refresh()
    return structuredClone(next)
  }, [])

  const clear = useCallback((): void => {
    past.current = []
    future.current = []
    refresh()
  }, [])

  return {
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    push,
    undo,
    redo,
    clear
  }
}
