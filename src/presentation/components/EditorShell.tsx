import type { ReactNode, SelectHTMLAttributes } from 'react'
import { Button } from './ui'

export type EditorShellTab = {
  id: string
  label: string
}

/**
 * Canonical right-drawer dimensions — single source of truth for all pages.
 * Do not override per-page width/height.
 */
export const EDITOR_SHELL_WIDTH =
  'w-full max-w-[min(72rem,100vw)]' /* ≈ max-w-6xl, fixed */
export const EDITOR_SHELL_HEIGHT = 'h-full' /* full viewport stretch */
/** Form column inside the shell (all tabs / all pages). */
export const editorFormClass = 'mx-auto w-full max-w-2xl space-y-5'
/** Slightly wider for cast browsers / dense lists still inside same shell. */
export const editorFormWideClass = 'mx-auto w-full max-w-3xl space-y-4'
/** Preview column (left of form when split). */
export const EDITOR_PREVIEW_ASIDE =
  'flex max-h-[42vh] shrink-0 flex-col border-b border-ink-800 bg-ink-950/80 lg:max-h-none lg:w-[28rem] lg:shrink-0 lg:border-b-0 lg:border-r'

/**
 * Wide side-panel editor shell: sticky header/footer, optional tabs,
 * optional split layout (preview | form). Fixed size site-wide.
 */
export function EditorShell({
  open,
  title,
  subtitle,
  onClose,
  onSave,
  saveDisabled,
  saveLabel,
  cancelLabel,
  busy,
  tabs,
  activeTab,
  onTabChange,
  preview,
  children
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onSave: () => void
  saveDisabled?: boolean
  saveLabel: string
  cancelLabel: string
  busy?: boolean
  tabs?: EditorShellTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  /** Left column (gallery preview). When set, body becomes two-column. */
  preview?: ReactNode
  children: ReactNode
  /**
   * @deprecated Ignored — shell width is global. Kept optional so old call sites typecheck until cleaned.
   */
  maxWidthClass?: string
}): JSX.Element | null {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-overlay/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default max-md:hidden"
        aria-label={cancelLabel}
        onClick={onClose}
      />
      <div
        className={[
          'relative flex flex-col bg-ink-950 shadow-2xl',
          'border-l border-ink-800 max-md:border-l-0',
          'max-md:w-full max-md:max-w-none',
          'pb-[env(safe-area-inset-bottom,0px)]',
          EDITOR_SHELL_HEIGHT,
          EDITOR_SHELL_WIDTH
        ].join(' ')}
      >
        {/* Sticky header */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-800 px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink-50">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-ink-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
            onClick={onClose}
            aria-label={cancelLabel}
          >
            ✕
          </button>
        </header>

        {/* Tabs */}
        {tabs && tabs.length > 0 && onTabChange && activeTab ? (
          <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ink-800/80 px-3 sm:px-5">
            {tabs.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={[
                    'relative shrink-0 px-3.5 py-2.5 text-sm font-medium transition',
                    active
                      ? 'text-brand-200'
                      : 'text-ink-400 hover:text-ink-200'
                  ].join(' ')}
                  onClick={() => onTabChange(tab.id)}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" />
                  ) : null}
                </button>
              )
            })}
          </nav>
        ) : null}

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {preview ? (
            <aside className={EDITOR_PREVIEW_ASIDE}>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {preview}
              </div>
            </aside>
          ) : null}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>
        </div>

        {/* Sticky footer — full-width actions on phone */}
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-ink-800 bg-ink-950/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-3.5">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            loading={busy}
            disabled={saveDisabled || busy}
            onClick={onSave}
            className="w-full min-w-[7rem] sm:w-auto"
          >
            {saveLabel}
          </Button>
        </footer>
      </div>
    </div>
  )
}

/** Compact field label + control block */
export function EditorField({
  label,
  hint,
  children,
  className = ''
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-ink-400">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

/** Select with editor styling */
export function EditorSelect({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      className={[
        'w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </select>
  )
}
