/**
 * Media gen prep IPC: extract materials → multi-vision polish → generate one image.
 */
import { PromptCatalog } from '../../prompts'
import { existsSync, writeFileSync } from 'fs'
import { imageSizeForClass } from '../../domain/residualLabels'
import { ensureHardRules } from '../../domain/promptHardRules'
import { mergeSexIntoHardRules, sexPromptLock } from '../../domain/sexLock'
import { AppError } from '../../types/errors'
import type { HandlerContext } from './context'
import {
  extractPolishedMediaPrompt,
  type MediaGenKind,
  type MediaGenMaterialSection
} from '../../domain/mediaGenPrep'

type ExtractPayload = {
  kind: MediaGenKind
  actionId?: string
  characterId?: string
  sceneId?: string
  propId?: string
  storyId?: string
  costumeId?: string
  entryId?: string
  pageId?: string
  panelLayout?: string | null
  artStyle?: string | null
  /** Character sheet package (出圖方案) */
  sheetVariant?: string | null
  /** Scene / prop plate variant */
  plateVariant?: string | null
  galleryIdentityPaths?: string[] | null
  preferIdentityEdit?: boolean
  /** Free-text wardrobe for costume-dress / costume-swap */
  costumeDescription?: string
  atmosphereDescription?: string
  durationSeconds?: number
  locale?: string
  /** When true, surface existing continuity/keyframe path if on disk */
  skipStillIfExists?: boolean
  comicVideoScheme?: 'page' | 'drama'
  keyArtMakeMethod?: 'fresh' | 'edit' | 'identity' | 'continue'
  shotType?: string | null
  pageFormat?: 'tall' | 'square' | 'wide'
  forcePureLayout?: boolean
}

function sanitizeSections(
  sections: MediaGenMaterialSection[]
): MediaGenMaterialSection[] {
  return sections.map((s) => {
    const p = s.imagePath?.trim()
    if (p && !existsSync(p)) {
      return {
        ...s,
        imagePath: null,
        canBeEditBase: false,
        include: s.kind === 'ref-image' ? false : s.include
      }
    }
    return s
  })
}

function parseSpokenLanguagesField(
  raw: string | null | undefined
): string[] | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const list = parsed.filter(
        (x): x is string => typeof x === 'string' && Boolean(x.trim())
      )
      return list.length ? list : undefined
    }
  } catch {
    /* not JSON */
  }
  return undefined
}

async function loadCharacterSoulExcerpt(row: {
  soulMdPath?: string | null
  soulHubId?: number | null
}): Promise<string> {
  try {
    const soulPath = row.soulMdPath
    const soulHubId = row.soulHubId
    if (soulHubId == null && !soulPath?.trim()) return ''
    const { SoulMdHubClient } = await import(
      '../../infrastructure/soulmd/SoulMdHubClient'
    )
    const { readFileSync } = await import('fs')
    const soulHub = new SoulMdHubClient()
    if (soulHubId != null && Number.isFinite(soulHubId)) {
      const detail = await soulHub.getSoul(soulHubId)
      return SoulMdHubClient.flattenContent(
        detail.content,
        detail.file_type
      ).trim()
    }
    const path = soulPath!.trim()
    if (path.startsWith('soulmd-hub://')) {
      const id = Number(path.replace('soulmd-hub://', ''))
      if (!Number.isFinite(id)) return ''
      const detail = await soulHub.getSoul(id)
      return SoulMdHubClient.flattenContent(
        detail.content,
        detail.file_type
      ).trim()
    }
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8').trim()
    }
  } catch {
    return ''
  }
  return ''
}

