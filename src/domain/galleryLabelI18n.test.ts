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
    expect(translateCharacterGalleryLabel('  ', t)).toBe(
      'characters.photoFallback'
    )
    expect(translateCharacterGalleryLabel('Costume swap · red coat', t)).toBe(
      'characters.swapCostume · red coat'
    )
    expect(translateCharacterGalleryLabel('Costume swap', t)).toBe(
      'characters.swapCostume'
    )
    expect(translateCharacterGalleryLabel('Generate dressed look', t)).toBe(
      'costumes.generateDressed'
    )
    expect(translateCharacterGalleryLabel('costumes.generateDressed', t)).toBe(
      'costumes.generateDressed'
    )
    expect(translateCharacterGalleryLabel('External ref', t)).toBe(
      'characters.externalRefLabel'
    )
    expect(translateCharacterGalleryLabel('Reference', t)).toBe(
      'characters.photoFallback'
    )
    expect(translateCharacterGalleryLabel('Freeform custom label', t)).toBe(
      'Freeform custom label'
    )
    // partial prefix match with suffix
    expect(translateCharacterGalleryLabel('Bible sheet · rain', t)).toMatch(
      /sheetBible|Bible/
    )
  })

  it('maps scene and prop labels', () => {
    expect(translateSceneGalleryLabel('Establishing', t)).toBe(
      'scenes.plateEstablishing'
    )
    expect(translateSceneGalleryLabel(null, t)).toBe('scenes.photoFallback')
    expect(translateSceneGalleryLabel('Custom scene', t)).toBe('Custom scene')
    expect(translatePropGalleryLabel('Prop hero', t)).toBe(
      'props.propPlateHero'
    )
    expect(translatePropGalleryLabel(undefined, t)).toBe('props.photoFallback')
    expect(translatePropGalleryLabel('Weird prop', t)).toBe('Weird prop')
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
    expect(translateActionGalleryLabel('Instruction strip', t)).toBe(
      'actions.galleryFallback'
    )
    expect(translateActionGalleryLabel(undefined, t)).toBe(
      'actions.galleryFallback'
    )
    expect(translateActionGalleryLabel('Generate multi panel', t)).toBe(
      'actions.generatePlate'
    )
    expect(translateActionGalleryLabel('actions.generatePlate', t)).toBe(
      'actions.generatePlate'
    )
    expect(translateActionGalleryLabel('External ref pack', t)).toBe(
      'characters.externalRefLabel'
    )
    expect(translateActionGalleryLabel('My freeform action', t)).toBe(
      'My freeform action'
    )
  })
})
