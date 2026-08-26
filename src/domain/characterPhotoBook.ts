/**
 * Character photo book — shots live in profileJson.photoBook (no Prisma column).
 * Stills are library files only; never written to identity refGalleryJson.
 */
import {
  buildTimelineBeatMaterialSections,
  pickDefaultEditBaseSectionId,
  type MediaGenGenOptions,
  type MediaGenMaterialSection,
  type TimelineBoundEntityRef
} from './mediaGenPrep'

export type PhotoBookVideoMode = 'slideshow' | 'ai-clips'

export type PhotoBookShot = {
  id: string
  sceneId: string
  propIds: string[]
  actionId?: string
  notes?: string
  stillPath?: string
  clipPath?: string
  /** Camera template id (`introVideoTemplates`). */
  cameraTemplateId?: string
}

export type PhotoBookAlbum = {
  id: string
  name: string
  shots: PhotoBookShot[]
  videoPath?: string
  videoMode?: PhotoBookVideoMode
}

export type PhotoBook = {
  albums: PhotoBookAlbum[]
}

export const DEFAULT_PHOTO_BOOK_ALBUM_ID = 'album_default'

const PHOTO_BOOK_KEY = 'photoBook'

function parseProfileObject(
  existing: string | null | undefined
): Record<string, unknown> {
  if (!existing?.trim()) return {}
  try {
    const parsed = JSON.parse(existing) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) }
    }
  } catch {
    /* start empty */
  }
  return {}
}

function newShotId(): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `pb_${stamp}_${rand}`
}

export function newPhotoBookAlbumId(): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `pba_${stamp}_${rand}`
}

function videoFields(src: {
  videoPath?: string
  videoMode?: PhotoBookVideoMode
}): Pick<PhotoBookAlbum, 'videoPath' | 'videoMode'> {
  return {
    ...(src.videoPath?.trim() ? { videoPath: src.videoPath.trim() } : {}),
    ...(src.videoMode === 'slideshow' || src.videoMode === 'ai-clips'
      ? { videoMode: src.videoMode }
      : {})
  }
}

export function emptyPhotoBookAlbum(
  partial?: Partial<PhotoBookAlbum>
): PhotoBookAlbum {
  return {
    id: partial?.id?.trim() || DEFAULT_PHOTO_BOOK_ALBUM_ID,
    name: partial?.name?.trim() || '',
    shots: Array.isArray(partial?.shots) ? partial!.shots : [],
    ...videoFields(partial ?? {})
  }
}

export function emptyPhotoBook(): PhotoBook {
  return { albums: [emptyPhotoBookAlbum()] }
}

export function newPhotoBookShot(
  partial?: Partial<PhotoBookShot>
): PhotoBookShot {
  const camera = partial?.cameraTemplateId?.trim() || ''
  return {
    id: partial?.id?.trim() || newShotId(),
    sceneId: partial?.sceneId?.trim() || '',
    propIds: Array.isArray(partial?.propIds)
      ? partial!.propIds.map((x) => String(x).trim()).filter(Boolean)
      : [],
    ...(partial?.actionId?.trim()
      ? { actionId: partial.actionId.trim() }
      : {}),
    ...(partial?.notes?.trim() ? { notes: partial.notes.trim() } : {}),
    ...(partial?.stillPath?.trim()
      ? { stillPath: partial.stillPath.trim() }
      : {}),
    ...(partial?.clipPath?.trim()
      ? { clipPath: partial.clipPath.trim() }
      : {}),
    ...(camera ? { cameraTemplateId: camera } : {})
  }
}

function sanitizeShotList(
  raw: unknown,
  seen: Set<string>
): PhotoBookShot[] {
  const shots: PhotoBookShot[] = []
  if (!Array.isArray(raw)) return shots
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const shot = newPhotoBookShot(item as Partial<PhotoBookShot>)
    if (!shot.id || seen.has(shot.id)) {
      shot.id = newShotId()
    }
    seen.add(shot.id)
    shots.push(shot)
  }
  return shots
}

