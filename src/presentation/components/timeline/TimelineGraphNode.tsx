import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TimelineGraphLaidOutNode } from '../../../domain/timelineGraph'
import { LocalMediaImage } from '../LocalMediaImage'
import { Button, Label, Textarea } from '../ui'
import { timelineArtStyleLabel, timelineChannelLabel } from './timelineLabels'

export interface TimelineGraphNodeHandlers {
  promptValue: string
  revisionValue: string
  onPromptChange: (v: string) => void
  onRevisionChange: (v: string) => void
  onSavePrompt: () => void
  onGenStill: () => void
  onRegenStill: () => void
  onRefineStill: () => void
  onGenStillFor?: (entryId: string) => void
  onRegenStillFor?: (entryId: string) => void
  onRefineStillFor?: (entryId: string) => void
  onOpenSetup: () => void
  onOpenStoryEditor: () => void
  onOpenEntity: (kind: 'character' | 'scene' | 'prop' | 'action', id: string) => void
  stillBusy?: boolean
  videoSlot?: ReactNode
  generateVideoSlot?: ReactNode
  videoSlotFor?: (entryId: string) => ReactNode
  generateVideoSlotFor?: (entryId: string) => ReactNode
}

const CARD =
  'flex flex-col overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-900/40 shadow-lg shadow-black/10'
const CARD_ACTIVE = 'border-brand-500 bg-brand-950/30 shadow-md shadow-brand-950/20'
const CARD_GHOST = 'border-dashed border-ink-700/80 bg-ink-900/20'
const EYEBROW = 'text-[10px] font-medium uppercase tracking-wide text-ink-500'
const MEDIA_BOX =
  'relative overflow-hidden rounded-xl bg-ink-950/50 [&_img]:!h-full [&_img]:!w-full [&_img]:!object-contain'

interface TimelineGraphNodeProps {
  node: TimelineGraphLaidOutNode
  active?: boolean
  handlers: TimelineGraphNodeHandlers
  onSelect: () => void
  positioned?: boolean
}

export function TimelineGraphNode({
  node,
  active,
  handlers,
  onSelect,
  positioned = true
}: TimelineGraphNodeProps): JSX.Element {
  const { t } = useTranslation()
  const style = positioned
    ? {
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h
      }
    : undefined

  const shell = [
    positioned ? 'absolute h-full' : 'relative w-full',
    CARD,
    active ? CARD_ACTIVE : '',
    node.kind.startsWith('ghost-') ? CARD_GHOST : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      data-testid={`graph-node-${node.id}`}
      className={shell}
      style={style}
      onClick={onSelect}
    >
      {nodeBody(node, handlers, t)}
    </article>
  )
}

