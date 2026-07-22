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
  'flex max-w-full shrink-0 flex-wrap items-center justify-stretch gap-2 sm:justify-end',
  /* Normalize nested Button / Select / native controls in the actions slot */
  '[&_button]:!h-10 [&_button]:!min-h-10 [&_button]:!min-w-0 [&_button]:!px-3 [&_button]:!py-0 [&_button]:!text-sm [&_button]:!leading-none sm:[&_button]:!px-3.5',
  '[&_select]:!h-10 [&_select]:!min-h-10 [&_select]:!py-0 [&_select]:!text-sm',
  '[&_a]:!h-10 [&_a]:!min-h-10 [&_a]:inline-flex [&_a]:items-center'
].join(' ')

/**
 * Title + subtitle on the left; action buttons aligned to the right.
 * Actions wrap when needed without collapsing the title into a single column.
 */
export function PageHeader({
  title,
  subtitle,
  actions
}: PageHeaderProps): JSX.Element {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-ink-800 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-6 sm:gap-y-3 sm:px-6 sm:py-5 md:px-8">
      <div className="min-w-0 max-w-full flex-1 sm:basis-[16rem] sm:max-w-xl">
        <h1 className="text-xl font-semibold tracking-tight text-ink-50 sm:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400 sm:line-clamp-none sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className={`${pageHeaderActionsClass} w-full sm:ml-auto sm:w-auto`}>
          {actions}
        </div>
      ) : null}
    </header>
  )
}