function sanitizeAlbum(
  raw: unknown,
  seenShots: Set<string>,
  seenAlbums: Set<string>
): PhotoBookAlbum | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  let id =
    typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newPhotoBookAlbumId()
  if (seenAlbums.has(id)) id = newPhotoBookAlbumId()
  seenAlbums.add(id)
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  return emptyPhotoBookAlbum({
    id,
    name,
    shots: sanitizeShotList(o.shots, seenShots),
    videoPath: typeof o.videoPath === 'string' ? o.videoPath : undefined,
    videoMode:
      o.videoMode === 'slideshow' || o.videoMode === 'ai-clips'
        ? o.videoMode
        : undefined
  })
}

export function sanitizePhotoBook(raw: unknown): PhotoBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyPhotoBook()
  }
  const o = raw as Record<string, unknown>
  const seenShots = new Set<string>()
  const seenAlbums = new Set<string>()
  const albums: PhotoBookAlbum[] = []
  if (Array.isArray(o.albums) && o.albums.length > 0) {
    for (const item of o.albums) {
      const album = sanitizeAlbum(item, seenShots, seenAlbums)
      if (album) albums.push(album)
    }
  }
  if (albums.length === 0) {
    albums.push(
      emptyPhotoBookAlbum({
        id: DEFAULT_PHOTO_BOOK_ALBUM_ID,
        shots: sanitizeShotList(o.shots, seenShots),
        videoPath: typeof o.videoPath === 'string' ? o.videoPath : undefined,
        videoMode:
          o.videoMode === 'slideshow' || o.videoMode === 'ai-clips'
            ? o.videoMode
            : undefined
      })
    )
  }
  return { albums }
}

export function parsePhotoBook(
  json: string | null | undefined
): PhotoBook {
  if (!json?.trim()) return emptyPhotoBook()
  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyPhotoBook()
    }
    return sanitizePhotoBook((parsed as Record<string, unknown>)[PHOTO_BOOK_KEY])
  } catch {
    return emptyPhotoBook()
  }
}

export function photoBookIsEmpty(book: PhotoBook | null | undefined): boolean {
  if (!book || book.albums.length === 0) return true
  return !book.albums.some(
    (a) =>
      a.shots.length > 0 ||
      Boolean(a.videoPath?.trim()) ||
      Boolean(a.videoMode) ||
      Boolean(a.name.trim())
  )
}

export function mergePhotoBookIntoProfileJson(
  existing: string | null | undefined,
  book: PhotoBook
): string | null {
  const obj = parseProfileObject(existing)
  const clean = sanitizePhotoBook(book)
  if (photoBookIsEmpty(clean)) {
    delete obj[PHOTO_BOOK_KEY]
  } else {
    obj[PHOTO_BOOK_KEY] = clean
  }
  if (Object.keys(obj).length === 0) return null
  return JSON.stringify(obj)
}

export function activeAlbum(
  book: PhotoBook,
  albumId?: string | null
): PhotoBookAlbum {
  const id = albumId?.trim() || ''
  const found = id ? book.albums.find((a) => a.id === id) : undefined
  return found ?? book.albums[0] ?? emptyPhotoBookAlbum()
}

export function findShotAlbumId(
  book: PhotoBook,
  shotId: string
): string | null {
  const id = shotId.trim()
  if (!id) return null
  for (const album of book.albums) {
    if (album.shots.some((s) => s.id === id)) return album.id
  }
  return null
}

export function findPhotoBookShot(
  book: PhotoBook,
  shotId: string | null | undefined
): PhotoBookShot | undefined {
  const id = shotId?.trim() || ''
  if (!id) return undefined
  for (const album of book.albums) {
    const shot = album.shots.find((s) => s.id === id)
    if (shot) return shot
  }
  return undefined
}

export function albumShots(
  book: PhotoBook,
  albumId?: string | null
): PhotoBookShot[] {
  return activeAlbum(book, albumId).shots
}

