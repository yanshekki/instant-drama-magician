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
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  /** Shows disabled state + subtle busy affordance */
  loading?: boolean
}): JSX.Element {
  const styles: Record<string, string> = {
    primary:
      'bg-brand-600 text-white shadow-theme-sm hover:bg-brand-500 disabled:bg-brand-800 disabled:text-white/80',
    secondary:
      'border border-ink-700 bg-ink-900 text-ink-100 shadow-theme-sm hover:border-ink-600 hover:bg-ink-800',
    danger: 'bg-rose-600 text-white shadow-theme-sm hover:bg-rose-500',
    ghost: 'text-ink-400 hover:bg-ink-800 hover:text-ink-50'
  }
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 py-0 text-sm font-medium leading-none transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        loading ? 'opacity-80' : '',
        className
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
      ) : null}
      {children}
    </button>
  )
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={[
        'w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 shadow-inner shadow-theme-sm placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        className
      ].join(' ')}
      {...props}
    />
  )
}

/**
 * size controls default min-height (pages can still override with className).
 * sm  — short idea / single dialogue line
 * md  — summary / short description
 * lg  — style bible / appearance / costume
 * xl  — long multi-field profiles
 * fill — use remaining vertical space in editor panels
 */
export function Textarea({
  className = '',
  size = 'md',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fill'
}): JSX.Element {
  const sizes: Record<string, string> = {
    sm: 'min-h-[5rem]',
    md: 'min-h-[7.5rem]',
    lg: 'min-h-[11rem]',
    xl: 'min-h-[15rem]',
    fill: 'min-h-[min(42vh,20rem)]'
  }
  return (
    <textarea
      className={[
        'w-full resize-y rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm leading-relaxed text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        sizes[size] ?? sizes.md,
        className
      ].join(' ')}
      {...props}
    />
  )
}

export function Label({ children }: { children: ReactNode }): JSX.Element {
  return (
    <label className="mb-1 block text-xs font-medium text-ink-400">
      {children}
    </label>
  )
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
        'rounded-xl border border-ink-800 bg-ink-900/80 p-4 shadow-theme-sm',
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
        'h-10 min-h-10 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-0 text-sm text-ink-50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </select>
  )
}
