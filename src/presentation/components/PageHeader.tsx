import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps): JSX.Element {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-ink-800 px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
