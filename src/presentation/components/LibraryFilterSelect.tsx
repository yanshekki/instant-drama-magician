/**
 * Shared select control for library page facets — fixed height, labeled, grid-friendly.
 */
import { libraryToolbar } from './libraryToolbar'

export const libraryFilterSelectClass = libraryToolbar.select

export type LibraryFilterOption = {
  value: string
  label: string
}

export function LibraryFilterSelect({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  className = ''
}: {
  value: string
  onChange: (v: string) => void
  options: LibraryFilterOption[]
  /** Visible label above the control (preferred). */
  label?: string
  ariaLabel?: string
  className?: string
}): JSX.Element {
  // Highlight only when a real facet is applied (options include empty "any")
  const hasAnyOption = options.some((o) => o.value === '')
  const active = hasAnyOption && Boolean(value)
  const a11y = ariaLabel ?? label ?? undefined

  return (
    <div className={['min-w-0', className].filter(Boolean).join(' ')}>
      {label ? (
        <span className={libraryToolbar.label} title={label}>
          {label}
        </span>
      ) : (
        /* Reserve label row when some filters have labels — parent grid stays aligned */
        <span className={libraryToolbar.label} aria-hidden>
          {'\u00a0'}
        </span>
      )}
      <div className="relative">
        <select
          className={[
            libraryToolbar.select,
            active ? libraryToolbar.selectActive : ''
          ]
            .filter(Boolean)
            .join(' ')}
          value={value}
          aria-label={a11y}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value || '__any__'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-ink-500"
          aria-hidden
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  )
}

/** Unique sorted non-empty string values from a list (for dynamic facet options). */
export function uniqueFacetValues(
  values: Array<string | null | undefined>,
  opts?: { emptyToken?: string; limit?: number }
): string[] {
  const emptyToken = opts?.emptyToken
  const limit = opts?.limit ?? 40
  const set = new Set<string>()
  for (const v of values) {
    const t = (v ?? '').trim()
    if (!t) {
      if (emptyToken) set.add(emptyToken)
      continue
    }
    set.add(t)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant')).slice(0, limit)
}
