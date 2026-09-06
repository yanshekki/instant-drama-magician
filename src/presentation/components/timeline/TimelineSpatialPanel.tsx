import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../../lib/api'
import type { SpatialBlocking } from '../../../domain/spatialRef'
import { defaultSpatialBlocking, parseSpatialBlocking } from '../../../domain/spatialRef'
import { Button } from '../ui'
import { TimelineShotStage, shotStageToPngDataUrl } from './TimelineShotStage'
import type { TimelineEntry, Character, Scene, Prop, Action } from '../../../types/domain'

function notifySpatialUpdated(entryId: string, playblastPath: string | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('idm:spatial-ref-updated', {
      detail: { entryId, playblastPath }
    })
  )
}

export function TimelineSpatialPanel(props: {
  entry: TimelineEntry
  characters: Character[]
  scenes: Scene[]
  propsList: Prop[]
  actions: Action[]
}): JSX.Element {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [blocking, setBlocking] = useState<SpatialBlocking>(() =>
    defaultSpatialBlocking({
      characters: props.characters.map((c) => ({ id: c.id, name: c.name })),
      scenes: props.scenes.map((s) => ({
        id: s.id,
        name: s.title || s.description.slice(0, 24)
      })),
      props: props.propsList.map((p) => ({ id: p.id, name: p.name })),
      actions: props.actions.map((a) => ({ id: a.id, name: a.name }))
    })
  )
  const [playblastPath, setPlayblastPath] = useState<string | null>(null)
  const [blenderOk, setBlenderOk] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [asFirst, setAsFirst] = useState(false)
  const [meshNote, setMeshNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const pkg = (await getApi().spatial.compileBeat({
          storyId: props.entry.storyId,
          entryId: props.entry.id
        })) as {
          blocking?: unknown
          playblastPath?: string | null
          usePlayblastAsFirstFrame?: boolean
        }
        if (cancelled) return
        const parsed = parseSpatialBlocking(pkg.blocking)
        if (parsed) setBlocking(parsed)
        setPlayblastPath(pkg.playblastPath ?? null)
        setAsFirst(pkg.usePlayblastAsFirstFrame === true)
        notifySpatialUpdated(props.entry.id, pkg.playblastPath ?? null)
      } catch {
        /* keep defaults */
      }
      try {
        const st = await getApi().spatial.blenderStatus()
        if (!cancelled) setBlenderOk(st.available)
      } catch {
        if (!cancelled) setBlenderOk(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.entry.id, props.entry.storyId])

  const savePlayblast = async (): Promise<void> => {
    setBusy(true)
    setMeshNote(null)
    try {
      const dataUrl = shotStageToPngDataUrl(canvasRef.current)
      const pkg = (await getApi().spatial.attachRef({
        storyId: props.entry.storyId,
        entryId: props.entry.id,
        blocking,
        playblastPngBase64: dataUrl || undefined,
        usePlayblastAsFirstFrame: asFirst
      })) as { playblastPath?: string | null }
      const path = pkg.playblastPath ?? null
      setPlayblastPath(path)
      notifySpatialUpdated(props.entry.id, path)
    } finally {
      setBusy(false)
    }
  }

  const pickStill = async (): Promise<void> => {
    const picked = await getApi().media.pickRefImage()
    const path = picked?.filePath?.trim() || ''
    if (!path) return
    setBusy(true)
    setMeshNote(null)
    try {
      const pkg = (await getApi().spatial.attachRef({
        storyId: props.entry.storyId,
        entryId: props.entry.id,
        playblastPath: path,
        blocking,
        usePlayblastAsFirstFrame: asFirst
      })) as { playblastPath?: string | null }
      const next = pkg.playblastPath ?? path
      setPlayblastPath(next)
      notifySpatialUpdated(props.entry.id, next)
    } finally {
      setBusy(false)
    }
  }

  const generateProxy = async (): Promise<void> => {
    const target =
      props.propsList[0] != null
        ? { entityType: 'prop', entityId: props.propsList[0].id }
        : props.scenes[0] != null
          ? { entityType: 'scene', entityId: props.scenes[0].id }
          : props.characters[0] != null
            ? { entityType: 'character', entityId: props.characters[0].id }
            : null
    if (!target) {
      setMeshNote(t('timeline.desk.spatialMeshNeed'))
      return
    }
    setBusy(true)
    try {
      await getApi().spatial.generateMesh({
        storyId: props.entry.storyId,
        entryId: props.entry.id,
        entityType: target.entityType,
        entityId: target.entityId
      })
      setMeshNote(t('timeline.desk.spatialMeshOk'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-ink-800 pt-3" data-testid="spatial-panel">
      <h4 className="text-xs font-semibold text-ink-100">{t('timeline.desk.spatialTitle')}</h4>
      <p className="text-[11px] text-ink-400">{t('timeline.desk.spatialHint')}</p>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="secondary"
          className="!h-7 !px-2 !py-0 !text-[10px]"
          disabled={busy}
          onClick={() => void savePlayblast()}
        >
          {t('timeline.desk.spatialExportPlayblast')}
        </Button>
        <Button
          variant="ghost"
          className="!h-7 !px-2 !py-0 !text-[10px]"
          disabled={busy}
          onClick={() => void pickStill()}
        >
          {t('timeline.desk.spatialPick')}
        </Button>
        <Button
          variant="ghost"
          className="!h-7 !px-2 !py-0 !text-[10px]"
          disabled={busy}
          onClick={() => void generateProxy()}
        >
          {t('timeline.desk.spatialGenMesh')}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-ink-300">
        <input
          type="checkbox"
          data-testid="spatial-first-frame"
          checked={asFirst}
          onChange={(e) => setAsFirst(e.target.checked)}
        />
        {t('timeline.desk.spatialUseAsFirstFrame')}
      </label>
      {asFirst ? (
        <p className="text-[11px] text-amber-200/90">{t('timeline.desk.spatialFirstFrameWarn')}</p>
      ) : null}
      <TimelineShotStage
        ref={canvasRef}
        blocking={blocking}
        onChange={setBlocking}
        disabled={busy}
      />
      <p className="font-mono text-[10px] text-ink-500" data-testid="spatial-playblast-path">
        {playblastPath || t('timeline.desk.spatialEmpty')}
      </p>
      {meshNote ? <p className="text-[11px] text-ink-300">{meshNote}</p> : null}
      <p className="text-[10px] text-ink-500">
        {blenderOk
          ? t('timeline.desk.spatialBlender')
          : t('timeline.desk.spatialBlenderMissing')}
      </p>
    </div>
  )
}
