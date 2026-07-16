import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TimelineService } from '../../application/TimelineService'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { GenerationResult } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { useCharacters } from '../hooks/useCharacters'
import { useProps } from '../hooks/useProps'
import { useScenes } from '../hooks/useScenes'
import { useTimeline } from '../hooks/useTimeline'
import { PageHeader } from '../components/PageHeader'
import {
  AssetLibrary
} from '../components/timeline/AssetLibrary'
import {
  TimelineCanvas,
  type AssetDropPayload
} from '../components/timeline/TimelineCanvas'
import { Button, EmptyState, Label, Textarea } from '../components/ui'

const MAX_CLIP = TimelineService.DEFAULT_MAX_CLIP_SECONDS

export function TimelinePage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId, refreshStories, refreshAiStatus } = useApp()
  const { items: characters } = useCharacters(activeStoryId)
  const { items: scenes } = useScenes(activeStoryId)
  const { items: props } = useProps(activeStoryId)
  const {
    entries,
    loading,
    error,
    totalDuration,
    create,
    update,
    remove,
    reorder,
    reload
  } = useTimeline(activeStoryId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [genResult, setGenResult] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selected = entries.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    setDialogue(selected?.dialogue ?? '')
  }, [selected?.id, selected?.dialogue])

  useEffect(() => {
    return getApi().generation.onProgress((payload) => {
      const line = payload.result?.success
        ? `✓ [${payload.index + 1}/${payload.total}] ${payload.step}`
        : `… [${payload.index + 1}/${payload.total}] ${payload.step}${
            payload.result?.error ? `: ${payload.result.error}` : ''
          }`
      setProgressLog((prev) => [...prev, line])
    })
  }, [])

  const labels = useMemo(() => {
    const map: Record<string, string> = {}
    const charMap = new Map(characters.map((c) => [c.id, c.name]))
    const sceneMap = new Map(
      scenes.map((s) => [s.id, `#${s.sceneNumber}`])
    )
    const propMap = new Map(props.map((p) => [p.id, p.name]))
    for (const e of entries) {
      map[e.id] =
        e.dialogue ||
        (e.characterId && charMap.get(e.characterId)) ||
        (e.sceneId && sceneMap.get(e.sceneId)) ||
        (e.propId && propMap.get(e.propId)) ||
        `#${e.order + 1}`
    }
    return map
  }, [entries, characters, scenes, props])

  const addAsset = async (
    payload: AssetDropPayload,
    atTime?: number
  ): Promise<void> => {
    if (!activeStoryId) return
    const duration = Math.min(MAX_CLIP, 5)
    let startTime: number
    let order: number
    if (atTime !== undefined) {
      startTime = Math.max(0, atTime)
      order = entries.length
    } else {
      const slot = TimelineService.suggestNextSlot(entries, duration)
      startTime = slot.startTime
      order = slot.order
    }
    const range = TimelineService.clampDuration(
      startTime,
      startTime + duration,
      MAX_CLIP
    )
    await create({
      startTime: range.startTime,
      endTime: range.endTime,
      order,
      characterId: payload.kind === 'character' ? payload.id : null,
      sceneId: payload.kind === 'scene' ? payload.id : null,
      propId: payload.kind === 'prop' ? payload.id : null,
      dialogue: null
    })
    await refreshStories()
  }

  const persistMove = async (
    id: string,
    startTime: number,
    endTime: number
  ): Promise<void> => {
    // optimistic local feel via immediate update call
    await update(id, { startTime, endTime })
  }

  const handleSaveDialogue = async (): Promise<void> => {
    if (!selectedId) return
    await update(selectedId, { dialogue: dialogue.trim() || null })
  }

  const handleReorderByStart = async (): Promise<void> => {
    const ordered = [...entries]
      .sort((a, b) => a.startTime - b.startTime)
      .map((e) => e.id)
    await reorder(ordered)
  }

  const handleGenerate = async (): Promise<void> => {
    if (!activeStoryId) return
    setGenerating(true)
    setProgressLog([])
    setGenResult(null)
    setActionError(null)
    try {
      const result = (await getApi().generation.run(
        activeStoryId
      )) as GenerationResult
      const lines = result.steps.map((s) =>
        s.success
          ? `✓ ${s.step}\n${s.output ?? ''}`
          : `✗ ${s.step}: ${s.error ?? 'failed'}`
      )
      setGenResult(lines.join('\n\n'))
      await reload()
      await refreshStories()
      await refreshAiStatus()
    } catch (e) {
      setActionError(parseIpcError(e).message)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!activeStoryId) return
    setExporting(true)
    setActionError(null)
    try {
      const { outputPath } = await getApi().media.exportStoryboard(activeStoryId)
      setGenResult((prev) =>
        [prev, `Export: ${outputPath}`].filter(Boolean).join('\n\n')
      )
      await getApi().shell.openPath(outputPath)
    } catch (e) {
      setActionError(parseIpcError(e).message)
    } finally {
      setExporting(false)
    }
  }

  if (!activeStoryId) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('timeline.title')} subtitle={t('timeline.subtitle')} />
        <div className="p-8">
          <EmptyState message={t('common.selectStory')} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('timeline.title')}
        subtitle={t('timeline.subtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void handleReorderByStart()}>
              {t('timeline.reorder')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? t('common.exporting') : t('common.export')}
            </Button>
            <Button onClick={() => void handleGenerate()} disabled={generating}>
              {generating ? t('common.generating') : t('common.generate')}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-ink-800">
          <div className="flex items-center justify-between gap-4 border-b border-ink-800 px-6 py-3 text-xs text-ink-400">
            <span>
              {t('timeline.duration', { seconds: totalDuration.toFixed(1) })}
            </span>
            <span>{t('timeline.maxClip', { seconds: MAX_CLIP })}</span>
          </div>

          <div className="border-b border-ink-800 px-6 py-4">
            <TimelineCanvas
              entries={entries}
              labels={labels}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={(id, s, e) => void persistMove(id, s, e)}
              onResize={(id, s, e) => void persistMove(id, s, e)}
              onDropAsset={(payload, at) => void addAsset(payload, at)}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {(error || actionError) && (
              <p className="mb-3 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
                {error?.message ?? actionError}
              </p>
            )}

            {selected && (
              <div className="mb-4 rounded-xl border border-ink-800 bg-ink-900/50 p-4">
                <div className="mb-2 text-xs text-brand-300">
                  {selected.startTime.toFixed(1)}s → {selected.endTime.toFixed(1)}s
                </div>
                <Label>{t('timeline.dialogue')}</Label>
                <Textarea
                  rows={2}
                  value={dialogue}
                  onChange={(e) => setDialogue(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => void handleSaveDialogue()}>
                    {t('common.save')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(t('common.confirmDelete'))) {
                        void remove(selected.id)
                        setSelectedId(null)
                      }
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            ) : entries.length === 0 ? (
              <EmptyState message={t('timeline.noEntries')} />
            ) : (
              <ul className="space-y-2 text-sm">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className={[
                      'cursor-pointer rounded-lg border px-3 py-2',
                      selectedId === e.id
                        ? 'border-brand-500 bg-brand-950/30'
                        : 'border-ink-800 bg-ink-900/40'
                    ].join(' ')}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <span className="font-mono text-xs text-brand-300">
                      {e.startTime.toFixed(1)}–{e.endTime.toFixed(1)}s
                    </span>{' '}
                    <span className="text-ink-200">{labels[e.id]}</span>
                  </li>
                ))}
              </ul>
            )}

            {progressLog.length > 0 && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-xl border border-ink-800 bg-ink-950 p-3 text-xs text-ink-300">
                {progressLog.join('\n')}
              </pre>
            )}
            {genResult && (
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-ink-800 bg-ink-950 p-4 text-xs text-ink-300">
                {genResult}
              </pre>
            )}
          </div>
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto bg-ink-900/40 p-5">
          <AssetLibrary
            characters={characters}
            scenes={scenes}
            props={props}
            onAdd={(p) => void addAsset(p)}
          />
        </aside>
      </div>
    </div>
  )
}
