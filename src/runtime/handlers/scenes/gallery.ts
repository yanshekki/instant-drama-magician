/**
 * registerScenesGallery
 */
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'

export function registerScenesGallery(ctx: HandlerContext): void {
  const {
    reg,
    scenes,
    activity
  } = ctx

reg(
  'scenes:copyGalleryFrom',
  (
    async (
      payload: { targetSceneId: string; sourceSceneId: string }
    ) => {
      const target = await scenes().get(payload.targetSceneId)
      const source = await scenes().get(payload.sourceSceneId)
      const {
        parseSceneGallery,
        serializeSceneGallery,
        primarySceneGalleryPath
      } = await import('../../../domain/sceneGallery')
      const srcGallery = parseSceneGallery(source.refGalleryJson, {
        refImagePath: source.refImagePath
      })
      if (srcGallery.length === 0) {
        throw new AppError('VALIDATION', 'errors.sourceSceneNoGallery')
      }
      const updated = await scenes().update(target.id, {
        refGalleryJson: serializeSceneGallery(srcGallery),
        refImagePath:
          primarySceneGalleryPath(srcGallery) ?? source.refImagePath,
        locationKey:
          target.locationKey ||
          source.locationKey ||
          source.title ||
          target.title
      })
      activity.append({
        kind: 'scene',
        message: 'copyGalleryFrom',
        meta: {
          targetSceneId: target.id,
          sourceSceneId: source.id,
          count: srcGallery.length
        }
      })
      return { scene: updated, gallery: srcGallery }
    }
  )
)
}
