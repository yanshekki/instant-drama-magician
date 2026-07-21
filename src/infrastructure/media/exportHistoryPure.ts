/**
 * Pure export-history merge helpers (MediaStore residual paths).
 */

export type ExportHistLike = {
  id: string
  fileName: string
  path: string
  workPath?: string | null
}

export function isWorkExportsPath(path: string, sep: string): boolean {
  return (
    path.includes(`${sep}exports${sep}`) || path.endsWith(`${sep}exports`)
  )
}

/** Prefer public path; attach workPath from work copy. */
export function mergeExportByName(
  prev: ExportHistLike,
  item: ExportHistLike,
  sep: string
): ExportHistLike {
  const prevIsWork = isWorkExportsPath(prev.path, sep)
  const curIsWork = isWorkExportsPath(item.path, sep)
  if (prevIsWork && !curIsWork) {
    return {
      ...item,
      workPath: item.workPath || prev.path,
      id: prev.id
    }
  }
  if (!prev.workPath && (item.workPath || curIsWork)) {
    return {
      ...prev,
      workPath: item.workPath || item.path
    }
  }
  return prev
}
