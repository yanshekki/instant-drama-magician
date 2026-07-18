import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { LibraryFilterSelect } from '../components/LibraryFilterSelect'
import { libraryToolbar } from '../components/libraryToolbar'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui'
import { useDialog } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'

type AuditRow = {
  ts: string
  kind: string
  message: string
  level?: string
  storyId?: string
  meta?: Record<string, unknown>
}

type QuickFilter = 'all' | 'errors' | 'warns' | 'generation' | 'export' | 'media'

type SortKey = 'ts' | 'level' | 'kind' | 'message' | 'ms'
type SortDir = 'asc' | 'desc'

const LEVEL_RANK: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/** Map raw IPC / activity messages to user-facing copy keys. */
const EVENT_LABEL_KEYS: Array<{ test: RegExp; key: string; cat: string }> = [
  { test: /^media:exportFinal$|^export.*final$/i, key: 'audit.evtExportFinal', cat: 'export' },
  { test: /^media:exportStoryboard$|export.*board/i, key: 'audit.evtExportBoard', cat: 'export' },
  { test: /^media:listExports$|listExports/i, key: 'audit.evtListExports', cat: 'export' },
  { test: /^media:deleteExport$|deleteExport/i, key: 'audit.evtDeleteExport', cat: 'export' },
  { test: /^media:toPreviewUrl$/i, key: 'audit.evtPreview', cat: 'media' },
  { test: /^media:importClip$|importClip/i, key: 'audit.evtImportClip', cat: 'media' },
  { test: /^media:saveAs$/i, key: 'audit.evtSaveAs', cat: 'media' },
  { test: /^generation:|pipeline|runClip|runPipeline/i, key: 'audit.evtGeneration', cat: 'generation' },
  { test: /^characters:aiFill$|character.*ai/i, key: 'audit.evtCharacterAi', cat: 'character' },
  { test: /^characters:generateSoul$|generateSoul/i, key: 'audit.evtSoul', cat: 'character' },
  { test: /^characters:|character/i, key: 'audit.evtCharacter', cat: 'character' },
  { test: /^scenes:|scene/i, key: 'audit.evtScene', cat: 'scene' },
  { test: /^props:|prop/i, key: 'audit.evtProp', cat: 'prop' },
  { test: /^stories:|story/i, key: 'audit.evtStory', cat: 'story' },
  { test: /^timeline:/i, key: 'audit.evtTimeline', cat: 'timeline' },
  { test: /^settings:|settings/i, key: 'audit.evtSettings', cat: 'settings' },
  { test: /^ai:status$|aiStatus/i, key: 'audit.evtAiStatus', cat: 'system' },
  { test: /^app:getInfo$/i, key: 'audit.evtAppInfo', cat: 'system' },
  { test: /^ipc$/i, key: 'audit.evtIpc', cat: 'system' }
]

function classifyEvent(row: AuditRow): { labelKey: string; cat: string } {
  const hay = `${row.kind} ${row.message}`
  for (const rule of EVENT_LABEL_KEYS) {
    if (rule.test.test(hay) || rule.test.test(row.message)) {
      return { labelKey: rule.key, cat: rule.cat }
    }
  }
  if (row.kind === 'export') return { labelKey: 'audit.evtExport', cat: 'export' }
  if (row.kind === 'generation')
    return { labelKey: 'audit.evtGeneration', cat: 'generation' }
  return { labelKey: 'audit.evtGeneric', cat: 'system' }
}

function effectiveLevel(row: AuditRow): string {
  if (row.level === 'error' || row.meta?.ok === false) return 'error'
  if (row.level === 'warn') return 'warn'
  if (row.level === 'debug') return 'debug'
  return row.level || 'info'
}

