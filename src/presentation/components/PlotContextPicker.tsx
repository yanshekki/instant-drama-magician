import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseIdList } from '../../domain/timelineBindings'
import { getApi } from '../../lib/api'
import type { StoryWithCounts } from '../../types/domain'
import { EditorSelect } from './EditorShell'
import { Button, Label } from './ui'

export type PlotSegmentOption = {
  key: string
  label: string
  preview: string
}

type StoryDetailLite = {
  id: string
  title: string
  styleNote?: string | null
  chapters?: Array<{
    id: string
    order: number
    title?: string | null
    body?: string | null
  }>
  scenes: Array<{
    id: string
    sceneNumber?: number
    title?: string | null
    description: string
    script?: string | null
  }>
  timeline: Array<{
    id: string
    order: number
    dialogue?: string | null
    beatContentJson?: string | null
    characterId?: string | null
    characterIds?: string | string[] | null
    sceneId?: string | null
    sceneIds?: string | string[] | null
    propId?: string | null
    propIds?: string | string[] | null
    actionId?: string | null
    actionIds?: string | string[] | null
    character?: { name: string } | null
    scene?: { title?: string | null; description?: string } | null
  }>
  characters?: Array<{ id: string; name: string }>
}

export function plotPickerKeysFromProps(
  segmentKeys?: string[] | null,
  segmentKey?: string | null
): string[] {
  if (Array.isArray(segmentKeys)) {
    return segmentKeys.map((k) => k.trim()).filter((k) => k && k !== 'all')
  }
  const k = segmentKey?.trim()
  if (!k || k === 'all') return []
  return [k]
}

export function togglePlotSegmentKey(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((x) => x !== key) : [...keys, key]
}

export function applyPlotGroupSelection(
  keys: string[],
  groupKeys: string[],
  include: boolean
): string[] {
  const rest = keys.filter((k) => !groupKeys.includes(k))
  return include ? [...rest, ...groupKeys] : rest
}

export function filterPlotKeysToKnown(
  keys: string[],
  known: string[]
): string[] {
  const set = new Set(known)
  return keys.filter((k) => set.has(k))
}

/**
 * Drop unknown keys. On first load, apply defaultKeys (beats that already
 * have cast selected in the story). Chapters stay unchecked.
 */
export function reconcilePlotPickerKeys(
  keys: string[],
  knownKeys: string[],
  defaultKeys: string[] = []
): string[] {
  const filtered = filterPlotKeysToKnown(keys, knownKeys)
  if (filtered.length === 0 && defaultKeys.length > 0) {
    return filterPlotKeysToKnown(defaultKeys, knownKeys)
  }
  return filtered
}

export function plotBeatParseIds(
  ids: string | string[] | null | undefined,
  fallback?: string | null
): string[] {
  if (Array.isArray(ids)) {
    return parseIdList(ids.length ? JSON.stringify(ids) : null, fallback)
  }
  return parseIdList(ids ?? null, fallback)
}

export function plotBeatCharacterIds(beat: {
  characterId?: string | null
  characterIds?: string | string[] | null
}): string[] {
  return plotBeatParseIds(beat.characterIds, beat.characterId)
}

export type PlotBeatBindKind = 'character' | 'scene' | 'prop' | 'action'

type BeatBindFields = {
  characterId?: string | null
  characterIds?: string | string[] | null
  sceneId?: string | null
  sceneIds?: string | string[] | null
  propId?: string | null
  propIds?: string | string[] | null
  actionId?: string | null
  actionIds?: string | string[] | null
}

/** Ids already picked on this beat for the given bind kind. */
export function plotBeatBindIds(
  beat: BeatBindFields,
  kind: PlotBeatBindKind
): string[] {
  if (kind === 'character') {
    return plotBeatParseIds(beat.characterIds, beat.characterId)
  }
  if (kind === 'scene') {
    return plotBeatParseIds(beat.sceneIds, beat.sceneId)
  }
  if (kind === 'prop') {
    return plotBeatParseIds(beat.propIds, beat.propId)
  }
  return plotBeatParseIds(beat.actionIds, beat.actionId)
}

