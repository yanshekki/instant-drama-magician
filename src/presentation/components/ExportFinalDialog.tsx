/**
 * Modal: confirm export options once, then run final film export.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  defaultExportFinalOptions,
  type ExportFinalOptions,
  type ExportProfile
} from '../../domain/exportOptions'
import { canUse } from '../lib/webCapability'
import { Button, Input, Label, Select } from './ui'

export function ExportFinalDialog({
  open,
  initial,
  busy,
  onCancel,
  onConfirm
}: {
  open: boolean
  initial?: Partial<ExportFinalOptions> | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (opts: ExportFinalOptions) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const [opts, setOpts] = useState<ExportFinalOptions>(() =>
    defaultExportFinalOptions(initial)
  )

  useEffect(() => {
    if (open) setOpts(defaultExportFinalOptions(initial))
  }, [open, initial])

  if (!open) return null

  const patch = <K extends keyof ExportFinalOptions>(
    key: K,
    value: ExportFinalOptions[K]
  ): void => {
    setOpts((o) => ({ ...o, [key]: value }))
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('export.dialogTitle')}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-ink-700 bg-ink-950 shadow-theme-md">
        <div className="border-b border-ink-800 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-50">
            {t('export.dialogTitle')}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            {t('export.dialogHint')}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <Label>{t('settings.exportProfile')}</Label>
            <Select
              value={opts.exportProfile}
              disabled={busy}
              onChange={(e) =>
                patch('exportProfile', e.target.value as ExportProfile)
              }
            >
              <option value="balanced">
                {t('settings.exportProfileBalanced')}
              </option>
              <option value="fast">{t('settings.exportProfileFast')}</option>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              disabled={busy}
              checked={opts.burnSubtitles}
              onChange={(e) => patch('burnSubtitles', e.target.checked)}
            />
            {t('settings.burnSubtitles')}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              disabled={busy}
              checked={opts.includeSilentAudio}
              onChange={(e) => patch('includeSilentAudio', e.target.checked)}
            />
            {t('settings.includeSilentAudio')}
          </label>
          {canUse('openExportFolder') ? (
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input
                type="checkbox"
                disabled={busy}
                checked={opts.openExportFolder}
                onChange={(e) => patch('openExportFolder', e.target.checked)}
              />
              {t('settings.openExportFolder')}
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('settings.bgmVolume')}</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                disabled={busy}
                value={opts.bgmVolume}
                onChange={(e) =>
                  patch('bgmVolume', Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t('settings.dialogueVolume')}</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                disabled={busy}
                value={opts.dialogueVolume}
                onChange={(e) =>
                  patch('dialogueVolume', Number(e.target.value) || 0)
                }
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-ink-800 bg-ink-900/40 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            loading={busy}
            onClick={() => onConfirm(defaultExportFinalOptions(opts))}
          >
            {busy ? t('common.exporting') : t('export.confirmExport')}
          </Button>
        </div>
      </div>
    </div>
  )
}
