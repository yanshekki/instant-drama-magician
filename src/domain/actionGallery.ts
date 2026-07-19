/**
 * Action instruction gallery — same shape as scene gallery.
 */
export {
  parseSceneGallery as parseActionGallery,
  serializeSceneGallery as serializeActionGallery,
  primarySceneGalleryPath as primaryActionGalleryPath,
  setSceneGalleryIntroVideo as setActionGalleryIntroVideo,
  listSceneExternalRefs as listActionExternalRefs,
  pickSceneExternalRefPath as pickActionExternalRefPath,
  appendSceneGalleryItem as appendActionGalleryItem,
  removeSceneGalleryItem as removeActionGalleryItem,
  moveSceneGalleryItem as moveActionGalleryItem,
  isSceneGalleryCoverPath as isActionGalleryCoverPath,
  type SceneGalleryItem as ActionGalleryItem,
  type SceneImageKind as ActionImageKind
} from './sceneGallery'

import { parseSceneGallery } from './sceneGallery'

export function galleryFromActionRow(row: {
  refGalleryJson?: string | null
  refImagePath?: string | null
}) {
  return parseSceneGallery(row.refGalleryJson, {
    refImagePath: row.refImagePath
  })
}
