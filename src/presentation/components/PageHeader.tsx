import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/**
 * Shared tokens for every page's top-right tools.
 * Fixed 40px controls match library toolbars so all pages feel consistent.
 */
export const pageHeaderActionsClass = [
  'flex w-full max-w-full shrink-0 flex-wrap items-center justify-stretch gap-2 sm:ml-auto sm:w-auto sm:justify-end',
  /* Normalize nested Button / Select / native controls in the actions slot */
  '[&_button]:!h-10 [&_button]:!min-h-10 [&_button]:!min-w-0 [&_button]:!flex-1 sm:[&_button]:!flex-initial',
  '[&_button]:!px-3 [&_button]:!py-0 [&_button]:!text-sm [&_button]:!leading-none sm:[&_button]:!px-3.5',
  '[&_select]:!h-10 [&_select]:!min-h-10 [&_select]:!min-w-0 [&_select]:!flex-1 sm:[&_select]:!flex-initial [&_select]:!py-0 [&_select]:!text-sm',
  '[&_a]:!h-10 [&_a]:!min-h-10 [&_a]:inline-flex [&_a]:items-center'
].join(' ')

/** Shared header chrome: one row from sm up (title left, tools right). */
export const pageHeaderClass = [
  'flex shrink-0 flex-col gap-2 border-b border-ink-800',
  'px-3 py-3 sm:px-6 sm:py-3.5 md:px-8',
  'sm:flex-row sm:items-center sm:justify-between sm:gap-4'
].join(' ')

/**
 * Title + subtitle on the left; actions sit on the same row from `sm`.
 * Phone still stacks so a long toolbar cannot crush the title.
 */
export function PageHeader({
  title,
  subtitle,
  actions
}: PageHeaderProps): JSX.Element {
  return (
    <header className={pageHeaderClass}>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight text-ink-50 sm:text-xl md:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-400 sm:line-clamp-none sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className={pageHeaderActionsClass}>{actions}</div> : null}
    </header>
  )
}
