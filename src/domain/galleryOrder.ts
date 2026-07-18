/**
 * Generic gallery list reorder helpers (characters, scenes, props share the same shape).
 */

export function moveById<T extends { id: string }>(
  items: T[],
  fromId: string,
  toId: string
): T[] {
  if (fromId === toId) return items
  const from = items.findIndex((i) => i.id === fromId)
  const to = items.findIndex((i) => i.id === toId)
  if (from < 0 || to < 0 || from === to) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function shiftById<T extends { id: string }>(
  items: T[],
  id: string,
  delta: -1 | 1
): T[] {
  const from = items.findIndex((i) => i.id === id)
  if (from < 0) return items
  const to = from + delta
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Whether path is still in the gallery (cover validation). */
export function isCoverPathInList(
  items: Array<{ path: string }>,
  path: string | null | undefined
): boolean {
  if (!path) return false
  return items.some((i) => i.path === path)
}