export function resolvePhotoBookAlbum(
  book: PhotoBook,
  opts?: { albumId?: string | null; shotIds?: string[] | null }
): PhotoBookAlbum {
  const albumId = opts?.albumId?.trim() || ''
  if (albumId) return activeAlbum(book, albumId)
  const firstShot = (opts?.shotIds ?? []).map((x) => x.trim()).find(Boolean)
  if (firstShot) {
    const found = findShotAlbumId(book, firstShot)
    if (found) return activeAlbum(book, found)
  }
  return activeAlbum(book)
}

function mapAlbum(
  book: PhotoBook,
  albumId: string,
  fn: (album: PhotoBookAlbum) => PhotoBookAlbum
): PhotoBook {
  return {
    albums: book.albums.map((a) => (a.id === albumId ? fn(a) : a))
  }
}

export function upsertAlbum(
  book: PhotoBook,
  album: PhotoBookAlbum
): PhotoBook {
  const next = emptyPhotoBookAlbum(album)
  const idx = book.albums.findIndex((a) => a.id === next.id)
  const albums = [...book.albums]
  if (idx >= 0) albums[idx] = { ...albums[idx], ...next, shots: next.shots }
  else albums.push(next)
  return sanitizePhotoBook({ albums })
}

export function removeAlbum(book: PhotoBook, albumId: string): PhotoBook {
  const id = albumId.trim()
  const albums = book.albums.filter((a) => a.id !== id)
  if (albums.length === 0) return emptyPhotoBook()
  return { albums }
}

export function renameAlbum(
  book: PhotoBook,
  albumId: string,
  name: string
): PhotoBook {
  return mapAlbum(book, albumId, (a) => ({ ...a, name: name.trim() }))
}

export function upsertPhotoBookShot(
  book: PhotoBook,
  shot: PhotoBookShot,
  albumId?: string | null
): PhotoBook {
  const next = newPhotoBookShot(shot)
  const existingAlbum = findShotAlbumId(book, next.id)
  const targetId =
    existingAlbum ||
    albumId?.trim() ||
    book.albums[0]?.id ||
    DEFAULT_PHOTO_BOOK_ALBUM_ID
  const ensured =
    book.albums.some((a) => a.id === targetId)
      ? book
      : upsertAlbum(book, emptyPhotoBookAlbum({ id: targetId }))
  return mapAlbum(ensured, targetId, (album) => {
    const idx = album.shots.findIndex((s) => s.id === next.id)
    const shots = [...album.shots]
    if (idx >= 0) shots[idx] = next
    else shots.push(next)
    return { ...album, shots }
  })
}

export function removePhotoBookShot(book: PhotoBook, shotId: string): PhotoBook {
  const albumId = findShotAlbumId(book, shotId)
  if (!albumId) return book
  return mapAlbum(book, albumId, (album) => ({
    ...album,
    shots: album.shots.filter((s) => s.id !== shotId)
  }))
}

export function movePhotoBookShot(
  book: PhotoBook,
  shotId: string,
  dir: -1 | 1
): PhotoBook {
  const albumId = findShotAlbumId(book, shotId)
  if (!albumId) return book
  return mapAlbum(book, albumId, (album) => {
    const idx = album.shots.findIndex((s) => s.id === shotId)
    if (idx < 0) return album
    const dest = idx + dir
    if (dest < 0 || dest >= album.shots.length) return album
    const shots = [...album.shots]
    const [item] = shots.splice(idx, 1)
    shots.splice(dest, 0, item!)
    return { ...album, shots }
  })
}

export function reorderPhotoBookShots(
  book: PhotoBook,
  fromId: string,
  toId: string
): PhotoBook {
  const albumId = findShotAlbumId(book, fromId)
  if (!albumId) return book
  return mapAlbum(book, albumId, (album) => {
    const from = album.shots.findIndex((s) => s.id === fromId)
    const to = album.shots.findIndex((s) => s.id === toId)
    if (from < 0 || to < 0 || from === to) return album
    const shots = [...album.shots]
    const [item] = shots.splice(from, 1)
    shots.splice(to, 0, item!)
    return { ...album, shots }
  })
}

