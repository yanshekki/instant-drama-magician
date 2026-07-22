import { useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import {
  mobileSheetOuterClass,
  mobileSheetPanelClass,
  sheetBodyScrollClass,
  stickyFooterClass,
  galleryStripClass
} from '../lib/mobileLayout'
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
  'w-full max-w-[min(72rem,100vw)]' /* desktop max */
export const EDITOR_SHELL_HEIGHT = 'h-[100dvh] max-h-[100dvh] min-h-0'
/** Form column inside the shell (all tabs / all pages). */
export const editorFormClass = 'mx-auto w-full max-w-2xl space-y-5'
/** Slightly wider for cast browsers / dense lists still inside same shell. */
export const editorFormWideClass = 'mx-auto w-full max-w-3xl space-y-4'
/** Preview column — desktop only side rail. */
export const EDITOR_PREVIEW_ASIDE =
  'hidden min-h-0 w-[28rem] shrink-0 flex-col border-r border-ink-800 bg-ink-950/80 lg:flex'

/**
 * Wide side-panel editor shell.
 * Mobile: full-screen sheet, collapsible gallery strip, ONE form scroll axis,
 * sticky Save/Cancel footer — never dual-pane height fight.
 * Desktop (lg+): optional preview | form side-by-side.
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
  /** Gallery / media column. On mobile becomes collapsible strip. */
  preview?: ReactNode
  children: ReactNode
  /**
   * @deprecated Ignored — shell width is global.
   */
  maxWidthClass?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  /** Mobile gallery: collapsed by default so form is always reachable. */
  const [galleryOpen, setGalleryOpen] = useState(false)

  if (!open) return null

  const hasPreview = Boolean(preview)

  return (
    <div
      className={mobileSheetOuterClass}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop close — desktop only (mobile is full-screen) */}
      <button
        type="button"
        className="absolute inset-0 cursor-default max-lg:hidden"
        aria-label={cancelLabel}
        onClick={onClose}
      />
      <div
        className={[
          mobileSheetPanelClass,
          EDITOR_SHELL_WIDTH,
          EDITOR_SHELL_HEIGHT
        ].join(' ')}
      >
        {/* Sticky header */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-800 px-3 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold tracking-tight text-ink-50 sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-ink-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-lg text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 touch-manipulation"
            onClick={onClose}
            aria-label={cancelLabel}
          >
            ✕
          </button>
        </header>

        {/* Tabs */}
        {tabs && tabs.length > 0 && onTabChange && activeTab ? (
          <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ink-800/80 px-2 sm:px-5 [-webkit-overflow-scrolling:touch]">
            {tabs.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={[
                    'relative shrink-0 px-3 py-2.5 text-sm font-medium transition touch-manipulation min-h-11',
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
          {/* Desktop: side preview */}
          {hasPreview ? (
            <aside className={EDITOR_PREVIEW_ASIDE}>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                {preview}
              </div>
            </aside>
          ) : null}

          {/* Mobile: collapsible gallery strip (not a second competing flex-1 pane) */}
          {hasPreview ? (
            <div className={`${galleryStripClass} lg:hidden`}>
              <button
                type="button"
                className="flex w-full min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm touch-manipulation"
                onClick={() => setGalleryOpen((v) => !v)}
                aria-expanded={galleryOpen}
              >
                <span className="font-medium text-ink-200">
                  {t('editor.galleryToggle')}
                </span>
                <span className="text-xs text-ink-500">
                  {galleryOpen
                    ? t('editor.galleryCollapse')
                    : t('editor.galleryExpand')}
                </span>
              </button>
              {galleryOpen ? (
                <div className="max-h-[min(36vh,16rem)] overflow-y-auto overscroll-contain border-t border-ink-800/80 px-3 py-3">
                  {preview}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Single form scroll axis — always the primary flex-1 region */}
          <div className={sheetBodyScrollClass}>{children}</div>
        </div>

        {/* Sticky footer — always visible */}
        <footer className={stickyFooterClass}>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="w-full min-h-11 sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            loading={busy}
            disabled={saveDisabled || busy}
            onClick={onSave}
            className="w-full min-h-11 min-w-[7rem] sm:w-auto"
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
        'w-full min-h-11 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </select>
  )
}
