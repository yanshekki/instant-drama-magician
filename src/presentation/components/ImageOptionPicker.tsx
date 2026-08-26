import { useEffect, useRef, useState } from 'react'
import { getApi } from '../../lib/api'

export type ImageOptionPickerItem = {
  id: string
  filePath: string
  label: string
}

function OptionThumb({
  filePath,
  sizeClass = 'h-10 w-10'
}: {
  filePath: string
  sizeClass?: string
}): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const preview = getApi().media.toPreviewUrl?.(filePath)
    void Promise.resolve(preview)
      .then((r) => {
        if (!cancelled && r?.url) setUrl(r.url)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [filePath])
  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-900`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-500">
          …
        </div>
      )}
    </div>
  )
}

export function ImageOptionPicker({
  value,
  options,
  onChange,
  disabled,
  ariaLabel
}: {
  value: string
  options: ImageOptionPickerItem[]
  onChange: (id: string) => void
  disabled?: boolean
  ariaLabel: string
}): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected =
    options.find((o) => o.id === value) ?? options[0] ?? null

  useEffect(() => {
    if (!open) return
    const onDoc = (ev: Event): void => {
      const el = rootRef.current
      if (el && ev.target instanceof Node && !el.contains(ev.target)) {
        setOpen(false)
      }
    }
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  if (!selected) return null

  return (
    <div
      ref={rootRef}
      className="relative mt-2"
      data-testid="image-option-picker"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-left text-[12px] text-ink-100 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || !open) return
          e.stopPropagation()
          setOpen(false)
        }}
      >
        <OptionThumb filePath={selected.filePath} />
        <span className="min-w-0 flex-1 truncate">{selected.label}</span>
        <span className="shrink-0 text-ink-500" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-ink-700 bg-ink-950 py-1 shadow-theme-md"
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            setOpen(false)
          }}
        >
          {options.map((o) => {
            const active = o.id === selected.id
            return (
              <li key={o.id} className="px-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-option-id={o.id}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] ${
                    active
                      ? 'bg-brand-950/50 text-ink-50'
                      : 'text-ink-100 hover:bg-ink-900'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(o.id)
                    setOpen(false)
                  }}
                >
                  <OptionThumb filePath={o.filePath} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