export function setPhotoBookShotStill(
  book: PhotoBook,
  shotId: string,
  stillPath: string
): PhotoBook {
  const path = stillPath.trim()
  if (!path) return book
  const albumId = findShotAlbumId(book, shotId)
  if (!albumId) return book
  return mapAlbum(book, albumId, (album) => ({
    ...album,
    shots: album.shots.map((s) =>
      s.id === shotId ? { ...s, stillPath: path } : s
    )
  }))
}

export function clearPhotoBookShotStill(
  book: PhotoBook,
  shotId: string
): PhotoBook {
  const albumId = findShotAlbumId(book, shotId)
  if (!albumId) return book
  return mapAlbum(book, albumId, (album) => ({
    ...album,
    shots: album.shots.map((s) => {
      if (s.id !== shotId) return s
      const next = { ...s }
      delete next.stillPath
      delete next.clipPath
      return next
    })
  }))
}

export function setPhotoBookShotClip(
  book: PhotoBook,
  shotId: string,
  clipPath: string
): PhotoBook {
  const path = clipPath.trim()
  if (!path) return book
  const albumId = findShotAlbumId(book, shotId)
  if (!albumId) return book
  return mapAlbum(book, albumId, (album) => ({
    ...album,
    shots: album.shots.map((s) =>
      s.id === shotId ? { ...s, clipPath: path } : s
    )
  }))
}

export function setAlbumFilm(
  book: PhotoBook,
  albumId: string,
  videoPath: string,
  videoMode: PhotoBookVideoMode
): PhotoBook {
  const path = videoPath.trim()
  if (!path) return book
  return mapAlbum(book, albumId, (album) => ({
    ...album,
    videoPath: path,
    videoMode
  }))
}

export function shotsWithStills(
  book: PhotoBook,
  shotIds?: string[] | null,
  albumId?: string | null
): PhotoBookShot[] {
  const album = resolvePhotoBookAlbum(book, { albumId, shotIds })
  const allow =
    Array.isArray(shotIds) && shotIds.length > 0
      ? new Set(shotIds.map((x) => x.trim()).filter(Boolean))
      : null
  return album.shots.filter((s) => {
    if (allow && !allow.has(s.id)) return false
    return Boolean(s.stillPath?.trim())
  })
}

export function shotsWithClips(
  book: PhotoBook,
  shotIds?: string[] | null,
  albumId?: string | null
): PhotoBookShot[] {
  const album = resolvePhotoBookAlbum(book, { albumId, shotIds })
  const allow =
    Array.isArray(shotIds) && shotIds.length > 0
      ? new Set(shotIds.map((x) => x.trim()).filter(Boolean))
      : null
  return album.shots.filter((s) => {
    if (allow && !allow.has(s.id)) return false
    return Boolean(s.clipPath?.trim())
  })
}

export function photoBookTaskHint(opts: {
  locale?: string | null
  characterName: string
}): string {
  const zh = (opts.locale || '').toLowerCase().startsWith('zh')
  const name = opts.characterName.trim() || (zh ? '角色' : 'character')
  return zh
    ? `角色「${name}」攝影集單張：可拍、電影感、無浮水印。身分鎖定角色參考圖；場景只鎖空間架構，勿用空鏡取代臉。`
    : `One shootable cinematic photo-book still of "${name}". Identity-lock the character refs. SPACE LOCK the location plate — do not use the empty set as the face. No watermark.`
}

export function photoBookClipTaskHint(opts: {
  locale?: string | null
  characterName: string
}): string {
  const zh = (opts.locale || '').toLowerCase().startsWith('zh')
  const name = opts.characterName.trim() || (zh ? '角色' : 'character')
  return zh
    ? `角色「${name}」攝影集短片：用已有靜圖做首幀，再圖像生成影片；鏡頭／表演跟範本；身分鎖定，無浮水印。`
    : `Photo-book clip of "${name}" from the existing still as first frame, then image-to-video. Camera and performance follow the template. Identity lock. No watermark.`
}

