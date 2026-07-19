import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  show: (kind: ToastKind, message: string, durationMs?: number) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_MS: Record<ToastKind, number> = {
  success: 2800,
  error: 5500,
  info: 3500
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const show = useCallback(
    (kind: ToastKind, message: string, durationMs?: number) => {
      const msg = message.trim()
      if (!msg) return
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev.slice(-4), { id, kind, message: msg }])
      const ms = durationMs ?? DEFAULT_MS[kind]
      if (ms > 0) {
        const handle = setTimeout(() => dismiss(id), ms)
        timers.current.set(id, handle)
      }
    },
    [dismiss]
  )

  const value = useMemo(
    () => ({
      toasts,
      show,
      success: (m: string, d?: number) => show('success', m, d),
      error: (m: string, d?: number) => show('error', m, d),
      info: (m: string, d?: number) => show('info', m, d),
      dismiss
    }),
    [toasts, show, dismiss]
  )

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

/** Fixed top-right toast stack */
export function ToastHost(): JSX.Element | null {
  const { t: tr } = useTranslation()
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((item) => {
        const colors =
          item.kind === 'success'
            ? 'border-emerald-600/45 bg-emerald-950 text-emerald-100'
            : item.kind === 'error'
              ? 'border-rose-600/45 bg-rose-950 text-rose-100'
              : 'border-brand-600/40 bg-ink-900 text-ink-50'
        const icon =
          item.kind === 'success' ? '✓' : item.kind === 'error' ? '!' : 'i'
        return (
          <div
            key={item.id}
            className={[
              'pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-theme-md backdrop-blur',
              colors
            ].join(' ')}
            role="status"
          >
            <span
              className={[
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                item.kind === 'success'
                  ? 'bg-emerald-600/35 text-emerald-50'
                  : item.kind === 'error'
                    ? 'bg-rose-600/35 text-rose-50'
                    : 'bg-brand-600/35 text-brand-50'
              ].join(' ')}
            >
              {icon}
            </span>
            <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
            <button
              type="button"
              className="shrink-0 rounded px-1.5 py-0.5 text-xs opacity-70 hover:opacity-100"
              onClick={() => dismiss(item.id)}
              aria-label={tr('common.dismissOk')}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
