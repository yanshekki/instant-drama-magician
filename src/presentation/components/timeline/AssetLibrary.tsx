import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Action, Character, Prop } from '../../../types/domain'
import { matchesSearchQuery } from '../../lib/searchQuery'
import { Button, EmptyState, Input } from '../ui'
import { makeAssetDragData, type AssetDropPayload } from './TimelineCanvas'
import {
  sceneCastLabel,
  type StoryCastScene
} from './timelineLabels'

export type { StoryCastScene }
export { sceneCastLabel }

interface AssetLibraryProps {
  characters: Character[]
  scenes: StoryCastScene[]
  props: Prop[]
  actions?: Action[]
  onAdd: (payload: AssetDropPayload) => void
  onOpenStoryEditor?: () => void
}

type CastTab = 'character' | 'scene' | 'prop' | 'action'

function DraggableChip({
  payload,
  onAdd
}: {
  payload: AssetDropPayload
  onAdd: (payload: AssetDropPayload) => void
}): JSX.Element {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-idm-asset', makeAssetDragData(payload))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAdd(payload)}
      className="w-full rounded-xl border border-ink-700/80 bg-ink-900/60 px-2.5 py-2 text-left text-xs text-ink-100 transition hover:border-brand-500 hover:bg-ink-800/80"
    >
      <span className="line-clamp-2">{payload.label}</span>
    </button>
  )
}

export function AssetLibrary({
  characters,
  scenes,
  props,
  actions = [],
  onAdd,
  onOpenStoryEditor
}: AssetLibraryProps): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<CastTab>('character')
  const [q, setQ] = useState('')

  const filteredCharacters = useMemo(() => {
    return characters.filter((c) =>
      matchesSearchQuery([c.name, c.description ?? ''].join(' '), q)
    )
  }, [characters, q])

  const filteredScenes = useMemo(() => {
    return scenes.filter((s) =>
      matchesSearchQuery(
        [sceneCastLabel(s), s.title ?? '', s.description ?? ''].join(' '),
        q
      )
    )
  }, [scenes, q])

  const filteredProps = useMemo(() => {
    return props.filter((p) =>
      matchesSearchQuery([p.name, p.description ?? ''].join(' '), q)
    )
  }, [props, q])

  const filteredActions = useMemo(() => {
    return actions.filter((a) =>
      matchesSearchQuery([a.name, a.description ?? ''].join(' '), q)
    )
  }, [actions, q])

  const tabs: { id: CastTab; label: string; count: number }[] = [
    { id: 'character', label: t('timeline.character'), count: characters.length },
    { id: 'scene', label: t('timeline.scene'), count: scenes.length },
    { id: 'prop', label: t('timeline.prop'), count: props.length },
    { id: 'action', label: t('timeline.action'), count: actions.length }
  ]

  const emptyKindKey =
    tab === 'character'
      ? 'timeline.castEmptyCharacters'
      : tab === 'scene'
        ? 'timeline.castEmptyScenes'
        : tab === 'prop'
          ? 'timeline.castEmptyProps'
          : 'timeline.castEmptyActions'

  const listEmpty =
    tab === 'character'
      ? characters.length === 0
      : tab === 'scene'
        ? scenes.length === 0
        : tab === 'prop'
          ? props.length === 0
          : actions.length === 0

  const filteredEmpty =
    tab === 'character'
      ? filteredCharacters.length === 0
      : tab === 'scene'
        ? filteredScenes.length === 0
        : tab === 'prop'
          ? filteredProps.length === 0
          : filteredActions.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-100">{t('timeline.library')}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
          {t('timeline.libraryHint')}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-ink-800/80 bg-ink-950/50 p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={[
              'min-w-[4.5rem] flex-1 rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition',
              tab === tb.id
                ? 'bg-brand-600/90 text-white shadow-sm'
                : 'text-ink-400 hover:bg-ink-800/60 hover:text-ink-200'
            ].join(' ')}
          >
            {tb.label}
            <span className="ml-0.5 opacity-70">({tb.count})</span>
          </button>
        ))}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('timeline.searchCast')}
        className="mb-3 !py-1.5 text-xs"
      />

      <p className="mb-2 text-[10px] text-ink-600">{t('timeline.dragHint')}</p>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {listEmpty ? (
          <div className="rounded-xl border border-dashed border-ink-700/80 bg-ink-950/40 px-3 py-5 text-center">
            <p className="text-xs text-ink-400">{t(emptyKindKey)}</p>
            {onOpenStoryEditor && (
              <Button
                variant="secondary"
                className="mt-3 !text-xs"
                onClick={onOpenStoryEditor}
              >
                {t('timeline.openStoryEditor')}
              </Button>
            )}
          </div>
        ) : filteredEmpty ? (
          <EmptyState message={t('timeline.searchNoResults')} />
        ) : tab === 'character' ? (
          filteredCharacters.map((c) => (
            <DraggableChip
              key={c.id}
              payload={{ kind: 'character', id: c.id, label: c.name }}
              onAdd={onAdd}
            />
          ))
        ) : tab === 'scene' ? (
          filteredScenes.map((s) => (
            <DraggableChip
              key={s.id}
              payload={{
                kind: 'scene',
                id: s.id,
                label: sceneCastLabel(s)
              }}
              onAdd={onAdd}
            />
          ))
        ) : tab === 'prop' ? (
          filteredProps.map((p) => (
            <DraggableChip
              key={p.id}
              payload={{ kind: 'prop', id: p.id, label: p.name }}
              onAdd={onAdd}
            />
          ))
        ) : (
          filteredActions.map((a) => (
            <DraggableChip
              key={a.id}
              payload={{ kind: 'action', id: a.id, label: a.name }}
              onAdd={onAdd}
            />
          ))
        )}
      </div>
    </div>
  )
}
