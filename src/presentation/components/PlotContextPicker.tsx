import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import type { StoryWithCounts } from '../../types/domain'
import { EditorSelect } from './EditorShell'
import { Label } from './ui'

export type PlotSegmentOption = {
  key: string
  label: string
}

type StoryDetailLite = {
  id: string
  title: string
  styleNote?: string | null
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
    characterId?: string | null
    sceneId?: string | null
    character?: { name: string } | null
    scene?: { title?: string | null; description?: string } | null
  }>
}

/**
 * Story + plot-segment picker for wardrobe / AI plot-aware tools.
 */
export function PlotContextPicker({
  stories,
  storyId,
  segmentKey,
  onStoryChange,
  onSegmentChange,
  className = ''
}: {
  stories: StoryWithCounts[]
  storyId: string
  segmentKey: string
  onStoryChange: (id: string) => void
  onSegmentChange: (key: string) => void
  className?: string
}): JSX.Element {
  const { t } = useTranslation()
  const [segments, setSegments] = useState<PlotSegmentOption[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    if (!storyId) {
      setSegments([
        { key: 'all', label: t('plot.segmentAll') }
      ])
      setPreview('')
      return
    }
    setLoading(true)
    void getApi()
      .stories.get(storyId)
      .then((raw) => {
        if (cancelled) return
        const detail = raw as StoryDetailLite
        const opts: PlotSegmentOption[] = [
          { key: 'all', label: t('plot.segmentAll') }
        ]
        for (const sc of detail.scenes ?? []) {
          const n = sc.sceneNumber ?? 0
          const title = sc.title?.trim() || sc.description.slice(0, 36)
          opts.push({
            key: `scene:${sc.id}`,
            label: t('plot.segmentScene', { n, title })
          })
        }
        for (const beat of detail.timeline ?? []) {
          if (!beat.dialogue?.trim()) continue
          const who =
            beat.character?.name ||
            t('plot.unknownCharacter')
          const snip = beat.dialogue.trim().slice(0, 28)
          opts.push({
            key: `beat:${beat.id}`,
            label: t('plot.segmentBeat', {
              n: beat.order + 1,
              who,
              snip
            })
          })
        }
        setSegments(opts)
        if (!opts.some((o) => o.key === segmentKey)) {
          onSegmentChange('all')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSegments([{ key: 'all', label: t('plot.segmentAll') }])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when story changes
  }, [storyId, t])

  useEffect(() => {
    if (!storyId) {
      setPreview(t('plot.noStoryHint'))
      return
    }
    let cancelled = false
    void getApi()
      .stories.get(storyId)
      .then((raw) => {
        if (cancelled) return
        const detail = raw as StoryDetailLite
        if (segmentKey === 'all') {
          const lines = (detail.scenes ?? [])
            .slice(0, 4)
            .map(
              (s) =>
                `#${s.sceneNumber ?? '?'} ${s.title || s.description.slice(0, 48)}`
            )
          setPreview(
            [
              detail.title,
              detail.styleNote
                ? t('plot.styleNoteLine', { note: detail.styleNote })
                : '',
              lines.join(' · ') || t('plot.noScenesYet')
            ]
              .filter(Boolean)
              .join('\n')
          )
          return
        }
        if (segmentKey.startsWith('scene:')) {
          const id = segmentKey.slice(6)
          const sc = (detail.scenes ?? []).find((s) => s.id === id)
          setPreview(
            sc
              ? [
                  sc.title || t('plot.segmentScene', { n: sc.sceneNumber ?? 0, title: '' }),
                  sc.description,
                  sc.script ? String(sc.script).slice(0, 200) : ''
                ]
                  .filter(Boolean)
                  .join('\n')
              : t('plot.segmentMissing')
          )
          return
        }
        if (segmentKey.startsWith('beat:')) {
          const id = segmentKey.slice(5)
          const beat = (detail.timeline ?? []).find((b) => b.id === id)
          setPreview(
            beat
              ? [
                  `${t('plot.beat')} ${beat.order + 1}`,
                  beat.character?.name
                    ? `${t('plot.character')}: ${beat.character.name}`
                    : '',
                  beat.dialogue || ''
                ]
                  .filter(Boolean)
                  .join('\n')
              : t('plot.segmentMissing')
          )
        }
      })
      .catch(() => {
        if (!cancelled) setPreview('')
      })
    return () => {
      cancelled = true
    }
  }, [storyId, segmentKey, t])

  return (
    <div className={['space-y-3', className].filter(Boolean).join(' ')}>
      <div className="grid gap-3 sm:grid-cols-2">
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
        <div>
          <Label>{t('plot.segment')}</Label>
          <EditorSelect
            className="mt-1"
            value={segmentKey}
            disabled={!storyId || loading}
            onChange={(e) => onSegmentChange(e.target.value)}
          >
            {segments.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </EditorSelect>
        </div>
      </div>
      {preview ? (
        <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
          {preview}
        </pre>
      ) : null}
    </div>
  )
}
