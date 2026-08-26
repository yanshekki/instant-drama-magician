import { describe, expect, it } from 'vitest'
import {
  buildPhotoBookMaterialSections,
  collectPhotoBookStillRefs,
  photoBookClipTaskHint,
  photoBookStillSectionId,
  emptyPhotoBook,
  mergePhotoBookIntoProfileJson,
  movePhotoBookShot,
  newPhotoBookShot,
  parsePhotoBook,
  photoBookIsEmpty,
  photoBookTaskHint,
  removePhotoBookShot,
  reorderPhotoBookShots,
  setAlbumFilm,
  setPhotoBookShotClip,
  setPhotoBookShotStill,
  clearPhotoBookShotStill,
  shotsWithStills,
  upsertPhotoBookShot,
  upsertAlbum,
  emptyPhotoBookAlbum,
  newPhotoBookAlbumId,
  albumShots,
  activeAlbum,
  DEFAULT_PHOTO_BOOK_ALBUM_ID,
  sanitizePhotoBook,
  removeAlbum,
  renameAlbum,
  shotsWithClips
} from './characterPhotoBook'

describe('characterPhotoBook', () => {
  it('parses and merges without wiping other profile keys', () => {
    const shot = newPhotoBookShot({
      id: 's1',
      sceneId: 'sc1',
      propIds: ['p1'],
      actionId: 'a1',
      notes: 'rain'
    })
    const json = mergePhotoBookIntoProfileJson(
      '{"costumeKit":{"base":"x"},"name":"N"}',
      sanitizePhotoBook({ shots: [shot] })
    )
    const obj = JSON.parse(json ?? '{}') as Record<string, unknown>
    expect(obj.costumeKit).toEqual({ base: 'x' })
    expect(obj.name).toBe('N')
    expect(albumShots(parsePhotoBook(json))[0]?.sceneId).toBe('sc1')
    expect(albumShots(parsePhotoBook(json))[0]?.propIds).toEqual(['p1'])
    expect(albumShots(parsePhotoBook('{"photoBook":null}') )).toEqual([])
    expect(albumShots(parsePhotoBook('not-json'))).toEqual([])
    expect(photoBookIsEmpty(emptyPhotoBook())).toBe(true)
    expect(
      mergePhotoBookIntoProfileJson('{"photoBook":{"shots":[]}}', emptyPhotoBook())
    ).toBeNull()
  })

  it('upserts, moves, removes, and filters stills', () => {
    let book = emptyPhotoBook()
    const a = newPhotoBookShot({ id: 'a', sceneId: 'sc1' })
    const b = newPhotoBookShot({ id: 'b', sceneId: 'sc2', stillPath: '/b.png' })
    book = upsertPhotoBookShot(book, a)
    book = upsertPhotoBookShot(book, b)
    book = upsertPhotoBookShot(book, { ...a, notes: 'n' })
    expect(albumShots(book)).toHaveLength(2)
    expect(albumShots(book)[0]?.notes).toBe('n')
    book = movePhotoBookShot(book, 'a', 1)
    expect(albumShots(book).map((s) => s.id)).toEqual(['b', 'a'])
    book = setPhotoBookShotStill(book, 'a', '/a.png')
    expect(shotsWithStills(book).map((s) => s.id)).toEqual(['b', 'a'])
    expect(shotsWithStills(book, ['b']).map((s) => s.id)).toEqual(['b'])
    book = setPhotoBookShotClip(book, 'a', '/a.mp4')
    expect(albumShots(book).find((s) => s.id === 'a')?.clipPath).toBe('/a.mp4')
    book = removePhotoBookShot(book, 'b')
    expect(albumShots(book).map((s) => s.id)).toEqual(['a'])
    book = upsertPhotoBookShot(
      book,
      newPhotoBookShot({ id: 'c', sceneId: 'sc3', stillPath: '/c.png' })
    )
    book = reorderPhotoBookShots(book, 'c', 'a')
    expect(albumShots(book).map((s) => s.id)).toEqual(['c', 'a'])
    expect(reorderPhotoBookShots(book, 'missing', 'a')).toBe(book)
    expect(setPhotoBookShotStill(book, 'missing', '/x.png')).toBe(book)
    expect(setPhotoBookShotStill(book, 'a', '  ')).toBe(book)
    expect(setPhotoBookShotClip(book, 'a', '')).toBe(book)
    expect(setAlbumFilm(book, 'album_default', '', 'slideshow')).toBe(book)
    book = clearPhotoBookShotStill(book, 'c')
    expect(albumShots(book).find((s) => s.id === 'c')?.stillPath).toBeUndefined()
    expect(clearPhotoBookShotStill(book, 'missing')).toBe(book)
    expect(photoBookTaskHint({ locale: 'zh-HK', characterName: 'Aria' })).toMatch(
      /攝影集/
    )
    expect(photoBookTaskHint({ locale: 'en', characterName: '' })).toMatch(
      /character/
    )
    expect(movePhotoBookShot(book, 'nope', 1)).toEqual(book)
  })

  it('migrates legacy shots into a default album and supports named albums', () => {
    const migrated = parsePhotoBook(
      JSON.stringify({
        photoBook: {
          shots: [{ id: 's1', sceneId: 'sc1', propIds: [] }],
          videoPath: '/old.mp4',
          videoMode: 'ai-clips'
        }
      })
    )
    expect(migrated.albums).toHaveLength(1)
    expect(migrated.albums[0]?.id).toBe(DEFAULT_PHOTO_BOOK_ALBUM_ID)
    expect(migrated.albums[0]?.shots[0]?.id).toBe('s1')
    expect(migrated.albums[0]?.videoPath).toBe('/old.mp4')
    let book = emptyPhotoBook()
    book = upsertAlbum(
      book,
      emptyPhotoBookAlbum({
        id: newPhotoBookAlbumId(),
        name: 'Night walk'
      })
    )
    expect(book.albums).toHaveLength(2)
    expect(activeAlbum(book, book.albums[1]?.id).name).toBe('Night walk')
    const nightId = book.albums[1]!.id
    book = renameAlbum(book, nightId, 'Dawn')
    expect(activeAlbum(book, nightId).name).toBe('Dawn')
    book = upsertPhotoBookShot(
      book,
      newPhotoBookShot({
        id: 'n1',
        sceneId: 'sc1',
        stillPath: '/n.png',
        clipPath: '/n.mp4'
      }),
      nightId
    )
    expect(shotsWithClips(book, null, nightId).map((s) => s.id)).toEqual(['n1'])
    expect(shotsWithClips(book, null, DEFAULT_PHOTO_BOOK_ALBUM_ID)).toEqual([])
    book = removeAlbum(book, nightId)
    expect(book.albums).toHaveLength(1)
    expect(book.albums[0]?.id).toBe(DEFAULT_PHOTO_BOOK_ALBUM_ID)
    expect(removeAlbum(book, DEFAULT_PHOTO_BOOK_ALBUM_ID).albums).toHaveLength(1)
    const minted = newPhotoBookShot({ sceneId: 'sc9' })
    expect(minted.id).toMatch(/^pb_/)
    expect(newPhotoBookAlbumId()).toMatch(/^pba_/)
  })

  it('builds material sections with character, scene, prop, and action refs', () => {
    const built = buildPhotoBookMaterialSections({
      characterName: 'Aria',
      identityRefs: [
        { id: 'c1', name: 'Aria', imagePath: '/char.png' },
        { id: 'c1b', name: 'Aria ¾', imagePath: '/char2.png' }
      ],
      scenes: [{ id: 'sc1', name: 'Rooftop', imagePath: '/roof.png' }],
      props: [{ id: 'p1', name: 'Badge', imagePath: '/badge.png' }],
      actions: [{ id: 'a1', name: 'Draw', imagePath: '/draw.png' }],
      notes: 'neon rain',
      locale: 'zh-HK',
      shotIndex: 2
    })
    const types = built.sections.map((s) => s.entityType)
    expect(types).toContain('character')
    expect(types).toContain('scene')
    expect(types).toContain('prop')
    expect(types).toContain('action')
    const char = built.sections.find((s) => s.entityType === 'character')
    expect(char?.canBeEditBase).toBe(true)
    expect((char?.editBasePriority ?? 0) >= 120).toBe(true)
    const scene = built.sections.find((s) => s.entityType === 'scene')
    expect(scene?.canBeEditBase).toBe(false)
    expect(built.editBaseSectionId).toMatch(/character/)
    expect(built.taskHint).toMatch(/攝影集/)
    expect(built.fallbackPrompt).toMatch(/neon rain/)
    const profile = built.sections.find((s) => s.id === 'beat_profile')
    expect(profile?.text).toMatch(/Rooftop|場景/)
    expect(profile?.text).toMatch(/Badge|道具/)
    expect(profile?.text).toMatch(/Draw|動作/)
    expect(photoBookClipTaskHint({ locale: 'zh-HK', characterName: 'Aria' })).toMatch(
      /短片/
    )
    expect(photoBookClipTaskHint({ locale: 'en', characterName: 'Aria' })).toMatch(
      /clip/i
    )
    const withCam = buildPhotoBookMaterialSections({
      characterName: 'Aria',
      identityRefs: [{ id: 'c1', name: 'Aria', imagePath: '/char.png' }],
      locale: 'en',
      cameraStillPrompt: 'Camera still template (low-angle-hero):\nLow hero.'
    })
    const cam = withCam.sections.find((s) => s.id === 'camera_template')
    expect(cam?.kind).toBe('prompt-block')
    expect(cam?.text).toMatch(/low-angle-hero/)
    expect(withCam.fallbackPrompt).toMatch(/low-angle-hero/)
  })

  it('clip mode uses photo-book stills as the only edit base', () => {
    const built = buildPhotoBookMaterialSections({
      characterName: 'Aria',
      identityRefs: [
        { id: 'c1', name: 'Aria', imagePath: '/char.png' },
        { id: 'c1b', name: 'Aria ¾', imagePath: '/char2.png' }
      ],
      scenes: [{ id: 'sc1', name: 'Rooftop', imagePath: '/roof.png' }],
      locale: 'zh-HK',
      shotIndex: 2,
      currentShotId: 'pb2',
      photoStills: [
        {
          shotId: 'pb1',
          stillPath: '/s1.png',
          index: 1,
          sceneName: 'Alley'
        },
        {
          shotId: 'pb2',
          stillPath: '/s2.png',
          index: 2,
          sceneName: 'Rooftop'
        }
      ]
    })
    const chars = built.sections.filter((s) => s.entityType === 'character')
    expect(chars.length).toBeGreaterThan(0)
    expect(chars.every((s) => s.canBeEditBase === false)).toBe(true)
    const stills = built.sections.filter((s) =>
      s.id.startsWith('photoshoot_still_')
    )
    expect(stills.map((s) => s.id)).toEqual([
      photoBookStillSectionId('pb1'),
      photoBookStillSectionId('pb2')
    ])
    expect(stills.every((s) => s.canBeEditBase === true)).toBe(true)
    expect(built.editBaseSectionId).toBe(photoBookStillSectionId('pb2'))
    const book = emptyPhotoBook()
    const withStills = upsertPhotoBookShot(
      upsertPhotoBookShot(
        book,
        newPhotoBookShot({ id: 'pb1', sceneId: 'sc1', stillPath: '/a.png' })
      ),
      newPhotoBookShot({ id: 'pb2', sceneId: 'sc2' })
    )
    expect(
      collectPhotoBookStillRefs(withStills, {
        currentShotId: 'pb2',
        sourceImagePath: '/fresh.png',
        sceneNameById: { sc1: 'Alley', sc2: 'Roof' }
      })
    ).toEqual([
      {
        shotId: 'pb1',
        stillPath: '/a.png',
        index: 1,
        sceneName: 'Alley'
      },
      {
        shotId: 'pb2',
        stillPath: '/fresh.png',
        index: 2,
        sceneName: 'Roof'
      }
    ])
    expect(
      collectPhotoBookStillRefs(emptyPhotoBook(), {
        currentShotId: 'ghost',
        sourceImagePath: '/ghost.png'
      })
    ).toEqual([
      { shotId: 'ghost', stillPath: '/ghost.png', index: 1 }
    ])
    const enBuilt = buildPhotoBookMaterialSections({
      characterName: 'Aria',
      identityRefs: [{ id: 'c1', name: 'Aria', imagePath: '/char.png' }],
      scenes: [{ id: 'sc1', name: 'Rooftop', imagePath: '/roof.png' }],
      props: [{ id: 'p1', name: 'Badge', imagePath: '/badge.png' }],
      actions: [{ id: 'a1', name: 'Draw', imagePath: '/draw.png' }],
      locale: 'en',
      shotIndex: 1
    })
    const enProfile = enBuilt.sections.find((s) => s.id === 'beat_profile')
    expect(enProfile?.text).toMatch(/Location: Rooftop/)
    expect(enProfile?.text).toMatch(/Props: Badge/)
    expect(enProfile?.text).toMatch(/Action: Draw/)
  })
})
