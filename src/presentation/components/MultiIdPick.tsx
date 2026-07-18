/**
 * Multi-select chip picker for story cast (characters / scenes / props).
 */
interface Option {
  id: string
  label: string
}

interface MultiIdPickProps {
  /** Omit when wrapped in EditorField (avoids double labels). */
  label?: string
  options: Option[]
  value: string[]
  max?: number
  emptyLabel?: string
  onChange: (ids: string[]) => void
}

export function MultiIdPick({
  label,
  options,
  value,
  max = 4,
  emptyLabel = '—',
  onChange
}: MultiIdPickProps): JSX.Element {
  const selected = new Set(value)
  const toggle = (id: string): void => {
    if (selected.has(id)) {
      onChange(value.filter((x) => x !== id))
      return
    }
    if (value.length >= max) return
    onChange([...value, id])
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <span className="text-[11px] font-medium text-ink-400">{label}</span>
        ) : (
          <span />
        )}
        <span className="text-[10px] text-ink-600">
          {value.length}/{max}
        </span>
      </div>
      {options.length === 0 ? (
        <p className="text-[11px] text-ink-600">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = selected.has(o.id)
            const disabled = !on && value.length >= max
            return (
              <button
                key={o.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(o.id)}
                className={[
                  'rounded-full border px-2.5 py-1 text-left text-[11px] transition',
                  on
                    ? 'border-brand-500 bg-brand-950/50 text-brand-100'
                    : disabled
                      ? 'cursor-not-allowed border-ink-800 bg-ink-950/40 text-ink-600'
                      : 'border-ink-700 bg-ink-900/60 text-ink-200 hover:border-ink-500'
                ].join(' ')}
              >
                {on ? '✓ ' : ''}
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
