import { imageSizeForAspect, multiSubjectClipNote, appearanceOrDescription } from '../../../domain/residualLabels'
/**
 * Video prep — registerVideoPrepCreate
 */
import { existsSync, readFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'

export function registerVideoPrepCreate(ctx: HandlerContext): void {
  const {
    reg,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    generation,
    activity
  } = ctx

reg(
  'videoPrep:create',
  (
    async (
      payload: {
        kind:
          | 'character-intro'
          | 'scene-intro'
          | 'prop-intro'
          | 'costume-intro'
          | 'action-intro'
          | 'timeline-clip'
        sourceImagePath?: string | null
        characterId?: string
        sceneId?: string
        propId?: string
        costumeId?: string
        actionId?: string
        storyId?: string
        entryId?: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
        /** If continuity still exists, reuse it (skip image gen). */
        skipStillIfExists?: boolean
        /** Still-only: polish+still without requiring video capability. */
        stillOnly?: boolean
      }
    ) => {
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      let seconds =
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : 10
      const aspectRatio =
        ctx.settings.aspectRatio === '9:16' || ctx.settings.aspectRatio === '16:9'
          ? ctx.settings.aspectRatio
          : '16:9'
      let sourceImagePath = payload.sourceImagePath?.trim() || null
      if (sourceImagePath && !existsSync(sourceImagePath)) {
        throw new AppError('VALIDATION', 'errors.sourceImageRequired')
      }
      // Full video-prep needs generateVideo; still-only batch needs images only.
      if (!payload.stillOnly && !ctx.aiClient.generateVideo) {
        throw new AppError('VALIDATION', 'errors.videoUnavailable')
      }

      const {
        polishProfessionalVideoPrompt
      } = await import('../../../application/video/prepareVideoPrompt')
      const {
        generateVideoStillKeyframe
      } = await import('../../../application/video/generateVideoStill')
      const {
        materialsSummaryLines
      } = await import('../../../domain/videoPrep')
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      store.ensureTmpDir()

      let fallbackPrompt = ''
      let polishUserContent = ''
      let materialsSummary = ''
      /** Hard rules to force onto polished professional prompt + still (by kind). */
      let prepHardRules: string | null = null
      /** Multi-vision polish paths (timeline: prev + cast + library). */
      let multiPolishPaths: string[] | null = null
      let stillOut = store.tmpImagePath('video_prep_still', '.png')
      const entityIds: {
        characterId?: string
        sceneId?: string
        propId?: string
        costumeId?: string
        actionId?: string
        storyId?: string
        entryId?: string
      } = {}

      if (payload.kind === 'character-intro') {
        if (!payload.characterId) {
          throw new AppError('VALIDATION', 'errors.characterIdRequired')
        }
        const row = await characters().get(payload.characterId)
        entityIds.characterId = row.id
        let spokenLanguages: string[] | undefined
        try {
          const raw = (row as { spokenLanguages?: string | null })
            .spokenLanguages
          if (raw?.trim()) {
            const parsed = JSON.parse(raw) as unknown
            if (Array.isArray(parsed)) {
              spokenLanguages = parsed.filter(
                (x): x is string => typeof x === 'string'
              )
            }
          }
        } catch {
          spokenLanguages = undefined
        }
        let soulExcerpt = ''
        try {
          const soulPath = (row as { soulMdPath?: string | null }).soulMdPath
          if (soulPath?.trim() && existsSync(soulPath.trim())) {
            soulExcerpt = readFileSync(soulPath.trim(), 'utf-8')
          }
        } catch {
          soulExcerpt = ''
        }
        const profile = {
          name: row.name,
          description: row.description,
          appearance: row.appearance ?? undefined,
          personality: row.personality ?? undefined,
          backstory: row.backstory ?? undefined,
          costume: row.costume ?? undefined,
          ageRange: row.ageRange ?? undefined,
          gender: row.gender ?? undefined,
          voiceDesc: row.voiceDesc ?? undefined,
          mannerisms: row.mannerisms ?? undefined,
          relationships: row.relationships ?? undefined,
          visualTags: row.visualTags ?? undefined,
          seedPrompt:
            (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined,
          spokenLanguages
        }
        const { buildCharacterIntroVideoPrompt } = await import(
          '../../../domain/characterMasterPrompt'
        )
        const {
          buildIntroVideoPolishUserPrompt,
          truncateForVideoPrompt
        } = await import('../../../domain/videoPromptPolish')
        prepHardRules = row.hardRules ?? null
        const { ensureHardRules: sealChar } = await import(
          '../../../domain/promptHardRules'
        )
        fallbackPrompt = sealChar(
          buildCharacterIntroVideoPrompt(profile, locale, {
            soulExcerpt
          }),
          prepHardRules
        )
        polishUserContent = buildIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: Boolean(sourceImagePath),
          fallbackPrompt,
          ...profile,
          soulExcerpt: truncateForVideoPrompt(soulExcerpt),
          hardRules: prepHardRules
        })
        materialsSummary = materialsSummaryLines([
          `name: ${profile.name}`,
          profile.appearance ? `appearance: ${profile.appearance}` : null,
          profile.personality ? `personality: ${profile.personality}` : null,
          profile.costume ? `costume: ${profile.costume}` : null,
          prepHardRules ? 'hardRules: yes' : null
        ])
        stillOut = store.characterImagePath(row.id, 'video_prep_still', '.png')
      } else if (payload.kind === 'scene-intro') {
        if (!payload.sceneId) {
          throw new AppError('VALIDATION', 'errors.sceneIdRequired')
        }
        const row = await scenes().get(payload.sceneId)
        entityIds.sceneId = row.id
        const profile = {
          title: row.title ?? undefined,
          description: row.description || row.title || 'Scene',
          script: row.script ?? undefined,
          locationType: row.locationType ?? undefined,
          timeOfDay: row.timeOfDay ?? undefined,
          weather: row.weather ?? undefined,
          mood: row.mood ?? undefined,
          lighting: row.lighting ?? undefined,
          colorPalette: row.colorPalette ?? undefined,
          setDressing: row.setDressing ?? undefined,
          soundscape: row.soundscape ?? undefined,
          cameraNotes: row.cameraNotes ?? undefined,
          visualTags: row.visualTags ?? undefined,
          artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
        }
        const { buildSceneIntroVideoPrompt } = await import(
          '../../../domain/sceneMasterPrompt'
        )
        const {
          buildSceneIntroVideoPolishUserPrompt
        } = await import('../../../domain/videoPromptPolish')
        prepHardRules = row.hardRules ?? null
        const { ensureHardRules: sealScene } = await import(
          '../../../domain/promptHardRules'
        )
        fallbackPrompt = sealScene(
          buildSceneIntroVideoPrompt(profile, locale),
          prepHardRules
        )
        polishUserContent = buildSceneIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: Boolean(sourceImagePath),
          fallbackPrompt,
          ...profile,
          seedPrompt:
            (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          hardRules: prepHardRules
        })
        materialsSummary = materialsSummaryLines([
          profile.title ? `title: ${profile.title}` : null,
          `description: ${profile.description}`,
          profile.mood ? `mood: ${profile.mood}` : null,
          prepHardRules ? 'hardRules: yes' : null
        ])
        stillOut = store.sceneImagePath(row.id, 'video_prep_still', '.png')
      } else if (payload.kind === 'prop-intro') {
        if (!payload.propId) {
          throw new AppError('VALIDATION', 'errors.propIdRequired')
        }
        const row = await props().get(payload.propId)
        entityIds.propId = row.id
        const profile = {
          name: row.name,
          description: row.description || row.name,
          material: row.material ?? undefined,
          sizeNotes: row.sizeNotes ?? undefined,
          condition: row.condition ?? undefined,
          visualTags: row.visualTags ?? undefined,
          artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
        }
        const { buildPropIntroVideoPrompt } = await import(
          '../../../domain/propMasterPrompt'
        )
        const {
          buildPropIntroVideoPolishUserPrompt
        } = await import('../../../domain/videoPromptPolish')
        prepHardRules = row.hardRules ?? null
        const { ensureHardRules: sealProp } = await import(
          '../../../domain/promptHardRules'
        )
        fallbackPrompt = sealProp(
          buildPropIntroVideoPrompt(profile, locale),
          prepHardRules
        )
        polishUserContent = buildPropIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: Boolean(sourceImagePath),
          fallbackPrompt,
          ...profile,
          hardRules: prepHardRules
        })
        materialsSummary = materialsSummaryLines([
          `name: ${profile.name}`,
          `description: ${profile.description}`,
          profile.material ? `material: ${profile.material}` : null,
          prepHardRules ? 'hardRules: yes' : null
        ])
        stillOut = store.propImagePath(row.id, 'video_prep_still', '.png')
      } else if (payload.kind === 'action-intro') {
        if (!payload.actionId) {
          throw new AppError('VALIDATION', 'errors.actionIdRequired')
        }
        const row = await actions().get(payload.actionId)
        entityIds.actionId = row.id
        const profile = {
          name: row.name,
          description: row.description || row.name,
          motionNotes: row.motionNotes ?? undefined,
          intention: row.intention ?? undefined,
          cameraNotes: row.cameraNotes ?? undefined,
          visualTags: row.visualTags ?? undefined,
          artStyle: row.artStyle ?? undefined
        }
        const { buildActionIntroVideoPrompt } = await import(
          '../../../domain/actionMasterPrompt'
        )
        const {
          hardRulesMaterialsBlock
        } = await import('../../../domain/videoPromptPolish')
        prepHardRules = row.hardRules ?? null
        const { ensureHardRules: sealAct } = await import(
          '../../../domain/promptHardRules'
        )
        fallbackPrompt = sealAct(
          buildActionIntroVideoPrompt(profile, locale),
          prepHardRules
        )
        polishUserContent = [
          locale === 'en'
            ? 'TASK: Action / motion-guide intro clip (image-to-video).'
            : '任務：動作指導介紹短片（圖生影片）。',
          hardRulesMaterialsBlock(prepHardRules, locale),
          locale === 'en'
            ? 'Template draft (improve; keep HARD RULES at end):'
            : '模板草稿（請改進；HARD RULES 置於最尾）：',
          fallbackPrompt
        ]
          .filter(Boolean)
          .join('\n')
        materialsSummary = materialsSummaryLines([
          `name: ${profile.name}`,
          `description: ${profile.description}`,
          profile.motionNotes ? `motion: ${profile.motionNotes}` : null,
          profile.intention ? `intention: ${profile.intention}` : null,
          prepHardRules ? 'hardRules: yes' : null
        ])
        stillOut = store.actionImagePath(row.id, 'video_prep_still', '.png')
      } else if (payload.kind === 'costume-intro') {
        if (!payload.costumeId) {
          throw new AppError('VALIDATION', 'errors.costumeIdRequired')
        }
        const row = await costumes().get(payload.costumeId)
        entityIds.costumeId = row.id
        const profile = {
          name: row.name,
          description: row.description || row.name,
          artStyle: row.artStyle ?? undefined
        }
        const { buildCostumeIntroVideoPrompt } = await import(
          '../../../domain/costumeSwap'
        )
        const {
          buildCostumeIntroVideoPolishUserPrompt
        } = await import('../../../domain/videoPromptPolish')
        prepHardRules = row.hardRules ?? null
        const { ensureHardRules: sealCos } = await import(
          '../../../domain/promptHardRules'
        )
        fallbackPrompt = sealCos(
          buildCostumeIntroVideoPrompt(profile, locale),
          prepHardRules
        )
        polishUserContent = buildCostumeIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: Boolean(sourceImagePath),
          fallbackPrompt,
          ...profile,
          hardRules: prepHardRules
        })
        materialsSummary = materialsSummaryLines([
          `name: ${profile.name}`,
          `description: ${profile.description}`,
          prepHardRules ? 'hardRules: yes' : null
        ])
        stillOut = store.costumeImagePath(row.id, 'video_prep_still', '.png')
      } else if (payload.kind === 'timeline-clip') {
        if (!payload.entryId || !payload.storyId) {
          throw new AppError(
            'VALIDATION',
            'errors.storyAndEntryRequired'
          )
        }
        entityIds.storyId = payload.storyId
        entityIds.entryId = payload.entryId
        const story = await stories().get(payload.storyId)
        const entry = (story.timeline as Array<Record<string, unknown>>).find(
          (e) => e.id === payload.entryId
        )
        if (!entry) {
          throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound')
        }
        const { parseIdList } = await import(
          '../../../domain/timelineBindings'
        )
        const { snapVideoSeconds } = await import(
          '../../../domain/videoDuration'
        )
        const {
          buildClipPrompt,
          previousClipContext,
          resolveTimelineStillRefs,
          getPreviousTimelineEntry,
          buildContinuityLockPrompt,
          timelineBeatDisplayIndex
        } = await import('../../../domain/promptContinuity')
        const { characterVideoPromptBlock } = await import(
          '../../../domain/characterMasterPrompt'
        )
        const {
          buildClipVideoPolishUserPrompt
        } = await import('../../../domain/videoPromptPolish')
        const {
          beatContentToClipPromptBlock,
          parseBeatContent
        } = await import('../../../domain/beatContent')

        const asList = (
          multi: string | string[] | null | undefined,
          primary: string | null
        ): string[] => {
          if (Array.isArray(multi) && multi.length > 0) return multi
          if (typeof multi === 'string') return parseIdList(multi, primary)
          return parseIdList(null, primary)
        }
        const charIdList = asList(
          entry.characterIds as string | string[] | null | undefined,
          (entry.characterId as string | null) ?? null
        )
        const sceneIdList = asList(
          entry.sceneIds as string | string[] | null | undefined,
          (entry.sceneId as string | null) ?? null
        )
        const propIdList = asList(
          entry.propIds as string | string[] | null | undefined,
          (entry.propId as string | null) ?? null
        )
        const actionIdList = asList(
          entry.actionIds as string | string[] | null | undefined,
          (entry.actionId as string | null) ?? null
        )
        const characters = story.characters as Array<Record<string, unknown>>
        const scenesList = story.scenes as Array<Record<string, unknown>>
        const propsList = story.props as Array<Record<string, unknown>>
        const actionsList = (story.actions ?? []) as Array<
          Record<string, unknown>
        >
        const chars = charIdList
          .map((id) => characters.find((c) => c.id === id))
          .filter(Boolean) as Array<Record<string, unknown>>
        const scenesBound = sceneIdList
          .map((id) => scenesList.find((s) => s.id === id))
          .filter(Boolean) as Array<Record<string, unknown>>
        const propsBound = propIdList
          .map((id) => propsList.find((p) => p.id === id))
          .filter(Boolean) as Array<Record<string, unknown>>
        const actionsBound = actionIdList
          .map((id) => actionsList.find((a) => a.id === id))
          .filter(Boolean) as Array<Record<string, unknown>>
        const char = chars[0] ?? null
        const scene = scenesBound[0] ?? null
        const prop = propsBound[0] ?? null
        const action = actionsBound[0] ?? null

        const clipSeconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : snapVideoSeconds(
                Number(entry.endTime) - Number(entry.startTime)
              )
        seconds = clipSeconds

        const parseLangs = (
          c: Record<string, unknown>
        ): string[] | undefined => {
          try {
            const raw = c.spokenLanguages as string | null | undefined
            if (!raw?.trim()) return undefined
            const parsed = JSON.parse(raw) as unknown
            return Array.isArray(parsed)
              ? parsed.filter((x): x is string => typeof x === 'string')
              : undefined
          } catch {
            return undefined
          }
        }
        const charBlocks = chars.map((c) =>
          characterVideoPromptBlock({
            name: String(c.name ?? ''),
            description: String(c.description ?? ''),
            ageRange: (c.ageRange as string | null) ?? undefined,
            gender: (c.gender as string | null) ?? undefined,
            appearance: appearanceOrDescription(
              c.appearance as string | null,
              c.description as string | null
            ),
            costume: (c.costume as string | null) ?? undefined,
            personality: (c.personality as string | null) ?? undefined,
            backstory: (c.backstory as string | null) ?? undefined,
            relationships: (c.relationships as string | null) ?? undefined,
            mannerisms: (c.mannerisms as string | null) ?? undefined,
            voiceDesc: (c.voiceDesc as string | null) ?? undefined,
            visualTags: (c.visualTags as string | null) ?? undefined,
            artStyle: (c.artStyle as string | null) ?? undefined,
            spokenLanguages: parseLangs(c)
          })
        )
        const multiCastNote = multiSubjectClipNote({
          charNames: chars.map((c) => c.name),
          sceneLabels: scenesBound.map(
            (s) => s.title || String(s.description).slice(0, 40)
          ),
          propNames: propsBound.map((p) => p.name)
        })

        const charMap = new Map(
          characters.map((c) => [String(c.id), c as never])
        )
        const sceneMap = new Map(
          scenesList.map((s) => [String(s.id), s as never])
        )
        const propMap = new Map(
          propsList.map((p) => [String(p.id), p as never])
        )
        const timelineEntries = story.timeline as never
        const prev = previousClipContext(
          timelineEntries,
          payload.entryId,
          { characters: charMap, scenes: sceneMap, props: propMap }
        )
        // Clip-to-clip continuity: use previous beat's keyframe still as image ref.
        const prevEntry = getPreviousTimelineEntry(
          timelineEntries,
          payload.entryId
        )
        let previousContinuityPath: string | null = null
        let prevBeatIndex = 0
        if (prevEntry) {
          prevBeatIndex = timelineBeatDisplayIndex(
            timelineEntries,
            prevEntry.id
          )
          const contPath = store.clipContinuityStillPath(
            payload.storyId,
            prevEntry.id
          )
          if (existsSync(contPath)) {
            previousContinuityPath = contPath
          }
        }
        // Advanced cast prep (costume look / gallery pick)
        const {
          parseStoryCastPrep,
          resolveCastRefFromPrep,
          buildClipPrepHash,
          parseEntryStillPromptCache,
          serializeEntryStillPromptCache
        } = await import('../../../domain/advancedPrep')
        const castPrep = parseStoryCastPrep(
          store.readStoryCastPrepJson(payload.storyId)
        )
        const castRefPath = resolveCastRefFromPrep(
          char ? String(char.id) : null,
          castPrep
        )
        const sameCharacter = Boolean(
          char &&
            prevEntry &&
            prevEntry.characterId &&
            String(char.id) === String(prevEntry.characterId)
        )
        const sameScene = Boolean(
          scene &&
            prevEntry &&
            prevEntry.sceneId &&
            String(scene.id) === String(prevEntry.sceneId)
        )
        const continuityLock = prevEntry
          ? buildContinuityLockPrompt({
              previousBeatIndex: prevBeatIndex,
              previousDialogueSnippet: prev,
              sameCharacter,
              sameScene,
              hasContinuityImage: Boolean(previousContinuityPath)
            })
          : null
        const prevWithLock = [prev, continuityLock].filter(Boolean).join('\n')

        const dialogue = (entry.dialogue as string | null) ?? null
        const beatContentJson =
          (entry.beatContentJson as string | null) ?? null
        const beatOrDialogue =
          beatContentToClipPromptBlock(
            parseBeatContent(dialogue, beatContentJson),
            dialogue
          ) ||
          dialogue ||
          null

        const { collectTimelineHardRules, ensureHardRules } = await import(
          '../../../domain/promptHardRules'
        )
        const clipHardRules = collectTimelineHardRules({
          story: story as {
            hardRules?: string | null
            title?: string | null
          },
          characters: chars as Array<{
            hardRules?: string | null
            name?: string | null
          }>,
          scenes: scenesBound as Array<{
            hardRules?: string | null
            title?: string | null
            description?: string | null
          }>,
          props: propsBound as Array<{
            hardRules?: string | null
            name?: string | null
          }>,
          actions: actionsBound as Array<{
            hardRules?: string | null
            name?: string | null
          }>
        })
        prepHardRules = clipHardRules

        fallbackPrompt = ensureHardRules(
          [
            buildClipPrompt({
              storyTitle: story.title,
              styleNote: story.styleNote,
              character: char as never,
              scene: scene as never,
              prop: prop as never,
              dialogue,
              beatContentJson,
              seconds: clipSeconds,
              previousContext: prevWithLock || prev
            }),
            multiCastNote,
            ...charBlocks
          ]
            .filter(Boolean)
            .join('\n'),
          clipHardRules
        )

        // Timeline: prev continuity always wins edit base (never skip for weak payload).
        const timelineRefs = resolveTimelineStillRefs({
          character: char as never,
          scene: scene as never,
          prop: prop as never,
          action: action
            ? { refImagePath: (action.refImagePath as string | null) ?? null }
            : null,
          previousContinuityPath,
          castRefPath,
          payloadSourcePath: sourceImagePath,
          pathExists: (p) => existsSync(p)
        })
        const resolvedSource = timelineRefs.editBase
        const resolvedRefSource: string | null = timelineRefs.editSource
        multiPolishPaths = timelineRefs.polishPaths

        polishUserContent = buildClipVideoPolishUserPrompt({
          locale,
          seconds: clipSeconds,
          aspectRatio,
          hasRefImage: Boolean(resolvedSource),
          fallbackPrompt,
          storyTitle: story.title,
          styleNote: story.styleNote,
          characterBlocks: charBlocks,
          sceneBlock: scene
            ? [
                `#${scene.sceneNumber ?? ''} ${scene.title || ''}`,
                String(scene.description ?? ''),
                scene.mood ? `mood: ${scene.mood}` : null,
                scene.lighting ? `lighting: ${scene.lighting}` : null
              ]
                .filter(Boolean)
                .join('\n')
            : null,
          propBlock: prop
            ? `${prop.name}: ${prop.description}`
            : null,
          // primary action is always actionsBound[0] when multi-bound
          actionBlock: action
            ? [
                `Motion guide "${String(action.name ?? '')}": ${String(action.description ?? '')}`,
                action.motionNotes
                  ? `Body/tempo: ${String(action.motionNotes)}`
                  : null,
                action.intention
                  ? `Intention: ${String(action.intention)}`
                  : null,
                action.cameraNotes
                  ? `Camera: ${String(action.cameraNotes)}`
                  : null
              ]
                .filter(Boolean)
                .join('\n')
            : null,
          beatOrDialogue,
          previousContext: prevWithLock || prev,
          multiCastNote,
          hardRules: clipHardRules
        })
        const continuityMaterialsLine = previousContinuityPath
          ? `continuity: LOCKED to beat #${prevBeatIndex} keyframe (prev-clip image ref)`
          : prevEntry
            ? `continuity: text only from beat #${prevBeatIndex} (no prior still yet — gen beat ${prevBeatIndex} first for image lock)`
            : `continuity: first beat (no previous)`
        materialsSummary = materialsSummaryLines([
          `story: ${story.title}`,
          chars.length
            ? `characters: ${chars.map((c) => c.name).join(', ')}`
            : null,
          scenesBound.length
            ? `scenes: ${scenesBound.map((s) => s.title || s.description).join(' | ')}`
            : null,
          propsBound.length
            ? `props: ${propsBound.map((p) => p.name).join(', ')}`
            : null,
          actionsBound.length
            ? `actions: ${actionsBound.map((a) => a.name).join(', ')}`
            : null,
          clipHardRules
            ? `hardRules: ${clipHardRules.split('\n').length} lines (labeled per object)`
            : null,
          beatOrDialogue
            ? `beat: ${String(beatOrDialogue).slice(0, 200)}`
            : null,
          continuityMaterialsLine,
          resolvedRefSource
            ? `imageRef: ${resolvedRefSource}`
            : null,
          prev ? `prev: ${String(prev).slice(0, 120)}` : null
        ])
        // Write this beat's continuity still so the next clip can chain from it.
        store.ensureStoryDirs(payload.storyId)
        stillOut = store.clipContinuityStillPath(
          payload.storyId,
          payload.entryId,
          '.png'
        )
        if (resolvedSource) {
          sourceImagePath = resolvedSource
        }
        // User is generating a new still — drop "removed by user" marker
        try {
          store.clearEntryStillUserCleared(
            payload.storyId,
            payload.entryId
          )
        } catch {
          /* ignore */
        }

        // Skip still gen when continuity file already exists
        if (
          payload.skipStillIfExists &&
          existsSync(stillOut) &&
          !payload.sourceImagePath
        ) {
          const existingCache = parseEntryStillPromptCache(
            store.readEntryStillPromptJson(payload.storyId, payload.entryId)
          )
          let promptOut = existingCache?.professionalPrompt?.trim() || ''
          let polishedFlag = false
          if (!promptOut) {
            const polishedOnly = await polishProfessionalVideoPrompt({
              ai: ctx.aiClient,
              locale,
              fallbackPrompt,
              polishUserContent,
              hardRules: prepHardRules
            })
            promptOut = polishedOnly.prompt
            polishedFlag = polishedOnly.polished
          } else if (prepHardRules) {
            const { ensureHardRules: sealRules } = await import(
              '../../../domain/promptHardRules'
            )
            promptOut = sealRules(promptOut, prepHardRules)
          }
          const promptHash = buildClipPrepHash({
            entryId: payload.entryId,
            dialogue,
            beatContentJson,
            characterIds: charIdList,
            sceneIds: sceneIdList,
            propIds: propIdList,
            castRefPath,
            styleNote: story.styleNote,
            seconds: clipSeconds
          })
          store.writeEntryStillPromptJson(
            payload.storyId,
            payload.entryId,
            serializeEntryStillPromptCache({
              version: 1,
              professionalPrompt: promptOut,
              userExtraPrompt: existingCache?.userExtraPrompt || '',
              materialsSummary:
                existingCache?.materialsSummary || materialsSummary,
              sourceImagePath,
              stillPath: stillOut,
              promptHash,
              updatedAt: new Date().toISOString(),
              durationSeconds: clipSeconds,
              aspectRatio
            })
          )
          return {
            kind: payload.kind,
            entityIds,
            professionalPrompt: promptOut,
            userExtraPrompt: existingCache?.userExtraPrompt || '',
            stillPath: stillOut,
            sourceImagePath,
            durationSeconds: seconds,
            aspectRatio,
            materialsSummary:
              existingCache?.materialsSummary || materialsSummary,
            stillPromptUsed: undefined,
            polished: polishedFlag,
            skippedStill: true
          }
        }
      } else {
        throw new AppError('VALIDATION', 'errors.unknownVideoPrepKind')
      }

      // Entity intros: single-asset hardRules when not already set (timeline)
      if (!prepHardRules) {
        try {
          if (payload.kind === 'character-intro' && entityIds.characterId) {
            const c = await characters().get(entityIds.characterId)
            prepHardRules = c?.hardRules ?? null
          } else if (payload.kind === 'scene-intro' && entityIds.sceneId) {
            const s = await scenes().get(entityIds.sceneId)
            prepHardRules = s?.hardRules ?? null
          } else if (payload.kind === 'prop-intro' && entityIds.propId) {
            const p = await props().get(entityIds.propId)
            prepHardRules = p?.hardRules ?? null
          } else if (payload.kind === 'action-intro' && entityIds.actionId) {
            const a = await actions().get(entityIds.actionId)
            prepHardRules = a?.hardRules ?? null
          } else if (payload.kind === 'costume-intro' && entityIds.costumeId) {
            const cos = await costumes().get(entityIds.costumeId)
            prepHardRules = cos?.hardRules ?? null
          }
        } catch {
          /* v8 ignore next */
          void 0
        /* v8 ignore next */
        }
        if (prepHardRules) {
          const { ensureHardRules: seal } = await import(
            '../../../domain/promptHardRules'
          )
          fallbackPrompt = seal(fallbackPrompt, prepHardRules)
        }
      }

      // Multi-vision polish: attach identity/source still(s) so LLM sees pixels
      // (chat supports N image_url; still export remains one frame).
      // Timeline uses multiPolishPaths (prev + cast + library); others: single source.
      const polishRefPaths =
        multiPolishPaths && multiPolishPaths.length > 0
          ? multiPolishPaths
          : [sourceImagePath].filter((p): p is string => Boolean(p?.trim()))
      const polished = await polishProfessionalVideoPrompt({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        polishUserContent,
        hardRules: prepHardRules,
        referenceImagePaths: polishRefPaths
      })

      // aspectRatio already coerced to 9:16 | 16:9 above
      const size =
        imageSizeForAspect(aspectRatio, {
          tall: ctx.settings.imageSizeTall,
          wide: ctx.settings.imageSizeWide
        })

      const still = await generateVideoStillKeyframe({
        ai: ctx.aiClient,
        store,
        professionalPrompt: polished.prompt,
        sourceImagePath,
        locale,
        aspectRatio,
        size,
        hardRules: prepHardRules,
        outputPath: stillOut
      })

      // Persist still prompt cache for advanced prep / skip-to-video
      if (
        payload.kind === 'timeline-clip' &&
        payload.storyId &&
        payload.entryId
      ) {
        try {
          const {
            buildClipPrepHash,
            serializeEntryStillPromptCache,
            parseStoryCastPrep,
            resolveCastRefFromPrep
          } = await import('../../../domain/advancedPrep')
          const castPrep = parseStoryCastPrep(
            store.readStoryCastPrepJson(payload.storyId)
          )
          const entryRow = (
            (await stories().get(payload.storyId)).timeline as Array<
              Record<string, unknown>
            >
          ).find((e) => e.id === payload.entryId)
          const { parseIdList } = await import(
            '../../../domain/timelineBindings'
          )
          const primaryChar = (entryRow?.characterId as string) || null
          const castRef = resolveCastRefFromPrep(primaryChar, castPrep)
          const promptHash = buildClipPrepHash({
            entryId: payload.entryId,
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
            styleNote: (await stories().get(payload.storyId)).styleNote,
            seconds
          })
          store.writeEntryStillPromptJson(
            payload.storyId,
            payload.entryId,
            serializeEntryStillPromptCache({
              version: 1,
              professionalPrompt: polished.prompt,
              userExtraPrompt: '',
              materialsSummary,
              sourceImagePath,
              stillPath: still.stillPath,
              promptHash,
              updatedAt: new Date().toISOString(),
              durationSeconds: seconds,
              aspectRatio
            })
          )
        } catch {
          /* best-effort cache */
        }
      }

      activity.append({
        kind: 'video',
        message: 'videoPrepCreate',
        meta: {
          kind: payload.kind,
          polished: polished.polished,
          stillPath: still.stillPath,
          entityIds
        }
      })

      return {
        kind: payload.kind,
        entityIds,
        professionalPrompt: polished.prompt,
        userExtraPrompt: '',
        stillPath: still.stillPath,
        sourceImagePath,
        durationSeconds: seconds,
        aspectRatio,
        materialsSummary,
        stillPromptUsed: still.stillPromptUsed,
        polished: polished.polished,
        skippedStill: false
      }
    }
  )
)
}
