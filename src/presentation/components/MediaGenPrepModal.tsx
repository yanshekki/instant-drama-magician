/**
 * Unified image/video shell: materials → polish → (image result | video keyframe → confirm → done).
 * One modal for the whole journey — no jump to a second wizard.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  groupMaterialSections,
  isMediaGenPrepPhaseLocked,
  mediaGenMode,
  shellPhaseToStepIndex,
  shellStepLabelKey,
  shellStepsForMode,
  type MediaGenKind,
  type MediaGenMaterialSection,
  type MediaGenShellPhase
} from '../../domain/mediaGenPrep'
import { getApi } from '../../lib/api'
import { formatIpcError } from '../../lib/ipc'
import { getAiLocale } from '../../lib/aiLocale'
import { Button, Label, Textarea } from './ui'
import { LocalMediaImage } from './LocalMediaImage'

function SectionThumb({
  filePath,
  sizeClass = 'h-14 w-14',
  fit = 'cover'
}: {
  filePath: string
  sizeClass?: string
  /** cover crops; contain keeps full subject (better for sheets / multi-panel). */
  fit?: 'cover' | 'contain'
}): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void getApi()
      .media.toPreviewUrl(filePath)
      .then((r) => {
        if (!cancelled) setUrl(r.url)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [filePath])
  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className={`h-full w-full ${
            fit === 'contain' ? 'object-contain' : 'object-cover'
          }`}
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-500">
          …
        </div>
      )}
    </div>
  )
}

export type MediaGenPrepKind =
  | 'action-plate'
  | 'character-sheet'
  | 'scene-plate'
  | 'prop-plate'
  | 'story-cover'
  | 'costume-dress'
  | 'costume-swap'
  | 'atmosphere-swap'
  | 'timeline-still'
  | 'character-intro'
  | 'scene-intro'
  | 'prop-intro'
  | 'costume-intro'
  | 'action-intro'
  | 'timeline-clip'

export interface MediaGenPrepOpenRequest {
  kind: MediaGenPrepKind
  actionId?: string
  characterId?: string
  sceneId?: string
  propId?: string
  storyId?: string
  costumeId?: string
  entryId?: string
  panelLayout?: string | null
  artStyle?: string | null
  sheetVariant?: string | null
  galleryIdentityPaths?: string[]
  preferIdentityEdit?: boolean
  /** Costume swap / dress description */
  costumeDescription?: string
  /** Atmosphere swap text */
  atmosphereDescription?: string
  durationSeconds?: number
}

export interface MediaGenPrepResult {
  path: string
  panelLayout?: string
  artStyle?: string
  usedEdit?: boolean
  promptUsed?: string
}

function entityLabel(
  t: (k: string, o?: Record<string, unknown>) => string,
  entityType?: string
): string {
  if (!entityType) return ''
  const key = `mediaGen.entity.${entityType}`
  const v = t(key)
  return v === key ? entityType : v
}

function sectionHeading(
  t: (k: string, o?: Record<string, unknown>) => string,
  s: MediaGenMaterialSection
): string {
  const typeLabel = entityLabel(t, s.entityType)
  if (s.entityType === 'gallery') {
    return t('mediaGen.galleryBoard', { n: s.title })
  }
  if (s.entityType === 'layout') {
    return t('mediaGen.layoutTitle', { id: s.title })
  }
  if (s.entityType === 'hardRules') {
    return t('mediaGen.hardRulesTitle')
  }
  if (typeLabel && s.title) return `${typeLabel} · ${s.title}`
  return s.title || typeLabel || s.id
}