export function AuditLogPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [entries, setEntries] = useState<AuditRow[]>([])
  const [logPath, setLogPath] = useState('')
  const [quick, setQuick] = useState<QuickFilter>('all')
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [limit, setLimit] = useState(300)
  const [selected, setSelected] = useState<AuditRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('ts')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copied, setCopied] = useState(false)
  const [filterLevel, setFilterLevel] = useState('') // '' | error | warn | info
  const [filterKind, setFilterKind] = useState('')
  const [filterRange, setFilterRange] = useState('') // '' | today | 7d

  useEffect(() => {
    const id = window.setTimeout(() => setQDebounced(q.trim()), 280)
    return () => window.clearTimeout(id)
  }, [q])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // Fetch a generous pool; quick filters apply client-side for snappy UX
      const r = await getApi().activity.query({
        limit: Math.min(Math.max(limit, 50), 2000),
        q: qDebounced || undefined
      })
      setEntries(r.entries)
      setLogPath(r.path)
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setLoading(false)
    }
  }, [limit, qDebounced])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => {
      void load()
    }, 5000)
    return () => window.clearInterval(id)
  }, [autoRefresh, load])

  const kindOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.kind?.trim()) set.add(e.kind.trim())
    }
    return [...set].sort().slice(0, 40)
  }, [entries])

  const filtered = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    return entries.filter((row) => {
      const lvl = effectiveLevel(row)
      const { cat } = classifyEvent(row)
      const hay = `${row.kind} ${row.message}`.toLowerCase()
      switch (quick) {
        case 'errors':
          if (lvl !== 'error') return false
          break
        case 'warns':
          if (lvl !== 'warn') return false
          break
        case 'generation':
          if (
            !(
              cat === 'generation' ||
              /generation|pipeline|clip|video/i.test(hay)
            )
          )
            return false
          break
        case 'export':
          if (!(cat === 'export' || /export/i.test(hay))) return false
          break
        case 'media':
          if (!(cat === 'media' || /^media:/.test(row.message))) return false
          break
        default:
          break
      }
      if (filterLevel && lvl !== filterLevel) return false
      if (filterKind && row.kind !== filterKind) return false
      if (filterRange === 'today' || filterRange === '7d') {
        const ts = Date.parse(row.ts)
        if (!Number.isFinite(ts)) return false
        const window = filterRange === 'today' ? dayMs : 7 * dayMs
        if (now - ts > window) return false
      }
      return true
    })
  }, [entries, quick, filterLevel, filterKind, filterRange])

  const clearAuditFilters = (): void => {
    setQ('')
    setQuick('all')
    setFilterLevel('')
    setFilterKind('')
    setFilterRange('')
  }
  const auditHasFilters =
    Boolean(q.trim()) ||
    quick !== 'all' ||
    Boolean(filterLevel) ||
    Boolean(filterKind) ||
    Boolean(filterRange)

  const sortedEntries = useMemo(() => {
    const rows = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'ts':
          cmp = a.ts.localeCompare(b.ts)
          break
        case 'level': {
          const la = LEVEL_RANK[effectiveLevel(a)] ?? 1
          const lb = LEVEL_RANK[effectiveLevel(b)] ?? 1
          cmp = la - lb
          break
        }
        case 'kind':
          cmp = a.kind.localeCompare(b.kind)
          break
        case 'message':
          cmp = a.message.localeCompare(b.message)
          break
        case 'ms': {
          const ma = typeof a.meta?.ms === 'number' ? a.meta.ms : -1
          const mb = typeof b.meta?.ms === 'number' ? b.meta.ms : -1
          cmp = ma - mb
          break
        }
        default:
          cmp = 0
      }
      if (cmp !== 0) return cmp * dir
      return b.ts.localeCompare(a.ts)
    })
    return rows
  }, [filtered, sortKey, sortDir])

  const stats = useMemo(() => {
    let errors = 0
    let warns = 0
    let exports = 0
    let gens = 0
    for (const row of entries) {
      const lvl = effectiveLevel(row)
      if (lvl === 'error') errors++
      if (lvl === 'warn') warns++
      const { cat } = classifyEvent(row)
      if (cat === 'export' || /export/i.test(row.message)) exports++
      if (cat === 'generation' || /generation|pipeline/i.test(row.message))
        gens++
    }
    return {
      total: entries.length,
      errors,
      warns,
      exports,
      gens,
      lastTs: entries[0]?.ts ?? null
    }
  }, [entries])

  const handleClear = async (): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('audit.confirmClear'),
      variant: 'danger',
      confirmLabel: t('common.delete')
    })
    if (!ok) return
    try {
      await getApi().activity.clear()
      setSelected(null)
      await load()
      toast.success(t('audit.cleared'))
    } catch (e) {
      setError(parseIpcError(e).message)
      toast.error(parseIpcError(e).message)
    }
  }

  const copySelected = async (): Promise<void> => {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2))
      setCopied(true)
      toast.success(t('audit.copied'))
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('common.actionFailed'))
    }
  }

  const quickFilters: Array<{ id: QuickFilter; label: string }> = [
    { id: 'all', label: t('audit.filterAll') },
    { id: 'errors', label: t('audit.filterErrors') },
    { id: 'warns', label: t('audit.filterWarns') },
    { id: 'generation', label: t('audit.filterGeneration') },
    { id: 'export', label: t('audit.filterExport') },
    { id: 'media', label: t('audit.filterMedia') }
  ]

  const eventTitle = (row: AuditRow): string => {
    const { labelKey } = classifyEvent(row)
    const translated = t(labelKey, { defaultValue: '' })
    if (translated && translated !== labelKey) return translated
    // Fallback: prettify channel name
    return prettifyChannel(row.message || row.kind)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        actions={
          <>
            <Button
              variant="secondary"
              loading={loading}
              onClick={() => void load()}
            >
              {t('common.refresh')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void getApi().activity.openLogFolder()}
            >
              {t('audit.openFolder')}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4 pt-1 sm:px-6 lg:flex-row lg:px-8">
        {/* Main column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* Summary cards */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              label={t('audit.statTotal')}
              value={String(stats.total)}
              tone="neutral"
              active={quick === 'all'}
              onClick={() => setQuick('all')}
            />
            <StatCard
              label={t('audit.statErrors')}
              value={String(stats.errors)}
              tone="danger"
              active={quick === 'errors'}
              onClick={() => setQuick('errors')}
            />
            <StatCard
              label={t('audit.statGeneration')}
              value={String(stats.gens)}
              tone="brand"
              active={quick === 'generation'}
              onClick={() => setQuick('generation')}
            />
            <StatCard
              label={t('audit.statExports')}
              value={String(stats.exports)}
              tone="ok"
              active={quick === 'export'}
              onClick={() => setQuick('export')}
            />
          </div>

          {/* Search + filters */}
          <div className={['shrink-0 space-y-3', libraryToolbar.panel].join(' ')}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10.5 10.5 14 14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('audit.searchPh')}
                  className={libraryToolbar.searchInput}
                  aria-label={t('audit.search')}
                />
              </div>
              <label
                className={[
                  libraryToolbar.clearBtn,
                  'cursor-pointer gap-2 !px-3 font-normal text-ink-300'
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="rounded border-ink-600"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                {t('audit.autoRefresh')}
              </label>
              <button
                type="button"
                className={libraryToolbar.clearBtn}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? t('audit.hideAdvanced') : t('audit.showAdvanced')}
              </button>
              <button
                type="button"
                disabled={!auditHasFilters}
                className={[
                  libraryToolbar.clearBtn,
                  auditHasFilters ? libraryToolbar.clearBtnActive : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={clearAuditFilters}
              >
                {t('library.clearFilters')}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quickFilters.map((f) => {
                const active = quick === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setQuick(f.id)}
                    className={[
                      'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition',
                      active
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-950/40'
                        : 'border border-ink-700 bg-ink-950/60 text-ink-300 hover:border-ink-500 hover:text-ink-100'
                    ].join(' ')}
                  >
                    {f.label}
                    {f.id === 'errors' && stats.errors > 0 ? (
                      <span className="ml-1 opacity-90">({stats.errors})</span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {showAdvanced && (
              <div className="space-y-3 border-t border-ink-800/70 pt-3">
                <div
                  className={[
                    libraryToolbar.filterGrid,
                    'lg:!grid-cols-5'
                  ].join(' ')}
                >
                  <LibraryFilterSelect
                    label={t('library.filterLevel')}
                    value={filterLevel}
                    onChange={setFilterLevel}
                    options={[
                      { value: '', label: t('library.filterAny') },
                      { value: 'error', label: 'error' },
                      { value: 'warn', label: 'warn' },
                      { value: 'info', label: 'info' }
                    ]}
                  />
                  <LibraryFilterSelect
                    label={t('library.filterKind')}
                    value={filterKind}
                    onChange={setFilterKind}
                    options={[
                      { value: '', label: t('library.filterAny') },
                      ...kindOptions.map((k) => ({ value: k, label: k }))
                    ]}
                  />
                  <LibraryFilterSelect
                    label={t('library.filterRange')}
                    value={filterRange}
                    onChange={setFilterRange}
                    options={[
                      { value: '', label: t('library.filterRangeAll') },
                      { value: 'today', label: t('library.filterRangeToday') },
                      { value: '7d', label: t('library.filterRange7d') }
                    ]}
                  />
                  <LibraryFilterSelect
                    label={t('audit.limit')}
                    value={String(limit)}
                    onChange={(v) => setLimit(Number(v) || 300)}
                    options={[100, 300, 500, 1000, 2000].map((n) => ({
                      value: String(n),
                      label: String(n)
                    }))}
                  />
                  <LibraryFilterSelect
                    label={t('audit.sort')}
                    value={`${sortKey}:${sortDir}`}
                    onChange={(v) => {
                      const [k, d] = v.split(':') as [SortKey, SortDir]
                      setSortKey(k)
                      setSortDir(d)
                    }}
                    options={[
                      { value: 'ts:desc', label: t('audit.sortNewest') },
                      { value: 'ts:asc', label: t('audit.sortOldest') },
                      { value: 'ms:desc', label: t('audit.sortSlowest') },
                      { value: 'level:desc', label: t('audit.sortByLevel') }
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {logPath ? (
                    <p
                      className="min-w-0 truncate font-mono text-[10px] text-ink-600"
                      title={logPath}
                    >
                      {logPath}
                    </p>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="danger"
                    className="!h-10 !rounded-xl !px-4 !text-xs"
                    onClick={() => void handleClear()}
                  >
                    {t('audit.clear')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="shrink-0 rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          )}

          {/* Event list */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-ink-800/80 bg-ink-950/30">
            {sortedEntries.length === 0 ? (
              <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-xl text-ink-500">
                  📋
                </div>
                <p className="text-sm font-medium text-ink-200">
                  {t('audit.emptyTitle')}
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-ink-500">
                  {t('audit.empty')}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-800/60">
                {sortedEntries.map((row, i) => {
                  const lvl = effectiveLevel(row)
                  const ms =
                    typeof row.meta?.ms === 'number' ? row.meta.ms : null
                  const { cat } = classifyEvent(row)
                  const active = selected === row
                  return (
                    <li key={`${row.ts}-${row.kind}-${row.message}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className={[
                          'flex w-full items-start gap-3 px-3 py-3 text-left transition sm:px-4',
                          active
                            ? 'bg-brand-950/35 ring-1 ring-inset ring-brand-500/30'
                            : 'hover:bg-ink-900/50'
                        ].join(' ')}
                      >
                        <CatIcon cat={cat} level={lvl} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-ink-50">
                              {eventTitle(row)}
                            </span>
                            <LevelPill level={lvl} t={t} />
                            {ms != null && ms >= 0 && (
                              <span
                                className={[
                                  'rounded-md px-1.5 py-0.5 font-mono text-[10px]',
                                  ms > 2000
                                    ? 'bg-amber-950/50 text-amber-200'
                                    : 'bg-ink-800 text-ink-400'
                                ].join(' ')}
                              >
                                {formatMs(ms)}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-500">
                            {row.message}
                            {row.storyId
                              ? ` · ${row.storyId.slice(0, 10)}…`
                              : ''}
                          </p>
                        </div>
                        <time
                          className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-ink-500"
                          dateTime={row.ts}
                          title={row.ts}
                        >
                          {formatTs(row.ts, i18n.language)}
                        </time>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <p className="shrink-0 text-[11px] text-ink-600">
            {t('audit.showing', { n: sortedEntries.length })}
            {stats.errors > 0
              ? ` · ${t('audit.errors', { n: stats.errors })}`
              : ''}
            {stats.lastTs
              ? ` · ${t('audit.lastActivity', {
                  time: formatTs(stats.lastTs, i18n.language)
                })}`
              : ''}
          </p>
        </div>

        {/* Detail panel */}
        <aside className="flex max-h-[42vh] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-900/50 lg:max-h-none lg:w-[22rem] xl:w-[24rem]">
          <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-100">
              {t('audit.detail')}
            </h2>
            {selected && (
              <button
                type="button"
                className="text-xs text-ink-500 hover:text-ink-300"
                onClick={() => setSelected(null)}
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
          {selected ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex flex-wrap items-center gap-2">
                <LevelPill level={effectiveLevel(selected)} t={t} />
                <span className="text-sm font-medium text-ink-50">
                  {eventTitle(selected)}
                </span>
              </div>
              <DetailField
                label={t('audit.colTime')}
                value={formatTsFull(selected.ts, i18n.language)}
              />
              <DetailField
                label={t('audit.colMessage')}
                value={selected.message}
                mono
              />
              <DetailField label={t('audit.colKind')} value={selected.kind} mono />
              {selected.storyId && (
                <DetailField
                  label={t('audit.storyId')}
                  value={selected.storyId}
                  mono
                />
              )}
              {typeof selected.meta?.ms === 'number' && (
                <DetailField
                  label={t('audit.colMs')}
                  value={formatMs(selected.meta.ms as number)}
                />
              )}
              {selected.meta && Object.keys(selected.meta).length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                    {t('audit.meta')}
                  </div>
                  <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-all rounded-xl border border-ink-800 bg-ink-950/80 p-3 font-mono text-[11px] leading-relaxed text-ink-300">
                    {JSON.stringify(selected.meta, null, 2)}
                  </pre>
                </div>
              )}
              <Button
                variant="secondary"
                className="w-full !text-xs"
                onClick={() => void copySelected()}
              >
                {copied ? t('audit.copied') : t('audit.copyJson')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-ink-400">{t('audit.selectRow')}</p>
              <p className="text-[11px] text-ink-600">{t('audit.selectRowHint')}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
  active,
  onClick
}: {
  label: string
  value: string
  tone: 'neutral' | 'danger' | 'brand' | 'ok'
  active?: boolean
  onClick?: () => void
}): JSX.Element {
  const tones: Record<string, string> = {
    neutral: 'border-ink-800 bg-ink-900/50 text-ink-100',
    danger: 'border-rose-900/40 bg-rose-950/30 text-rose-100',
    brand: 'border-brand-800/40 bg-brand-950/30 text-brand-100',
    ok: 'border-emerald-900/40 bg-emerald-950/25 text-emerald-100'
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl border px-3 py-2.5 text-left transition',
        tones[tone],
        active ? 'ring-2 ring-brand-500/50' : 'hover:brightness-110'
      ].join(' ')}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </button>
  )
}

function LevelPill({
  level,
  t
}: {
  level: string
  t: (k: string) => string
}): JSX.Element {
  const styles: Record<string, string> = {
    error: 'bg-rose-950/70 text-rose-200 ring-rose-800/50',
    warn: 'bg-amber-950/60 text-amber-100 ring-amber-800/40',
    debug: 'bg-ink-800 text-ink-400 ring-ink-700',
    info: 'bg-sky-950/50 text-sky-200 ring-sky-900/40'
  }
  const labels: Record<string, string> = {
    error: t('audit.levelError'),
    warn: t('audit.levelWarn'),
    debug: t('audit.levelDebug'),
    info: t('audit.levelInfo')
  }
  const lv = level in styles ? level : 'info'
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        styles[lv]
      ].join(' ')}
    >
      {labels[lv] || lv}
    </span>
  )
}

function CatIcon({
  cat,
  level
}: {
  cat: string
  level: string
}): JSX.Element {
  const icons: Record<string, string> = {
    export: '⬆',
    generation: '✦',
    media: '▣',
    character: '☺',
    scene: '⌂',
    prop: '◆',
    story: '☰',
    timeline: '▤',
    settings: '⚙',
    system: '·'
  }
  const ring =
    level === 'error'
      ? 'bg-rose-950/50 text-rose-200'
      : level === 'warn'
        ? 'bg-amber-950/40 text-amber-100'
        : 'bg-ink-800 text-ink-300'
  return (
    <span
      className={[
        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm',
        ring
      ].join(' ')}
      aria-hidden
    >
      {icons[cat] || '·'}
    </span>
  )
}

function DetailField({
  label,
  value,
  mono
}: {
  label: string
  value: string
  mono?: boolean
}): JSX.Element {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div
        className={[
          'break-all text-sm text-ink-100',
          mono ? 'font-mono text-xs text-ink-300' : ''
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function formatTs(iso: string, lang?: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(lang || undefined, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return iso
  }
}

function formatTsFull(iso: string, lang?: string): string {
  try {
    return new Date(iso).toLocaleString(lang || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return iso
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

function prettifyChannel(raw: string): string {
  return raw
    .replace(/^media:|^stories:|^characters:|^scenes:|^props:|^timeline:|^ai:|^app:|^settings:|^generation:/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/:/g, ' · ')
    .replace(/[_-]+/g, ' ')
    .trim() || raw
}