export function registerMediagenHandlers(ctx: HandlerContext): void {
  const {
    reg,
    actions,
    characters,
    scenes,
    props,
    stories,
    comics,
    keyArt,
    costumes,
    timeline,
    generation,
    activity
  } = ctx

  reg('mediaGen:extract', async (payload: ExtractPayload) => {
    const kind = payload.kind || 'action-plate'

    if (kind === 'action-plate') {
      if (!payload.actionId?.trim()) {
        throw new AppError('VALIDATION', 'errors.actionIdRequired')
      }
      const row = await actions().get(payload.actionId)
      const { parseActionCastRefs } = await import(
        '../../domain/actionCastRefs'
      )
      const { parseActionGallery } = await import(
        '../../domain/actionGallery'
      )
      const {
        buildActionPlateMaterialSections,
        actionPlateTaskHint
      } = await import('../../domain/mediaGenPrep')
      const { getActionPanelLayout } = await import(
        '../../domain/actionPlateVariants'
      )
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )

      const castRefs = parseActionCastRefs(row.castRefsJson)
      const gallery = parseActionGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const galleryFromPayload = (payload.galleryIdentityPaths ?? [])
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p))
      const galleryPaths =
        galleryFromPayload.length > 0
          ? galleryFromPayload
          : gallery.map((g) => g.path).filter(Boolean)

      const profile = {
        name: row.name,
        description: row.description,
        motionNotes: row.motionNotes ?? undefined,
        intention: row.intention ?? undefined,
        cameraNotes: row.cameraNotes ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const layout = getActionPanelLayout(
        payload.panelLayout ?? row.panelLayout
      )
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id

      const built = buildActionPlateMaterialSections({
        actionId: row.id,
        profile,
        castRefs,
        galleryIdentityPaths: galleryPaths,
        panelLayout: layout.id,
        artStyleId: artStyle,
        preferIdentityEdit: payload.preferIdentityEdit
      })
      const sections = sanitizeSections(built.sections)

      activity.append({
        kind: 'ai',
        level: 'info',
        message: 'mediaGenExtract',
        meta: {
          kind,
          actionId: row.id,
          sectionCount: sections.length
        }
      })

      return {
        kind,
        entityIds: { actionId: row.id },
        sections,
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: actionPlateTaskHint(layout.id, profile.name),
        genOptions: {
          ...built.genOptions,
          panelLayout: layout.id,
          artStyle
        },
        hardRules: profile.hardRules ?? null
      }
    }

    // Generic entity extract (character / scene / prop / story)
    const { buildGenericEntityMaterialSections } = await import(
      '../../domain/mediaGenPrep'
    )
    const { getArtStyle } = await import('../../domain/characterArtStyles')

    if (kind === 'character-sheet') {
      if (!payload.characterId?.trim()) {
        throw new AppError('VALIDATION', 'errors.characterIdRequired')
      }
      const row = await characters().get(payload.characterId)
      const { getSheetVariant } = await import(
        '../../domain/characterSheetVariants'
      )
      const {
        buildCharacterSheetEditPrompt,
        buildCharacterSheetImagePrompt
      } = await import('../../domain/characterMasterPrompt')
      const variantDef = getSheetVariant(payload.sheetVariant)
      const forcePureLayout =
        variantDef.wardrobeLayer === 'nude' ||
        variantDef.wardrobeLayer === 'base' ||
        Boolean(variantDef.requiresUnclothedSupport)
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath, row.refSheetPath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const spokenLanguages = parseSpokenLanguagesField(
        (row as { spokenLanguages?: string | null }).spokenLanguages
      )
      const soulExcerpt = await loadCharacterSoulExcerpt(
        row as { soulMdPath?: string | null; soulHubId?: number | null }
      )
      const profile = {
        name: row.name,
        description: row.description,
        appearance: row.appearance ?? undefined,
        personality: row.personality ?? undefined,
        costume: row.costume ?? undefined,
        ageRange: row.ageRange ?? undefined,
        gender: row.gender ?? undefined,
        voiceDesc: row.voiceDesc ?? undefined,
        mannerisms: row.mannerisms ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined,
        backstory: row.backstory ?? undefined,
        spokenLanguages
      }
      const profileText = [
        `Name: ${row.name}`,
        sexPromptLock(row.gender, payload.locale)
          ? `SEX LOCK: ${sexPromptLock(row.gender, payload.locale)}`
          : '',
        row.ageRange ? `Age: ${row.ageRange}` : '',
        row.gender ? `Gender: ${row.gender}` : '',
        row.appearance ? `Appearance: ${row.appearance}` : '',
        row.costume ? `Costume: ${row.costume}` : '',
        row.description ? `Description: ${row.description}` : '',
        row.personality ? `Personality: ${row.personality}` : '',
        row.mannerisms ? `Mannerisms: ${row.mannerisms}` : '',
        row.voiceDesc ? `Voice: ${row.voiceDesc}` : '',
        spokenLanguages?.length
          ? `Spoken languages: ${spokenLanguages.join(', ')}`
          : '',
        row.visualTags ? `Tags: ${row.visualTags}` : '',
        row.backstory
          ? `Backstory: ${String(row.backstory).slice(0, 280)}`
          : '',
        soulExcerpt
          ? `Soul bible excerpt: ${soulExcerpt.slice(0, 800)}`
          : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const preferIdentity =
        !forcePureLayout && payload.preferIdentityEdit === true
      const fallbackPrompt = preferIdentity
        ? buildCharacterSheetEditPrompt(profile, variantDef.id, artStyle)
        : buildCharacterSheetImagePrompt(profile, variantDef.id, artStyle)
      const layerTag =
        variantDef.wardrobeLayer === 'nude' ? 'body' : variantDef.wardrobeLayer
      const built = buildGenericEntityMaterialSections({
        kind,
        name: row.name,
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: preferIdentity,
        forcePureLayout,
        layoutSection: {
          id: 'sheet_layout',
          title: `${variantDef.id} · ${variantDef.galleryLabel}`,
          text: [
            `Character sheet package id: "${variantDef.id}" (${variantDef.galleryLabel}).`,
            `Wardrobe layer: ${layerTag}.`,
            `LAYOUT: ${variantDef.layout}`,
            forcePureLayout
              ? 'FORCE PURE LAYOUT: do not image_edit from clothed references; generate a new package composition.'
              : 'When editing from a ref, keep identity only; change layout to this package completely.'
          ].join(' ')
        },
        fallbackPrompt,
        genOptionsExtra: {
          sheetVariant: variantDef.id,
          galleryLabel: variantDef.galleryLabel,
          layer: variantDef.wardrobeLayer,
          forcePureLayout
        }
      })
      return {
        kind,
        entityIds: { characterId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Character reference sheet package "${variantDef.id}" (${variantDef.galleryLabel}) for "${row.name}". Exact LAYOUT; consistent identity.`,
        genOptions: { ...built.genOptions, artStyle },
        hardRules: row.hardRules ?? null
      }
    }

    if (kind === 'scene-plate') {
      if (!payload.sceneId?.trim()) {
        throw new AppError('VALIDATION', 'errors.sceneIdRequired')
      }
      const row = await scenes().get(payload.sceneId)
      const {
        buildScenePlateEditPrompt,
        buildScenePlateImagePrompt,
        getScenePlateVariant
      } = await import('../../domain/scenePlateVariants')
      const variantDef = getScenePlateVariant(payload.plateVariant)
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const sceneTitle = row.title || 'Scene'
      const profile = {
        title: row.title ?? undefined,
        description: row.description || sceneTitle,
        locationType: row.locationType ?? undefined,
        timeOfDay: row.timeOfDay ?? undefined,
        weather: row.weather ?? undefined,
        mood: row.mood ?? undefined,
        lighting: row.lighting ?? undefined,
        colorPalette: row.colorPalette ?? undefined,
        setDressing: row.setDressing ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const profileText = [
        `Title: ${sceneTitle}`,
        row.description ? `Description: ${row.description}` : '',
        row.locationType ? `Location type: ${row.locationType}` : '',
        row.timeOfDay ? `Time: ${row.timeOfDay}` : '',
        row.weather ? `Weather: ${row.weather}` : '',
        row.lighting ? `Lighting: ${row.lighting}` : '',
        row.mood ? `Mood: ${row.mood}` : '',
        row.colorPalette ? `Palette: ${row.colorPalette}` : '',
        row.setDressing ? `Set: ${row.setDressing}` : '',
        row.visualTags ? `Tags: ${row.visualTags}` : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? (row as { artStyle?: string }).artStyle ?? undefined
      ).id
      const preferIdentity = payload.preferIdentityEdit === true
      const fallbackPrompt = preferIdentity
        ? buildScenePlateEditPrompt(profile, variantDef.id, artStyle)
        : buildScenePlateImagePrompt(profile, variantDef.id, artStyle)
      const built = buildGenericEntityMaterialSections({
        kind,
        name: sceneTitle,
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: preferIdentity,
        layoutSection: {
          id: 'plate_layout',
          title: `${variantDef.id} · ${variantDef.galleryLabel}`,
          text: [
            `Scene plate package "${variantDef.id}" (${variantDef.galleryLabel}).`,
            `Plate layer: ${variantDef.plateLayer}.`,
            `LAYOUT: ${variantDef.layout}`,
            'Empty of hero faces; SPACE LOCK architecture and set dressing.'
          ].join(' ')
        },
        fallbackPrompt,
        genOptionsExtra: {
          plateVariant: variantDef.id,
          galleryLabel: variantDef.galleryLabel,
          layer: variantDef.plateLayer
        }
      })
      return {
        kind,
        entityIds: { sceneId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Location plate "${variantDef.id}" for "${sceneTitle}". SPACE LOCK; empty of hero faces.`,
        genOptions: { ...built.genOptions, artStyle },
        hardRules: row.hardRules ?? null
      }
    }

    if (kind === 'prop-plate') {
      if (!payload.propId?.trim()) {
        throw new AppError('VALIDATION', 'errors.propIdRequired')
      }
      const row = await props().get(payload.propId)
      const {
        buildPropPlateEditPrompt,
        buildPropPlateImagePrompt,
        getPropPlateVariant
      } = await import('../../domain/propPlateVariants')
      const variantDef = getPropPlateVariant(payload.plateVariant)
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const profile = {
        name: row.name,
        description: row.description || row.name,
        material: row.material ?? undefined,
        sizeNotes: row.sizeNotes ?? undefined,
        condition: row.condition ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const profileText = [
        `Name: ${row.name}`,
        row.description ? `Description: ${row.description}` : '',
        row.material ? `Material: ${row.material}` : '',
        row.sizeNotes ? `Size: ${row.sizeNotes}` : '',
        row.condition ? `Condition: ${row.condition}` : '',
        row.visualTags ? `Tags: ${row.visualTags}` : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const preferIdentity = payload.preferIdentityEdit === true
      const fallbackPrompt = preferIdentity
        ? buildPropPlateEditPrompt(profile, variantDef.id, artStyle)
        : buildPropPlateImagePrompt(profile, variantDef.id, artStyle)
      const built = buildGenericEntityMaterialSections({
        kind,
        name: row.name,
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: preferIdentity,
        layoutSection: {
          id: 'plate_layout',
          title: `${variantDef.id} · ${variantDef.galleryLabel}`,
          text: [
            `Prop plate package "${variantDef.id}" (${variantDef.galleryLabel}).`,
            `LAYOUT: ${variantDef.layout}`,
            'PROP LOCK identity; no celebrity faces.'
          ].join(' ')
        },
        fallbackPrompt,
        genOptionsExtra: {
          plateVariant: variantDef.id,
          galleryLabel: variantDef.galleryLabel
        }
      })
      return {
        kind,
        entityIds: { propId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Prop plate "${variantDef.id}" of "${row.name}". Clean product / drama prop still.`,
        genOptions: { ...built.genOptions, artStyle },
        hardRules: row.hardRules ?? null
      }
    }

    if (kind === 'story-cover') {
      if (!payload.storyId?.trim()) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      const row = await stories().get(payload.storyId)
      const galleryPaths = (payload.galleryIdentityPaths ?? [])
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p))
      const storyMeta = row as {
        title?: string
        logline?: string | null
        synopsis?: string | null
        description?: string | null
      }
      const profileText = [
        `Title: ${storyMeta.title ?? row.title}`,
        storyMeta.logline ? `Logline: ${storyMeta.logline}` : '',
        storyMeta.synopsis
          ? `Synopsis: ${storyMeta.synopsis}`
          : storyMeta.description
            ? `Description: ${storyMeta.description}`
            : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(payload.artStyle ?? undefined).id
      const built = buildGenericEntityMaterialSections({
        kind,
        name: row.title,
        profileText,
        hardRules: null,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: payload.preferIdentityEdit
      })
      return {
        kind,
        entityIds: { storyId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Story cover key art for "${row.title}".`,
        genOptions: { ...built.genOptions, artStyle },
        hardRules: null
      }
    }

    // Costume dress / swap — character base + wardrobe text
    if (kind === 'costume-dress' || kind === 'costume-swap') {
      const charId = payload.characterId?.trim()
      if (!charId) {
        throw new AppError('VALIDATION', 'errors.characterIdRequired')
      }
      const row = await characters().get(charId)
      const freeText =
        typeof payload.costumeDescription === 'string'
          ? payload.costumeDescription.trim()
          : ''
      let costumeDesc = freeText
      let costumeName = freeText
        ? freeText.split('\n')[0]?.slice(0, 48) || 'Look'
        : 'Costume'
      let costumeHard: string | null = null
      if (payload.costumeId?.trim() && costumes) {
        try {
          const c = await costumes().get(payload.costumeId.trim())
          if (!costumeDesc) {
            costumeDesc = c.description || c.name || ''
          }
          costumeName = c.name || costumeName
          costumeHard = c.hardRules ?? null
        } catch {
          /* optional */
        }
      }
      if (!costumeDesc) {
        costumeDesc = row.costume || 'new wardrobe'
      }
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath, row.refSheetPath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const profileText = [
        `Character: ${row.name}`,
        sexPromptLock(row.gender, payload.locale)
          ? `SEX LOCK: ${sexPromptLock(row.gender, payload.locale)}`
          : '',
        row.ageRange ? `Age: ${row.ageRange}` : '',
        row.gender ? `Gender: ${row.gender}` : '',
        row.appearance ? `Appearance: ${row.appearance}` : '',
        row.mannerisms ? `Mannerisms: ${row.mannerisms}` : '',
        `Costume look (APPLY THIS WARDROBE): ${costumeDesc}`,
        kind === 'costume-swap'
          ? 'TASK: costume swap on identity base still — KEEP face/body; REPLACE clothing only.'
          : 'TASK: dressed character still — IDENTITY LOCK face/body; apply wardrobe fully.'
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      let fallbackPrompt = [
        `IMAGE EDIT costume ${kind === 'costume-swap' ? 'swap' : 'dress'} for short-drama.`,
        `Character: ${row.name}.`,
        row.appearance ? `Appearance lock: ${row.appearance}` : '',
        `New wardrobe (must match): ${costumeDesc}`,
        'KEEP face, hair, body proportions, age, species from the base still.',
        'REPLACE outer clothing completely with the new wardrobe. No half-merge of old outfit.',
        `Art: ${getArtStyle(artStyle).promptBlock || artStyle}`,
        'Single full-body or hero still; no multi-panel board; no watermark.'
      ]
        .filter(Boolean)
        .join(' ')
      try {
        const { buildCostumeSwapPrompt } = await import(
          '../../domain/costumeSwap'
        )
        fallbackPrompt = buildCostumeSwapPrompt({
          name: row.name,
          newCostume: costumeDesc,
          artStyle,
          appearance: row.appearance,
          ageRange: row.ageRange,
          gender: row.gender,
          visualTags: row.visualTags,
          mannerisms: row.mannerisms,
          hardRules: costumeHard || row.hardRules
        })
      } catch {
        /* keep inline fallback */
      }
      const built = buildGenericEntityMaterialSections({
        kind: 'character-sheet',
        name: `${row.name} · ${costumeName}`,
        profileText,
        hardRules: costumeHard || row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: true,
        layoutSection: {
          id: 'costume_task',
          title: costumeName,
          text: [
            kind === 'costume-swap'
              ? 'Costume swap package: identity lock + full wardrobe replace.'
              : 'Costume dress package: identity lock + apply wardrobe.',
            `Wardrobe description: ${costumeDesc}`
          ].join(' ')
        },
        fallbackPrompt,
        genOptionsExtra: {
          galleryLabel:
            kind === 'costume-swap'
              ? `Costume swap · ${costumeName}`
              : `Dressed · ${costumeName}`,
          layer: 'costume',
          sheetVariant: 'costume_swap'
        }
      })
      return {
        kind,
        entityIds: { characterId: row.id, costumeId: payload.costumeId },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Dressed character still of "${row.name}" in look "${costumeName}". IDENTITY LOCK face/body; apply wardrobe.`,
        genOptions: {
          ...built.genOptions,
          artStyle,
          useIdentityEdit: true
        },
        hardRules: costumeHard || row.hardRules || null
      }
    }

    if (kind === 'atmosphere-swap') {
      if (!payload.sceneId?.trim()) {
        throw new AppError('VALIDATION', 'errors.sceneIdRequired')
      }
      const row = await scenes().get(payload.sceneId)
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const atmo =
        payload.atmosphereDescription?.trim() ||
        row.mood ||
        row.lighting ||
        'atmosphere change'
      const {
        buildScenePlateEditPrompt,
        getScenePlateVariant
      } = await import('../../domain/scenePlateVariants')
      const variantDef = getScenePlateVariant(
        payload.plateVariant || 'establishing'
      )
      const profile = {
        title: row.title ?? undefined,
        description: row.description || row.title || 'Scene',
        locationType: row.locationType ?? undefined,
        timeOfDay: row.timeOfDay ?? undefined,
        weather: row.weather ?? undefined,
        mood: atmo,
        lighting: atmo,
        colorPalette: row.colorPalette ?? undefined,
        setDressing: row.setDressing ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const profileText = [
        `Scene: ${row.title || 'Scene'}`,
        row.description ? `Base: ${row.description}` : '',
        row.locationType ? `Location type: ${row.locationType}` : '',
        row.setDressing ? `Set dressing: ${row.setDressing}` : '',
        `Atmosphere change (APPLY): ${atmo}`,
        'SPACE LOCK architecture, materials, camera geometry; only lighting/mood/weather/time shift.'
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? (row as { artStyle?: string }).artStyle ?? undefined
      ).id
      const fallbackPrompt = [
        buildScenePlateEditPrompt(profile, variantDef.id, artStyle),
        `ATMOSPHERE SWAP TASK: keep set identity; change only lighting/mood/weather/time to: ${atmo}.`
      ].join(' ')
      const built = buildGenericEntityMaterialSections({
        kind: 'scene-plate',
        name: row.title || 'Scene',
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: true,
        layoutSection: {
          id: 'atmosphere_task',
          title: 'atmosphere_swap',
          text: [
            'ATMOSPHERE SWAP: SPACE LOCK architecture and set dressing from base still.',
            `New atmosphere only: ${atmo}`,
            'Do not redesign the location or invent a different shop/street.'
          ].join(' ')
        },
        fallbackPrompt,
        genOptionsExtra: {
          plateVariant: 'atmosphere_swap',
          galleryLabel: 'Atmosphere swap',
          layer: 'atmosphere'
        }
      })
      return {
        kind,
        entityIds: { sceneId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Atmosphere swap for "${row.title || 'Scene'}". Keep set; change lighting/mood only.`,
        genOptions: {
          ...built.genOptions,
          artStyle,
          useIdentityEdit: true
        },
        hardRules: row.hardRules ?? null
      }
    }

    // Timeline beat refine — full cast/prev/beat materials (not generic intro)
    if (kind === 'timeline-still' || kind === 'timeline-clip') {
      const storyId = payload.storyId?.trim()
      const entryId = payload.entryId?.trim()
      if (!storyId || !entryId) {
        throw new AppError('VALIDATION', 'errors.timelineEntryNotFound')
      }
      const story = await stories().get(storyId)
      const timeline = (story as { timeline?: Array<Record<string, unknown>> })
        .timeline
      if (!Array.isArray(timeline)) {
        throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound')
      }
      const { hydrateTimelineBindings } = await import(
        '../../domain/timelineBindings'
      )
      const {
        getPreviousTimelineEntry,
        buildContinuityLockPrompt,
        timelineBeatDisplayIndex
      } = await import('../../domain/promptContinuity')
      const {
        beatContentToClipPromptBlock,
        parseBeatContent
      } = await import('../../domain/beatContent')
      const {
        parseStoryCastPrep,
        resolveCastRefFromPrep
      } = await import('../../domain/advancedPrep')
      const { buildTimelineBeatMaterialSections } = await import(
        '../../domain/mediaGenPrep'
      )
      const { collectTimelineHardRules } = await import(
        '../../domain/promptHardRules'
      )
      const { snapVideoSeconds } = await import('../../domain/videoDuration')
      const { getArtStyle } = await import('../../domain/characterArtStyles')

      type TlEntry = {
        id: string
        order: number
        startTime: number
        endTime: number
        dialogue?: string | null
        beatContentJson?: string | null
        characterId?: string | null
        sceneId?: string | null
        propId?: string | null
        actionId?: string | null
        characterIds: string[]
        sceneIds: string[]
        propIds: string[]
        actionIds?: string[]
      }
      // hydrateTimelineBindings already expands legacy FK → id arrays
      const domainEntries = timeline.map((e) =>
        hydrateTimelineBindings(e as never)
      ) as TlEntry[]
      const entry = domainEntries.find((e) => e.id === entryId)
      if (!entry) {
        throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound')
      }
      const displayIndex = timelineBeatDisplayIndex(
        domainEntries as never,
        entryId
      )
      const prevEntry = getPreviousTimelineEntry(
        domainEntries as never,
        entryId
      ) as TlEntry | null
      const store = generation().getMediaStore()
      let previousContinuityPath: string | null = null
      let previousBeatIndex = 0
      if (prevEntry) {
        previousBeatIndex = timelineBeatDisplayIndex(
          domainEntries as never,
          prevEntry.id
        )
        const cont = store.clipContinuityStillPath(storyId, prevEntry.id)
        if (existsSync(cont)) previousContinuityPath = cont
      }

      const charIds = Array.isArray(entry.characterIds)
        ? entry.characterIds
        : []
      const sceneIds = Array.isArray(entry.sceneIds) ? entry.sceneIds : []
      const propIds = Array.isArray(entry.propIds) ? entry.propIds : []
      const actionIds = Array.isArray(entry.actionIds)
        ? entry.actionIds
        : entry.actionId
          ? [entry.actionId]
          : []
      const primaryCharId =
        charIds[0] ?? entry.characterId ?? null
      const primarySceneId = sceneIds[0] ?? entry.sceneId ?? null
      const primaryPropId = propIds[0] ?? entry.propId ?? null

      let characterHard: string | null = null
      let artStyle: string | undefined
      const chars: Array<{ hardRules?: string | null; name?: string | null }> =
        []
      const charRefs: Array<{
        id?: string
        name: string
        imagePath?: string | null
      }> = []
      for (const cid of charIds.length > 0
        ? charIds
        : primaryCharId
          ? [primaryCharId]
          : []) {
        try {
          const ch = await characters().get(cid)
          chars.push(ch)
          charRefs.push({
            id: ch.id,
            name: ch.name,
            imagePath:
              ch.refSheetPath?.trim() || ch.refImagePath?.trim() || null
          })
          if (!artStyle && ch.artStyle) artStyle = ch.artStyle
          if (!characterHard && ch.hardRules) characterHard = ch.hardRules
        } catch {
          /* optional */
        }
      }
      const scenesBound: Array<{
        hardRules?: string | null
        title?: string | null
        description?: string | null
      }> = []
      const sceneRefs: Array<{
        id?: string
        name: string
        imagePath?: string | null
      }> = []
      for (const sid of sceneIds.length > 0
        ? sceneIds
        : primarySceneId
          ? [primarySceneId]
          : []) {
        try {
          const sc = await scenes().get(sid)
          scenesBound.push(sc)
          sceneRefs.push({
            id: sc.id,
            name: sc.title || String(sc.description || '').slice(0, 40),
            imagePath: sc.refImagePath?.trim() || null
          })
        } catch {
          /* optional */
        }
      }
      const propsBound: Array<{ hardRules?: string | null; name?: string | null }> =
        []
      const propRefs: Array<{
        id?: string
        name: string
        imagePath?: string | null
      }> = []
      for (const pid of propIds.length > 0
        ? propIds
        : primaryPropId
          ? [primaryPropId]
          : []) {
        try {
          const pr = await props().get(pid)
          propsBound.push(pr)
          propRefs.push({
            id: pr.id,
            name: pr.name,
            imagePath: pr.refImagePath?.trim() || null
          })
        } catch {
          /* optional */
        }
      }
      const actionsBound: Array<{
        hardRules?: string | null
        name?: string | null
      }> = []
      const actionTextParts: string[] = []
      for (const aid of actionIds) {
        try {
          const ac = await actions().get(aid)
          actionsBound.push(ac)
          actionTextParts.push(
            [
              `Action: ${ac.name}`,
              ac.description ? `Seq: ${ac.description}` : '',
              ac.motionNotes ? `Motion: ${ac.motionNotes}` : '',
              ac.cameraNotes ? `Camera: ${ac.cameraNotes}` : ''
            ]
              .filter(Boolean)
              .join('. ')
          )
        } catch {
          /* optional */
        }
      }

      const castPrep = parseStoryCastPrep(
        store.readStoryCastPrepJson(storyId)
      )
      const castRefPath = resolveCastRefFromPrep(primaryCharId, castPrep)
      const seconds = snapVideoSeconds(
        Number(entry.endTime) - Number(entry.startTime)
      )
      const dialogue = entry.dialogue ?? null
      const beatContentJson = entry.beatContentJson ?? null
      const extractLocale = PromptCatalog.locale(payload.locale)
      const beatBlock =
        beatContentToClipPromptBlock(
          parseBeatContent(dialogue, beatContentJson),
          dialogue,
          extractLocale
        ) || dialogue

      const prevCharIds = prevEntry
        ? [
            ...(Array.isArray(prevEntry.characterIds)
              ? prevEntry.characterIds
              : []),
            ...(prevEntry.characterId ? [prevEntry.characterId] : [])
          ]
        : []
      const prevSceneIds = prevEntry
        ? [
            ...(Array.isArray(prevEntry.sceneIds) ? prevEntry.sceneIds : []),
            ...(prevEntry.sceneId ? [prevEntry.sceneId] : [])
          ]
        : []
      const sameCharacter = Boolean(
        primaryCharId && prevCharIds.includes(primaryCharId)
      )
      const sameScene = Boolean(
        primarySceneId && prevSceneIds.includes(primarySceneId)
      )
      const continuityLockText = prevEntry
        ? buildContinuityLockPrompt({
            previousBeatIndex,
            previousDialogueSnippet: prevEntry.dialogue,
            sameCharacter,
            sameScene,
            hasContinuityImage: Boolean(previousContinuityPath),
            locale: extractLocale
          })
        : null

      const hardRules = collectTimelineHardRules(
        {
          story: story as { hardRules?: string | null; title?: string | null },
          characters: chars,
          scenes: scenesBound,
          props: propsBound,
          actions: actionsBound
        },
        { uiLocale: PromptCatalog.locale(payload.locale) }
      )

      const characterName = charRefs[0]?.name ?? null
      const beatBlockWithActions = [
        beatBlock,
        actionTextParts.length > 0
          ? `Bound actions:\n${actionTextParts.join('\n')}`
          : null
      ]
        .filter(Boolean)
        .join('\n')

      let existingStillPath: string | null = null
      try {
        const own = store.clipContinuityStillPath(storyId, entryId)
        if (own && existsSync(own)) existingStillPath = own
      } catch {
        existingStillPath = null
      }

      const built = buildTimelineBeatMaterialSections({
        kind,
        storyTitle: String(
          (story as { title?: string }).title || 'Story'
        ),
        displayIndex,
        dialogue,
        beatBlock: beatBlockWithActions || beatBlock,
        previousContinuityPath,
        previousBeatIndex: prevEntry ? previousBeatIndex : undefined,
        ownStillPath: existingStillPath,
        continuityLockText,
        castRefPath,
        castRefName: characterName,
        characters: charRefs,
        scenes: sceneRefs,
        props: propRefs,
        hardRules: hardRules || characterHard,
        artStyleId: getArtStyle(
          payload.artStyle ??
            artStyle ??
            (story as { artStyle?: string }).artStyle ??
            undefined
        ).id,
        durationSeconds: payload.durationSeconds ?? seconds,
        styleNote: (story as { styleNote?: string | null }).styleNote,
        locale: PromptCatalog.locale(payload.locale)
      })

      return {
        kind,
        entityIds: {
          storyId,
          entryId,
          characterId: primaryCharId ?? undefined,
          sceneId: primarySceneId ?? undefined,
          propId: primaryPropId ?? undefined
        },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: built.taskHint,
        genOptions: built.genOptions,
        existingStillPath:
          payload.skipStillIfExists === true ? existingStillPath : null,
        hardRules: hardRules || characterHard || null
      }
    }

    // Video intros — professional video templates + materials for polish then keyframe
    if (
      kind === 'character-intro' ||
      kind === 'scene-intro' ||
      kind === 'prop-intro' ||
      kind === 'action-intro' ||
      kind === 'costume-intro'
    ) {
      const locale = PromptCatalog.locale(payload.locale)
      const galleryPaths = (payload.galleryIdentityPaths ?? [])
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p))
      let name: string = kind
      let profileText = `Video / still prep kind: ${kind}.`
      let hardRules: string | null = null
      let artStyle = getArtStyle(payload.artStyle ?? undefined).id
      let fallbackPrompt = ''
      const entityIds: Record<string, string | undefined> = {
        characterId: payload.characterId,
        sceneId: payload.sceneId,
        propId: payload.propId,
        costumeId: payload.costumeId,
        actionId: payload.actionId,
        storyId: payload.storyId,
        entryId: payload.entryId
      }
      if (kind === 'costume-intro') {
        // Library costume intro: costumeId required; character optional
        const cosId = payload.costumeId?.trim()
        if (!cosId) {
          throw new AppError('VALIDATION', 'errors.costumeIdRequired')
        }
        if (!costumes) {
          throw new AppError('VALIDATION', 'errors.costumeIdRequired')
        }
        const c = await costumes().get(cosId)
        name = c.name || 'Look'
        hardRules = c.hardRules ?? null
        artStyle = getArtStyle(
          payload.artStyle ?? c.artStyle ?? undefined
        ).id
        const costumeDesc =
          payload.costumeDescription?.trim() ||
          c.description ||
          c.name ||
          name
        if (galleryPaths.length === 0 && c.refImagePath?.trim()) {
          galleryPaths.push(c.refImagePath.trim())
        }
        // Optional character dress context
        if (payload.characterId?.trim()) {
          try {
            const ch = await characters().get(payload.characterId.trim())
            name = `${ch.name} · ${c.name || name}`
            if (galleryPaths.length === 0) {
              for (const p of [ch.refImagePath, ch.refSheetPath]) {
                if (p?.trim()) galleryPaths.push(p.trim())
              }
            }
          } catch {
            /* optional */
          }
        }
        profileText = [
          `Costume intro video: ${c.name || name}`,
          `Wardrobe: ${costumeDesc}`,
          c.hardRules ? `Hard rules: ${c.hardRules}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        const { buildCostumeIntroVideoPrompt } = await import(
          '../../domain/costumeSwap'
        )
        fallbackPrompt = buildCostumeIntroVideoPrompt(
          {
            name: c.name || name,
            description: costumeDesc,
            artStyle,
            hardRules
          },
          locale
        )
      } else if (kind === 'character-intro') {
        if (!payload.characterId?.trim()) {
          throw new AppError('VALIDATION', 'errors.characterIdRequired')
        }
        const row = await characters().get(payload.characterId)
        name = row.name
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        hardRules = row.hardRules ?? null
        if (galleryPaths.length === 0) {
          for (const p of [row.refImagePath, row.refSheetPath]) {
            if (p?.trim()) galleryPaths.push(p.trim())
          }
        }
        const freeCostume =
          payload.costumeDescription?.trim() || row.costume || ''
        const spokenLanguages = parseSpokenLanguagesField(
          (row as { spokenLanguages?: string | null }).spokenLanguages
        )
        const soulExcerpt = await loadCharacterSoulExcerpt(
          row as { soulMdPath?: string | null; soulHubId?: number | null }
        )
        profileText = [
          `Character intro video: ${row.name}`,
          sexPromptLock(row.gender, payload.locale)
            ? `SEX LOCK: ${sexPromptLock(row.gender, payload.locale)}`
            : '',
          row.ageRange ? `Age: ${row.ageRange}` : '',
          row.gender ? `Gender: ${row.gender}` : '',
          row.appearance ? `Appearance: ${row.appearance}` : '',
          freeCostume ? `Costume: ${freeCostume}` : '',
          row.description ? `Description: ${row.description}` : '',
          row.personality ? `Personality: ${row.personality}` : '',
          row.mannerisms ? `Mannerisms: ${row.mannerisms}` : '',
          row.voiceDesc ? `Voice: ${row.voiceDesc}` : '',
          spokenLanguages?.length
            ? `Spoken languages: ${spokenLanguages.join(', ')}`
            : '',
          soulExcerpt
            ? `Soul bible excerpt: ${soulExcerpt.slice(0, 800)}`
            : ''
        ]
          .filter(Boolean)
          .join('\n')
        const { buildCharacterIntroVideoPrompt } = await import(
          '../../domain/characterMasterPrompt'
        )
        fallbackPrompt = buildCharacterIntroVideoPrompt(
          {
            name: row.name,
            description: row.description,
            appearance: row.appearance ?? undefined,
            costume: freeCostume || undefined,
            personality: row.personality ?? undefined,
            mannerisms: row.mannerisms ?? undefined,
            voiceDesc: row.voiceDesc ?? undefined,
            ageRange: row.ageRange ?? undefined,
            gender: row.gender ?? undefined,
            visualTags: row.visualTags ?? undefined,
            artStyle,
            spokenLanguages
          },
          locale,
          { soulExcerpt }
        )
      } else if (kind === 'scene-intro') {
        if (!payload.sceneId?.trim()) {
          throw new AppError('VALIDATION', 'errors.sceneIdRequired')
        }
        const row = await scenes().get(payload.sceneId)
        name = row.title || 'Scene'
        hardRules = row.hardRules ?? null
        artStyle = getArtStyle(
          payload.artStyle ??
            (row as { artStyle?: string }).artStyle ??
            undefined
        ).id
        if (galleryPaths.length === 0 && row.refImagePath) {
          galleryPaths.push(row.refImagePath)
        }
        profileText = [
          `Scene intro: ${name}`,
          row.description ? `Description: ${row.description}` : '',
          row.lighting ? `Lighting: ${row.lighting}` : '',
          row.mood ? `Mood: ${row.mood}` : '',
          row.timeOfDay ? `Time: ${row.timeOfDay}` : '',
          row.weather ? `Weather: ${row.weather}` : '',
          row.setDressing ? `Set: ${row.setDressing}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        const { buildSceneIntroVideoPrompt } = await import(
          '../../domain/sceneMasterPrompt'
        )
        fallbackPrompt = buildSceneIntroVideoPrompt(
          {
            title: name,
            description: row.description || name,
            lighting: row.lighting ?? undefined,
            mood: row.mood ?? undefined,
            timeOfDay: row.timeOfDay ?? undefined,
            weather: row.weather ?? undefined,
            setDressing: row.setDressing ?? undefined,
            artStyle
          },
          locale
        )
      } else if (kind === 'prop-intro') {
        if (!payload.propId?.trim()) {
          throw new AppError('VALIDATION', 'errors.propIdRequired')
        }
        const row = await props().get(payload.propId)
        name = row.name
        hardRules = row.hardRules ?? null
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        if (galleryPaths.length === 0 && row.refImagePath) {
          galleryPaths.push(row.refImagePath)
        }
        profileText = [
          `Prop intro: ${row.name}`,
          row.description ? `Description: ${row.description}` : '',
          row.material ? `Material: ${row.material}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        const { buildPropIntroVideoPrompt } = await import(
          '../../domain/propMasterPrompt'
        )
        fallbackPrompt = buildPropIntroVideoPrompt(
          {
            name: row.name,
            description: row.description || row.name,
            material: row.material ?? undefined,
            artStyle
          },
          locale
        )
      } else if (kind === 'action-intro') {
        if (!payload.actionId?.trim()) {
          throw new AppError('VALIDATION', 'errors.actionIdRequired')
        }
        const row = await actions().get(payload.actionId)
        name = row.name
        hardRules = row.hardRules ?? null
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        profileText = [
          `Action intro: ${row.name}`,
          row.description ? `Description: ${row.description}` : '',
          row.motionNotes ? `Motion: ${row.motionNotes}` : '',
          row.intention ? `Intention: ${row.intention}` : '',
          row.cameraNotes ? `Camera: ${row.cameraNotes}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        const { buildActionIntroVideoPrompt } = await import(
          '../../domain/actionMasterPrompt'
        )
        fallbackPrompt = buildActionIntroVideoPrompt(
          {
            name: row.name,
            description: row.description,
            intention: row.intention ?? undefined,
            motionNotes: row.motionNotes ?? undefined,
            cameraNotes: row.cameraNotes ?? undefined,
            hardRules: row.hardRules ?? undefined
          },
          locale
        )
      }
      const built = buildGenericEntityMaterialSections({
        kind,
        name,
        profileText,
        hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: galleryPaths.length > 0,
        layoutSection: {
          id: 'video_task',
          title: kind,
          text: [
            `VIDEO PIPELINE kind=${kind}.`,
            'First produce a strong keyframe still matching identity refs, then image-to-video with camera/performance.',
            `Duration target: ${payload.durationSeconds ?? 10}s.`
          ].join(' ')
        },
        fallbackPrompt:
          fallbackPrompt ||
          `Keyframe still then short-drama video for "${name}" (${kind}).`
      })
      return {
        kind,
        entityIds,
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Keyframe still then short-drama video for "${name}" (${kind}). Include motion, camera, performance.`,
        genOptions: {
          ...built.genOptions,
          artStyle,
          durationSeconds: payload.durationSeconds
        },
        hardRules
      }
    }

    if (kind === 'comic-intro') {
      const pageId = payload.pageId?.trim()
      if (!pageId) {
        throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
      }
      const page = await comics().getPage(pageId)
      const comic = await comics().getById(page.comicId)
      const story = await stories().get(comic.storyId)
      const locale = PromptCatalog.locale(payload.locale)
      const {
        getComicPageLayout,
        buildComicIntroVideoPrompt,
        buildComicDramaVideoPrompt,
        comicLayoutPrompt,
        coerceComicVideoScheme
      } = await import('../../domain/comicPageLayouts')
      const { parsePanelScriptJson, boundTimelineIdsFromSlots } = await import(
        '../../domain/comicPanelScript'
      )
      const layout = getComicPageLayout(
        payload.panelLayout ?? page.panelLayout
      )
      const slots = parsePanelScriptJson(page.panelScriptJson, layout.id)
      const scheme = coerceComicVideoScheme(payload.comicVideoScheme)
      const still =
        payload.galleryIdentityPaths?.find((p) => p?.trim())?.trim() ||
        page.imagePath?.trim() ||
        ''
      if (!still) {
        throw new AppError('VALIDATION', 'errors.sourceImageRequired')
      }
      const storyTitle =
        (story as { title?: string }).title ||
        comic.title ||
        PromptCatalog.t(locale, 'hardRules.labelStory')
      const hardRules = [
        comic.hardRules,
        page.hardRules,
        (story as { hardRules?: string | null }).hardRules
      ]
        .filter((x): x is string => Boolean(x?.trim()))
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? page.artStyle ?? comic.artStyle ?? undefined
      ).id
      const captionBlock = slots
        .map((s, i) => (s.caption.trim() ? `${i + 1}. ${s.caption.trim()}` : ''))
        .filter(Boolean)
        .join('\n')
      let beatText = captionBlock
      const boundIds = boundTimelineIdsFromSlots(slots)
      if (scheme === 'drama' && boundIds.length > 0) {
        try {
          const list = (await timeline().list(comic.storyId)) as Array<{
            id: string
            dialogue?: string | null
          }>
          const lines = boundIds
            .map((id) => list.find((e) => e.id === id)?.dialogue?.trim())
            .filter((x): x is string => Boolean(x))
          if (lines.length) beatText = lines.join('\n')
        } catch {
          /* captions already set */
        }
      }
      let prevSnippet: string | null = null
      if (scheme === 'drama') {
        try {
          const pack = await comics().getWithPages(comic.storyId)
          const idx = pack.pages.findIndex((p) => p.id === page.id)
          for (let i = idx - 1; i >= 0; i--) {
            const prev = pack.pages[i]
            if (prev.imagePath?.trim() || (prev as { videoPath?: string }).videoPath) {
              prevSnippet = PromptCatalog.t(locale, 'continuity.hasImage', {
                n: prev.order + 1
              })
              break
            }
          }
        } catch {
          /* optional */
        }
      }
      const fallbackPrompt =
        scheme === 'drama'
          ? buildComicDramaVideoPrompt({
              locale,
              storyTitle,
              pageOrder: page.order + 1,
              beatText,
              prevSnippet
            })
          : [
              buildComicIntroVideoPrompt({
                locale,
                storyTitle,
                pageOrder: page.order + 1,
                panelCount: layout.panelCount,
                layoutLabel: comicLayoutPrompt(layout, locale)
              }),
              captionBlock
            ]
              .filter(Boolean)
              .join('\n')
      const { buildGenericEntityMaterialSections } = await import(
        '../../domain/mediaGenPrep'
      )
      const built = buildGenericEntityMaterialSections({
        kind,
        name: storyTitle,
        profileText: fallbackPrompt,
        hardRules: hardRules || null,
        artStyleId: artStyle,
        galleryPaths: [still],
        preferIdentityEdit: true,
        fallbackPrompt
      })
      if (scheme === 'drama' && beatText.trim()) {
        built.sections.push({
          id: 'beat_profile',
          kind: 'text-profile',
          title: storyTitle,
          entityType: 'story',
          text: beatText,
          include: true,
          group: 'task'
        })
      }
      return {
        kind,
        entityIds: { storyId: comic.storyId, pageId: page.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint:
          scheme === 'drama'
            ? PromptCatalog.t(locale, 'clip.task')
            : PromptCatalog.t(locale, 'comic.introTask', {
                title: storyTitle,
                n: page.order + 1,
                count: layout.panelCount
              }),
        genOptions: {
          ...built.genOptions,
          panelLayout: layout.id,
          artStyle,
          durationSeconds: payload.durationSeconds,
          comicVideoScheme: scheme
        },
        existingStillPath:
          payload.skipStillIfExists === true ? still : null,
        hardRules: hardRules || null
      }
    }

    if (kind === 'comic-page') {
      const pageId = payload.pageId?.trim()
      if (!pageId) {
        throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
      }
      const page = await comics().getPage(pageId)
      const comic = await comics().getById(page.comicId)
      const story = await stories().get(comic.storyId)
      const {
        buildComicPageMaterialSections
      } = await import('../../domain/mediaGenPrep')
      const { parsePanelScriptJson } = await import(
        '../../domain/comicPanelScript'
      )
      const { getArtStyle } = await import('../../domain/characterArtStyles')
      const { getComicPageLayout } = await import(
        '../../domain/comicPageLayouts'
      )
      const layout = getComicPageLayout(
        payload.panelLayout ?? page.panelLayout
      )
      const slots = parsePanelScriptJson(page.panelScriptJson, layout.id)
      const artStyle = getArtStyle(
        payload.artStyle ?? page.artStyle ?? comic.artStyle ?? undefined
      ).id
      const galleryFromPayload = (payload.galleryIdentityPaths ?? [])
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p))
      const galleryPaths = [...galleryFromPayload]
      const collectPath = (p?: string | null): void => {
        const t = p?.trim()
        if (t && !galleryPaths.includes(t)) galleryPaths.push(t)
      }
      const charIds = new Set<string>()
      const sceneIds = new Set<string>()
      const propIds = new Set<string>()
      const actionIds = new Set<string>()
      const entryIds = new Set<string>()
      for (const slot of slots) {
        for (const id of slot.characterIds ?? []) {
          if (id.trim()) charIds.add(id.trim())
        }
        if (slot.sceneId?.trim()) sceneIds.add(slot.sceneId.trim())
        if (slot.propId?.trim()) propIds.add(slot.propId.trim())
        if (slot.actionId?.trim()) actionIds.add(slot.actionId.trim())
        if (slot.timelineEntryId?.trim()) {
          entryIds.add(slot.timelineEntryId.trim())
        }
      }
      const timeline = (story as { timeline?: Array<Record<string, unknown>> })
        .timeline
      if (Array.isArray(timeline)) {
        for (const e of timeline) {
          if (typeof e.id === 'string' && entryIds.has(e.id)) {
            const c =
              (e.characterId as string | null) ||
              (Array.isArray(e.characterIds) ? e.characterIds[0] : null)
            const s =
              (e.sceneId as string | null) ||
              (Array.isArray(e.sceneIds) ? e.sceneIds[0] : null)
            const p =
              (e.propId as string | null) ||
              (Array.isArray(e.propIds) ? e.propIds[0] : null)
            const a =
              (e.actionId as string | null) ||
              (Array.isArray(e.actionIds) ? e.actionIds[0] : null)
            if (typeof c === 'string' && c.trim()) charIds.add(c.trim())
            if (typeof s === 'string' && s.trim()) sceneIds.add(s.trim())
            if (typeof p === 'string' && p.trim()) propIds.add(p.trim())
            if (typeof a === 'string' && a.trim()) actionIds.add(a.trim())
          }
        }
      }
      for (const id of charIds) {
        try {
          const row = await characters().get(id)
          collectPath(row.refImagePath)
          collectPath((row as { refSheetPath?: string | null }).refSheetPath)
        } catch {
          /* optional */
        }
      }
      for (const id of sceneIds) {
        try {
          collectPath((await scenes().get(id)).refImagePath)
        } catch {
          /* optional */
        }
      }
      for (const id of propIds) {
        try {
          collectPath((await props().get(id)).refImagePath)
        } catch {
          /* optional */
        }
      }
      for (const id of actionIds) {
        try {
          collectPath((await actions().get(id)).refImagePath)
        } catch {
          /* optional */
        }
      }
      const pack = await comics().getWithPages(comic.storyId)
      const ordered = pack.pages
      const idx = ordered.findIndex((p) => p.id === page.id)
      let previousPagePath: string | null = null
      if (idx > 0) {
        for (let i = idx - 1; i >= 0; i--) {
          const p = ordered[i].imagePath?.trim()
          if (p) {
            previousPagePath = p
            break
          }
        }
      }
      const ownPagePath = page.imagePath?.trim() || null
      const hardRules = [
        comic.hardRules,
        page.hardRules,
        (story as { hardRules?: string | null }).hardRules
      ]
        .filter((x): x is string => Boolean(x?.trim()))
        .join('\n')
      const { effectiveComicPageFormat } = await import(
        '../../domain/comicPageFormat'
      )
      const pageFormat = effectiveComicPageFormat({
        pageFormat: payload.pageFormat ?? page.pageFormat,
        bookFormat: (comic as { pageFormat?: string | null }).pageFormat,
        layout
      })
      const allowOwnEdit =
        payload.preferIdentityEdit !== false &&
        payload.forcePureLayout !== true
      const built = buildComicPageMaterialSections({
        storyTitle:
          (story as { title?: string }).title ||
          comic.title ||
          PromptCatalog.t(payload.locale, 'hardRules.labelStory'),
        pageOrder: page.order + 1,
        styleNote: (story as { styleNote?: string | null }).styleNote,
        layoutId: layout.id,
        artStyleId: artStyle,
        hardRules: hardRules || null,
        slots,
        galleryPaths,
        previousPagePath,
        ownPagePath,
        preferIdentityEdit: allowOwnEdit,
        allowOwnEditBase: allowOwnEdit,
        pageFormat,
        locale: payload.locale
      })
      activity.append({
        kind: 'ai',
        level: 'info',
        message: 'mediaGenExtract',
        meta: { kind, pageId, storyId: comic.storyId }
      })
      return {
        kind,
        entityIds: {
          storyId: comic.storyId,
          pageId: page.id
        },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: built.taskHint,
        genOptions: {
          ...built.genOptions,
          panelLayout: layout.id,
          artStyle,
          pageFormat,
          aspectRatio:
            pageFormat === 'wide'
              ? '16:9'
              : pageFormat === 'square'
                ? '1:1'
                : '9:16'
        },
        hardRules: hardRules || null
      }
    }

    if (kind === 'key-art') {
      const shotId = payload.pageId?.trim()
      if (!shotId) {
        throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
      }
      const shot = await keyArt().getShot(shotId)
      const book = await keyArt().getById(shot.keyArtId)
      const story = await stories().get(book.storyId)
      const locale = PromptCatalog.locale(payload.locale)
      const {
        getKeyArtShotType,
        coerceKeyArtShotType
      } = await import('../../domain/keyArtShotTypes')
      const { getKeyArtMakeMethod } = await import(
        '../../domain/keyArtMakeMethods'
      )
      const { parseKeyArtShotImages } = await import(
        '../../domain/keyArtShotImages'
      )
      const { buildKeyArtFallbackPrompt } = await import(
        '../../domain/keyArtPrompt'
      )
      const {
        effectiveComicPageFormat,
        aspectForComicFormat
      } = await import('../../domain/comicPageFormat')
      const { getArtStyle } = await import('../../domain/characterArtStyles')
      const shotType = coerceKeyArtShotType(
        payload.shotType ?? shot.shotType
      )
      const type = getKeyArtShotType(shotType)
      const method = getKeyArtMakeMethod(
        payload.keyArtMakeMethod ?? shot.makeMethod
      )
      const pageFormat = effectiveComicPageFormat({
        pageFormat: payload.pageFormat ?? shot.pageFormat,
        bookFormat: book.pageFormat ?? 'wide',
        layout: { sizeClass: type.sizeClass }
      })
      const artStyle = getArtStyle(
        payload.artStyle ?? shot.artStyle ?? book.artStyle ?? undefined
      ).id
      const usedPaths = new Set<string>()
      const takePath = (p?: string | null): string | null => {
        const t = p?.trim()
        if (!t || usedPaths.has(t)) return null
        usedPaths.add(t)
        return t
      }
      const charIds = keyArt().parseCharacterIds(shot.characterIdsJson)
      const charSections: MediaGenMaterialSection[] = []
      for (const id of charIds) {
        try {
          const row = await characters().get(id)
          const path =
            takePath(row.refImagePath) ||
            takePath((row as { refSheetPath?: string | null }).refSheetPath)
          if (!path) continue
          charSections.push({
            id: `char_${id}`,
            kind: 'ref-image',
            title: (row as { name?: string }).name || id,
            entityType: 'character',
            text: '',
            imagePath: path,
            include: true,
            canBeEditBase: false,
            group: 'refs'
          })
        } catch {
          /* optional */
        }
      }
      let sceneSection: MediaGenMaterialSection | null = null
      if (shot.sceneId?.trim()) {
        try {
          const row = await scenes().get(shot.sceneId.trim())
          const path = takePath(row.refImagePath)
          if (path) {
            sceneSection = {
              id: `scene_${row.id}`,
              kind: 'ref-image',
              title:
                (row as { title?: string; name?: string }).title ||
                (row as { name?: string }).name ||
                row.id,
              entityType: 'scene',
              text: '',
              imagePath: path,
              include: true,
              canBeEditBase: false,
              group: 'refs'
            }
          }
        } catch {
          /* optional */
        }
      }
      let comicSection: MediaGenMaterialSection | null = null
      if (shot.comicPageId?.trim()) {
        try {
          const page = await comics().getPage(shot.comicPageId.trim())
          const path = takePath(page.imagePath)
          if (path) {
            comicSection = {
              id: `comic_${page.id}`,
              kind: 'ref-image',
              title: String((page.order ?? 0) + 1),
              entityType: 'comic',
              text: '',
              imagePath: path,
              include: true,
              canBeEditBase: false,
              group: 'refs'
            }
          }
        } catch {
          /* optional */
        }
      }
      let beatText: string | null = shot.brief
      if (shot.timelineEntryId?.trim()) {
        try {
          const list = (await timeline().list(book.storyId)) as Array<{
            id: string
            dialogue?: string | null
          }>
          const hit = list.find((e) => e.id === shot.timelineEntryId)
          if (hit?.dialogue?.trim()) beatText = hit.dialogue.trim()
        } catch {
          /* captions */
        }
      }
      let prevPath: string | null = null
      if (method.usesPreviousShot) {
        try {
          const pack = await keyArt().getWithShots(book.storyId)
          const idx = pack.shots.findIndex((s) => s.id === shot.id)
          for (let i = idx - 1; i >= 0; i--) {
            const p = takePath(pack.shots[i]!.imagePath)
            if (p) {
              prevPath = p
              break
            }
          }
        } catch {
          /* optional */
        }
      }
      const ownRaw = parseKeyArtShotImages(shot.imageGalleryJson, {
        imagePath: shot.imagePath
      })[0]?.path
      const own = ownRaw?.trim() || null
      const allowOwn = method.usesOwnEditBase && Boolean(own)
      if (allowOwn && own) usedPaths.add(own)
      const extraRefs = (payload.galleryIdentityPaths ?? [])
        .map((p) => takePath(p))
        .filter((p): p is string => Boolean(p))
      const hardRules = [
        book.hardRules,
        shot.hardRules,
        (story as { hardRules?: string | null }).hardRules
      ]
        .filter((x): x is string => Boolean(x?.trim()))
        .join('\n')
      const fallbackPrompt = buildKeyArtFallbackPrompt({
        locale,
        storyTitle:
          (story as { title?: string }).title ||
          book.title ||
          PromptCatalog.t(locale, 'hardRules.labelStory'),
        shotOrder: shot.order + 1,
        shotType,
        pageFormat,
        method: method.id,
        brief: shot.brief,
        beatText
      })
      const sections: MediaGenMaterialSection[] = [
        {
          id: 'task',
          kind: 'prompt-block',
          title: type.id,
          entityType: 'layout',
          text: fallbackPrompt,
          imagePath: null,
          include: true,
          canBeEditBase: false,
          group: 'task'
        }
      ]
      if (allowOwn && own) {
        sections.push({
          id: 'keyart_own',
          kind: 'ref-image',
          title: 'own',
          entityType: 'gallery',
          text: '',
          imagePath: own,
          include: true,
          canBeEditBase: allowOwn,
          group: 'refs'
        })
      }
      if (prevPath) {
        sections.push({
          id: 'keyart_prev',
          kind: 'ref-image',
          title: 'prev',
          entityType: 'continuity',
          text: '',
          imagePath: prevPath,
          include: true,
          canBeEditBase: method.id === 'continue',
          group: 'refs'
        })
      }
      sections.push(...charSections)
      if (sceneSection) sections.push(sceneSection)
      if (comicSection) sections.push(comicSection)
      for (const [i, p] of extraRefs.entries()) {
        sections.push({
          id: `ref_${i}`,
          kind: 'ref-image',
          title: String(i + 1),
          entityType: 'gallery',
          text: '',
          imagePath: p,
          include: true,
          canBeEditBase: false,
          group: 'refs'
        })
      }
      return {
        kind,
        entityIds: { storyId: book.storyId, pageId: shot.id },
        sections: sanitizeSections(sections),
        editBaseSectionId: allowOwn
          ? 'keyart_own'
          : method.id === 'continue' && prevPath
            ? 'keyart_prev'
            : null,
        fallbackPrompt,
        taskHint: fallbackPrompt,
        genOptions: {
          artStyle,
          pageFormat,
          aspectRatio: aspectForComicFormat(pageFormat),
          useIdentityEdit: allowOwn,
          galleryLabel: PromptCatalog.t(
            locale,
            type.lockKey as import('../../prompts/copy/keys').PromptCopyKey
          )
            .split(/[：:]/)[0]!
            .trim()
        },
        hardRules: hardRules || null
      }
    }

    throw new AppError('VALIDATION', 'errors.unsupportedMediaGenKind')
  })

  reg(
    'mediaGen:polish',
    async (payload: {
      kind?: MediaGenKind
      includedSections: MediaGenMaterialSection[]
      fallbackPrompt: string
      taskHint?: string
      hardRules?: string | null
      locale?: string
      /** image = keyframe/still director; video = motion director */
      mode?: 'image' | 'video'
      /** Domain *VideoPolishUserPrompt body (video stage) */
      userTextOverride?: string | null
      promptTemplateId?: string | null
    }) => {
      if (!payload.fallbackPrompt?.trim()) {
        throw new AppError('VALIDATION', 'errors.fallbackPromptRequired')
      }
      const sections = Array.isArray(payload.includedSections)
        ? payload.includedSections.filter((s) => s && s.include !== false)
        : []
      const included = sections.map((s) => ({ ...s, include: true }))

      const { polishMediaGenPrompt } = await import(
        '../../application/media/polishMediaGenPrompt'
      )
      const result = await polishMediaGenPrompt({
        ai: ctx.aiClient,
        locale: PromptCatalog.locale(payload.locale),
        kind: payload.kind || 'action-plate',
        includedSections: included,
        taskHint: payload.taskHint,
        fallbackPrompt: payload.fallbackPrompt,
        hardRules: payload.hardRules,
        mode: payload.mode,
        userTextOverride: payload.userTextOverride,
        promptTemplateId: payload.promptTemplateId
      })

      activity.append({
        kind: 'ai',
        level: 'info',
        message: 'mediaGenPolish',
        meta: {
          kind: payload.kind,
          mode: payload.mode,
          polished: result.polished,
          imageCount: result.imageCount,
          override: Boolean(payload.userTextOverride?.trim())
        }
      })

      return {
        polishedPrompt: result.prompt,
        polished: result.polished,
        imageCount: result.imageCount
      }
    }
  )

  reg(
    'mediaGen:generateImage',
    async (payload: {
      kind?: MediaGenKind
      actionId?: string
      characterId?: string
      sceneId?: string
      propId?: string
      storyId?: string
      entryId?: string
      pageId?: string
      costumeId?: string
      polishedPrompt: string
      editBasePath?: string | null
      useIdentityEdit?: boolean
      panelLayout?: string | null
      artStyle?: string | null
      sheetVariant?: string | null
      plateVariant?: string | null
      forcePureLayout?: boolean
      galleryIdentityPaths?: string[] | null
      galleryLabel?: string | null
      hardRules?: string | null
      persist?: boolean
      pageFormat?: 'tall' | 'square' | 'wide'
      shotType?: string | null
      keyArtMakeMethod?: 'fresh' | 'edit' | 'identity' | 'continue'
    }) => {
      const promptIn = extractPolishedMediaPrompt(
        payload.polishedPrompt ?? ''
      )
      if (!promptIn) {
        throw new AppError('VALIDATION', 'errors.promptRequired')
      }
      const kind = payload.kind || 'action-plate'
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )
      const {
        aspectFromImageSize,
        imageSizeForSheetVariant,
        imageSizeForScenePlate,
        imageSizeForPropPlate
      } = await import('../../types/settings')
      const { resolveSheetGenMode } = await import(
        '../../domain/characterMasterPrompt'
      )
      const { appendMultiRefNote, allRefPaths } = await import(
        '../../domain/imageGenConfirm'
      )

      let size = '1024x1024'
      let aspectRatio = '1:1'
      let artStyle = getArtStyle(payload.artStyle ?? undefined).id
      let hardRules = payload.hardRules ?? null
      let sexGender: string | null = null
      let sexName: string | null = null
      let entityKey = ''
      let panelLayoutId: string | undefined
      let sheetVariantId: string | undefined
      let plateVariantId: string | undefined
      let forcePureLayout = payload.forcePureLayout === true
      let galleryLabel: string | undefined =
        typeof payload.galleryLabel === 'string' && payload.galleryLabel.trim()
          ? payload.galleryLabel.trim()
          : undefined
      let layer: string | undefined
      let keyArtImageId: string | undefined

      if (kind === 'action-plate') {
        if (!payload.actionId?.trim()) {
          throw new AppError('VALIDATION', 'errors.actionIdRequired')
        }
        const row = await actions().get(payload.actionId)
        entityKey = row.id
        const { getActionPanelLayout } = await import(
          '../../domain/actionPlateVariants'
        )
        const layout = getActionPanelLayout(
          payload.panelLayout ?? row.panelLayout
        )
        panelLayoutId = layout.id
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        hardRules = payload.hardRules ?? row.hardRules
        size = imageSizeForClass(layout.sizeClass, {
          tall: ctx.settings.imageSizeTall,
          square: ctx.settings.imageSizeSquare,
          wide: ctx.settings.imageSizeWide
        })
        aspectRatio = aspectFromImageSize(size)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await actions().update(row.id, { artStyle })
        }
        if (payload.panelLayout && payload.panelLayout !== row.panelLayout) {
          await actions().update(row.id, { panelLayout: layout.id })
        }
      } else if (kind === 'costume-intro') {
        const cosId = payload.costumeId?.trim()
        if (!cosId) {
          throw new AppError('VALIDATION', 'errors.costumeIdRequired')
        }
        entityKey = cosId
        if (costumes) {
          try {
            const c = await costumes().get(cosId)
            artStyle = getArtStyle(
              payload.artStyle ?? c.artStyle ?? undefined
            ).id
            hardRules = payload.hardRules ?? c.hardRules
            galleryLabel = galleryLabel || c.name || 'Costume intro'
          } catch {
            hardRules = payload.hardRules ?? null
          }
        }
        size = ctx.settings.imageSizeTall || '1024x1792'
        aspectRatio = aspectFromImageSize(size)
      } else if (
        kind === 'character-sheet' ||
        kind === 'costume-dress' ||
        kind === 'costume-swap' ||
        kind === 'character-intro'
      ) {
        if (!payload.characterId?.trim()) {
          throw new AppError('VALIDATION', 'errors.characterIdRequired')
        }
        const row = await characters().get(payload.characterId)
        entityKey = row.id
        sexGender = row.gender ?? null
        sexName = row.name ?? null
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        hardRules = payload.hardRules ?? row.hardRules
        if (kind === 'character-sheet') {
          const { getSheetVariant } = await import(
            '../../domain/characterSheetVariants'
          )
          const variantDef = getSheetVariant(payload.sheetVariant)
          sheetVariantId = variantDef.id
          galleryLabel = variantDef.galleryLabel
          layer = variantDef.wardrobeLayer
          forcePureLayout =
            forcePureLayout ||
            variantDef.wardrobeLayer === 'nude' ||
            variantDef.wardrobeLayer === 'base' ||
            Boolean(variantDef.requiresUnclothedSupport)
          size = imageSizeForSheetVariant(ctx.settings, variantDef.id)
        } else if (kind === 'costume-dress' || kind === 'costume-swap') {
          sheetVariantId = 'costume_swap'
          layer = 'costume'
          // Prefer label from extract/UI; enrich with costume library name when possible
          galleryLabel =
            (payload as { galleryLabel?: string }).galleryLabel?.trim() ||
            galleryLabel
          if (!galleryLabel && payload.costumeId?.trim() && costumes) {
            try {
              const c = await costumes().get(payload.costumeId.trim())
              const nm = c.name?.trim() || 'Look'
              galleryLabel =
                kind === 'costume-swap'
                  ? `Costume swap · ${nm}`
                  : `Dressed · ${nm}`
            } catch {
              /* optional */
            }
          }
          if (!galleryLabel) {
            galleryLabel =
              kind === 'costume-swap' ? 'Costume swap' : 'Costume dress'
          }
          size = ctx.settings.imageSizeTall || '1024x1792'
        } else {
          size = ctx.settings.imageSizeTall || '1024x1792'
        }
        aspectRatio = aspectFromImageSize(size)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await characters().update(row.id, { artStyle })
        }
      } else if (
        kind === 'scene-plate' ||
        kind === 'atmosphere-swap' ||
        kind === 'scene-intro'
      ) {
        if (!payload.sceneId?.trim()) {
          throw new AppError('VALIDATION', 'errors.sceneIdRequired')
        }
        const row = await scenes().get(payload.sceneId)
        entityKey = row.id
        artStyle = getArtStyle(
          payload.artStyle ??
            (row as { artStyle?: string }).artStyle ??
            undefined
        ).id
        hardRules = payload.hardRules ?? row.hardRules
        if (kind === 'atmosphere-swap') {
          plateVariantId = 'atmosphere_swap'
          galleryLabel = 'Atmosphere swap'
          layer = 'atmosphere'
          size = ctx.settings.imageSizeWide || '1792x1024'
        } else if (kind === 'scene-plate') {
          const { getScenePlateVariant } = await import(
            '../../domain/scenePlateVariants'
          )
          const variantDef = getScenePlateVariant(payload.plateVariant)
          plateVariantId = variantDef.id
          galleryLabel = variantDef.galleryLabel
          layer = variantDef.plateLayer
          size = imageSizeForScenePlate(ctx.settings, variantDef.id)
        } else {
          size = ctx.settings.imageSizeWide || '1792x1024'
        }
        aspectRatio = aspectFromImageSize(size)
        if (
          payload.artStyle ||
          (row as { artStyle?: string }).artStyle !== artStyle
        ) {
          await scenes().update(row.id, { artStyle })
        }
      } else if (kind === 'prop-plate' || kind === 'prop-intro') {
        if (!payload.propId?.trim()) {
          throw new AppError('VALIDATION', 'errors.propIdRequired')
        }
        const row = await props().get(payload.propId)
        entityKey = row.id
        artStyle = getArtStyle(
          payload.artStyle ??
            (row as { artStyle?: string }).artStyle ??
            undefined
        ).id
        hardRules = payload.hardRules ?? row.hardRules
        if (kind === 'prop-plate') {
          const { getPropPlateVariant } = await import(
            '../../domain/propPlateVariants'
          )
          const variantDef = getPropPlateVariant(payload.plateVariant)
          plateVariantId = variantDef.id
          galleryLabel = variantDef.galleryLabel
          size = imageSizeForPropPlate(ctx.settings, variantDef.id)
        } else {
          size = ctx.settings.imageSizeSquare || '1024x1024'
        }
        aspectRatio = aspectFromImageSize(size)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await props().update(row.id, { artStyle })
        }
      } else if (kind === 'action-intro') {
        if (!payload.actionId?.trim()) {
          throw new AppError('VALIDATION', 'errors.actionIdRequired')
        }
        const row = await actions().get(payload.actionId)
        entityKey = row.id
        hardRules = payload.hardRules ?? row.hardRules
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        size = ctx.settings.imageSizeWide || '1792x1024'
        aspectRatio = aspectFromImageSize(size)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await actions().update(row.id, { artStyle })
        }
      } else if (kind === 'story-cover') {
        if (!payload.storyId?.trim()) {
          throw new AppError('VALIDATION', 'errors.storyIdRequired')
        }
        const row = await stories().get(payload.storyId)
        entityKey = row.id
        size = ctx.settings.imageSizeWide || '1792x1024'
        aspectRatio = aspectFromImageSize(size)
      } else if (kind === 'timeline-clip' || kind === 'timeline-still') {
        if (!payload.storyId?.trim() || !payload.entryId?.trim()) {
          throw new AppError('VALIDATION', 'errors.timelineEntryNotFound')
        }
        entityKey = payload.entryId.trim()
        size = ctx.settings.imageSizeWide || '1792x1024'
        aspectRatio = aspectFromImageSize(size)
      } else if (kind === 'key-art') {
        const shotId = payload.pageId?.trim()
        if (!shotId) {
          throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
        }
        const shot = await keyArt().getShot(shotId)
        const book = await keyArt().getById(shot.keyArtId)
        entityKey = shot.id
        const { getKeyArtShotType } = await import(
          '../../domain/keyArtShotTypes'
        )
        const type = getKeyArtShotType(
          payload.shotType ?? shot.shotType
        )
        artStyle = getArtStyle(
          payload.artStyle ?? shot.artStyle ?? book.artStyle ?? undefined
        ).id
        hardRules = payload.hardRules ?? shot.hardRules ?? book.hardRules
        const { effectiveComicPageFormat, imageSizeForComicFormat } =
          await import('../../domain/comicPageFormat')
        const pageFormat = effectiveComicPageFormat({
          pageFormat: payload.pageFormat ?? shot.pageFormat,
          bookFormat: book.pageFormat ?? 'wide',
          layout: { sizeClass: type.sizeClass }
        })
        size = imageSizeForComicFormat(pageFormat, {
          tall: ctx.settings.imageSizeTall || '1024x1792',
          square: ctx.settings.imageSizeSquare || '1024x1024',
          wide: ctx.settings.imageSizeWide || '1792x1024'
        })
        aspectRatio = aspectFromImageSize(size)
        const locale = PromptCatalog.locale(ctx.settings.uiLanguage)
        galleryLabel =
          galleryLabel ||
          PromptCatalog.t(locale, type.lockKey as import('../../prompts/copy/keys').PromptCopyKey)
            .split(/[：:]/)[0]!
            .trim()
        payload.storyId = book.storyId
        payload.pageId = shot.id
      } else if (kind === 'comic-page') {
        const pageId = payload.pageId?.trim()
        if (!pageId) {
          throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
        }
        const page = await comics().getPage(pageId)
        const comic = await comics().getById(page.comicId)
        entityKey = page.id
        const { getComicPageLayout } = await import(
          '../../domain/comicPageLayouts'
        )
        const layout = getComicPageLayout(
          payload.panelLayout ?? page.panelLayout
        )
        panelLayoutId = layout.id
        artStyle = getArtStyle(
          payload.artStyle ?? page.artStyle ?? comic.artStyle ?? undefined
        ).id
        hardRules = payload.hardRules ?? page.hardRules ?? comic.hardRules
        const { effectiveComicPageFormat, imageSizeForComicFormat } =
          await import('../../domain/comicPageFormat')
        const pageFormat = effectiveComicPageFormat({
          pageFormat: payload.pageFormat ?? page.pageFormat,
          bookFormat: (comic as { pageFormat?: string | null }).pageFormat,
          layout
        })
        size = imageSizeForComicFormat(pageFormat, {
          tall: ctx.settings.imageSizeTall || '1024x1792',
          square: ctx.settings.imageSizeSquare || '1024x1024',
          wide: ctx.settings.imageSizeWide || '1792x1024'
        })
        aspectRatio = aspectFromImageSize(size)
        galleryLabel = galleryLabel || `Comic page · ${layout.id}`
        if (payload.artStyle && page.artStyle !== artStyle) {
          await comics().updatePage(page.id, { artStyle })
        }
        if (payload.panelLayout && payload.panelLayout !== page.panelLayout) {
          await comics().updatePage(page.id, { panelLayout: layout.id })
        }
        payload.storyId = comic.storyId
        payload.pageId = page.id
      } else {
        throw new AppError('VALIDATION', 'errors.unsupportedMediaGenKind')
      }

      const refList = allRefPaths(
        payload.editBasePath,
        payload.galleryIdentityPaths
      ).filter((p) => existsSync(p))
      hardRules = mergeSexIntoHardRules(
        hardRules,
        sexGender,
        sexName,
        ctx.settings.uiLanguage
      )
      let prompt = ensureHardRules(
        promptIn,
        hardRules,
        ctx.settings.uiLanguage
      )
      if (refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, 'en')
      }
      const editBase =
        !forcePureLayout &&
        typeof payload.editBasePath === 'string' &&
        payload.editBasePath.trim() &&
        existsSync(payload.editBasePath.trim())
          ? payload.editBasePath.trim()
          : null
      const usedEdit =
        !forcePureLayout &&
        resolveSheetGenMode({
          useIdentityEdit: payload.useIdentityEdit === true,
          hasValidRef: Boolean(editBase)
        }) === 'edit'

      const img = usedEdit
        ? await ctx.aiClient.editImage({
            prompt,
            imagePath: editBase!,
            size,
            aspectRatio
          })
        : await ctx.aiClient.generateImage({ prompt, size, aspectRatio })

      const store = generation().getMediaStore()
      const persist =
        payload.persist === true ||
        kind === 'timeline-still' ||
        kind === 'timeline-clip' ||
        kind === 'comic-page' ||
        kind === 'key-art'
      store.ensureTmpDir()
      store.ensureLibraryDirs()
      let outPath: string
      if (kind === 'action-plate') {
        outPath = persist
          ? store.actionImagePath(
              entityKey,
              `plate_${panelLayoutId || 'grid'}`,
              '.png'
            )
          : store.tmpImagePath(`action_${panelLayoutId || 'grid'}`, '.png')
      } else if (kind === 'character-sheet') {
        const v = sheetVariantId || 'bible'
        outPath = persist
          ? store.characterImagePath(entityKey, `sheet_${v}`, '.png')
          : store.tmpImagePath(`sheet_${v}`, '.png')
      } else if (kind === 'costume-dress' || kind === 'costume-swap') {
        outPath = persist
          ? store.characterImagePath(entityKey, 'sheet_costume_swap', '.png')
          : store.tmpImagePath('sheet_costume_swap', '.png')
      } else if (kind === 'scene-plate') {
        const v = plateVariantId || 'establishing'
        outPath = persist
          ? store.sceneImagePath(entityKey, `plate_${v}`, '.png')
          : store.tmpImagePath(`scene_${v}`, '.png')
      } else if (kind === 'atmosphere-swap') {
        outPath = persist
          ? store.sceneImagePath(entityKey, 'plate_atmosphere_swap', '.png')
          : store.tmpImagePath('scene_atmosphere_swap', '.png')
      } else if (kind === 'prop-plate') {
        const v = plateVariantId || 'hero'
        outPath = persist
          ? store.propImagePath(entityKey, `plate_${v}`, '.png')
          : store.tmpImagePath(`prop_${v}`, '.png')
      } else if (kind === 'timeline-still' || kind === 'timeline-clip') {
        const sid = payload.storyId!.trim()
        const eid = payload.entryId!.trim()
        store.ensureStoryDirs(sid)
        outPath = store.clipContinuityStillPath(sid, eid, '.png')
        try {
          store.clearEntryStillUserCleared(sid, eid)
        } catch {
          /* ignore */
        }
      } else if (kind === 'comic-page') {
        const sid = (payload.storyId || '').trim()
        const pid = (payload.pageId || entityKey).trim()
        if (sid) store.ensureStoryDirs(sid)
        outPath = sid
          ? store.comicPagePath(sid, pid, '.png')
          : store.tmpImagePath(`comic_${pid || 'page'}`, '.png')
      } else if (kind === 'key-art') {
        const sid = (payload.storyId || '').trim()
        const pid = (payload.pageId || entityKey).trim()
        const { newKeyArtShotImageId } = await import(
          '../../domain/keyArtShotImages'
        )
        keyArtImageId = newKeyArtShotImageId()
        if (sid) store.ensureStoryDirs(sid)
        outPath = sid
          ? store.keyArtShotPath(sid, pid, keyArtImageId, '.png')
          : store.tmpImagePath(`keyart_${pid || 'shot'}`, '.png')
      } else if (kind === 'story-cover') {
        outPath = persist
          ? store.tmpImagePath('story_cover', '.png')
          : store.tmpImagePath('story_cover', '.png')
      } else {
        outPath = store.tmpImagePath(
          String(kind || 'media').replace(/-/g, '_'),
          '.png'
        )
      }

      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
      const { enhanceCharacterImage } = await import(
        '../../infrastructure/media/imageEnhance'
      )
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })
      const finalPath = enhanced.path || outPath
      if (
        finalPath !== outPath &&
        (kind === 'timeline-still' || kind === 'timeline-clip')
      ) {
        try {
          const { copyFileSync } = await import('fs')
          copyFileSync(finalPath, outPath)
        } catch {
          /* keep enhanced path */
        }
      }

      // Advanced prep stillStatus=ready needs matching prompt cache
      if (
        (kind === 'timeline-still' || kind === 'timeline-clip') &&
        payload.storyId?.trim() &&
        payload.entryId?.trim()
      ) {
        try {
          const sid = payload.storyId.trim()
          const eid = payload.entryId.trim()
          const {
            buildClipPrepHash,
            serializeEntryStillPromptCache,
            parseStoryCastPrep,
            resolveCastRefFromPrep
          } = await import('../../domain/advancedPrep')
          const { parseIdList } = await import(
            '../../domain/timelineBindings'
          )
          const story = await stories().get(sid)
          const entryRow = (
            (story as { timeline?: Array<Record<string, unknown>> }).timeline ||
            []
          ).find((e) => e.id === eid)
          const castPrep = parseStoryCastPrep(
            store.readStoryCastPrepJson(sid)
          )
          const primaryChar =
            (entryRow?.characterId as string) ||
            parseIdList(entryRow?.characterIds as string | null, null)[0] ||
            null
          const castRef = resolveCastRefFromPrep(primaryChar, castPrep)
          const seconds = Math.max(
            1,
            Number(entryRow?.endTime ?? 10) - Number(entryRow?.startTime ?? 0)
          )
          const promptHash = buildClipPrepHash({
            entryId: eid,
            dialogue: (entryRow?.dialogue as string) || null,
            beatContentJson:
              (entryRow?.beatContentJson as string) || null,
            characterIds: parseIdList(
              entryRow?.characterIds as string | null,
              primaryChar
            ),
            sceneIds: parseIdList(
              entryRow?.sceneIds as string | null,
              (entryRow?.sceneId as string) || null
            ),
            propIds: parseIdList(
              entryRow?.propIds as string | null,
              (entryRow?.propId as string) || null
            ),
            castRefPath: castRef,
            styleNote: (story as { styleNote?: string | null }).styleNote,
            seconds
          })
          const contPath = store.clipContinuityStillPath(sid, eid, '.png')
          const { STILL_PROMPT_VERSION } = await import(
            '../../domain/advancedPrep'
          )
          store.writeEntryStillPromptJson(
            sid,
            eid,
            serializeEntryStillPromptCache({
              version: STILL_PROMPT_VERSION,
              professionalPrompt: prompt,
              stillPath: contPath,
              promptHash,
              updatedAt: new Date().toISOString(),
              sourceImagePath: editBase,
              durationSeconds: seconds
            })
          )
        } catch {
          /* best-effort cache */
        }
      }

      if (kind === 'comic-page' && payload.pageId?.trim()) {
        try {
          await comics().updatePage(payload.pageId.trim(), {
            imagePath: finalPath,
            mediaStatus: 'READY',
            mediaError: null,
            seedPrompt: prompt,
            artStyle
          })
        } catch {
          /* best-effort persist */
        }
      }

      if (kind === 'key-art' && payload.pageId?.trim()) {
        try {
          const {
            parseKeyArtShotImages,
            prependKeyArtShotImage,
            serializeKeyArtShotImages,
            newKeyArtShotImageId
          } = await import('../../domain/keyArtShotImages')
          const { coerceKeyArtMakeMethod } = await import(
            '../../domain/keyArtMakeMethods'
          )
          const shot = await keyArt().getShot(payload.pageId.trim())
          const nextItem = {
            id: keyArtImageId || newKeyArtShotImageId(),
            path: finalPath,
            method: coerceKeyArtMakeMethod(
              payload.keyArtMakeMethod ?? shot.makeMethod
            ),
            createdAt: new Date().toISOString()
          }
          const gallery = prependKeyArtShotImage(
            parseKeyArtShotImages(shot.imageGalleryJson, {
              imagePath: shot.imagePath
            }),
            nextItem
          )
          await keyArt().updateShot(shot.id, {
            imagePath: nextItem.path,
            imageGalleryJson: serializeKeyArtShotImages(gallery),
            mediaStatus: 'READY',
            mediaError: null,
            seedPrompt: prompt,
            artStyle,
            makeMethod: nextItem.method
          })
        } catch {
          /* best-effort persist */
        }
      }

      activity.append({
        kind: 'ai',
        level: 'info',
        message: 'mediaGenGenerateImage',
        meta: { kind, entityKey, usedEdit, path: finalPath }
      })

      const isTimelineKind =
        String(kind) === 'timeline-still' || String(kind) === 'timeline-clip'
      return {
        path: isTimelineKind
          ? store.clipContinuityStillPath(
              payload.storyId!.trim(),
              payload.entryId!.trim(),
              '.png'
            )
          : finalPath,
        draft: !(persist || isTimelineKind),
        usedEdit,
        promptUsed: prompt,
        panelLayout: panelLayoutId,
        artStyle,
        sheetVariant: sheetVariantId,
        plateVariant: plateVariantId,
        forcePureLayout,
        galleryLabel,
        layer,
        size,
        aspectRatio
      }
    }
  )
}