function posterFallback(
  node: TimelineGraphLaidOutNode,
  t: (k: string) => string
): ReactNode {
  if (node.imagePath) {
    return (
      <div className={`${MEDIA_BOX} h-full min-h-[10rem]`}>
        <LocalMediaImage
          filePath={node.imagePath}
          alt={node.title || t('timeline.graph.still')}
          variant="fill"
          objectFit="contain"
          showActions={false}
          enableZoom={false}
          hoverZoom={false}
          className="h-full w-full"
        />
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-[10rem] items-center justify-center px-2 text-center text-[11px] text-ink-500">
      {t('timeline.graph.clipEmpty')}
    </div>
  )
}

function nodeBody(
  node: TimelineGraphLaidOutNode,
  handlers: TimelineGraphNodeHandlers,
  t: (k: string, opts?: Record<string, string | number>) => string
): ReactNode {
  if (node.kind === 'ghost-character' || node.kind === 'ghost-scene') {
    return (
      <div className="flex h-full flex-col justify-between p-3">
        <div>
          <p className={EYEBROW}>
            {node.kind === 'ghost-character'
              ? t('timeline.character')
              : t('timeline.scene')}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-200">
            {node.kind === 'ghost-character'
              ? t('timeline.graph.ghostCharacter')
              : t('timeline.graph.ghostScene')}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
            {t('timeline.graph.ghostHint')}
          </p>
        </div>
        <Button
          variant="secondary"
          className="!px-2 !py-1 !text-[11px]"
          onClick={(e) => {
            e.stopPropagation()
            handlers.onOpenStoryEditor()
          }}
        >
          {t('timeline.openStoryEditor')}
        </Button>
      </div>
    )
  }

  if (node.kind === 'prompt') {
    if (node.id !== 'prompt') {
      return (
        <div className="flex h-full min-h-0 flex-col p-3">
          <p className={EYEBROW}>
            {node.seq
              ? t('timeline.graph.clipN', { n: node.seq })
              : t('stories.beatScript')}
          </p>
          <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-lg bg-ink-950/40 px-2 py-1.5">
            <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-200">
              {node.title || t('stories.beatScriptPh')}
            </p>
          </div>
        </div>
      )
    }
    return (
      <div
        className="flex h-full min-h-0 flex-col p-3"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <p className={EYEBROW}>{t('stories.beatScript')}</p>
        <Textarea
          size="sm"
          value={handlers.promptValue}
          onChange={(e) => handlers.onPromptChange(e.target.value)}
          placeholder={t('stories.beatScriptPh')}
          className="mt-1.5 min-h-0 !min-h-[8rem] flex-1 resize-none overflow-y-auto font-mono text-[12px] leading-relaxed"
        />
        <div className="mt-2 shrink-0">
          <Label>{t('timeline.revisionPrompt')}</Label>
          <Textarea
            size="sm"
            value={handlers.revisionValue}
            onChange={(e) => handlers.onRevisionChange(e.target.value)}
            placeholder={t('timeline.revisionPlaceholder')}
            className="mt-1 min-h-[4.5rem] !min-h-[4.5rem] resize-none overflow-y-auto text-[12px] leading-relaxed"
          />
        </div>
        <div className="mt-2">
          <Button className="!px-2.5 !py-1 !text-[11px]" onClick={handlers.onSavePrompt}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    )
  }

  if (node.kind === 'still') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
          <p className={EYEBROW}>{t('timeline.graph.still')}</p>
          <span className="rounded-full bg-ink-800/80 px-2 py-0.5 text-[10px] text-ink-300">
            {node.missing
              ? t('timeline.advanced.stillMissing')
              : node.status === 'stale'
                ? t('timeline.advanced.stillStale')
                : t('timeline.advanced.stillReady')}
          </span>
        </div>
        <div className={`${MEDIA_BOX} mx-3 mt-2 min-h-0 flex-1`}>
          {node.imagePath ? (
            <LocalMediaImage
              key={`${node.imagePath}:${node.imageRev || 0}`}
              filePath={node.imagePath}
              alt={t('timeline.graph.still')}
              variant="fill"
              objectFit="contain"
              showActions={false}
              enableZoom={false}
              hoverZoom={false}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-ink-500">
              {t('timeline.advanced.stillMissingHint')}
            </div>
          )}
        </div>
        <div
          className="flex flex-wrap gap-1.5 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            className="!px-2 !py-1 !text-[11px]"
            disabled={handlers.stillBusy}
            onClick={() => {
              if (node.missing) {
                if (handlers.onGenStillFor) handlers.onGenStillFor(node.entryId)
                else handlers.onGenStill()
              } else if (handlers.onRegenStillFor) {
                handlers.onRegenStillFor(node.entryId)
              } else {
                handlers.onRegenStill()
              }
            }}
          >
            {node.missing
              ? t('timeline.advanced.genStill')
              : t('timeline.advanced.regenStill')}
          </Button>
          <Button
            variant="ghost"
            className="!px-2 !py-1 !text-[11px]"
            disabled={handlers.stillBusy}
            onClick={() => {
              if (handlers.onRefineStillFor) handlers.onRefineStillFor(node.entryId)
              else handlers.onRefineStill()
            }}
          >
            {t('timeline.advanced.refineStill')}
          </Button>
        </div>
      </div>
    )
  }

  if (node.kind === 'clip') {
    const link =
      node.subtitle === 'locked'
        ? t('timeline.graph.clipLinked')
        : node.subtitle === 'first'
          ? t('timeline.graph.clipFirst')
          : t('timeline.graph.clipUnlinked')
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
          <p className={EYEBROW}>
            {t('timeline.graph.clipN', { n: node.seq ?? '' })}
          </p>
          <span className="rounded-full bg-ink-800/80 px-2 py-0.5 text-[10px] text-ink-300">
            {link}
          </span>
        </div>
        <div className={`${MEDIA_BOX} mx-3 mt-2 min-h-0 flex-1`}>
          {node.imagePath ? (
            <LocalMediaImage
              filePath={node.imagePath}
              alt={node.title || t('timeline.graph.still')}
              variant="fill"
              objectFit="contain"
              showActions={false}
              enableZoom={false}
              hoverZoom={false}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-ink-500">
              {t('timeline.graph.clipEmpty')}
            </div>
          )}
        </div>
        <p className="min-h-[2.5rem] px-3 py-2 text-[11px] leading-snug text-ink-200">
          {node.title || t('timeline.graph.clipEmpty')}
        </p>
      </div>
    )
  }

  if (node.kind === 'video') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
          <p className={EYEBROW}>
            {node.seq
              ? t('timeline.graph.clipN', { n: node.seq })
              : t('timeline.graph.video')}
          </p>
          <button
            type="button"
            className="truncate text-[10px] text-brand-300 hover:text-brand-200"
            onClick={(e) => {
              e.stopPropagation()
              handlers.onOpenSetup()
            }}
          >
            {node.subtitle
              ? timelineChannelLabel(node.subtitle, t)
              : t('timeline.graph.setup')}
          </button>
        </div>
        <div className="min-h-0 flex-1 px-3 pt-2">
          {handlers.videoSlotFor?.(node.entryId) ??
            (node.id === 'video' ? handlers.videoSlot : posterFallback(node, t))}
        </div>
        <div
          className="flex shrink-0 flex-col gap-1 px-3 pb-2 pt-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {handlers.generateVideoSlotFor?.(node.entryId) ??
            (node.id === 'video' ? handlers.generateVideoSlot : null)}
        </div>
      </div>
    )
  }

  if (node.kind === 'cinematic') {
    return (
      <div className="flex h-full min-h-0 flex-col p-3">
        <p className={EYEBROW}>{t('timeline.graph.cinematic')}</p>
        {node.title ? (
          <p className="mt-1 break-words text-[11px] font-medium leading-snug text-brand-200">
            {timelineArtStyleLabel(node.title, t)}
          </p>
        ) : null}
        {node.imagePath ? (
          <div className={`${MEDIA_BOX} mt-2 aspect-video h-[9.25rem] shrink-0`}>
            <LocalMediaImage
              filePath={node.imagePath}
              alt={t('timeline.graph.cinematic')}
              variant="fill"
              objectFit="contain"
              showActions={false}
              enableZoom={false}
              hoverZoom={false}
              className="h-full w-full"
            />
          </div>
        ) : null}
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg bg-ink-950/40 px-2 py-1.5">
          <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-200">
            {node.subtitle || t('timeline.graph.noStyle')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <p className={EYEBROW}>{kindLabel(node.kind, t)}</p>
        {node.missing ? (
          <span className="rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-100">
            {t('timeline.advanced.missingRef')}
          </span>
        ) : null}
      </div>
      <div
        className={`${MEDIA_BOX} mx-3 mt-2 shrink-0 ${
          node.imagePath ? 'aspect-video' : 'min-h-[3.25rem]'
        }`}
      >
        {node.imagePath ? (
          <LocalMediaImage
            filePath={node.imagePath}
            alt={node.title}
            variant="fill"
            objectFit="contain"
            showActions={false}
            enableZoom={false}
            hoverZoom={false}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-[11px] leading-relaxed text-ink-500">
            {t('timeline.advanced.noImage')}
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 px-3 pt-2">
        <p className="min-w-0 break-words text-xs font-semibold leading-snug text-ink-100">
          {node.title}
        </p>
        {node.entityId &&
        (node.kind === 'character' ||
          node.kind === 'scene' ||
          node.kind === 'prop' ||
          node.kind === 'action') ? (
          <Button
            variant="ghost"
            className="!shrink-0 !px-1.5 !py-0.5 !text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              handlers.onOpenEntity(node.kind, node.entityId!)
            }}
          >
            {t('stories.open')}
          </Button>
        ) : null}
      </div>
      {node.subtitle ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1">
          <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-400">
            {node.subtitle}
          </p>
        </div>
      ) : (
        <div className="h-2 shrink-0" />
      )}
    </div>
  )
}

function kindLabel(
  kind: TimelineGraphLaidOutNode['kind'],
  t: (k: string) => string
): string {
  if (kind === 'character') return t('timeline.character')
  if (kind === 'scene') return t('timeline.scene')
  if (kind === 'prop') return t('timeline.prop')
  if (kind === 'action') return t('timeline.action')
  if (kind === 'cinematic') return t('timeline.graph.cinematic')
  if (kind === 'clip') return t('timeline.graph.video')
  return kind
}