export function MediaGenPrepModal({
  open,
  request,
  onClose,
  onGenerated
}: {
  open: boolean
  request: MediaGenPrepOpenRequest | null
  onClose: () => void
  /** Image accept / still ready for host (gallery draft). */
  onGenerated: (result: MediaGenPrepResult) => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const mode = request
    ? mediaGenMode(request.kind as MediaGenKind)
    : 'image'
  const shellSteps = shellStepsForMode(mode)

  const [phase, setPhase] = useState<MediaGenShellPhase>('loading-extract')
  const [sections, setSections] = useState<MediaGenMaterialSection[]>([])
  const [editBaseSectionId, setEditBaseSectionId] = useState<string | null>(
    null
  )
  const [fallbackPrompt, setFallbackPrompt] = useState('')
  const [taskHint, setTaskHint] = useState('')
  const [hardRules, setHardRules] = useState<string | null>(null)
  const [genOptions, setGenOptions] = useState<{
    panelLayout?: string
    artStyle?: string
    useIdentityEdit: boolean
  }>({ useIdentityEdit: false })
  const [polishedPrompt, setPolishedPrompt] = useState('')
  const [userExtra, setUserExtra] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(10)
  const [polishedFlag, setPolishedFlag] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resultPath, setResultPath] = useState<string | null>(null)
  const [resultMeta, setResultMeta] = useState<MediaGenPrepResult | null>(null)
  const [videoPath, setVideoPath] = useState<string | null>(null)

  const locked = isMediaGenPrepPhaseLocked(phase) || busy

  const loadExtract = useCallback(async (): Promise<void> => {
    if (!request) return
    setPhase('loading-extract')
    setErrorMessage(null)
    try {
      const r = await getApi().mediaGen.extract({
        kind: request.kind,
        actionId: request.actionId,
        characterId: request.characterId,
        sceneId: request.sceneId,
        propId: request.propId,
        storyId: request.storyId,
        costumeId: request.costumeId,
        entryId: request.entryId,
        panelLayout: request.panelLayout,
        artStyle: request.artStyle,
        sheetVariant: request.sheetVariant,
        galleryIdentityPaths: request.galleryIdentityPaths,
        preferIdentityEdit: request.preferIdentityEdit,
        atmosphereDescription: request.atmosphereDescription,
        durationSeconds: request.durationSeconds,
        locale: getAiLocale(i18n.language)
      } as never)
      setSections(r.sections as MediaGenMaterialSection[])
      setEditBaseSectionId(r.editBaseSectionId ?? null)
      setFallbackPrompt(r.fallbackPrompt ?? '')
      setTaskHint(r.taskHint ?? '')
      setHardRules(r.hardRules ?? null)
      setGenOptions(r.genOptions)
      setPolishedPrompt('')
      setUserExtra('')
      setDurationSeconds(request.durationSeconds ?? 10)
      setResultPath(null)
      setResultMeta(null)
      setVideoPath(null)
      setPhase('materials')
    } catch (e) {
      setErrorMessage(formatIpcError(e))
      setPhase('error')
    }
  }, [request, i18n.language])

  useEffect(() => {
    if (!open || !request) return
    void loadExtract()
    // Re-extract when entity / kind changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    request?.kind,
    request?.actionId,
    request?.characterId,
    request?.sceneId,
    request?.propId,
    request?.storyId,
    loadExtract
  ])

  const groups = useMemo(() => groupMaterialSections(sections), [sections])

  const editBaseCandidates = useMemo(
    () =>
      sections.filter(
        (s) => s.include && s.canBeEditBase && s.imagePath?.trim()
      ),
    [sections]
  )

  const toggleInclude = (id: string): void => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const next = !s.include
        return { ...s, include: next }
      })
    )
    // If un-including current edit base, clear it
    setEditBaseSectionId((cur) => {
      if (cur !== id) return cur
      return null
    })
  }

  const setAllInGroup = (
    list: MediaGenMaterialSection[],
    include: boolean
  ): void => {
    const ids = new Set(list.map((s) => s.id))
    setSections((prev) =>
      prev.map((s) => (ids.has(s.id) ? { ...s, include } : s))
    )
    if (!include) {
      setEditBaseSectionId((cur) =>
        cur && ids.has(cur) ? null : cur
      )
    }
  }

  const handlePolish = async (): Promise<void> => {
    setBusy(true)
    setPhase('loading-polish')
    setErrorMessage(null)
    try {
      const included = sections.filter((s) => s.include)
      const r = await getApi().mediaGen.polish({
        kind: request!.kind,
        includedSections: included as never,
        fallbackPrompt,
        taskHint,
        hardRules,
        locale: getAiLocale(i18n.language)
      })
      setPolishedPrompt(r.polishedPrompt)
      setPolishedFlag(r.polished)
      setImageCount(r.imageCount)
      setPhase('review-prompt')
    } catch (e) {
      setErrorMessage(formatIpcError(e))
      setPhase('materials')
    } finally {
      setBusy(false)
    }
  }

  const runGenerateStill = async (): Promise<void> => {
    if (!request || !polishedPrompt.trim()) return
    setBusy(true)
    setPhase('loading-generate')
    setErrorMessage(null)
    try {
      const baseSec = sections.find((s) => s.id === editBaseSectionId)
      const editBasePath =
        baseSec?.include && baseSec.canBeEditBase
          ? baseSec.imagePath?.trim() || null
          : null
      const useIdentityEdit = Boolean(editBasePath)
      const isTimeline =
        request.kind === 'timeline-still' || request.kind === 'timeline-clip'
      const r = await getApi().mediaGen.generateImage({
        kind: request.kind,
        actionId: request.actionId,
        characterId: request.characterId,
        sceneId: request.sceneId,
        propId: request.propId,
        storyId: request.storyId,
        entryId: request.entryId,
        costumeId: request.costumeId,
        polishedPrompt: polishedPrompt.trim(),
        editBasePath,
        useIdentityEdit,
        panelLayout: genOptions.panelLayout ?? request.panelLayout,
        artStyle: genOptions.artStyle ?? request.artStyle,
        sheetVariant: request.sheetVariant,
        hardRules,
        // Timeline refine writes continuity still immediately
        persist: isTimeline
      } as never)
      const meta: MediaGenPrepResult = {
        path: r.path,
        panelLayout: r.panelLayout,
        artStyle: r.artStyle,
        usedEdit: r.usedEdit,
        promptUsed: r.promptUsed || polishedPrompt.trim()
      }
      setResultPath(r.path)
      setResultMeta(meta)
      if (mode === 'video') {
        setPhase('keyframe')
      } else {
        setPhase('result')
      }
    } catch (e) {
      setErrorMessage(formatIpcError(e))
      setPhase(mode === 'video' ? 'review-prompt' : 'review-prompt')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmVideo = async (): Promise<void> => {
    if (!request || !resultPath || !polishedPrompt.trim()) return
    setBusy(true)
    setPhase('loading-video')
    setErrorMessage(null)
    try {
      const entityIds = {
        characterId: request.characterId,
        sceneId: request.sceneId,
        propId: request.propId,
        costumeId: request.costumeId,
        actionId: request.actionId,
        storyId: request.storyId,
        entryId: request.entryId
      }
      const r = await getApi().videoPrep.confirm({
        kind: request.kind as
          | 'character-intro'
          | 'scene-intro'
          | 'prop-intro'
          | 'costume-intro'
          | 'action-intro'
          | 'timeline-clip',
        professionalPrompt: polishedPrompt.trim(),
        userExtraPrompt: userExtra.trim() || null,
        stillPath: resultPath,
        sourceImagePath:
          request.galleryIdentityPaths?.[0] ?? resultPath,
        ...entityIds,
        durationSeconds: durationSeconds || request.durationSeconds || 10,
        aspectRatio: '16:9',
        locale: getAiLocale(i18n.language)
      })
      setVideoPath(r.path)
      setPhase('video-done')
      // Same event as VideoPrepHost — pages reload gallery introVideoPath + play buttons
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: request.kind,
            entityIds,
            degraded: Boolean((r as { degraded?: boolean }).degraded),
            path: r.path,
            gallery: r.gallery,
            stillPath: resultPath,
            sourceImagePath:
              request.galleryIdentityPaths?.[0] ?? resultPath
          }
        })
      )
    } catch (e) {
      setErrorMessage(formatIpcError(e))
      setPhase('confirm-video')
    } finally {
      setBusy(false)
    }
  }

  const acceptImageResult = (): void => {
    if (!resultMeta) return
    onGenerated(resultMeta)
    onClose()
  }

  if (!open || !request) return null
  if (typeof document === 'undefined') return null

  const includedCount = sections.filter((s) => s.include).length
  const includedImageSections = sections.filter(
    (s) => s.include && s.imagePath?.trim()
  )
  const includedImages = includedImageSections.length
  const includedTextOnly = sections.filter(
    (s) => s.include && !s.imagePath?.trim()
  )

  const stepIndex = shellPhaseToStepIndex(phase, mode)
  const kindLabel = t(`mediaGen.kind.${request.kind}`, {
    defaultValue: request.kind
  })
  const shellTitle =
    mode === 'video'
      ? `${t('mediaGen.titleVideo')} · ${kindLabel}`
      : `${t('mediaGen.titleImage')} · ${kindLabel}`
  const shellSubtitle =
    mode === 'video' ? t('mediaGen.subtitleVideo') : t('mediaGen.subtitleImage')

  const renderSectionRow = (s: MediaGenMaterialSection): JSX.Element => {
    const openTech = expandedId === s.id
    return (
      <div
        key={s.id}
        className={`flex gap-3 rounded-xl border p-3 ${
          s.include
            ? 'border-brand-600/40 bg-brand-950/15'
            : 'border-ink-800 bg-ink-900/30 opacity-80'
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-brand-500"
          checked={s.include}
          onChange={() => toggleInclude(s.id)}
          aria-label={sectionHeading(t, s)}
        />
        {s.imagePath?.trim() ? (
          <SectionThumb filePath={s.imagePath.trim()} />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 text-[10px] text-ink-500">
            {t('mediaGen.textOnly')}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink-50">
              {sectionHeading(t, s)}
            </span>
            {s.entityType ? (
              <span className="rounded-full border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-400">
                {entityLabel(t, s.entityType)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {s.imagePath?.trim()
              ? t('mediaGen.rowHintImage')
              : t('mediaGen.rowHintText')}
          </p>
          <button
            type="button"
            className="mt-1 text-[11px] text-ink-500 underline hover:text-ink-300"
            onClick={() => setExpandedId(openTech ? null : s.id)}
          >
            {openTech ? t('mediaGen.hideTech') : t('mediaGen.showTech')}
          </button>
          {openTech ? (
            <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-950/80 p-2 font-mono text-[10px] leading-relaxed text-ink-400">
              {s.text}
            </pre>
          ) : null}
        </div>
      </div>
    )
  }

  const renderGroup = (
    title: string,
    hint: string,
    list: MediaGenMaterialSection[]
  ): JSX.Element | null => {
    if (list.length === 0) return null
    return (
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-300">
              {title}
            </h3>
            <p className="text-[11px] text-ink-500">{hint}</p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              className="text-ink-400 underline hover:text-ink-200"
              onClick={() => setAllInGroup(list, true)}
            >
              {t('mediaGen.selectAll')}
            </button>
            <button
              type="button"
              className="text-ink-400 underline hover:text-ink-200"
              onClick={() => setAllInGroup(list, false)}
            >
              {t('mediaGen.selectNone')}
            </button>
          </div>
        </div>
        <div className="space-y-2">{list.map(renderSectionRow)}</div>
      </section>
    )
  }

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-ink-950/90 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-busy={locked}
      aria-label={shellTitle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border-0 border-ink-600 bg-ink-950 shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl sm:border pb-[env(safe-area-inset-bottom,0px)]">
        <header className="shrink-0 border-b border-ink-800 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    mode === 'video'
                      ? 'bg-violet-950/80 text-violet-200 ring-1 ring-violet-600/50'
                      : 'bg-sky-950/80 text-sky-200 ring-1 ring-sky-600/50'
                  }`}
                >
                  {mode === 'video'
                    ? t('mediaGen.modePillVideo')
                    : t('mediaGen.modePillImage')}
                </span>
                <h2 className="text-base font-semibold text-ink-50">
                  {shellTitle}
                </h2>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-500">{shellSubtitle}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-ink-600 px-2.5 py-1 text-sm text-ink-200 hover:bg-ink-800 disabled:opacity-40"
              disabled={locked}
              onClick={onClose}
              aria-label={t('common.cancel')}
            >
              ✕
            </button>
          </div>
          <ol className="mt-3 flex gap-1.5 text-[10px] sm:gap-2 sm:text-[11px]">
            {shellSteps.map((stepId, i) => {
              const label = t(`mediaGen.steps.${shellStepLabelKey(stepId)}`)
              const done = i < stepIndex
              const current = i === stepIndex
              return (
                <li
                  key={stepId}
                  className={`min-w-0 flex-1 rounded-lg border px-1 py-1.5 text-center sm:px-2 ${
                    current
                      ? 'border-brand-500/60 bg-brand-950/40 text-brand-200'
                      : done
                        ? 'border-emerald-800/50 text-emerald-400/90'
                        : 'border-ink-800 text-ink-600'
                  }`}
                >
                  <span className="hidden sm:inline">
                    {done ? '✓ ' : `${i + 1}. `}
                  </span>
                  <span className="sm:hidden">{done ? '✓' : i + 1}</span>
                  <span className="ml-0.5 sm:ml-0">{label}</span>
                </li>
              )
            })}
          </ol>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {(phase === 'loading-extract' ||
            phase === 'loading-polish' ||
            phase === 'loading-generate' ||
            phase === 'loading-video') && (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-sm text-ink-300">
                {phase === 'loading-extract'
                  ? t('mediaGen.phase.extract')
                  : phase === 'loading-polish'
                    ? t('mediaGen.phase.polish', { count: includedImages })
                    : phase === 'loading-video'
                      ? t('mediaGen.phase.loadingVideo', {
                          defaultValue: t('videoPrep.phase.loadingVideo')
                        })
                      : mode === 'video'
                        ? t('mediaGen.phase.loadingKeyframe', {
                            defaultValue: 'Generating keyframe…'
                          })
                        : t('mediaGen.phase.generate')}
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="space-y-3 py-6">
              <p className="text-sm text-rose-300">{errorMessage}</p>
              <Button onClick={() => void loadExtract()}>
                {t('common.retry')}
              </Button>
            </div>
          )}

          {phase === 'materials' && (
            <div className="space-y-5">
              {errorMessage ? (
                <p className="text-[12px] text-rose-300">{errorMessage}</p>
              ) : null}

              {/* Mode callout — multi vs single edit base */}
              <div className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
                <h3 className="text-xs font-semibold text-ink-200">
                  {t('mediaGen.modeTitle')}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                  {t('mediaGen.modeExplain')}
                </p>
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-800 p-2 hover:bg-ink-900">
                    <input
                      type="radio"
                      name="genMode"
                      className="mt-0.5 accent-brand-500"
                      checked={!editBaseSectionId}
                      onChange={() => setEditBaseSectionId(null)}
                    />
                    <span>
                      <span className="block text-[12px] font-medium text-ink-100">
                        {t('mediaGen.modePure')}
                      </span>
                      <span className="block text-[11px] text-ink-500">
                        {t('mediaGen.modePureHint')}
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex items-start gap-2 rounded-lg border border-ink-800 p-2 ${
                      editBaseCandidates.length === 0
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:bg-ink-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="genMode"
                      className="mt-0.5 accent-brand-500"
                      disabled={editBaseCandidates.length === 0}
                      checked={Boolean(editBaseSectionId)}
                      onChange={() => {
                        if (editBaseCandidates[0]) {
                          setEditBaseSectionId(editBaseCandidates[0].id)
                        }
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium text-ink-100">
                        {t('mediaGen.modeEdit')}
                      </span>
                      <span className="block text-[11px] text-ink-500">
                        {t('mediaGen.modeEditHint')}
                      </span>
                      {editBaseSectionId ? (
                        <select
                          className="mt-2 w-full rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-[12px] text-ink-100"
                          value={editBaseSectionId}
                          onChange={(e) =>
                            setEditBaseSectionId(e.target.value || null)
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editBaseCandidates.map((s) => (
                            <option key={s.id} value={s.id}>
                              {sectionHeading(t, s)}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </span>
                  </label>
                </div>
              </div>

              {renderGroup(
                t('mediaGen.groupRefs'),
                t('mediaGen.groupRefsHint'),
                groups.refs
              )}
              {renderGroup(
                t('mediaGen.groupTask'),
                t('mediaGen.groupTaskHint'),
                groups.task
              )}
              {renderGroup(
                t('mediaGen.groupRules'),
                t('mediaGen.groupRulesHint'),
                groups.rules
              )}

              <p className="text-[11px] text-ink-500">
                {t('mediaGen.selectedSummary', {
                  sections: includedCount,
                  images: includedImages
                })}
              </p>
            </div>
          )}

          {phase === 'review-prompt' && (
            <div className="space-y-3">
              {errorMessage ? (
                <p className="text-[12px] text-rose-300">{errorMessage}</p>
              ) : null}
              <p className="text-[12px] text-ink-400">
                {polishedFlag
                  ? t('mediaGen.polishOk', { count: imageCount })
                  : t('mediaGen.polishFallback')}
              </p>

              {/* Reference stills used in multi-vision polish */}
              <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-3">
                <h3 className="text-xs font-semibold text-ink-200">
                  {t('mediaGen.reviewRefsTitle')}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {t('mediaGen.reviewRefsHint')}
                </p>
                {includedImageSections.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {includedImageSections.map((s, i) => {
                      const isBase = editBaseSectionId === s.id
                      const heading = sectionHeading(t, s)
                      return (
                        <li
                          key={s.id}
                          className={`flex min-w-0 max-w-full items-center gap-3 rounded-xl border p-2 sm:w-[calc(50%-0.25rem)] ${
                            isBase
                              ? 'border-brand-500/70 bg-brand-950/30'
                              : 'border-ink-700 bg-ink-950/50'
                          }`}
                        >
                          <SectionThumb
                            filePath={s.imagePath!.trim()}
                            sizeClass="h-16 w-16 sm:h-20 sm:w-20"
                            fit="contain"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-200">
                                Ref#{i + 1}
                              </span>
                              {isBase ? (
                                <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  {t('mediaGen.reviewEditBaseBadge')}
                                </span>
                              ) : null}
                            </div>
                            <p
                              className="mt-1 truncate text-[12px] font-medium text-ink-100"
                              title={heading}
                            >
                              {heading}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-amber-200/90">
                    {t('mediaGen.reviewRefsNone')}
                  </p>
                )}
                {editBaseSectionId ? (
                  <p className="mt-2 text-[11px] text-ink-400">
                    {t('mediaGen.reviewModeEdit')}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-ink-400">
                    {t('mediaGen.reviewModePure')}
                  </p>
                )}
                {includedTextOnly.length > 0 ? (
                  <p className="mt-1 text-[10px] text-ink-500">
                    {t('mediaGen.reviewTextAlso', {
                      count: includedTextOnly.length
                    })}
                  </p>
                ) : null}
              </div>

              <div>
                <Label>
                  {mode === 'video'
                    ? t('mediaGen.polishPromptVideo')
                    : t('mediaGen.polishPromptImage')}
                </Label>
                <p className="mb-1 text-[10px] text-ink-500">
                  {mode === 'video'
                    ? t('mediaGen.polishPromptVideoHint')
                    : t('mediaGen.polishPromptImageHint')}
                </p>
                <Textarea
                  size="lg"
                  className="mt-1 min-h-[min(32vh,16rem)] font-mono text-[12px]"
                  value={polishedPrompt}
                  onChange={(e) => setPolishedPrompt(e.target.value)}
                  dir="auto"
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {/* Image result */}
          {phase === 'result' && resultPath ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink-300">
                {t('mediaGen.steps.result')}
              </h3>
              <LocalMediaImage
                filePath={resultPath}
                alt={shellTitle}
                maxHeightClass="max-h-[min(50vh,420px)]"
                objectFit="contain"
                showActions={false}
              />
            </div>
          ) : null}

          {/* Video keyframe */}
          {phase === 'keyframe' && resultPath ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink-300">
                {t('mediaGen.keyframeTitle')}
              </h3>
              <p className="text-[11px] text-ink-500">
                {t('mediaGen.keyframeHint')}
              </p>
              {errorMessage ? (
                <p className="text-[12px] text-rose-300">{errorMessage}</p>
              ) : null}
              <LocalMediaImage
                filePath={resultPath}
                alt={t('mediaGen.keyframeTitle')}
                maxHeightClass="max-h-[min(48vh,400px)]"
                objectFit="contain"
                showActions={false}
              />
            </div>
          ) : null}

          {/* Confirm video */}
          {phase === 'confirm-video' && resultPath ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink-300">
                  {t('mediaGen.keyframeTitle')}
                </h3>
                <LocalMediaImage
                  filePath={resultPath}
                  alt={t('mediaGen.keyframeTitle')}
                  maxHeightClass="max-h-[min(40vh,320px)]"
                  objectFit="contain"
                  showActions={false}
                />
              </div>
              <div className="space-y-3">
                {errorMessage ? (
                  <p className="text-[12px] text-rose-300">{errorMessage}</p>
                ) : null}
                <div>
                  <Label>{t('mediaGen.polishPromptVideo')}</Label>
                  <Textarea
                    size="lg"
                    className="mt-1 min-h-[8rem] font-mono text-[12px]"
                    value={polishedPrompt}
                    onChange={(e) => setPolishedPrompt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('mediaGen.userExtra')}</Label>
                  <p className="mb-1 text-[10px] text-ink-500">
                    {t('mediaGen.userExtraHint')}
                  </p>
                  <Textarea
                    size="md"
                    value={userExtra}
                    onChange={(e) => setUserExtra(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('mediaGen.duration')}</Label>
                  <input
                    type="number"
                    min={4}
                    max={15}
                    className="mt-1 w-24 rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100"
                    value={durationSeconds}
                    onChange={(e) =>
                      setDurationSeconds(Number(e.target.value) || 10)
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Video done — preview still + play intro (path bound on gallery via event) */}
          {phase === 'video-done' ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900/50 text-xl text-emerald-300">
                  ✓
                </div>
                <p className="text-sm font-medium text-ink-100">
                  {t('mediaGen.videoDoneOk')}
                </p>
              </div>
              {errorMessage ? (
                <p className="text-center text-[12px] text-rose-300">
                  {errorMessage}
                </p>
              ) : null}
              {resultPath ? (
                <div className="mx-auto w-full max-w-lg">
                  <LocalMediaImage
                    filePath={resultPath}
                    alt={t('mediaGen.keyframeTitle')}
                    maxHeightClass="max-h-[min(42vh,360px)]"
                    objectFit="contain"
                    showActions
                    introVideoPath={videoPath}
                  />
                </div>
              ) : videoPath ? (
                <p className="truncate text-center text-[11px] text-ink-500">
                  {videoPath}
                </p>
              ) : null}
              <p className="text-center text-[11px] text-ink-500">
                {t('mediaGen.videoDoneGalleryHint', {
                  defaultValue:
                    'Intro video is attached to the source still in the gallery — you can play it there too.'
                })}
              </p>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ink-800 px-4 py-3">
          {phase === 'materials' ? (
            <>
              <Button variant="ghost" disabled={locked} onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={locked || includedCount === 0}
                loading={busy}
                onClick={() => void handlePolish()}
              >
                {t('mediaGen.continuePolish')}
              </Button>
            </>
          ) : null}
          {phase === 'review-prompt' ? (
            <>
              <Button
                variant="ghost"
                disabled={locked}
                onClick={() => setPhase('materials')}
              >
                {t('mediaGen.backMaterials')}
              </Button>
              <Button
                variant="secondary"
                disabled={locked}
                loading={busy}
                onClick={() => void handlePolish()}
              >
                {t('mediaGen.repolish')}
              </Button>
              <Button
                disabled={locked || !polishedPrompt.trim()}
                loading={busy}
                onClick={() => void runGenerateStill()}
              >
                {mode === 'video'
                  ? t('mediaGen.generateKeyframe')
                  : t('mediaGen.generateImage')}
              </Button>
            </>
          ) : null}
          {phase === 'result' ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                {t('mediaGen.discardResult')}
              </Button>
              <Button onClick={acceptImageResult}>
                {t('mediaGen.acceptResult')}
              </Button>
            </>
          ) : null}
          {phase === 'keyframe' ? (
            <>
              <Button
                variant="ghost"
                disabled={locked}
                onClick={() => setPhase('review-prompt')}
              >
                {t('mediaGen.backMaterials')}
              </Button>
              <Button
                variant="secondary"
                disabled={locked}
                loading={busy}
                onClick={() => void runGenerateStill()}
              >
                {t('mediaGen.regenKeyframe')}
              </Button>
              <Button
                disabled={locked}
                onClick={() => setPhase('confirm-video')}
              >
                {t('mediaGen.nextConfirmVideo')}
              </Button>
            </>
          ) : null}
          {phase === 'confirm-video' ? (
            <>
              <Button
                variant="ghost"
                disabled={locked}
                onClick={() => setPhase('keyframe')}
              >
                {t('mediaGen.steps.keyframe')}
              </Button>
              <Button
                disabled={locked || !polishedPrompt.trim()}
                loading={busy}
                onClick={() => void handleConfirmVideo()}
              >
                {t('mediaGen.confirmGenerateVideo')}
              </Button>
            </>
          ) : null}
          {phase === 'video-done' ? (
            <Button onClick={onClose}>{t('mediaGen.finish')}</Button>
          ) : null}
          {phase === 'error' ? (
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
