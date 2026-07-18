/**
 * In-app styled dialogs replacing window.confirm / window.alert.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui'

export type DialogVariant = 'default' | 'danger'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Danger styling for destructive actions */
  variant?: DialogVariant
}

export interface AlertOptions {
  title?: string
  message: string
  okLabel?: string
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>
  alert: (opts: AlertOptions | string) => Promise<void>
}

const DialogContext = createContext<DialogContextValue | null>(null)

type Pending =
  | {
      mode: 'confirm'
      opts: ConfirmOptions
      resolve: (v: boolean) => void
    }
  | {
      mode: 'alert'
      opts: AlertOptions
      resolve: () => void
    }

function normalizeConfirm(opts: ConfirmOptions | string): ConfirmOptions {
  if (typeof opts === 'string') return { message: opts }
  return opts
}

function normalizeAlert(opts: AlertOptions | string): AlertOptions {
  if (typeof opts === 'string') return { message: opts }
  return opts
}

export function DialogProvider({
  children
}: {
  children: ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)
  const queue = useRef<Pending[]>([])

  const flushNext = useCallback((): void => {
    const next = queue.current.shift()
    setPending(next ?? null)
  }, [])

  const enqueue = useCallback((item: Pending): void => {
    setPending((cur) => {
      if (cur) {
        queue.current.push(item)
        return cur
      }
      return item
    })
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOptions | string): Promise<boolean> => {
      return new Promise((resolve) => {
        enqueue({
          mode: 'confirm',
          opts: normalizeConfirm(opts),
          resolve
        })
      })
    },
    [enqueue]
  )

  const alert = useCallback(
    (opts: AlertOptions | string): Promise<void> => {
      return new Promise((resolve) => {
        enqueue({
          mode: 'alert',
          opts: normalizeAlert(opts),
          resolve
        })
      })
    },
    [enqueue]
  )

  const closeConfirm = (ok: boolean): void => {
    if (!pending || pending.mode !== 'confirm') return
    pending.resolve(ok)
    flushNext()
  }

  const closeAlert = (): void => {
    if (!pending || pending.mode !== 'alert') return
    pending.resolve()
    flushNext()
  }

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (pending.mode === 'confirm') closeConfirm(false)
        else closeAlert()
      }
      if (e.key === 'Enter' && pending.mode === 'alert') {
        e.preventDefault()
        closeAlert()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rebind when dialog opens
  }, [pending])

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert])

  const opts = pending?.opts
  const variant =
    pending?.mode === 'confirm'
      ? (pending.opts.variant ?? 'default')
      : 'default'

  return (
    <DialogContext.Provider value={value}>
      {children}
      {pending && opts && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="presentation"
        >
          <div
            className="absolute inset-0 bg-overlay/70 backdrop-blur-sm"
            aria-hidden
            onClick={() =>
              pending.mode === 'confirm' ? closeConfirm(false) : closeAlert()
            }
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            aria-describedby="app-dialog-desc"
            className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-theme-md"
          >
            <div className="border-b border-ink-800/80 px-5 py-4">
              <h2
                id="app-dialog-title"
                className="text-base font-semibold tracking-tight text-ink-50"
              >
                {opts.title ??
                  (pending.mode === 'confirm'
                    ? t('common.confirmTitle')
                    : t('common.noticeTitle'))}
              </h2>
            </div>
            <div className="px-5 py-4">
              <p
                id="app-dialog-desc"
                className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300"
              >
                {opts.message}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-800/80 bg-ink-950/50 px-5 py-3.5">
              {pending.mode === 'confirm' ? (
                <>
                  <Button
                    variant="secondary"
                    className="min-w-[5.5rem]"
                    onClick={() => closeConfirm(false)}
                    autoFocus
                  >
                    {pending.opts.cancelLabel ?? t('common.cancel')}
                  </Button>
                  <Button
                    variant={variant === 'danger' ? 'danger' : 'primary'}
                    className="min-w-[5.5rem]"
                    onClick={() => closeConfirm(true)}
                  >
                    {pending.opts.confirmLabel ??
                      (variant === 'danger'
                        ? t('common.delete')
                        : t('common.ok'))}
                  </Button>
                </>
              ) : (
                <Button
                  className="min-w-[5.5rem]"
                  onClick={closeAlert}
                  autoFocus
                >
                  {pending.opts.okLabel ?? t('common.ok')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider')
  }
  return ctx
}
