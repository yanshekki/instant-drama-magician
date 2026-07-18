import { describe, expect, it } from 'vitest'
import {
  translateCharacterGalleryLabel,
  translatePropGalleryLabel,
  translateSceneGalleryLabel
} from './galleryLabelI18n'

const t = (key: string) => key

describe('galleryLabelI18n', () => {
  it('maps character sheet gallery labels to i18n keys', () => {
    expect(translateCharacterGalleryLabel('Bible sheet', t)).toBe(
      'characters.sheetBible'
    )
    expect(translateCharacterGalleryLabel('Body plate front', t)).toBe(
      'characters.sheetBodyNudeFront'
    )
    expect(translateCharacterGalleryLabel(undefined, t)).toBe(
      'characters.photoFallback'
    )
  })

  it('maps scene and prop labels', () => {
    expect(translateSceneGalleryLabel('Establishing', t)).toBe(
      'scenes.plateEstablishing'
    )
    expect(translatePropGalleryLabel('Prop hero', t)).toBe(
      'props.propPlateHero'
    )
  })
})
