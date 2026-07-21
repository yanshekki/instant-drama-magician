/**
 * Professional status card for Grok local gateway:
 * check Grok Build → start gateway → auto key (hidden from user).
 */
import { useTranslation } from 'react-i18next'
import { Button } from './ui'

export type GrokSetupStatus = {
  state: string
  message: string
  healthOk: boolean
  grokPath: string | null
  gctoacPath: string | null
  keyReady?: boolean
}

const GROK_INSTALL_CMD =
  'curl -fsSL https://x.ai/cli/install.sh | bash'

export function GrokGatewaySetupCard({
  status,
  busy,
  onRecheck,
  onCopyInstall,
  onOpenInstallPage
}: {
  status: GrokSetupStatus | null
  busy: boolean
  onRecheck: () => void
  onCopyInstall: (cmd: string) => void
  onOpenInstallPage: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const state = busy
    ? 'checking'
    : status?.state === 'ready' && (status.healthOk || status.keyReady !== false)
      ? 'ready'
      : status?.state === 'grok_build_missing'
        ? 'need_build'
        : status?.state === 'gateway_missing'
          ? 'need_package'
          : status?.state === 'gateway_starting'
            ? 'checking'
            : status?.state === 'unhealthy' || status?.state === 'error'
              ? 'unhealthy'
              : 'checking'

  const grokOk = Boolean(status?.grokPath)
  const gatewayOk =
    Boolean(status?.healthOk) || status?.state === 'ready'
  const keyOk =
    status?.keyReady === true ||
    (gatewayOk && status?.state === 'ready')

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border',
        state === 'ready'
          ? 'border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 to-ink-950/60'
          : state === 'need_build' || state === 'need_package'
            ? 'border-amber-800/45 bg-gradient-to-br from-amber-950/35 to-ink-950/70'
            : 'border-ink-700/80 bg-ink-950/50'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-50">
              {t('settings.grokSetupTitle')}
            </h3>
            <StatusPill state={state} />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            {state === 'ready'
              ? t('settings.grokSetupReadyBlurb')
              : state === 'need_build'
                ? t('settings.grokSetupNeedBuildBlurb')
                : state === 'need_package'
                  ? t('settings.grokSetupNeedPackageBlurb')
                  : state === 'unhealthy'
                    ? t('settings.grokSetupUnhealthyBlurb')
                    : t('settings.grokSetupCheckingBlurb')}
          </p>
        </div>
        {busy && (
          <span
            className="mt-0.5 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-400 border-t-transparent"
            aria-hidden
          />
        )}
      </div>

      <div className="space-y-2 border-t border-ink-800/60 px-4 py-3">
        <CheckRow
          done={grokOk}
          pending={busy && !grokOk}
          label={t('settings.grokCheckBuild')}
          detail={
            grokOk
              ? t('settings.grokCheckBuildOk')
              : t('settings.grokCheckBuildMissing')
          }
        />
        <CheckRow
          done={gatewayOk}
          pending={busy && grokOk && !gatewayOk}
          label={t('settings.grokCheckGateway')}
          detail={
            gatewayOk
              ? t('settings.grokCheckGatewayOk')
              : t('settings.grokCheckGatewayWait')
          }
        />
        <CheckRow
          done={keyOk && gatewayOk}
          pending={busy && gatewayOk && !keyOk}
          label={t('settings.grokCheckKey')}
          detail={t('settings.grokCheckKeyManaged')}
        />
      </div>

      {state === 'need_build' && (
        <div className="space-y-3 border-t border-amber-900/40 bg-amber-950/20 px-4 py-3">
          <div>
            <p className="text-xs font-medium text-amber-100">
              {t('settings.grokInstallTitle')}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/75">
              {t('settings.grokInstallHint')}
            </p>
          </div>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-[11px] text-ink-200">
              {GROK_INSTALL_CMD}
            </code>
            <Button
              type="button"
              variant="secondary"
              className="!shrink-0 !px-3 !text-xs"
              onClick={() => onCopyInstall(GROK_INSTALL_CMD)}
            >
              {t('settings.copyInstallCmd')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={busy}
              className="!text-xs"
              onClick={onRecheck}
            >
              {t('settings.grokRecheck')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              onClick={onOpenInstallPage}
            >
              {t('settings.grokOpenInstallPage')}
            </Button>
          </div>
        </div>
      )}

      {(state === 'unhealthy' || state === 'need_package') && (
        <div className="flex flex-wrap gap-2 border-t border-ink-800/60 px-4 py-3">
          <Button
            type="button"
            loading={busy}
            className="!text-xs"
            onClick={onRecheck}
          >
            {t('settings.grokRecheck')}
          </Button>
        </div>
      )}

      {state === 'ready' && (
        <div className="border-t border-emerald-900/30 px-4 py-2">
          <p className="text-[11px] text-emerald-200/80">
            {t('settings.gatewayReadyManaged')}
          </p>
        </div>
      )}
    </div>
  )
}

function StatusPill({ state }: { state: string }): JSX.Element {
  const { t } = useTranslation()
  const map: Record<string, { cls: string; label: string }> = {
    ready: {
      cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
      label: t('settings.grokPillReady')
    },
    checking: {
      cls: 'bg-brand-500/15 text-brand-200 ring-brand-500/30',
      label: t('settings.grokPillChecking')
    },
    need_build: {
      cls: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
      label: t('settings.grokPillNeedBuild')
    },
    need_package: {
      cls: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
      label: t('settings.grokPillError')
    },
    unhealthy: {
      cls: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
      label: t('settings.grokPillUnhealthy')
    }
  }
  const m = map[state] ?? map.checking
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        m.cls
      ].join(' ')}
    >
      {m.label}
    </span>
  )
}

function CheckRow({
  done,
  pending,
  label,
  detail
}: {
  done: boolean
  pending?: boolean
  label: string
  detail: string
}): JSX.Element {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={[
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
          done
            ? 'bg-emerald-500/20 text-emerald-300'
            : pending
              ? 'border border-brand-400/50 text-brand-300'
              : 'border border-ink-600 text-ink-500'
        ].join(' ')}
        aria-hidden
      >
        {done ? '✓' : pending ? '…' : '·'}
      </span>
      <div className="min-w-0">
        <p
          className={[
            'text-xs font-medium',
            done ? 'text-ink-100' : 'text-ink-300'
          ].join(' ')}
        >
          {label}
        </p>
        <p className="text-[11px] text-ink-500">{detail}</p>
      </div>
    </div>
  )
}

export { GROK_INSTALL_CMD }
