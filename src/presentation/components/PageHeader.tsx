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

/**
 * Title + subtitle; actions wrap below on phone so they never crush content height.
 */
export function PageHeader({
  title,
  subtitle,
  actions
}: PageHeaderProps): JSX.Element {
  return (
    <header className="flex shrink-0 flex-col gap-2.5 border-b border-ink-800 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 md:px-8 md:py-5">
      <div className="min-w-0 max-w-full">
        <h1 className="text-lg font-semibold tracking-tight text-ink-50 sm:text-xl md:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-400 sm:mt-1 sm:line-clamp-none sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className={pageHeaderActionsClass}>{actions}</div> : null}
    </header>
  )
}
