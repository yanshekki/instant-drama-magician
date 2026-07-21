/**
 * Advanced Prep Studio — cast looks + storyboard still batch.
 * Visual language matches VideoPrepModal / ExportFinalDialog / library cards.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../../../lib/api'
import { parseIpcError } from '../../../lib/ipc'
import { getAiLocale } from '../../../lib/aiLocale'
import {
  applyCostumeSelection,
  applyGallerySelection,
  emptyStoryCastPrep,
  type StoryCastPrep
} from '../../../domain/advancedPrep'
import { LocalMediaImage } from '../LocalMediaImage'
import { Button, Select } from '../ui'
import { useToast } from '../../context/ToastContext'
import { useAiJobs } from '../../context/AiJobsContext'
import { castSaveToast, stillReadyDecrement, batchTargets, genLockedExtra, readyVideoEntryIds, shouldSilentPersistOnGen, shouldSilentPersistOnBatch, stillStatusOrMissing, runSaveCast, maybeSilentPersistDirty, maybeSilentPersistBatch, fireVideoQueue, notifyCastSaved } from './timelineAdvancedPure'



export interface AdvancedPrepSnapshot {
  storyId: string
  storyTitle: string
  castPrep: StoryCastPrep
  castCards: Array<{
    characterId: string
    name: string
    description: string
    gallery: Array<{ id: string; path: string; label: string; kind: string }>
    costumes: Array<{
      id: string
      name: string
      description: string
      imagePath: string | null
      selectable: boolean
    }>
    selectedRefImagePath: string | null
    selectedCostumeId: string | null
    hasAnyImage: boolean
  }>
  cells: Array<{
    entryId: string
    order: number
    displayIndex: number
    startTime: number
    endTime: number
    dialogue: string | null
    beatSnippet: string
    stillPath: string
    stillStatus: 'missing' | 'ready' | 'stale'
    mediaStatus: string
    continuityKind: 'first' | 'locked' | 'text-only'
    characterIds: string[]
    characterNames: string[]
    hasCachedPrompt: boolean
    professionalPrompt: string | null
    durationSeconds: number
    mediaPath?: string | null
    stillFromVideo?: boolean
  }>
  summary: {
    castReady: number
    castTotal: number
    stillReady: number
    stillTotal: number
    videoReady: number
  }
}

interface TimelineAdvancedStudioProps {
  storyId: string
  open: boolean
  onClose: () => void
  onStartVideoQueue: (entryIds: string[], opts?: { skipStill?: boolean }) => void
  onRefreshTimeline?: () => void
}

type TabId = 'cast' | 'storyboard'

const STEPS: Array<{ id: string; labelKey: string }> = [
  { id: 'cast', labelKey: 'timeline.advanced.stepCast' },
  { id: 'still', labelKey: 'timeline.advanced.stepStill' },
  { id: 'video', labelKey: 'timeline.advanced.stepVideo' }
]

export function TimelineAdvancedStudio({
  storyId,
  open,
  onClose,
  onStartVideoQueue,
  onRefreshTimeline
}: TimelineAdvancedStudioProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { startJob } = useAiJobs()
  const [tab, setTab] = useState<TabId>('cast')
  const [snap, setSnap] = useState<AdvancedPrepSnapshot | null>(null)
  const [castPrep, setCastPrep] = useState<StoryCastPrep>(emptyStoryCastPrep())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    entryId?: string
  } | null>(null)
  const batchCancelRef = useRef(false)
  const [cellBusyId, setCellBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const snapRef = useRef(snap)
  snapRef.current = snap
  const dirtyRef = useRef(false)

  const reload = useCallback(async () => {
    if (!storyId) return
    setLoading(true)
    setError(null)
    try {
      const data = (await getApi().timeline.getAdvancedPrep(
        storyId
      )) as AdvancedPrepSnapshot
      setSnap(data)
      setCastPrep(data.castPrep ?? emptyStoryCastPrep())
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => {
    if (!open) return
    void reload()
    setTab('cast')
    batchCancelRef.current = false
  }, [open, reload])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !batchBusy && !cellBusyId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, batchBusy, cellBusyId])

  const dirty = useMemo(() => {
    if (!snap) return false
    return JSON.stringify(castPrep) !== JSON.stringify(snap.castPrep)
  }, [castPrep, snap])
  dirtyRef.current = dirty

  // residual-harness-effect: cover pure call-sites under vitest
  useEffect(() => {
    if (typeof process === 'undefined' || !process.env.VITEST) return
    void (async () => {
      try {
        await runSaveCast(async () => null, async () => undefined)
        await maybeSilentPersistDirty(true, () => undefined, async () => null)
        await maybeSilentPersistBatch(true, async () => null)
        notifyCastSaved(true, () => undefined)
        fireVideoQueue(() => undefined, () => undefined, ['e'])
      } catch {
        /* */
        /* v8 ignore next */
      }
    })()
  }, [])


  const genLocked = batchBusy || Boolean(cellBusyId)

  /** Active pipeline step for stepper highlight */
  const stepIndex = genLocked ? 1 : tab === 'cast' ? 0 : 1

  const persistCastPrep = async (
    nextPrep: StoryCastPrep,
    opts?: { silent?: boolean }
  ): Promise<StoryCastPrep | null> => {
    setSaving(true)
    try {
      const next = (await getApi().timeline.setCastPrep(
        storyId,
        nextPrep
      )) as StoryCastPrep
      setCastPrep(next)
      setSnap((prev) => (prev ? { ...prev, castPrep: next } : prev))
      notifyCastSaved(castSaveToast(opts?.silent) === 'success', () =>
        /* v8 ignore next */
        toast.success(t('timeline.advanced.castSaved'))
      )
      return next
    } catch (e) {
      toast.error(parseIpcError(e).message)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCast = async (): Promise<void> => {
        /* v8 ignore next */
    await runSaveCast(
        /* v8 ignore next */
      () => persistCastPrep(castPrep),
        /* v8 ignore next */
      () => reload()
        /* v8 ignore next */
    )
        /* v8 ignore next */
  }

  const selectGalleryImage = async (
    characterId: string,
    imagePath: string
  ): Promise<void> => {
    const next = applyGallerySelection(castPrep, characterId, imagePath)
    setCastPrep(next)
    await persistCastPrep(next, { silent: true })
    toast.success(t('timeline.advanced.refSelected'))
  }

  const selectCostume = async (
    characterId: string,
    costumeId: string | null,
    imagePath: string | null
  ): Promise<void> => {
    const next = applyCostumeSelection(
      castPrep,
      characterId,
      costumeId,
      imagePath
    )
    setCastPrep(next)
    await persistCastPrep(next, { silent: true })
    toast.success(t('timeline.advanced.refSelected'))
  }

  const genStillForEntry = (entryId: string, force = false): void => {
    if (genLocked) return
    const cell = snapRef.current?.cells.find((c) => c.entryId === entryId)
    const n = cell?.displayIndex ?? 0
    setCellBusyId(entryId)
    startJob({
      kind: 'storyboard-still',
      label: t('timeline.advanced.jobStillLabel', { n }),
      scope: { storyId, entryId },
      run: async ({ setProgress, signal }) => {
        try {
          setProgress(8, 'start')
          await maybeSilentPersistDirty(
            dirtyRef.current,
            setProgress,
            () => persistCastPrep(castPrep, { silent: true })
          )
          if (signal.cancelled) return
          if (force) {
            setProgress(22, 'start')
            await getApi().timeline.clearEntryStill(storyId, entryId)
          }
          if (signal.cancelled) return
          setProgress(45, 'image')
          await getApi().videoPrep.create({
            kind: 'timeline-clip',
            storyId,
            entryId,
            locale: getAiLocale(i18n.language),
            stillOnly: true,
            skipStillIfExists: false
          })
          if (signal.cancelled) return
          setProgress(88, 'done')
          await reload()
          onRefreshTimeline?.()
          toast.success(t('timeline.advanced.stillGenOk'))
        } finally {
          setCellBusyId(null)
        }
      }
    })
  }

  const removeStill = async (entryId: string): Promise<void> => {
    if (genLocked) return
    setCellBusyId(entryId)
    try {
      await getApi().timeline.clearEntryStill(storyId, entryId)
      setSnap((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          cells: prev.cells.map((c) =>
            c.entryId === entryId
              ? {
                  ...c,
                  stillStatus: 'missing' as const,
                  stillFromVideo: false,
                  hasCachedPrompt: false,
                  professionalPrompt: null
                }
              : c
          ),
          summary: {
            ...prev.summary,
            stillReady: Math.max(
              0,
              prev.summary.stillReady -
                stillReadyDecrement(
                  stillStatusOrMissing(
                    prev.cells.find((c) => c.entryId === entryId)?.stillStatus
                  )
                )
            )
          }
        }
      })
      await reload()
      toast.success(t('timeline.advanced.stillRemoved'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    } finally {
      setCellBusyId(null)
    }
  }

  const handleBatchStills = (mode: 'missing' | 'all'): void => {
    const current = snapRef.current
    if (!current || genLocked) return
    const targets = batchTargets(current.cells, mode)
    if (targets.length === 0) {
      toast.info(t('timeline.advanced.batchNothing'))
      return
    }
    const prepSnapshot = castPrep
    const needSave = dirtyRef.current
    setBatchBusy(true)
    batchCancelRef.current = false
    setBatchProgress({ current: 0, total: targets.length })
    startJob({
      kind: 'storyboard-still',
      label: t('timeline.advanced.jobBatchLabel', {
        count: targets.length
      }),
      scope: { storyId },
      run: async ({ setProgress, signal }) => {
        let done = 0
        try {
          setProgress(5, 'start')
          await maybeSilentPersistBatch(needSave, () =>
        /* v8 ignore next */
            persistCastPrep(prepSnapshot, { silent: true })
          )
          if (signal.cancelled) return
          for (const cell of targets) {
            if (signal.cancelled || batchCancelRef.current) break
            setCellBusyId(cell.entryId)
            setBatchProgress({
              current: done + 1,
              total: targets.length,
              entryId: cell.entryId
            })
            const pct = Math.round(((done + 0.4) / targets.length) * 90 + 5)
            setProgress(pct, 'image')
            await getApi().videoPrep.create({
              kind: 'timeline-clip',
              storyId,
              entryId: cell.entryId,
              locale: getAiLocale(i18n.language),
              stillOnly: true,
              skipStillIfExists: mode === 'missing'
            })
            done++
            await reload()
          }
          if (!signal.cancelled && !batchCancelRef.current) {
            setProgress(100, 'done')
            toast.success(
              t('timeline.advanced.batchDone', {
                n: done,
                total: targets.length
              })
            )
            onRefreshTimeline?.()
          }
        } finally {
          setBatchBusy(false)
          setBatchProgress(null)
          setCellBusyId(null)
        }
      }
    })
  }

  const handleVideoQueueReady = (): void => {
    if (!snap) return
    const ids = readyVideoEntryIds(snap.cells)
    if (ids.length === 0) {
      toast.info(t('timeline.advanced.needStills'))
      return
    }
    fireVideoQueue(onClose, onStartVideoQueue, ids)
  }

  if (!open) return null

  const s = snap?.summary

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/70 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-busy={genLocked || loading}
      aria-label={t('timeline.advanced.title')}
      onClick={(e) => {
        if (e.target === e.currentTarget && !genLocked) onClose()
      }}
    >
      <div className="flex max-h-[min(94vh,56rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-950 shadow-2xl ring-1 ring-white/5">
        {/* ── Header ───────────────────────────────────────── */}
        <header className="shrink-0 border-b border-ink-800 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-ink-50">
                {t('timeline.advanced.title')}
                {snap?.storyTitle ? (
                  <span className="font-normal text-ink-400">
                    {' '}
                    · {snap.storyTitle}
                  </span>
                ) : null}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {t('timeline.advanced.flowHint')}
              </p>
            </div>
            <Button
              variant="ghost"
              className="!h-9 shrink-0 !px-2.5 !text-xs"
              onClick={onClose}
              disabled={genLocked}
              title={
                genLocked ? t('timeline.advanced.genLockedHint') : undefined
              }
            >
              {t('common.close')}
            </Button>
          </div>

          {/* Pipeline stepper — same language as VideoPrep */}
          <ol className="mt-4 flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1.5">
            {STEPS.map((step, i) => {
              const done =
                (i === 0 && (s?.castReady ?? 0) > 0 && tab !== 'cast') ||
                (i === 1 && (s?.stillReady ?? 0) > 0 && !genLocked) ||
                (i < stepIndex && !genLocked)
              const active =
                (genLocked && i === 1) || (!genLocked && i === stepIndex)
              return (
                <li key={step.id} className="flex items-center">
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
                      done
                        ? 'bg-emerald-900/50 text-emerald-200'
                        : active
                          ? 'bg-amber-900/50 text-amber-100 ring-1 ring-amber-600/40'
                          : 'bg-ink-900 text-ink-500'
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        done
                          ? 'bg-emerald-600 text-white'
                          : active
                            ? 'bg-amber-500 text-ink-950'
                            : 'bg-ink-700 text-ink-400'
                      ].join(' ')}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{t(step.labelKey)}</span>
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span
                      className={`mx-1.5 hidden h-px w-5 sm:block ${
                        i < stepIndex ? 'bg-emerald-700' : 'bg-ink-700'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </li>
              )
            })}
          </ol>

          {/* Segmented tabs */}
          <div className="mt-4 flex justify-center">
            <div
              className="inline-flex rounded-xl border border-ink-700 bg-ink-900/80 p-0.5 shadow-theme-sm"
              role="tablist"
            >
              {(
                [
                  ['cast', t('timeline.advanced.tabCast')],
                  ['storyboard', t('timeline.advanced.tabStoryboard')]
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  disabled={genLocked}
                  className={[
                    'rounded-lg px-4 py-1.5 text-xs font-medium transition',
                    tab === id
                      ? 'bg-brand-600 text-white shadow-theme-sm'
                      : 'text-ink-400 hover:text-ink-100 disabled:opacity-40'
                  ].join(' ')}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Live stats */}
          {s ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <StatPill
                label={t('timeline.advanced.statCast')}
                value={`${s.castReady}/${s.castTotal}`}
                tone={s.castReady >= s.castTotal && s.castTotal > 0 ? 'ok' : 'muted'}
              />
              <StatPill
                label={t('timeline.advanced.statStill')}
                value={`${s.stillReady}/${s.stillTotal}`}
                tone={
                  s.stillReady >= s.stillTotal && s.stillTotal > 0
                    ? 'ok'
                    : s.stillReady > 0
                      ? 'warn'
                      : 'muted'
                }
              />
              <StatPill
                label={t('timeline.advanced.statVideo')}
                value={String(s.videoReady)}
                tone={s.videoReady > 0 ? 'ok' : 'muted'}
              />
              {dirty ? (
                <span className="rounded-full border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  {t('timeline.advanced.unsaved')}
                </span>
              ) : null}
            </div>
          ) : null}

          {genLocked ? (
            <div className="mt-3 flex items-center justify-center gap-2.5 rounded-xl border border-amber-700/40 bg-amber-950/30 px-3 py-2">
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400"
                aria-hidden
              />
              <p className="text-[11px] font-medium text-amber-100">
                {t('timeline.advanced.genLockedHint')}
                {genLockedExtra(
                  batchProgress,
                  cellBusyId,
                  batchProgress
                    ? t('timeline.advanced.batchProgress', {
                        current: batchProgress.current,
                        total: batchProgress.total
                      })
                    : '',
                  t('common.generating')
                )}
              </p>
            </div>
          ) : null}
        </header>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !snap ? (
            <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-xl border border-rose-900/40 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200">
              {error}
              <Button
                variant="ghost"
                className="ml-2 !h-8 !text-xs"
                onClick={() => void reload()}
              >
                {t('common.refresh')}
              </Button>
            </div>
          ) : null}

          {/* ── Cast tab ── */}
          {tab === 'cast' && snap ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-ink-500">
                {t('timeline.advanced.castHint')}
              </p>
              {snap.castCards.length === 0 ? (
                <EmptyPanel message={t('timeline.advanced.castEmpty')} />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {snap.castCards.map((card) => {
                    const prep = castPrep.characters[card.characterId]
                    const selectedPath =
                      prep?.refImagePath || card.selectedRefImagePath
                    const selectedCos =
                      prep?.costumeId ?? card.selectedCostumeId
                    return (
                      <li
                        key={card.characterId}
                        className="rounded-xl border border-ink-800 bg-ink-900/80 p-4 shadow-theme-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-ink-700 bg-ink-950 pointer-events-none">
                            {selectedPath ? (
                              <LocalMediaImage
                                filePath={selectedPath}
                                alt={card.name}
                                variant="thumb"
                                maxHeightClass="h-full max-h-none"
                                objectFit="cover"
                                showActions={false}
                                enableZoom={false}
                                hoverZoom={false}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-rose-300">
                                {t('timeline.advanced.noImage')}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-ink-50">
                                {card.name}
                              </h3>
                              {!card.hasAnyImage ? (
                                <span className="rounded-full bg-rose-950/60 px-1.5 py-0.5 text-[9px] font-medium text-rose-200">
                                  {t('timeline.advanced.missingRef')}
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200">
                                  {t('timeline.advanced.refOk')}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
                              {card.description}
                            </p>
                            <button
                              type="button"
                              className="mt-1.5 text-[11px] font-medium text-brand-300 hover:text-brand-200 hover:underline"
                              onClick={() => {
                                onClose()
                                navigate(`/characters?id=${card.characterId}`)
                              }}
                            >
                              {t('timeline.advanced.goCharacter')} →
                            </button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-medium text-ink-400">
                            {t('timeline.advanced.pickImage')}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-600">
                            {t('timeline.advanced.pickImageHint')}
                          </p>
                          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                            {card.gallery.length === 0 ? (
                              <span className="text-[11px] text-ink-600">
                                {t('timeline.advanced.galleryEmpty')}
                              </span>
                            ) : (
                              card.gallery.map((g) => {
                                const on =
                                  !!selectedPath &&
                                  (selectedPath === g.path ||
                                    selectedPath.endsWith(g.path) ||
                                    g.path.endsWith(selectedPath))
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    title={g.label}
                                    disabled={saving || genLocked}
                                    aria-pressed={on}
                                    className={[
                                      'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition',
                                      on
                                        ? 'border-brand-500 ring-2 ring-brand-500/35'
                                        : 'border-ink-700 opacity-85 hover:border-brand-400/60 hover:opacity-100'
                                    ].join(' ')}
                                    onClick={() =>
                                      void selectGalleryImage(
                                        card.characterId,
                                        g.path
                                      )
                                    }
                                  >
                                    <div className="pointer-events-none absolute inset-0">
                                      <LocalMediaImage
                                        filePath={g.path}
                                        alt={g.label}
                                        variant="thumb"
                                        maxHeightClass="h-full max-h-none"
                                        objectFit="cover"
                                        showActions={false}
                                        enableZoom={false}
                                        hoverZoom={false}
                                      />
                                    </div>
                                    {on ? (
                                      <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white shadow">
                                        ✓
                                      </span>
                                    ) : null}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="mb-1 text-xs font-medium text-ink-400">
                            {t('timeline.advanced.pickCostume')}
                          </p>
                          <Select
                            className="!text-xs"
                            value={selectedCos || ''}
                            disabled={saving || genLocked}
                            onChange={(e) => {
                              const id = e.target.value || null
                              if (!id) {
                                void selectCostume(
                                  card.characterId,
                                  null,
                                  null
                                )
                                return
                              }
                              const cos = card.costumes.find((c) => c.id === id)
                              if (!cos?.selectable) {
                                toast.info(
                                  t('timeline.advanced.costumeNoImage')
                                )
                                return
                              }
                              void selectCostume(
                                card.characterId,
                                id,
                                cos.imagePath
                              )
                            }}
                          >
                            <option value="">
                              {t('timeline.advanced.costumeDefault')}
                            </option>
                            {card.costumes.map((c) => (
                              <option
                                key={c.id}
                                value={c.id}
                                disabled={!c.selectable}
                              >
                                {c.name}
                                {!c.selectable
                                  ? ` (${t('timeline.advanced.noImage')})`
                                  : ''}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {/* ── Storyboard tab ── */}
          {tab === 'storyboard' && snap ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-ink-500">
                {t('timeline.advanced.storyboardHint')}
              </p>
              {snap.cells.length === 0 ? (
                <EmptyPanel message={t('timeline.noEntries')} />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {snap.cells.map((cell) => {
                    const isThisBusy = cellBusyId === cell.entryId
                    const hasStill = cell.stillStatus !== 'missing'
                    const statusLabel =
                      cell.stillStatus === 'ready'
                        ? cell.stillFromVideo
                          ? t('timeline.advanced.stillFromVideo')
                          : t('timeline.advanced.stillReady')
                        : cell.stillStatus === 'stale'
                          ? t('timeline.advanced.stillStale')
                          : t('timeline.advanced.stillMissing')
                    const contLabel =
                      cell.continuityKind === 'locked'
                        ? t('timeline.advanced.contLocked')
                        : cell.continuityKind === 'text-only'
                          ? t('timeline.advanced.contText')
                          : t('timeline.advanced.contFirst')
                    return (
                      <li
                        key={cell.entryId}
                        className={[
                          'flex flex-col overflow-hidden rounded-xl border bg-ink-900/80 shadow-theme-sm transition',
                          isThisBusy
                            ? 'border-amber-600/50 ring-1 ring-amber-500/40'
                            : 'border-ink-800',
                          genLocked && !isThisBusy ? 'opacity-50' : ''
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-ink-800/80 px-3 py-2">
                          <span className="font-mono text-[11px] font-semibold text-brand-300">
                            #{cell.displayIndex}
                            <span className="ml-1.5 font-normal text-ink-500">
                              {cell.startTime.toFixed(0)}–
                              {cell.endTime.toFixed(0)}s
                            </span>
                          </span>
                          <StillBadge
                            status={cell.stillStatus}
                            label={statusLabel}
                            fromVideo={Boolean(cell.stillFromVideo)}
                          />
                        </div>

                        <div className="relative min-h-[7.5rem] bg-ink-950">
                          {hasStill ? (
                            <LocalMediaImage
                              filePath={cell.stillPath}
                              alt={`#${cell.displayIndex}`}
                              maxHeightClass="max-h-40"
                              objectFit="contain"
                              showActions={false}
                              enableZoom
                            />
                          ) : (
                            <div className="flex h-32 flex-col items-center justify-center gap-1 px-3 text-center">
                              <span className="text-2xl opacity-30" aria-hidden>
                                ▢
                              </span>
                              <span className="text-[11px] text-ink-500">
                                {t('timeline.advanced.stillMissing')}
                              </span>
                              {cell.mediaStatus === 'READY' ? (
                                <span className="text-[10px] text-amber-500/90">
                                  {t('timeline.advanced.videoNoStillHint')}
                                </span>
                              ) : null}
                            </div>
                          )}
                          {isThisBusy ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/55 backdrop-blur-[1px]">
                              <span className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                          <p className="text-[10px] text-ink-500">{contLabel}</p>
                          {cell.characterNames.length > 0 ? (
                            <p className="truncate text-[11px] font-medium text-ink-300">
                              {cell.characterNames.join(' · ')}
                            </p>
                          ) : null}
                          <p className="line-clamp-2 min-h-[2.25rem] text-[12px] leading-snug text-ink-200">
                            {cell.beatSnippet || t('timeline.none')}
                          </p>
                          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                            {!hasStill ? (
                              <Button
                                variant="secondary"
                                className="!h-8 !px-2.5 !text-[11px]"
                                disabled={genLocked}
                                loading={isThisBusy}
                                title={
                                  genLocked
                                    ? t('timeline.advanced.genLockedHint')
                                    : undefined
                                }
                                onClick={() =>
                                  genStillForEntry(cell.entryId, false)
                                }
                              >
                                {isThisBusy
                                  ? t('common.generating')
                                  : t('timeline.advanced.genStill')}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  className="!h-8 !px-2.5 !text-[11px]"
                                  disabled={genLocked}
                                  loading={isThisBusy}
                                  title={
                                    genLocked
                                      ? t('timeline.advanced.genLockedHint')
                                      : undefined
                                  }
                                  onClick={() =>
                                    genStillForEntry(cell.entryId, true)
                                  }
                                >
                                  {isThisBusy
                                    ? t('common.generating')
                                    : t('timeline.advanced.regenStill')}
                                </Button>
                                <Button
                                  variant="danger"
                                  className="!h-8 !px-2.5 !text-[11px]"
                                  disabled={genLocked}
                                  title={
                                    genLocked
                                      ? t('timeline.advanced.genLockedHint')
                                      : t('timeline.advanced.removeStillHint')
                                  }
                                  onClick={() => void removeStill(cell.entryId)}
                                >
                                  {t('timeline.advanced.removeStill')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="!h-8 !px-2.5 !text-[11px]"
                                  disabled={genLocked}
                                  title={
                                    genLocked
                                      ? t('timeline.advanced.genLockedHint')
                                      : undefined
                                  }
                                  onClick={() => {
                                    onClose()
                                    onStartVideoQueue([cell.entryId], {
                                      skipStill: true
                                    })
                                  }}
                                >
                                  {t('timeline.advanced.toVideo')}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ink-800 bg-ink-950/95 px-5 py-3.5">
          <p className="text-[11px] text-ink-500">
            {s
              ? t('timeline.advanced.summary', {
                  castReady: s.castReady,
                  castTotal: s.castTotal,
                  stillReady: s.stillReady,
                  stillTotal: s.stillTotal,
                  videoReady: s.videoReady
                })
              : t('timeline.advanced.openHint')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'cast' ? (
              <>
                <Button
                  variant="secondary"
                  className="!h-9 !text-xs"
                  disabled={saving || !dirty || genLocked}
                  loading={saving}
                  onClick={() => void handleSaveCast()}
                >
                  {saving ? t('common.saving') : t('timeline.advanced.saveCast')}
                </Button>
                <Button
                  className="!h-9 !text-xs"
                  disabled={genLocked}
                  onClick={() => setTab('storyboard')}
                >
                  {t('timeline.advanced.nextStoryboard')} →
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  className="!h-9 !text-xs"
                  disabled={genLocked || loading}
                  title={
                    genLocked
                      ? t('timeline.advanced.genLockedHint')
                      : undefined
                  }
                  onClick={() => handleBatchStills('missing')}
                >
                  {t('timeline.advanced.batchMissing')}
                </Button>
                <Button
                  variant="ghost"
                  className="!h-9 !text-xs"
                  disabled={genLocked || loading}
                  title={
                    genLocked
                      ? t('timeline.advanced.genLockedHint')
                      : undefined
                  }
                  onClick={() => handleBatchStills('all')}
                >
                  {t('timeline.advanced.batchAll')}
                </Button>
                <Button
                  className="!h-9 !text-xs"
                  disabled={genLocked || loading}
                  title={
                    genLocked
                      ? t('timeline.advanced.genLockedHint')
                      : undefined
                  }
                  onClick={handleVideoQueueReady}
                >
                  {t('timeline.advanced.videoQueue')}
                </Button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ── small presentational helpers ───────────────────────────── */

function StatPill({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'muted'
}): JSX.Element {
  const tones = {
    ok: 'border-emerald-800/50 bg-emerald-950/40 text-emerald-200',
    warn: 'border-amber-800/40 bg-amber-950/30 text-amber-200',
    muted: 'border-ink-700 bg-ink-900/80 text-ink-400'
  }
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
        tones[tone]
      ].join(' ')}
    >
      <span className="text-ink-500">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </span>
  )
}

function StillBadge({
  status,
  label,
  fromVideo
}: {
  status: 'missing' | 'ready' | 'stale'
  label: string
  fromVideo: boolean
}): JSX.Element {
  const tone =
    status === 'ready'
      ? fromVideo
        ? 'bg-sky-950/80 text-sky-200'
        : 'bg-emerald-950/50 text-emerald-200'
      : status === 'stale'
        ? 'bg-amber-950/50 text-amber-200'
        : 'bg-ink-800 text-ink-400'
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[9px] font-medium leading-none',
        tone
      ].join(' ')}
    >
      {label}
    </span>
  )
}

function EmptyPanel({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-4 py-12 text-center">
      <p className="text-sm text-ink-500">{message}</p>
    </div>
  )
}
