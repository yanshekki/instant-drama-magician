import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}): JSX.Element {
  const styles: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-500 disabled:bg-brand-800',
    secondary:
      'border border-ink-600 bg-ink-800 text-ink-100 hover:border-ink-500 hover:bg-ink-700',
    danger: 'bg-rose-700 text-white hover:bg-rose-600',
    ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-50'
  }
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className
      ].join(' ')}
      {...props}
    />
  )
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={[
        'w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className
      ].join(' ')}
      {...props}
    />
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      className={[
        'w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className
      ].join(' ')}
      {...props}
    />
  )
}

export function Label({ children }: { children: ReactNode }): JSX.Element {
  return <label className="mb-1 block text-xs font-medium text-ink-400">{children}</label>
}

export function Card({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={[
        'rounded-xl border border-ink-800 bg-ink-900/60 p-4 shadow-sm',
        className
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 px-6 py-16 text-center text-sm text-ink-400">
      {message}
    </div>
  )
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      className={[
        'w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </select>
  )
}