export const PHOTO_BOOK_STILL_SECTION_PREFIX = 'photoshoot_still_'

export type PhotoBookStillRef = {
  shotId: string
  stillPath: string
  index: number
  sceneName?: string
}

export function photoBookStillSectionId(shotId: string): string {
  return `${PHOTO_BOOK_STILL_SECTION_PREFIX}${shotId.trim()}`
}

/** Stills that can be a clip pixel base (current shot prefers sourceImagePath). */
export function collectPhotoBookStillRefs(
  book: PhotoBook,
  opts?: {
    currentShotId?: string | null
    sourceImagePath?: string | null
    sceneNameById?: Record<string, string>
    albumId?: string | null
  }
): PhotoBookStillRef[] {
  const sceneNameById = opts?.sceneNameById ?? {}
  const currentId = opts?.currentShotId?.trim() || ''
  const source = opts?.sourceImagePath?.trim() || ''
  const album = resolvePhotoBookAlbum(book, {
    albumId: opts?.albumId,
    shotIds: currentId ? [currentId] : undefined
  })
  const out: PhotoBookStillRef[] = []
  let index = 0
  for (const shot of album.shots) {
    const path =
      shot.id === currentId && source
        ? source
        : shot.stillPath?.trim() || ''
    if (!path) continue
    index += 1
    const scene = shot.sceneId.trim()
      ? sceneNameById[shot.sceneId]?.trim() || undefined
      : undefined
    out.push({
      shotId: shot.id,
      stillPath: path,
      index,
      ...(scene ? { sceneName: scene } : {})
    })
  }
  if (source && currentId && !out.some((s) => s.shotId === currentId)) {
    out.push({
      shotId: currentId,
      stillPath: source,
      index: out.length + 1
    })
  }
  return out
}

