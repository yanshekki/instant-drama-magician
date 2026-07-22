/**
 * Media gen prep IPC: extract materials → multi-vision polish → generate one image.
 */
import { existsSync, writeFileSync } from 'fs'
import { imageSizeForClass } from '../../domain/residualLabels'
import { ensureHardRules } from '../../domain/promptHardRules'
import { AppError } from '../../types/errors'
import type { HandlerContext } from './context'
import type {
  MediaGenKind,
  MediaGenMaterialSection
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
  panelLayout?: string | null
  artStyle?: string | null
  sheetVariant?: string | null
  galleryIdentityPaths?: string[] | null
  preferIdentityEdit?: boolean
  atmosphereDescription?: string
  durationSeconds?: number
  locale?: 'zh-HK' | 'en'
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

export function registerMediagenHandlers(ctx: HandlerContext): void {
  const {
    reg,
    actions,
    characters,
    scenes,
    props,
    stories,
    costumes,
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
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath, row.refSheetPath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const profileText = [
        `Name: ${row.name}`,
        row.appearance ? `Appearance: ${row.appearance}` : '',
        row.costume ? `Costume: ${row.costume}` : '',
        row.description ? `Description: ${row.description}` : '',
        row.visualTags ? `Tags: ${row.visualTags}` : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const built = buildGenericEntityMaterialSections({
        kind,
        name: row.name,
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: payload.preferIdentityEdit
      })
      return {
        kind,
        entityIds: { characterId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Character reference sheet for "${row.name}". Consistent identity across views.`,
        genOptions: { ...built.genOptions, artStyle },
        hardRules: row.hardRules ?? null
      }
    }

    if (kind === 'scene-plate') {
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
      const sceneTitle = row.title || 'Scene'
      const profileText = [
        `Title: ${sceneTitle}`,
        row.description ? `Description: ${row.description}` : '',
        row.lighting ? `Lighting: ${row.lighting}` : '',
        row.mood ? `Mood: ${row.mood}` : '',
        row.setDressing ? `Set: ${row.setDressing}` : '',
        row.visualTags ? `Tags: ${row.visualTags}` : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? (row as { artStyle?: string }).artStyle ?? undefined
      ).id
      const built = buildGenericEntityMaterialSections({
        kind,
        name: sceneTitle,
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: payload.preferIdentityEdit
      })
      return {
        kind,
        entityIds: { sceneId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Empty location plate for "${sceneTitle}". SPACE LOCK architecture and set dressing.`,
        genOptions: { ...built.genOptions, artStyle },
        hardRules: row.hardRules ?? null
      }
    }

    if (kind === 'prop-plate') {
      if (!payload.propId?.trim()) {
        throw new AppError('VALIDATION', 'errors.propIdRequired')
      }
      const row = await props().get(payload.propId)
      const galleryPaths =
        (payload.galleryIdentityPaths ?? []).filter(Boolean).length > 0
          ? (payload.galleryIdentityPaths ?? []).filter(
              (p): p is string => Boolean(p?.trim())
            )
          : [row.refImagePath]
              .map((p) => p?.trim())
              .filter((p): p is string => Boolean(p))
      const profileText = [
        `Name: ${row.name}`,
        row.description ? `Description: ${row.description}` : '',
        row.material ? `Material: ${row.material}` : '',
        row.visualTags ? `Tags: ${row.visualTags}` : ''
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const built = buildGenericEntityMaterialSections({
        kind,
        name: row.name,
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: payload.preferIdentityEdit
      })
      return {
        kind,
        entityIds: { propId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Hero prop still of "${row.name}". Clean product / drama prop plate.`,
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
      const profileText = [
        `Title: ${row.title}`,
        row.logline ? `Logline: ${row.logline}` : '',
        row.synopsis ? `Synopsis: ${row.synopsis}` : ''
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
      let costumeDesc = ''
      let costumeName = 'Costume'
      let costumeHard: string | null = null
      if (payload.costumeId?.trim() && costumes) {
        try {
          const c = await costumes().get(payload.costumeId.trim())
          costumeDesc = c.description || c.name || ''
          costumeName = c.name || costumeName
          costumeHard = c.hardRules ?? null
        } catch {
          /* optional */
        }
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
        row.appearance ? `Appearance: ${row.appearance}` : '',
        `Costume look: ${costumeDesc || row.costume || 'new wardrobe'}`,
        kind === 'costume-swap' ? 'TASK: costume swap on identity base still.' : 'TASK: dressed character still.'
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const built = buildGenericEntityMaterialSections({
        kind: 'character-sheet',
        name: `${row.name} · ${costumeName}`,
        profileText,
        hardRules: costumeHard || row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: true
      })
      return {
        kind,
        entityIds: { characterId: row.id, costumeId: payload.costumeId },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Dressed character still of "${row.name}" in look "${costumeName}". IDENTITY LOCK face/body; apply wardrobe.`,
        genOptions: { ...built.genOptions, artStyle, useIdentityEdit: true },
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
        (payload as { atmosphereDescription?: string }).atmosphereDescription ||
        row.mood ||
        row.lighting ||
        'atmosphere change'
      const profileText = [
        `Scene: ${row.title || 'Scene'}`,
        row.description ? `Base: ${row.description}` : '',
        `Atmosphere change: ${atmo}`,
        'SPACE LOCK architecture; only lighting/mood/weather/time shift.'
      ]
        .filter(Boolean)
        .join('\n')
      const artStyle = getArtStyle(
        payload.artStyle ?? (row as { artStyle?: string }).artStyle ?? undefined
      ).id
      const built = buildGenericEntityMaterialSections({
        kind: 'scene-plate',
        name: row.title || 'Scene',
        profileText,
        hardRules: row.hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: true
      })
      return {
        kind,
        entityIds: { sceneId: row.id },
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Atmosphere swap for "${row.title || 'Scene'}". Keep set; change lighting/mood only.`,
        genOptions: { ...built.genOptions, artStyle, useIdentityEdit: true },
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
      const {
        hydrateTimelineBindings,
        parseIdList
      } = await import('../../domain/timelineBindings')
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
        characterIds?: string | string[] | null
        sceneIds?: string | string[] | null
        propIds?: string | string[] | null
      }
      const toIdJson = (
        v: string | string[] | null | undefined
      ): string | null => {
        if (Array.isArray(v)) return JSON.stringify(v)
        return v ?? null
      }
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

      const charIds = parseIdList(
        toIdJson(entry.characterIds),
        entry.characterId
      )
      const sceneIds = parseIdList(toIdJson(entry.sceneIds), entry.sceneId)
      const propIds = parseIdList(toIdJson(entry.propIds), entry.propId)
      const primaryCharId = charIds[0] ?? null
      const primarySceneId = sceneIds[0] ?? null
      const primaryPropId = propIds[0] ?? null

      let characterName: string | null = null
      let characterImagePath: string | null = null
      let characterHard: string | null = null
      let artStyle: string | undefined
      const chars: Array<{ hardRules?: string | null; name?: string | null }> =
        []
      if (primaryCharId) {
        try {
          const ch = await characters().get(primaryCharId)
          characterName = ch.name
          characterImagePath =
            ch.refSheetPath?.trim() || ch.refImagePath?.trim() || null
          characterHard = ch.hardRules ?? null
          artStyle = ch.artStyle ?? undefined
          chars.push(ch)
        } catch {
          /* optional */
        }
      }
      let sceneLabel: string | null = null
      let sceneImagePath: string | null = null
      const scenesBound: Array<{
        hardRules?: string | null
        title?: string | null
        description?: string | null
      }> = []
      if (primarySceneId) {
        try {
          const sc = await scenes().get(primarySceneId)
          sceneLabel = sc.title || String(sc.description || '').slice(0, 40)
          sceneImagePath = sc.refImagePath?.trim() || null
          scenesBound.push(sc)
        } catch {
          /* optional */
        }
      }
      let propName: string | null = null
      let propImagePath: string | null = null
      const propsBound: Array<{ hardRules?: string | null; name?: string | null }> =
        []
      if (primaryPropId) {
        try {
          const pr = await props().get(primaryPropId)
          propName = pr.name
          propImagePath = pr.refImagePath?.trim() || null
          propsBound.push(pr)
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
      const beatBlock =
        beatContentToClipPromptBlock(
          parseBeatContent(dialogue, beatContentJson),
          dialogue
        ) || dialogue

      const sameCharacter = Boolean(
        primaryCharId &&
          prevEntry?.characterId &&
          primaryCharId === prevEntry.characterId
      )
      const sameScene = Boolean(
        primarySceneId &&
          prevEntry?.sceneId &&
          primarySceneId === prevEntry.sceneId
      )
      const continuityLockText = prevEntry
        ? buildContinuityLockPrompt({
            previousBeatIndex,
            previousDialogueSnippet: prevEntry.dialogue,
            sameCharacter,
            sameScene,
            hasContinuityImage: Boolean(previousContinuityPath)
          })
        : null

      const hardRules = collectTimelineHardRules({
        story: story as { hardRules?: string | null; title?: string | null },
        characters: chars,
        scenes: scenesBound,
        props: propsBound,
        actions: []
      })

      const built = buildTimelineBeatMaterialSections({
        kind,
        storyTitle: String(
          (story as { title?: string }).title || 'Story'
        ),
        displayIndex,
        dialogue,
        beatBlock,
        previousContinuityPath,
        previousBeatIndex: prevEntry ? previousBeatIndex : undefined,
        continuityLockText,
        castRefPath,
        castRefName: characterName,
        characterName,
        characterImagePath,
        sceneLabel,
        sceneImagePath,
        propName,
        propImagePath,
        hardRules: hardRules || characterHard,
        artStyleId: getArtStyle(
          payload.artStyle ?? artStyle ?? undefined
        ).id,
        durationSeconds: payload.durationSeconds ?? seconds,
        styleNote: (story as { styleNote?: string | null }).styleNote
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
        hardRules: hardRules || characterHard || null
      }
    }

    // Video intros — structured sections for multi-vision polish then still
    if (
      kind === 'character-intro' ||
      kind === 'scene-intro' ||
      kind === 'prop-intro' ||
      kind === 'action-intro' ||
      kind === 'costume-intro'
    ) {
      const galleryPaths = (payload.galleryIdentityPaths ?? [])
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p))
      let name = kind
      let profileText = `Video / still prep kind: ${kind}.`
      let hardRules: string | null = null
      let artStyle = getArtStyle(payload.artStyle ?? undefined).id
      const entityIds: Record<string, string | undefined> = {
        characterId: payload.characterId,
        sceneId: payload.sceneId,
        propId: payload.propId,
        costumeId: payload.costumeId,
        actionId: payload.actionId,
        storyId: payload.storyId,
        entryId: payload.entryId
      }
      if (payload.characterId) {
        const row = await characters().get(payload.characterId)
        name = row.name
        profileText = [
          `Character intro: ${row.name}`,
          row.appearance ? `Appearance: ${row.appearance}` : '',
          row.costume ? `Costume: ${row.costume}` : '',
          row.description ? `Description: ${row.description}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        hardRules = row.hardRules ?? null
        artStyle = getArtStyle(payload.artStyle ?? row.artStyle ?? undefined).id
        if (galleryPaths.length === 0 && row.refImagePath) {
          galleryPaths.push(row.refImagePath)
        }
      } else if (payload.sceneId) {
        const row = await scenes().get(payload.sceneId)
        name = row.title || 'Scene'
        profileText = [
          `Scene intro: ${name}`,
          row.description ? `Description: ${row.description}` : '',
          row.lighting ? `Lighting: ${row.lighting}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        hardRules = row.hardRules ?? null
        if (galleryPaths.length === 0 && row.refImagePath) {
          galleryPaths.push(row.refImagePath)
        }
      } else if (payload.propId) {
        const row = await props().get(payload.propId)
        name = row.name
        profileText = [
          `Prop intro: ${row.name}`,
          row.description ? `Description: ${row.description}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        hardRules = row.hardRules ?? null
        if (galleryPaths.length === 0 && row.refImagePath) {
          galleryPaths.push(row.refImagePath)
        }
      } else if (payload.actionId) {
        const row = await actions().get(payload.actionId)
        name = row.name
        profileText = [
          `Action intro: ${row.name}`,
          row.description ? `Description: ${row.description}` : '',
          row.motionNotes ? `Motion: ${row.motionNotes}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        hardRules = row.hardRules ?? null
      }
      const built = buildGenericEntityMaterialSections({
        kind: 'character-sheet',
        name,
        profileText,
        hardRules,
        artStyleId: artStyle,
        galleryPaths,
        preferIdentityEdit: galleryPaths.length > 0
      })
      return {
        kind,
        entityIds,
        sections: sanitizeSections(built.sections),
        editBaseSectionId: built.editBaseSectionId,
        fallbackPrompt: built.fallbackPrompt,
        taskHint: `Keyframe still then short-drama video for "${name}" (${kind}).`,
        genOptions: {
          ...built.genOptions,
          artStyle,
          durationSeconds: payload.durationSeconds
        },
        hardRules
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
      locale?: 'zh-HK' | 'en'
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
        locale: payload.locale === 'en' ? 'en' : 'zh-HK',
        kind: payload.kind || 'action-plate',
        includedSections: included,
        taskHint: payload.taskHint,
        fallbackPrompt: payload.fallbackPrompt,
        hardRules: payload.hardRules
      })

      activity.append({
        kind: 'ai',
        level: 'info',
        message: 'mediaGenPolish',
        meta: {
          kind: payload.kind,
          polished: result.polished,
          imageCount: result.imageCount
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
      costumeId?: string
      polishedPrompt: string
      editBasePath?: string | null
      useIdentityEdit?: boolean
      panelLayout?: string | null
      artStyle?: string | null
      sheetVariant?: string | null
      hardRules?: string | null
      persist?: boolean
    }) => {
      const promptIn = payload.polishedPrompt?.trim()
      if (!promptIn) {
        throw new AppError('VALIDATION', 'errors.promptRequired')
      }
      const kind = payload.kind || 'action-plate'
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )
      const { aspectFromImageSize } = await import('../../types/settings')
      const { resolveSheetGenMode } = await import(
        '../../domain/characterMasterPrompt'
      )

      let size = '1024x1024'
      let aspectRatio = '1:1'
      let artStyle = getArtStyle(payload.artStyle ?? undefined).id
      let hardRules = payload.hardRules ?? null
      let entityKey = ''
      let panelLayoutId: string | undefined

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
      } else if (
        kind === 'character-sheet' ||
        kind === 'costume-dress' ||
        kind === 'costume-swap' ||
        kind === 'character-intro' ||
        kind === 'costume-intro'
      ) {
        if (!payload.characterId?.trim()) {
          throw new AppError('VALIDATION', 'errors.characterIdRequired')
        }
        const row = await characters().get(payload.characterId)
        entityKey = row.id
        artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        hardRules = payload.hardRules ?? row.hardRules
        size = ctx.settings.imageSizeTall || '1024x1792'
        aspectRatio = aspectFromImageSize(size)
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
        size = ctx.settings.imageSizeWide || '1792x1024'
        aspectRatio = aspectFromImageSize(size)
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
        size = ctx.settings.imageSizeSquare || '1024x1024'
        aspectRatio = aspectFromImageSize(size)
      } else if (kind === 'action-intro') {
        if (!payload.actionId?.trim()) {
          throw new AppError('VALIDATION', 'errors.actionIdRequired')
        }
        const row = await actions().get(payload.actionId)
        entityKey = row.id
        hardRules = payload.hardRules ?? row.hardRules
        size = ctx.settings.imageSizeWide || '1792x1024'
        aspectRatio = aspectFromImageSize(size)
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
      } else {
        throw new AppError('VALIDATION', 'errors.unsupportedMediaGenKind')
      }

      const prompt = ensureHardRules(promptIn, hardRules)
      const editBase =
        typeof payload.editBasePath === 'string' &&
        payload.editBasePath.trim() &&
        existsSync(payload.editBasePath.trim())
          ? payload.editBasePath.trim()
          : null
      const usedEdit =
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
        kind === 'timeline-clip'
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
        outPath = persist
          ? store.characterImagePath(entityKey, 'sheet', '.png')
          : store.tmpImagePath('character_sheet', '.png')
      } else if (kind === 'scene-plate') {
        outPath = persist
          ? store.sceneImagePath(entityKey, 'plate', '.png')
          : store.tmpImagePath('scene_plate', '.png')
      } else if (kind === 'prop-plate') {
        outPath = persist
          ? store.propImagePath(entityKey, 'plate', '.png')
          : store.tmpImagePath('prop_plate', '.png')
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
      } else {
        outPath = store.tmpImagePath('story_cover', '.png')
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
        artStyle
      }
    }
  )
}
