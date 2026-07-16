import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TimelineService } from '../../application/TimelineService'
import { getApi } from '../../lib/api'
import type { Character, Prop, Scene, TimelineEntry } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Textarea
} from '../components/ui'

const MAX_CLIP = TimelineService.DEFAULT_MAX_CLIP_SECONDS

export function TimelinePage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId, refreshStories } = useApp()
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genLog, setGenLog] = useState<string | null>(null)

  const [characterId, setCharacterId] = useState('')
  const [sceneId, setSceneId] = useState('')
  const [propId, setPropId] = useState('')
  const [dialogue, setDialogue] = useState('')
  const [duration, setDuration] = useState(MAX_CLIP)

  const load = useCallback(async () => {
    if (!activeStoryId) {
      setEntries([])
      setCharacters([])
      setScenes([])
      setProps([])
      return
    }
    setLoading(true)
    try {
      const api = getApi()
      const [tl, chars, scns, prps] = await Promise.all([
        api.timeline.list(activeStoryId) as Promise<TimelineEntry[]>,
        api.characters.list(activeStoryId) as Promise<Character[]>,
        api.scenes.list(activeStoryId) as Promise<Scene[]>,
        api.props.list(activeStoryId) as Promise<Prop[]>
      ])
      setEntries(TimelineService.sort(tl))
      setCharacters(chars)
      setScenes(scns)
      setProps(prps)
    } finally {
      setLoading(false)
    }
  }, [activeStoryId])

  useEffect(() => {
    void load()
  }, [load])

  const total = useMemo(() => TimelineService.totalDuration(entries), [entries])

  const charMap = useMemo(
    () => new Map(characters.map((c) => [c.id, c.name])),
    [characters]
  )
  const sceneMap = useMemo(
    () => new Map(scenes.map((s) => [s.id, `#${s.sceneNumber} ${s.description}`])),
    [scenes]
  )
  const propMap = useMemo(() => new Map(props.map((p) => [p.id, p.name])), [props])

  const handleAdd = async (): Promise<void> => {
    if (!activeStoryId) return
    const clampedDuration = Math.min(Math.max(0.5, duration), MAX_CLIP)
    const slot = TimelineService.suggestNextSlot(entries, clampedDuration)
    const clamped = TimelineService.clampDuration(
      slot.startTime,
      slot.endTime,
      MAX_CLIP
    )

    await getApi().timeline.create({
      storyId: activeStoryId,
      startTime: clamped.startTime,
      endTime: clamped.endTime,
      order: slot.order,
      characterId: characterId || null,
      sceneId: sceneId || null,
      propId: propId || null,
      dialogue: dialogue.trim() || null
    })

    setDialogue('')
    await load()
    await refreshStories()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm(t('common.confirmDelete'))) return
    await getApi().timeline.delete(id)
    await load()
    await refreshStories()
  }

  const handleGenerate = async (): Promise<void> => {
    if (!activeStoryId) return
    setGenerating(true)
    setGenLog(null)
    try {
      const result = await getApi().generation.run(activeStoryId)
      const lines = (result as { steps: { step: string; success: boolean; output?: string; error?: string }[] })
        .steps
        .map((s) => {
          if (s.success) return `✓ ${s.step}\n${s.output ?? ''}`
          return `✗ ${s.step}: ${s.error ?? 'failed'}`
        })
      setGenLog(lines.join('\n\n'))
      await refreshStories()
    } catch (error) {
      setGenLog(error instanceof Error ? error.message : String(error))
    } finally {
      setGenerating(false)
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
          <Button onClick={() => void handleGenerate()} disabled={generating}>
            {generating ? t('common.generating') : t('common.generate')}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-ink-800">
          <div className="flex items-center justify-between gap-4 border-b border-ink-800 px-6 py-3 text-xs text-ink-400">
            <span>{t('timeline.duration', { seconds: total.toFixed(1) })}</span>
            <span>{t('timeline.maxClip', { seconds: MAX_CLIP })}</span>
          </div>

          {/* Visual linear track */}
          <div className="border-b border-ink-800 bg-ink-900/40 px-6 py-4">
            <div className="relative h-16 overflow-x-auto rounded-lg bg-ink-950 ring-1 ring-ink-800">
              <div
                className="relative h-full"
                style={{
                  width: `${Math.max(100, total * 40 + 80)}px`,
                  minWidth: '100%'
                }}
              >
                {entries.map((e) => {
                  const left = e.startTime * 40
                  const width = Math.max(24, (e.endTime - e.startTime) * 40)
                  return (
                    <div
                      key={e.id}
                      className="absolute top-2 flex h-12 items-center overflow-hidden rounded-md bg-brand-600/80 px-2 text-[10px] font-medium text-white shadow"
                      style={{ left, width }}
                      title={`${e.startTime}s–${e.endTime}s`}
                    >
                      <span className="truncate">
                        {e.dialogue ||
                          (e.characterId && charMap.get(e.characterId)) ||
                          (e.sceneId && sceneMap.get(e.sceneId)) ||
                          `#${e.order + 1}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            ) : entries.length === 0 ? (
              <EmptyState message={t('timeline.noEntries')} />
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <Card key={e.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <div className="font-mono text-xs text-brand-300">
                        {e.startTime.toFixed(1)}s → {e.endTime.toFixed(1)}s · #
                        {e.order}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-400">
                        {e.characterId && (
                          <span className="rounded bg-ink-800 px-1.5 py-0.5">
                            {t('timeline.character')}: {charMap.get(e.characterId) ?? e.characterId}
                          </span>
                        )}
                        {e.sceneId && (
                          <span className="rounded bg-ink-800 px-1.5 py-0.5">
                            {t('timeline.scene')}: {sceneMap.get(e.sceneId) ?? e.sceneId}
                          </span>
                        )}
                        {e.propId && (
                          <span className="rounded bg-ink-800 px-1.5 py-0.5">
                            {t('timeline.prop')}: {propMap.get(e.propId) ?? e.propId}
                          </span>
                        )}
                      </div>
                      {e.dialogue && (
                        <p className="mt-1 text-ink-200">&ldquo;{e.dialogue}&rdquo;</p>
                      )}
                    </div>
                    <Button variant="danger" onClick={() => void handleDelete(e.id)}>
                      {t('common.delete')}
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            {genLog && (
              <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-ink-800 bg-ink-950 p-4 text-xs text-ink-300">
                {genLog}
              </pre>
            )}
          </div>
        </div>

        {/* Library / add form */}
        <aside className="w-80 shrink-0 overflow-y-auto bg-ink-900/40 p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-100">
            {t('timeline.library')}
          </h3>

          <div className="space-y-3">
            <div>
              <Label>{t('timeline.character')}</Label>
              <Select value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
                <option value="">{t('timeline.none')}</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>{t('timeline.scene')}</Label>
              <Select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
                <option value="">{t('timeline.none')}</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.sceneNumber} {s.description.slice(0, 40)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>{t('timeline.prop')}</Label>
              <Select value={propId} onChange={(e) => setPropId(e.target.value)}>
                <option value="">{t('timeline.none')}</option>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>{t('timeline.dialogue')}</Label>
              <Textarea
                rows={3}
                value={dialogue}
                onChange={(e) => setDialogue(e.target.value)}
              />
            </div>

            <div>
              <Label>
                {t('timeline.end').replace('（秒）', '').replace(' (s)', '')} duration (s)
              </Label>
              <Input
                type="number"
                min={0.5}
                max={MAX_CLIP}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || MAX_CLIP)}
              />
            </div>

            <Button className="w-full" onClick={() => void handleAdd()}>
              {t('timeline.addClip')}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