export function buildPhotoBookMaterialSections(opts: {
  characterName: string
  identityRefs: TimelineBoundEntityRef[]
  scenes: TimelineBoundEntityRef[]
  props?: TimelineBoundEntityRef[]
  actions?: TimelineBoundEntityRef[]
  notes?: string | null
  actionNotes?: string | null
  hardRules?: string | null
  artStyleId?: string | null
  locale?: string | null
  shotIndex?: number
  /** When set (clip extract), these stills are the only pixel-edit bases. */
  photoStills?: PhotoBookStillRef[]
  currentShotId?: string | null
  /** Camera-template still system prompt (injected as a prompt-block). */
  cameraStillPrompt?: string | null
}): {
  sections: MediaGenMaterialSection[]
  editBaseSectionId: string | null
  fallbackPrompt: string
  genOptions: MediaGenGenOptions
  taskHint: string
} {
  const zh = (opts.locale || '').toLowerCase().startsWith('zh')
  const clipMode = opts.photoStills !== undefined
  const shotN = Math.max(1, opts.shotIndex ?? 1)
  const beatBlock = [
    opts.notes?.trim() || null,
    opts.actionNotes?.trim() || null
  ]
    .filter(Boolean)
    .join('\n')

  const built = buildTimelineBeatMaterialSections({
    kind: 'timeline-still',
    storyTitle: opts.characterName,
    displayIndex: shotN,
    beatBlock: beatBlock || undefined,
    characters: opts.identityRefs,
    scenes: opts.scenes,
    props: opts.props,
    actions: opts.actions,
    hardRules: opts.hardRules,
    artStyleId: opts.artStyleId,
    locale: opts.locale
  })

  const mapped = built.sections.map((s) => {
    if (s.entityType === 'character') {
      const i = Number(String(s.id).replace(/\D/g, '')) || 0
      if (clipMode) {
        return {
          ...s,
          canBeEditBase: false,
          editBasePriority: 120 - i,
          text: [
            s.text,
            'IDENTITY LOCK — vision reference only. Do not use as the pixel edit base; the photo-book still is the first frame.'
          ].join(' ')
        }
      }
      return {
        ...s,
        canBeEditBase: true,
        editBasePriority: 180 - i,
        text: [
          s.text,
          'IDENTITY LOCK — this is the hero face/body. Prefer as pixel edit base over empty location plates.'
        ].join(' ')
      }
    }
    if (s.id === 'beat_profile') {
      const sceneNames = (opts.scenes ?? [])
        .map((x) => x.name)
        .filter(Boolean)
      const propNames = (opts.props ?? []).map((x) => x.name).filter(Boolean)
      const actionNames = (opts.actions ?? [])
        .map((x) => x.name)
        .filter(Boolean)
      return {
        ...s,
        title: zh ? `攝影集第 ${shotN} 張` : `Photo-book shot #${shotN}`,
        text: [
          zh
            ? `角色：${opts.characterName}`
            : `Character: ${opts.characterName}`,
          zh
            ? `攝影集單張 #${shotN}（可拍、無水印）`
            : `Photo-book still #${shotN} (shootable, no watermark)`,
          sceneNames.length
            ? zh
              ? `場景：${sceneNames.join('、')}`
              : `Location: ${sceneNames.join(', ')}`
            : null,
          propNames.length
            ? zh
              ? `道具：${propNames.join('、')}`
              : `Props: ${propNames.join(', ')}`
            : null,
          actionNames.length
            ? zh
              ? `動作：${actionNames.join('、')}`
              : `Action: ${actionNames.join(', ')}`
            : null,
          beatBlock ||
            (zh
              ? '角色站在該場景中，臉與體型鎖定參考圖。'
              : 'Place the character in this location; lock face and body to the refs.')
        ]
          .filter(Boolean)
          .join('\n')
      }
    }
    return s
  })

  const stillSections: MediaGenMaterialSection[] = []
  if (clipMode) {
    for (const shot of opts.photoStills ?? []) {
      const path = shot.stillPath.trim()
      if (!path || !shot.shotId.trim()) continue
      const isCurrent =
        Boolean(opts.currentShotId?.trim()) &&
        shot.shotId === opts.currentShotId?.trim()
      const scene = shot.sceneName?.trim() || ''
      stillSections.push({
        id: photoBookStillSectionId(shot.shotId),
        kind: 'ref-image',
        title: scene ? `${shot.index} · ${scene}` : String(shot.index),
        entityType: 'continuity',
        imagePath: path,
        text: [
          `PHOTO-BOOK STILL #${shot.index} of "${opts.characterName}".`,
          'This is the first frame / pixel edit base for image-to-video.',
          'Do not replace the actor, wardrobe, or set with identity library refs.'
        ].join(' '),
        include: true,
        canBeEditBase: true,
        editBasePriority: isCurrent ? 230 : 210 - shot.index,
        group: 'refs'
      })
    }
  }

  const cameraPrompt = opts.cameraStillPrompt?.trim() || ''
  const cameraSection: MediaGenMaterialSection[] = cameraPrompt
    ? [
        {
          id: 'camera_template',
          kind: 'prompt-block',
          title: zh ? '鏡頭範本' : 'Camera template',
          entityType: 'layout',
          text: cameraPrompt,
          include: true,
          canBeEditBase: false,
          group: 'task'
        }
      ]
    : []

  const sections = [...stillSections, ...mapped, ...cameraSection]

  const taskHint = photoBookTaskHint({
    locale: opts.locale,
    characterName: opts.characterName
  })
  const editBaseSectionId = pickDefaultEditBaseSectionId(sections)
  const fallbackPrompt = [taskHint, cameraPrompt || null, beatBlock || null]
    .filter(Boolean)
    .join('\n')

  return {
    sections,
    editBaseSectionId,
    fallbackPrompt,
    taskHint,
    genOptions: {
      ...built.genOptions,
      useIdentityEdit: Boolean(editBaseSectionId),
      galleryLabel: zh ? '攝影集' : 'Photo book'
    }
  }
}