/** True when the beat already has this exact entity picked. */
export function plotBeatHasBindId(
  beat: BeatBindFields,
  kind: PlotBeatBindKind,
  entityId: string
): boolean {
  const id = entityId.trim()
  if (!id) return false
  return plotBeatBindIds(beat, kind).includes(id)
}

/** True when that beat already has any pick of this bind kind. */
export function plotBeatHasBind(
  beat: BeatBindFields,
  kind: PlotBeatBindKind
): boolean {
  return plotBeatBindIds(beat, kind).length > 0
}

export function plotBeatCharacterLabel(
  beat: {
    characterId?: string | null
    characterIds?: string | string[] | null
    character?: { name: string } | null
  },
  characters: Array<{ id: string; name: string }>,
  unknown: string
): string {
  const byId = new Map(characters.map((c) => [c.id, c.name.trim()]))
  const names = plotBeatCharacterIds(beat)
    .map((id) => byId.get(id))
    .filter((n): n is string => Boolean(n))
  if (names.length) return names.join('、')
  const nested = beat.character?.name?.trim()
  if (nested) return nested
  return unknown
}

function beatHasText(beat: StoryDetailLite['timeline'][number]): boolean {
  return Boolean(beat.dialogue?.trim() || beat.beatContentJson?.trim())
}

function beatSnip(beat: StoryDetailLite['timeline'][number]): string {
  const d = beat.dialogue?.trim()
  if (d) return d.slice(0, 28)
  return (beat.beatContentJson || '').trim().slice(0, 28)
}

function beatPreview(beat: StoryDetailLite['timeline'][number]): string {
  return [beat.dialogue?.trim(), beat.beatContentJson?.trim()]
    .filter(Boolean)
    .join('\n')
}

/**
 * Story + multi-select plot picker (chapters + beats). No scene group.
 * Empty selection = entire story. Default-checks beats that already picked
 * `focusBindId` for `defaultBeatBind` (e.g. scene A → beats that selected A).
 */
