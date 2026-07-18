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
  'ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2',
  /* Normalize nested Button / Select / native controls in the actions slot */
  '[&_button]:!h-10 [&_button]:!min-h-10 [&_button]:!px-3.5 [&_button]:!py-0 [&_button]:!text-sm [&_button]:!leading-none',
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
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-ink-800 px-6 py-5 sm:px-8">
      <div className="min-w-0 max-w-full flex-1 basis-[12rem] sm:basis-[16rem] sm:max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className={pageHeaderActionsClass}>{actions}</div> : null}
    </header>
  )
}
