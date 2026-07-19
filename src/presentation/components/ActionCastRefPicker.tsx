/**
 * Pick stills from character / costume / scene / prop libraries for action boards.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  makeActionCastRefId,
  type ActionCastEntityType,
  type ActionCastRef
} from '../../domain/actionCastRefs'
import { parseCharacterGallery } from '../../domain/characterGallery'
import { parseSceneGallery } from '../../domain/sceneGallery'
import { getApi } from '../../lib/api'
import { LocalMediaImage } from './LocalMediaImage'
import { Button, Label, Select } from './ui'

type LibItem = {
  id: string
  name: string
  refImagePath?: string | null
  refGalleryJson?: string | null
}

export function ActionCastRefPicker({
  value,
  onChange,
  disabled
}: {
  value: ActionCastRef[]
  onChange: (next: ActionCastRef[]) => void
  disabled?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const [entityType, setEntityType] =
    useState<ActionCastEntityType>('character')
  const [items, setItems] = useState<LibItem[]>([])
  const [entityId, setEntityId] = useState('')
  const [gallery, setGallery] = useState<
    Array<{ id: string; path: string; label: string }>
  >([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        let list: LibItem[] = []
        if (entityType === 'character') {
          const rows = (await getApi().characters.list()) as Array<{
            id: string
            name: string
            refImagePath?: string | null
            refGalleryJson?: string | null
          }>
          list = rows.map((r) => ({
            id: r.id,
            name: r.name,
            refImagePath: r.refImagePath,
            refGalleryJson: r.refGalleryJson
          }))
        } else if (entityType === 'costume') {
          const rows = (await getApi().costumes.list()) as Array<{
            id: string
            name: string
            refImagePath?: string | null
            refGalleryJson?: string | null
          }>
          list = rows.map((r) => ({
            id: r.id,
            name: r.name,
            refImagePath: r.refImagePath,
            refGalleryJson: r.refGalleryJson
          }))
        } else if (entityType === 'scene') {
          const rows = (await getApi().scenes.list()) as Array<{
            id: string
            title?: string | null
            description: string
            refImagePath?: string | null
            refGalleryJson?: string | null
          }>
          list = rows.map((r) => ({
            id: r.id,
            name: r.title?.trim() || r.description.slice(0, 40) || r.id,
            refImagePath: r.refImagePath,
            refGalleryJson: r.refGalleryJson
          }))
        } else {
          const rows = (await getApi().props.list()) as Array<{
            id: string
            name: string
            refImagePath?: string | null
            refGalleryJson?: string | null
          }>
          list = rows.map((r) => ({
            id: r.id,
            name: r.name,
            refImagePath: r.refImagePath,
            refGalleryJson: r.refGalleryJson
          }))
        }
        if (!cancelled) {
          setItems(list)
          setEntityId(list[0]?.id ?? '')
        }
      } catch {
        if (!cancelled) {
          setItems([])
          setEntityId('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entityType])

  useEffect(() => {
    const hit = items.find((i) => i.id === entityId)
    if (!hit) {
      setGallery([])
      return
    }
    const g =
      entityType === 'character' || entityType === 'costume'
        ? parseCharacterGallery(hit.refGalleryJson, {
            refImagePath: hit.refImagePath
          })
        : parseSceneGallery(hit.refGalleryJson, {
            refImagePath: hit.refImagePath
          })
    setGallery(
      g.map((x) => ({ id: x.id, path: x.path, label: x.label }))
    )
  }, [entityId, items, entityType])

  const addPath = (path: string): void => {
    const hit = items.find((i) => i.id === entityId)
    if (!hit || !path) return
    if (value.some((v) => v.imagePath === path)) return
    onChange([
      ...value,
      {
        id: makeActionCastRefId(),
        entityType,
        entityId: hit.id,
        entityName: hit.name,
        imagePath: path
      }
    ])
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3">
      <div>
        <h4 className="text-xs font-semibold text-ink-100">
          {t('actions.castRefs')}
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {t('actions.castRefsHint')}
        </p>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((ref) => (
            <li
              key={ref.id}
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-ink-700"
            >
              <LocalMediaImage
                filePath={ref.imagePath}
                alt={ref.entityName || ref.entityType}
                variant="thumb"
                maxHeightClass="h-full max-h-none"
                objectFit="cover"
                showActions={false}
                enableZoom={false}
                hoverZoom={false}
              />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-[9px] text-white"
                disabled={disabled}
                onClick={() =>
                  onChange(value.filter((v) => v.id !== ref.id))
                }
              >
                ×
              </button>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/70 px-0.5 text-center text-[8px] text-white">
                {ref.entityName || ref.entityType}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-500">{t('actions.castRefsEmpty')}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>{t('actions.castEntityType')}</Label>
          <Select
            className="mt-1"
            value={entityType}
            disabled={disabled || loading}
            onChange={(e) =>
              setEntityType(e.target.value as ActionCastEntityType)
            }
          >
            <option value="character">{t('nav.characters')}</option>
            <option value="costume">{t('nav.costumes')}</option>
            <option value="scene">{t('nav.scenes')}</option>
            <option value="prop">{t('nav.props')}</option>
          </Select>
        </div>
        <div>
          <Label>{t('actions.castEntity')}</Label>
          <Select
            className="mt-1"
            value={entityId}
            disabled={disabled || loading || items.length === 0}
            onChange={(e) => setEntityId(e.target.value)}
          >
            {items.length === 0 ? (
              <option value="">{t('actions.castEntityEmpty')}</option>
            ) : (
              items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))
            )}
          </Select>
        </div>
      </div>

      {gallery.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] text-ink-400">
            {t('actions.pickStill')}
          </p>
          <div className="flex flex-wrap gap-2">
            {gallery.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={disabled}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-ink-700 hover:border-brand-500"
                onClick={() => addPath(g.path)}
                title={g.label}
              >
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
              </button>
            ))}
          </div>
        </div>
      ) : entityId ? (
        <p className="text-[11px] text-ink-500">{t('actions.noStills')}</p>
      ) : null}

      {entityId && items.find((i) => i.id === entityId)?.refImagePath ? (
        <Button
          variant="secondary"
          className="!text-xs"
          disabled={disabled}
          onClick={() => {
            const p = items.find((i) => i.id === entityId)?.refImagePath
            if (p) addPath(p)
          }}
        >
          {t('actions.addCoverStill')}
        </Button>
      ) : null}
    </div>
  )
}