export function PlotContextPicker({
  stories,
  storyId,
  segmentKeys,
  onSegmentKeysChange,
  segmentKey,
  onSegmentChange,
  onStoryChange,
  defaultBeatBind,
  focusBindId,
  className = ''
}: {
  stories: StoryWithCounts[]
  storyId: string
  segmentKeys?: string[]
  onSegmentKeysChange?: (keys: string[]) => void
  /** @deprecated Prefer segmentKeys */
  segmentKey?: string
  onSegmentChange?: (key: string) => void
  onStoryChange: (id: string) => void
  /** Bind kind to match (scene / character / prop / action). */
  defaultBeatBind?: PlotBeatBindKind
  /** Current entity id being filled; only beats that picked this id start checked. */
  focusBindId?: string | null
  className?: string
}): JSX.Element {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<StoryDetailLite | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const defaultedStoryRef = useRef<string | null>(null)

  const keys = plotPickerKeysFromProps(segmentKeys, segmentKey)

  const emit = (next: string[]): void => {
    onSegmentKeysChange?.(next)
    onSegmentChange?.(next.length === 0 ? 'all' : next[0])
  }

  useEffect(() => {
    let cancelled = false
    if (!storyId) {
      setDetail(null)
      return
    }
    setLoading(true)
    void getApi()
      .stories.get(storyId)
      .then((raw) => {
        if (cancelled) return
        setDetail(raw as StoryDetailLite)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [storyId])

  const chapters = useMemo<PlotSegmentOption[]>(() => {
    if (!detail) return []
    return (detail.chapters ?? []).map((c) => {
      const n = c.order + 1
      const title = c.title?.trim() || t('stories.chapterN', { n })
      return {
        key: `chapter:${c.id}`,
        label: t('plot.segmentChapter', { n, title }),
        preview: (c.body || '').trim()
      }
    })
  }, [detail, t])

  const scenes = useMemo<PlotSegmentOption[]>(() => {
    if (!detail) return []
    return (detail.scenes ?? []).map((sc) => {
      const n = sc.sceneNumber ?? 0
      const title = sc.title?.trim() || sc.description.slice(0, 36)
      return {
        key: `scene:${sc.id}`,
        label: t('plot.segmentScene', { n, title }),
        preview: [sc.description, sc.script ? String(sc.script).slice(0, 200) : '']
          .filter(Boolean)
          .join('\n')
      }
    })
  }, [detail, t])

  const beats = useMemo<PlotSegmentOption[]>(() => {
    if (!detail) return []
    const chars = detail.characters ?? []
    return (detail.timeline ?? [])
      .filter(beatHasText)
      .map((beat) => {
        const who = plotBeatCharacterLabel(
          beat,
          chars,
          t('plot.unknownCharacter')
        )
        const snip = beatSnip(beat)
        return {
          key: `beat:${beat.id}`,
          label: t('plot.segmentBeat', {
            n: beat.order + 1,
            who,
            snip
          }),
          preview: beatPreview(beat)
        }
      })
  }, [detail, t])

  const knownKeys = useMemo(
    () => [...chapters, ...beats].map((o) => o.key),
    [chapters, beats]
  )

  const defaultBeatKeys = useMemo(() => {
    const focus = focusBindId?.trim()
    if (!detail || !defaultBeatBind || !focus) return []
    return (detail.timeline ?? [])
      .filter(beatHasText)
      .filter((b) => plotBeatHasBindId(b, defaultBeatBind, focus))
      .map((b) => `beat:${b.id}`)
  }, [detail, defaultBeatBind, focusBindId])

  useEffect(() => {
    if (!storyId) {
      defaultedStoryRef.current = null
      return
    }
    if (loading || knownKeys.length === 0) return
    const defaultedKey = `${storyId}:${defaultBeatBind ?? ''}:${focusBindId?.trim() ?? ''}`
    const isNewFocus = defaultedStoryRef.current !== defaultedKey
    const next = reconcilePlotPickerKeys(
      keys,
      knownKeys,
      isNewFocus ? defaultBeatKeys : []
    )
    defaultedStoryRef.current = defaultedKey
    if (next.join('|') !== keys.join('|')) emit(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emit stale keys once after load
  }, [
    storyId,
    loading,
    knownKeys.join('|'),
    defaultBeatKeys.join('|'),
    focusBindId,
    defaultBeatBind,
    keys.join('|')
  ])

  const summaryPreview = useMemo(() => {
    if (!storyId) return t('plot.noStoryHint')
    if (!detail) return ''
    if (keys.length === 0) {
      const chapterLines = (detail.chapters ?? [])
        .slice(0, 4)
        .map(
          (c) =>
            `${t('plot.segmentChapter', {
              n: c.order + 1,
              title: c.title?.trim() || ''
            })}`
        )
      const sceneLines = (detail.scenes ?? [])
        .slice(0, 4)
        .map(
          (s) =>
            `#${s.sceneNumber ?? '?'} ${s.title || s.description.slice(0, 48)}`
        )
      return [
        detail.title,
        detail.styleNote
          ? t('plot.styleNoteLine', { note: detail.styleNote })
          : '',
        t('plot.emptyMeansAll'),
        chapterLines.join(' · ') ||
          sceneLines.join(' · ') ||
          t('plot.noScenesYet')
      ]
        .filter(Boolean)
        .join('\n')
    }
    const selected = [...chapters, ...beats].filter((o) =>
      keys.includes(o.key)
    )
    return selected
      .map((o) => [o.label, o.preview.slice(0, 240)].filter(Boolean).join('\n'))
      .join('\n\n')
  }, [storyId, detail, keys, chapters, scenes, beats, t])

  const renderGroup = (
    title: string,
    list: PlotSegmentOption[]
  ): JSX.Element | null => {
    if (!storyId) return null
    if (list.length === 0) return null
    const groupKeys = list.map((o) => o.key)
    return (
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-300">
            {title}
          </h3>
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              className="text-ink-400 underline hover:text-ink-200"
              onClick={() => emit(applyPlotGroupSelection(keys, groupKeys, true))}
            >
              {t('mediaGen.selectAll')}
            </button>
            <button
              type="button"
              className="text-ink-400 underline hover:text-ink-200"
              onClick={() =>
                emit(applyPlotGroupSelection(keys, groupKeys, false))
              }
            >
              {t('mediaGen.selectNone')}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {list.map((row) => {
            const checked = keys.includes(row.key)
            const open = expandedKey === row.key
            return (
              <div
                key={row.key}
                className={`flex gap-3 rounded-xl border p-3 ${
                  checked
                    ? 'border-brand-600/40 bg-brand-950/15'
                    : 'border-ink-800 bg-ink-900/30 opacity-80'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-brand-500"
                  checked={checked}
                  onChange={() => emit(togglePlotSegmentKey(keys, row.key))}
                  aria-label={row.label}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-ink-50">
                    {row.label}
                  </span>
                  {row.preview ? (
                    <>
                      <button
                        type="button"
                        className="mt-1 block text-[11px] text-ink-500 underline hover:text-ink-300"
                        onClick={() =>
                          setExpandedKey(open ? null : row.key)
                        }
                      >
                        {open
                          ? t('mediaGen.hideTech')
                          : t('mediaGen.showTech')}
                      </button>
                      {open ? (
                        <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-950/80 p-2 font-mono text-[10px] leading-relaxed text-ink-400">
                          {row.preview}
                        </pre>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className={['space-y-3', className].filter(Boolean).join(' ')}>
      <div>
        <Label>{t('plot.story')}</Label>
        <EditorSelect
          className="mt-1"
          value={storyId}
          onChange={(e) => onStoryChange(e.target.value)}
        >
          <option value="">{t('plot.noStory')}</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </EditorSelect>
      </div>
      {storyId ? (
        <p className="text-[11px] text-ink-500">{t('plot.pickerHint')}</p>
      ) : null}
      {loading ? (
        <p className="text-[11px] text-ink-500">{t('common.loading')}</p>
      ) : (
        <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
          {renderGroup(t('plot.groupChapters'), chapters)}
          {renderGroup(t('plot.groupBeats'), beats)}
        </div>
      )}
      {summaryPreview ? (
        <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
          {summaryPreview}
        </pre>
      ) : null}
    </div>
  )
}

export function PlotSuggestModal({
  open,
  titleId,
  title,
  hint,
  stories,
  storyId,
  segmentKeys,
  onStoryChange,
  onSegmentKeysChange,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  confirmDisabled,
  defaultBeatBind,
  focusBindId
}: {
  open: boolean
  titleId: string
  title: string
  hint: string
  stories: StoryWithCounts[]
  storyId: string
  segmentKeys: string[]
  onStoryChange: (id: string) => void
  onSegmentKeysChange: (keys: string[]) => void
  onClose: () => void
  onConfirm: () => void
  confirmLabel: string
  cancelLabel: string
  confirmDisabled?: boolean
  defaultBeatBind?: PlotBeatBindKind
  focusBindId?: string | null
}): JSX.Element | null {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl">
        <h2 id={titleId} className="text-base font-semibold text-ink-50">
          {title}
        </h2>
        <p className="mt-1 text-[12px] text-ink-400">{hint}</p>
        <div className="mt-4">
          <PlotContextPicker
            stories={stories}
            storyId={storyId}
            segmentKeys={segmentKeys}
            onStoryChange={onStoryChange}
            onSegmentKeysChange={onSegmentKeysChange}
            defaultBeatBind={defaultBeatBind}
            focusBindId={focusBindId}
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
