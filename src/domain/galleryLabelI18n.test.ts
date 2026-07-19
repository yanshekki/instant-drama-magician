import { describe, expect, it } from 'vitest'
import {
  translateActionGalleryLabel,
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
    expect(translateCharacterGalleryLabel('Costume swap · red coat', t)).toBe(
      'characters.swapCostume · red coat'
    )
    expect(translateCharacterGalleryLabel('Generate dressed look', t)).toBe(
      'costumes.generateDressed'
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

  it('maps action instruction board labels', () => {
    expect(translateActionGalleryLabel('Instruction board 2×2', t)).toBe(
      'actions.panelLayout_grid-2x2'
    )
    expect(translateActionGalleryLabel('Instruction strip ×3', t)).toBe(
      'actions.panelLayout_strip-3'
    )
    expect(translateActionGalleryLabel('Instruction board', t)).toBe(
      'actions.galleryFallback'
    )
    expect(translateActionGalleryLabel(undefined, t)).toBe(
      'actions.galleryFallback'
    )
  })
})
