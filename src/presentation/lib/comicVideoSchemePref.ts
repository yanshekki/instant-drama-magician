import type { ComicVideoScheme } from '../../domain/comicPageLayouts'
import { coerceComicVideoScheme } from '../../domain/comicPageLayouts'

export const COMIC_VIDEO_SCHEME_KEY = 'idm.comicVideoScheme.v1'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readComicVideoScheme(): ComicVideoScheme {
  try {
    return coerceComicVideoScheme(storage()?.getItem(COMIC_VIDEO_SCHEME_KEY))
  } catch {
    return 'page'
  }
}

export function writeComicVideoScheme(scheme: ComicVideoScheme): void {
  try {
    storage()?.setItem(COMIC_VIDEO_SCHEME_KEY, scheme)
  } catch {
    /* ignore */
  }
}
