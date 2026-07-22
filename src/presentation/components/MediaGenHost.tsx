/**
 * Global host: one MediaGenPrepModal for the whole app (image + video).
 * Video completes inside the shell — never jumps to VideoPrepModal mid-flow.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiJobs } from '../context/AiJobsContext'
import { useToast } from '../context/ToastContext'
import {
  MediaGenPrepModal,
  type MediaGenPrepOpenRequest,
  type MediaGenPrepResult
} from './MediaGenPrepModal'
import { mediaGenMode } from '../../domain/mediaGenPrep'

export function MediaGenHost(): JSX.Element | null {
  const { t } = useTranslation()
  const toast = useToast()
  const {
    mediaGenRequest,
    setMediaGenRequest,
    startJob,
    registerStartMediaGen
  } = useAiJobs()

  useEffect(() => {
    registerStartMediaGen((req: MediaGenPrepOpenRequest) => {
      setMediaGenRequest(req)
    })
    return () => registerStartMediaGen(null)
  }, [registerStartMediaGen, setMediaGenRequest])

  const close = useCallback((): void => {
    setMediaGenRequest(null)
  }, [setMediaGenRequest])

  /** Image path: user accepted result in shell → open AiDraft / gallery job. */
  const onGenerated = useCallback(
    (result: MediaGenPrepResult): void => {
      const req = mediaGenRequest
      setMediaGenRequest(null)
      if (!req) return

      // Video finishes inside the modal (confirm + done); no second wizard.
      if (mediaGenMode(req.kind as never) === 'video') {
        // Timeline clip video already confirmed via videoPrep — notify studio
        if (req.kind === 'timeline-clip' && req.storyId && req.entryId) {
          window.dispatchEvent(
            new CustomEvent('idm:timeline-still-done', {
              detail: {
                storyId: req.storyId,
                entryId: req.entryId,
                path: result.path,
                kind: req.kind
              }
            })
          )
        }
        return
      }

      // Timeline still: already persisted to continuity path — notify studio, no draft
      if (
        req.kind === 'timeline-still' &&
        req.storyId &&
        req.entryId &&
        result.path
      ) {
        window.dispatchEvent(
          new CustomEvent('idm:timeline-still-done', {
            detail: {
              storyId: req.storyId,
              entryId: req.entryId,
              path: result.path,
              kind: req.kind
            }
          })
        )
        toast.success(t('timeline.advanced.stillGenOk'))
        return
      }

      const scope = {
        characterId: req.characterId,
        sceneId: req.sceneId,
        propId: req.propId,
        // Required for costume-dress so acceptDraft also appends costume gallery
        costumeId: req.costumeId,
        actionId: req.actionId,
        storyId: req.storyId,
        entryId: req.entryId
      }
      const label =
        t(`mediaGen.kind.${req.kind}`, {
          defaultValue: t('mediaGen.generateImage')
        }) || t('mediaGen.generateImage')

      toast.info(t('aiJobs.startedBackground'))
      startJob({
        kind: jobKindForMediaGen(req.kind),
        label,
        scope,
        run: async ({ setProgress }) => {
          setProgress(100, 'done')
          return draftPayloadFor(req, result, label)
        }
      })
    },
    [mediaGenRequest, setMediaGenRequest, startJob, t, toast]
  )

  return (
    <MediaGenPrepModal
      open={Boolean(mediaGenRequest)}
      request={mediaGenRequest}
      onClose={close}
      onGenerated={onGenerated}
    />
  )
}

function jobKindForMediaGen(
  kind: string
):
  | 'action-plate'
  | 'character-sheet'
  | 'scene-plate'
  | 'prop-plate'
  | 'story-cover'
  | 'costume-swap'
  | 'atmosphere-swap' {
  switch (kind) {
    case 'character-sheet':
      return 'character-sheet'
    case 'scene-plate':
      return 'scene-plate'
    case 'prop-plate':
      return 'prop-plate'
    case 'story-cover':
      return 'story-cover'
    case 'costume-dress':
    case 'costume-swap':
      return 'costume-swap'
    case 'atmosphere-swap':
      return 'atmosphere-swap'
    case 'action-plate':
    default:
      return 'action-plate'
  }
}

function draftPayloadFor(
  req: MediaGenPrepOpenRequest,
  result: MediaGenPrepResult,
  label: string
): Record<string, unknown> {
  const path = result.path
  switch (req.kind) {
    case 'character-sheet':
      return {
        type: 'character-sheet',
        characterId: req.characterId!,
        storyId: req.storyId ?? '',
        path,
        variant: req.sheetVariant || 'bible',
        label
      }
    case 'scene-plate':
      return {
        type: 'scene-plate',
        sceneId: req.sceneId!,
        storyId: req.storyId ?? '',
        path,
        variant: 'plate',
        label
      }
    case 'prop-plate':
      return {
        type: 'prop-plate',
        propId: req.propId!,
        storyId: req.storyId ?? '',
        path,
        variant: 'plate',
        label
      }
    case 'story-cover':
      return {
        type: 'story-cover',
        storyId: req.storyId!,
        path,
        label
      }
    case 'costume-dress':
    case 'costume-swap':
      return {
        type: 'character-sheet',
        characterId: req.characterId!,
        storyId: req.storyId ?? '',
        path,
        variant: 'costume_swap',
        label,
        layer: 'costume',
        costumeDescription: req.costumeDescription
      }
    case 'atmosphere-swap':
      return {
        type: 'scene-plate',
        sceneId: req.sceneId!,
        storyId: req.storyId ?? '',
        path,
        variant: 'atmosphere_swap',
        label,
        layer: 'atmosphere',
        atmosphereDescription: req.atmosphereDescription
      }
    case 'action-plate':
    default:
      return {
        type: 'action-plate',
        actionId: req.actionId!,
        storyId: req.storyId ?? '',
        path,
        panelLayout: result.panelLayout || req.panelLayout || 'grid-2x2',
        label
      }
  }
}
