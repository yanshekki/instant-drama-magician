import { shouldCancelModal, shouldCancelOnBackdropClick } from './uiResidualPure'
/**
 * Confirm / edit prompt before reference-image generation (shared by all asset pages).
 * Portaled to document.body so EditorShell stacking never traps clicks / cancel.
 *
 * Hard rules (生成鐵則) live inside the prompt text itself — no separate callout.
 * User can edit the full prompt in the large textarea.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { Button, Label } from './ui'

export type ImageGenConfirmPayload = {
  /** Assembled default prompt (editable). */
  prompt: string
  /** Selected identity stills (may be empty when pure generate). */
  referencePaths: string[]
  useIdentityEdit: boolean
  summary?: string
}

function RefThumb({ filePath }: { filePath: string }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    const path = filePath?.trim()
    if (!path) {
      setFailed(true)
      return
    }
    void getApi()
      .media.toPreviewUrl(path)
      .then((r) => {
        if (!cancelled) setUrl(r.url)
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null)
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [filePath])
  return (
    <div className="h-14 w-14 overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-[10px] text-ink-500"
          title={filePath}
        >
          {failed ? '✕' : '…'}
        </div>
      )}
    </div>
  )
}

export function ImageGenConfirmModal({
  open,
  payload,
  busy,
  onCancel,
  onConfirm
}: {
  open: boolean
  payload: ImageGenConfirmPayload | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (next: ImageGenConfirmPayload) => void | Promise<void>
}): JSX.Element | null {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    if (open && payload) setPrompt(payload.prompt)
  }, [open, payload])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (shouldCancelModal(e.key, busy)) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open || !payload) return null
  if (typeof document === 'undefined') return null

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
      onClick={() => {
        if (shouldCancelOnBackdropClick(busy)) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('common.imageGenConfirmTitle')}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-ink-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-50">
              {t('common.imageGenConfirmTitle')}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {t('common.imageGenConfirmHint')}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-ink-600 px-2.5 py-1 text-sm text-ink-200 hover:bg-ink-800"
            disabled={busy}
            onClick={onCancel}
            aria-label={t('common.cancel')}
          >
            ✕
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {payload.summary ? (
            <p className="shrink-0 text-[12px] text-ink-400">{payload.summary}</p>
          ) : null}
          {payload.referencePaths.length > 0 ? (
            <div className="shrink-0">
              <p className="mb-1.5 text-[11px] font-medium text-ink-300">
                {payload.useIdentityEdit
                  ? t('common.imageGenConfirmRefs')
                  : t('common.imageGenConfirmRefsOptional')}
              </p>
              <div className="flex flex-wrap gap-2">
                {payload.referencePaths.map((p) => (
                  <RefThumb key={p} filePath={p} />
                ))}
              </div>
              {!payload.useIdentityEdit ? (
                <p className="mt-1.5 text-[11px] text-ink-500">
                  {t('common.imageGenConfirmPure')}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="shrink-0 text-[11px] text-ink-500">
              {t('common.imageGenConfirmPure')}
            </p>
          )}
          <div className="flex min-h-0 flex-1 flex-col">
            <Label>{t('common.imageGenConfirmPrompt')}</Label>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {t('common.imageGenConfirmPromptNote')}
            </p>
            <textarea
              className="mt-1 min-h-[min(52vh,28rem)] w-full flex-1 resize-y rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-100 outline-none focus:border-brand-500"
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
              dir="auto"
              lang="en"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-ink-800 px-4 py-3">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy || !prompt.trim()}
            loading={busy}
            onClick={() =>
              void onConfirm({
                ...payload,
                prompt: prompt.trim()
              })
            }
          >
            {t('common.imageGenConfirmGo')}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
