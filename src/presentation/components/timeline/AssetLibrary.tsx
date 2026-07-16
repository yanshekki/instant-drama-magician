import { useTranslation } from 'react-i18next'
import type { Character, Prop, Scene } from '../../../types/domain'
import { makeAssetDragData, type AssetDropPayload } from './TimelineCanvas'

interface AssetLibraryProps {
  characters: Character[]
  scenes: Scene[]
  props: Prop[]
  onAdd: (payload: AssetDropPayload) => void
}

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
      className="w-full rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-left text-xs text-ink-100 hover:border-brand-500 hover:bg-ink-800"
    >
      {payload.label}
    </button>
  )
}

export function AssetLibrary({
  characters,
  scenes,
  props,
  onAdd
}: AssetLibraryProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold text-ink-100">{t('timeline.library')}</h3>
      <p className="text-xs text-ink-500">{t('timeline.dragHint')}</p>

      <section className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {t('timeline.character')}
        </div>
        {characters.length === 0 ? (
          <p className="text-xs text-ink-600">{t('common.empty')}</p>
        ) : (
          characters.map((c) => (
            <DraggableChip
              key={c.id}
              payload={{ kind: 'character', id: c.id, label: c.name }}
              onAdd={onAdd}
            />
          ))
        )}
      </section>

      <section className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {t('timeline.scene')}
        </div>
        {scenes.length === 0 ? (
          <p className="text-xs text-ink-600">{t('common.empty')}</p>
        ) : (
          scenes.map((s) => (
            <DraggableChip
              key={s.id}
              payload={{
                kind: 'scene',
                id: s.id,
                label: `#${s.sceneNumber} ${s.description.slice(0, 32)}`
              }}
              onAdd={onAdd}
            />
          ))
        )}
      </section>

      <section className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {t('timeline.prop')}
        </div>
        {props.length === 0 ? (
          <p className="text-xs text-ink-600">{t('common.empty')}</p>
        ) : (
          props.map((p) => (
            <DraggableChip
              key={p.id}
              payload={{ kind: 'prop', id: p.id, label: p.name }}
              onAdd={onAdd}
            />
          ))
        )}
      </section>
    </div>
  )
}
