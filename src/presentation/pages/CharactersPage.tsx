import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAiLocale } from '../../lib/aiLocale'
import {
  formatSpokenLanguagesDisplay,
  languageLabel,
  parseSpokenLanguagesJson,
  serializeSpokenLanguages
} from '../../domain/worldLanguages'
import {
  libraryBodyClass,
  libraryCardClass,
  libraryGridClass,
  libraryMediaClass
} from '../components/libraryCard'
import {
  LibraryBrowseBar,
  LibraryPageBody,
  LibraryPagination
} from '../components/LibraryBrowseBar'
import {
  LibraryFilterSelect,
  uniqueFacetValues
} from '../components/LibraryFilterSelect'
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import { LanguageMultiPick } from '../components/LanguageMultiPick'
import {
  appendGalleryItem,
  filterGalleryByLayer,
  isGalleryCoverPath,
  listExternalRefs,
  parseCharacterGallery,
  moveGalleryItem,
  pickExternalRefPath,
  primaryGalleryPath,
  removeGalleryItem,
  serializeCharacterGallery,
  type CharacterGalleryItem
} from '../../domain/characterGallery'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  parseSoulMd
} from '../../domain/character'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { Character, CreateCharacterInput } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { useCharacters } from '../hooks/useCharacters'
import {
  artStylesByGroup,
  DEFAULT_ART_STYLE,
  getArtStyle,
  isArtStyleId,
  type ArtStyleId
} from '../../domain/characterArtStyles'
import {
  DEFAULT_SHEET_VARIANT,
  getSheetVariant,
  isLikelyMinorAge,
  sheetRequiresUnclothedSupport,
  sheetVariantsByGroupForProfile,
  type SheetVariantId,
  type WardrobeLayer
} from '../../domain/characterSheetVariants'
import {
  COSTUME_SWAP_POSES,
  inferGalleryLayer,
  pickBestBaseImage,
  type CostumeSwapPose
} from '../../domain/costumeSwap'
import {
  createCostumeEntry,
  ensureCostumeInLibrary,
  parseCharacterCostumes,
  removeCostume,
  serializeCharacterCostumes,
  type CharacterCostumeEntry,
  upsertCostume
} from '../../domain/characterCostumes'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PlotContextPicker } from '../components/PlotContextPicker'
import { PageHeader } from '../components/PageHeader'
import { Button, EmptyState, Input, Label, Textarea } from '../components/ui'
import { translateCharacterGalleryLabel } from '../../domain/galleryLabelI18n'

type EditorPanel = 'profile' | 'refs' | 'costume'
type GalleryLayerFilter = 'all' | WardrobeLayer

interface FormState {
  name: string
  description: string
  appearance: string
  personality: string
  backstory: string
  costume: string
  ageRange: string
  gender: string
  voiceDesc: string
  /** BCP-47 / ISO codes — multi spoken languages */
  spokenLanguages: string[]
  mannerisms: string
  relationships: string
  visualTags: string
  seedPrompt: string
  soulMdPath: string | null
  soulHubId: number | null
  soulPreview: string | null
  gallery: CharacterGalleryItem[]
  /** Library card cover — stored as Character.refImagePath */
  coverPath: string | null
  artStyle: ArtStyleId
  costumes: CharacterCostumeEntry[]
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  appearance: '',
  personality: '',
  backstory: '',
  costume: '',
  ageRange: '',
  gender: '',
  voiceDesc: '',
  spokenLanguages: [],
  mannerisms: '',
  relationships: '',
  visualTags: '',
  seedPrompt: '',
  soulMdPath: null,
  soulHubId: null,
  soulPreview: null,
  gallery: [],
  coverPath: null,
  artStyle: DEFAULT_ART_STYLE,
  costumes: []
})

function galleryFromCharacter(c: Character): CharacterGalleryItem[] {
  return parseCharacterGallery(c.refGalleryJson, {
    refImagePath: c.refImagePath,
    refSheetPath: c.refSheetPath
  })
}

function coverPath(c: Character): string | null {
  const g = galleryFromCharacter(c)
  return (
    primaryGalleryPath(g, c.refImagePath) ??
    c.refImagePath ??
    c.refSheetPath ??
    null
  )
}

export function CharactersPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { activeStoryId, stories } = useApp()
  const toast = useToast()
  const dialog = useDialog()
  const {
    startJob,
    isBlocked,
    onProfileApply,
    onSheetCommitted,
    onWardrobeApply,
    activeJobs
  } = useAiJobs()
  const {
    items,
    loading,
    error,
    create,
    update,
    remove,
    reload
  } = useCharacters(activeStoryId)

  const EMPTY_FACET = '__unset__'
  const [charGender, setCharGender] = useState('')
  const [charArtStyle, setCharArtStyle] = useState('')
  const [charImage, setCharImage] = useState('') // '' | has | none
  const [charSoul, setCharSoul] = useState('') // '' | has | none
  const [charLang, setCharLang] = useState('')
  const charBrowse = useLibraryBrowse(
    items,
    (c) =>
      [
        c.name,
        c.description,
        c.appearance ?? '',
        c.personality ?? '',
        c.costume ?? '',
        c.visualTags ?? '',
        c.gender ?? '',
        c.artStyle ?? ''
      ].join(' '),
    {
      extraKey: `${charGender}|${charArtStyle}|${charImage}|${charSoul}|${charLang}`,
      matchesExtra: (c) => {
        if (charGender === EMPTY_FACET) {
          if ((c.gender ?? '').trim()) return false
        } else if (charGender && (c.gender ?? '').trim() !== charGender) {
          return false
        }
        if (charArtStyle && (c.artStyle ?? '') !== charArtStyle) return false
        const hasImg = Boolean(c.refImagePath || c.refSheetPath)
        if (charImage === 'has' && !hasImg) return false
        if (charImage === 'none' && hasImg) return false
        const hasSoul = Boolean(
          (c.soulMdPath ?? '').trim() || c.soulHubId != null
        )
        if (charSoul === 'has' && !hasSoul) return false
        if (charSoul === 'none' && hasSoul) return false
        if (charLang) {
          let langs: string[] = []
          try {
            const raw = c.spokenLanguages
            if (raw?.trim()) {
              const parsed = JSON.parse(raw) as unknown
              if (Array.isArray(parsed)) {
                langs = parsed.filter((x): x is string => typeof x === 'string')
              }
            }
          } catch {
            langs = []
          }
          if (!langs.includes(charLang)) return false
        }
        return true
      }
    }
  )
  const charGenderOptions = useMemo(() => {
    const vals = uniqueFacetValues(
      items.map((c) => c.gender),
      { emptyToken: EMPTY_FACET }
    )
    return [
      { value: '', label: t('library.filterAny') },
      ...vals.map((v) => ({
        value: v,
        label:
          v === EMPTY_FACET ? t('library.filterUnset') : v
      }))
    ]
  }, [items, t])
  const charArtOptions = useMemo(() => {
    const vals = uniqueFacetValues(items.map((c) => c.artStyle))
    return [
      { value: '', label: t('library.filterAny') },
      ...vals.map((v) => ({
        value: v,
        label: isArtStyleId(v)
          ? t(`characters.${getArtStyle(v).labelKey}`)
          : v
      }))
    ]
  }, [items, t])
  const charLangOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of items) {
      try {
        const raw = c.spokenLanguages
        if (!raw?.trim()) continue
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          for (const x of parsed) {
            if (typeof x === 'string' && x.trim()) set.add(x.trim())
          }
        }
      } catch {
        /* skip */
      }
    }
    const vals = [...set].sort((a, b) =>
      languageLabel(a, i18n.language).localeCompare(
        languageLabel(b, i18n.language),
        i18n.language.startsWith('zh') ? 'zh-Hant' : 'en'
      )
    )
    return [
      { value: '', label: t('library.filterAny') },
      ...vals.map((v) => ({
        value: v,
        label: languageLabel(v, i18n.language)
      }))
    ]
  }, [items, t, i18n.language])
  const clearCharFilters = (): void => {
    charBrowse.setQ('')
    setCharGender('')
    setCharArtStyle('')
    setCharImage('')
    setCharSoul('')
    setCharLang('')
  }
  const charHasFilters =
    charBrowse.hasSearch ||
    Boolean(charGender) ||
    Boolean(charArtStyle) ||
    Boolean(charImage) ||
    Boolean(charSoul) ||
    Boolean(charLang)

  const removeWithFeedback = async (id: string): Promise<void> => {
    try {
      await remove(id)
      toast.success(t('common.deleted'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }


  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPanel, setEditorPanel] = useState<EditorPanel>('refs')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pageBanner, setPageBanner] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const CHARACTER_AI_KINDS = [
    'character-ai-fill',
    'character-sheet',
    'character-intro-video',
    'costume-swap',
    'wardrobe-suggest'
  ] as const

  /** null / undefined = "new character" scope (only block other new-char jobs). */
  const characterAiBusy = (characterId?: string | null): boolean => {
    const id = characterId ?? null
    if (
      isBlocked({
        kind: [...CHARACTER_AI_KINDS],
        characterId: id
      })
    ) {
      return true
    }
    return activeJobs.some((j) => {
      if (!(CHARACTER_AI_KINDS as readonly string[]).includes(j.kind)) {
        return false
      }
      if (id) {
        return j.scope.characterId === id
      }
      // New character: only block concurrent jobs that also have no characterId
      return !j.scope.characterId
    })
  }

  const editorAiBusy = characterAiBusy(editingId)

  useEffect(() => {
    return onProfileApply((draft) => {
      // Apply to open form when matching character or new
      if (
        draft.characterId &&
        editingId &&
        draft.characterId !== editingId
      ) {
        void reload()
        return
      }
      const p = draft.profile
      setForm((f) => ({
        ...f,
        name: p.name || f.name,
        description: p.description || f.description,
        appearance: p.appearance ?? f.appearance,
        personality: p.personality ?? f.personality,
        backstory: p.backstory ?? f.backstory,
        costume: p.costume ?? f.costume,
        ageRange: p.ageRange ?? f.ageRange,
        gender: p.gender ?? f.gender,
        voiceDesc: p.voiceDesc ?? f.voiceDesc,
        spokenLanguages:
          Array.isArray(p.spokenLanguages) && p.spokenLanguages.length
            ? p.spokenLanguages
            : f.spokenLanguages,
        mannerisms: p.mannerisms ?? f.mannerisms,
        relationships: p.relationships ?? f.relationships,
        visualTags: p.visualTags ?? f.visualTags,
        seedPrompt:
          p.seedPrompt || f.seedPrompt || p.description || f.description
      }))
      setAiIdea((prev) => prev || p.seedPrompt || p.description || '')
      setEditorOpen(true)
      setEditorPanel('profile')
      setActionError(null)
      setPageBanner(t('characters.aiFillOk'))
      toast.success(t('characters.aiFillOk'))
      void reload()
    })
  }, [onProfileApply, editingId, reload, t])

  useEffect(() => {
    return onSheetCommitted(({ characterId, path, gallery, costume }) => {
      // Instant form update from commit payload (tmp path already promoted)
      if (editingId === characterId) {
        if (gallery && gallery.length > 0) {
          const g = gallery.map((item) => ({
            id: item.id,
            path: item.path,
            kind: (item.kind === 'sheet' ||
            item.kind === 'upload' ||
            item.kind === 'gen'
              ? item.kind
              : 'sheet') as 'sheet' | 'upload' | 'gen',
            label: item.label,
            createdAt: item.createdAt,
            ...(item.layer
              ? {
                  layer: item.layer as
                    | 'identity'
                    | 'nude'
                    | 'base'
                    | 'costume'
                    | 'detail'
                }
              : {})
          }))
          setForm((f) => {
            const costumes = costume
              ? ensureCostumeInLibrary(f.costumes, costume, {
                  artStyle: f.artStyle
                })
              : f.costumes
            return {
              ...f,
              gallery: g,
              costume: costume ?? f.costume,
              costumes
              // Keep cover unless missing; user sets cover explicitly
            }
          })
          // Select the just-committed image (by path), not an older gallery[0] edge case
          const newest =
            g.find((item) => item.path === path) ?? g[0] ?? null
          setSelectedImageId(newest?.id ?? null)
          if (costume) setSwapCostumeText(costume)
        } else {
          // Fallback: reload global library row
          void getApi()
            .characters.list()
            .then((list) => {
              const c = (list as Character[]).find((x) => x.id === characterId)
              if (!c) return
              const g = galleryFromCharacter(c)
              setForm((f) => ({
                ...f,
                gallery: g,
                costume: c.costume ?? f.costume
              }))
              const newest =
                g.find((item) => item.path === path) ?? g[0] ?? null
              setSelectedImageId(newest?.id ?? null)
            })
        }
      }
      void reload()
      setPageBanner(t('characters.sheetOkShort')); toast.success(t('characters.sheetOkShort'))
      // ensure path is used so no unused lint
      void path
    })
  }, [onSheetCommitted, editingId, reload, t])

  useEffect(() => {
    return onWardrobeApply((draft) => {
      if (
        draft.characterId &&
        editingId &&
        draft.characterId !== editingId
      ) {
        return
      }
      const s = draft.suggestion
      const artStyle = isArtStyleId(s.artStyle) ? s.artStyle : form.artStyle
      const entry = createCostumeEntry({
        name: s.name,
        description: s.costume,
        artStyle
      })
      setForm((f) => ({
        ...f,
        costume: s.costume,
        artStyle,
        costumes: upsertCostume(f.costumes, entry)
      }))
      setSwapCostumeText(s.costume)
      setPageBanner(t('characters.suggestWardrobeOk')); toast.success(t('characters.suggestWardrobeOk'))
      setEditorOpen(true)
    })
  }, [onWardrobeApply, editingId, form.artStyle, t])

  const [aiIdea, setAiIdea] = useState('')
  const [sheetVariant, setSheetVariant] =
    useState<SheetVariantId>(DEFAULT_SHEET_VARIANT)
  const [swapCostumeText, setSwapCostumeText] = useState('')
  /** Global wardrobe linked to this character (Costume M2M) */
  const [linkedGlobalCostumes, setLinkedGlobalCostumes] = useState<
    Array<{
      id: string
      name: string
      description: string
      artStyle?: string | null
      refImagePath?: string | null
      isActive?: boolean
      dressedImagePath?: string | null
    }>
  >([])
  const [linkCostumePickId, setLinkCostumePickId] = useState('')
  const [allGlobalCostumes, setAllGlobalCostumes] = useState<
    Array<{ id: string; name: string; description: string }>
  >([])
  const [swapBasePath, setSwapBasePath] = useState<string>('')
  const [swapPose, setSwapPose] = useState<CostumeSwapPose>('hero_front')
  const [galleryLayerFilter, setGalleryLayerFilter] =
    useState<GalleryLayerFilter>('all')
  const [newCostumeName, setNewCostumeName] = useState('')
  const [plotStoryId, setPlotStoryId] = useState('')
  const [plotSegmentKey, setPlotSegmentKey] = useState('all')
  const sheetGroups = useMemo(
    () => sheetVariantsByGroupForProfile({ ageRange: form.ageRange }),
    [form.ageRange]
  )
  const isMinor = useMemo(
    () => isLikelyMinorAge(form.ageRange),
    [form.ageRange]
  )
  const filteredGallery = useMemo(
    () =>
      filterGalleryByLayer(form.gallery, galleryLayerFilter, {
        hideNude: false,
        inferLayer: (it) => inferGalleryLayer(it)
      }),
    [form.gallery, galleryLayerFilter]
  )
  const swapBaseOptions = useMemo(
    () =>
      filterGalleryByLayer(form.gallery, 'all', {
        hideNude: isMinor,
        inferLayer: (it) => inferGalleryLayer(it)
      }),
    [form.gallery, isMinor]
  )
  const artGroups = useMemo(() => artStylesByGroup(), [])

  // If nude variants hidden for age, reset selection
  useEffect(() => {
    const all = Object.values(sheetGroups).flat()
    if (!all.some((v) => v.id === sheetVariant)) {
      setSheetVariant(DEFAULT_SHEET_VARIANT)
    }
  }, [sheetGroups, sheetVariant])

  // Hub
  const [hubPage, setHubPage] = useState(1)
  const [hubTotalPages, setHubTotalPages] = useState(1)
  const [hubItems, setHubItems] = useState<
    Array<{
      id: number
      title: string
      description: string
      role: string | null
      domain: string | null
      role_icon?: string | null
    }>
  >([])
  const [hubQ, setHubQ] = useState('')
  const [suggestions, setSuggestions] = useState<
    Array<{ kind: string; label: string; count?: number }>
  >([])
  const [indexStatus, setIndexStatus] = useState<string | null>(null)
  /** Catalog browse selection (before / while applying to character) */
  const [catalogPickId, setCatalogPickId] = useState<number | null>(null)
  const [catalogPickTitle, setCatalogPickTitle] = useState<string | null>(null)
  const [catalogPickBody, setCatalogPickBody] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)

  const patch = <K extends keyof FormState>(k: K, v: FormState[K]): void => {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const selectedImage = useMemo(() => {
    if (!form.gallery.length) return null
    return (
      form.gallery.find((g) => g.id === selectedImageId) ?? form.gallery[0]
    )
  }, [form.gallery, selectedImageId])

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    setSelectedImageId(null)
    setAiIdea('')
  }

  const openCreate = (): void => {
    setEditingId(null)
    setForm(emptyForm())
    setSelectedImageId(null)
    setAiIdea('')
    setSwapCostumeText('')
    setSwapBasePath('')
    setSwapPose('hero_front')
    setGalleryLayerFilter('all')
    setNewCostumeName('')
    setEditorPanel('profile')
    setEditorOpen(true)
  }

  const loadSoulPreview = useCallback(
    async (opts: {
      soulMdPath?: string | null
      soulHubId?: number | null
    }): Promise<void> => {
      if (!opts.soulHubId && !opts.soulMdPath?.trim()) {
        setForm((f) => ({ ...f, soulPreview: null }))
        return
      }
      try {
        const r = await getApi().characters.readSoulContent({
          soulMdPath: opts.soulMdPath,
          soulHubId: opts.soulHubId
        })
        setForm((f) => ({
          ...f,
          soulPreview: r.content?.trim() ? r.content : null
        }))
      } catch (e) {
        setForm((f) => ({
          ...f,
          soulPreview: null
        }))
        setActionError(parseIpcError(e).message)
      }
    },
    []
  )

  const openEdit = (c: Character): void => {
    const gallery = galleryFromCharacter(c)
    const style: ArtStyleId = isArtStyleId(c.artStyle)
      ? c.artStyle
      : DEFAULT_ART_STYLE
    let costumes = parseCharacterCostumes(c.costumesJson)
    costumes = ensureCostumeInLibrary(costumes, c.costume, {
      name: 'Default',
      artStyle: style
    })
    setEditingId(c.id)
    setForm({
      name: c.name,
      description: c.description,
      appearance: c.appearance ?? '',
      personality: c.personality ?? '',
      backstory: c.backstory ?? '',
      costume: c.costume ?? '',
      ageRange: c.ageRange ?? '',
      gender: c.gender ?? '',
      voiceDesc: c.voiceDesc ?? '',
      spokenLanguages: parseSpokenLanguagesJson(c.spokenLanguages),
      mannerisms: c.mannerisms ?? '',
      relationships: c.relationships ?? '',
      visualTags: c.visualTags ?? '',
      seedPrompt: c.seedPrompt ?? '',
      soulMdPath: c.soulMdPath,
      soulHubId: c.soulHubId ?? null,
      soulPreview: null,
      gallery,
      coverPath: primaryGalleryPath(gallery, c.refImagePath),
      artStyle: style,
      costumes
    })
    // Prefill improve box with seed / short brief for instant refine
    setAiIdea(c.seedPrompt?.trim() || '')
    const coverId =
      gallery.find((g) => g.path === c.refImagePath)?.id ?? gallery[0]?.id ?? null
    setSelectedImageId(coverId)
    setSwapCostumeText(c.costume ?? '')
    const autoBase = pickBestBaseImage(gallery, { ageRange: c.ageRange })
    setSwapBasePath(autoBase.item?.path ?? '')
    setSwapPose('hero_front')
    setGalleryLayerFilter('all')
    setNewCostumeName('')
    setEditorPanel(gallery.length > 0 ? 'refs' : 'profile')
    setEditorOpen(true)
    // Load full soul.md for user to read
    void loadSoulPreview({
      soulMdPath: c.soulMdPath,
      soulHubId: c.soulHubId ?? null
    })
  }

  const payload = (): Omit<CreateCharacterInput, 'storyId'> => {
    const primary = primaryGalleryPath(form.gallery, form.coverPath)
    const costumes = ensureCostumeInLibrary(form.costumes, form.costume, {
      name: 'Default',
      artStyle: form.artStyle
    })
    return {
      name: form.name.trim(),
      description: form.description.trim() || form.appearance || form.name,
      soulMdPath: form.soulMdPath,
      refImagePath: primary,
      refSheetPath:
        form.gallery.find((g) => g.kind === 'sheet')?.path ?? primary,
      refGalleryJson: serializeCharacterGallery(form.gallery),
      appearance: form.appearance || null,
      personality: form.personality || null,
      backstory: form.backstory || null,
      costume: form.costume || null,
      ageRange: form.ageRange || null,
      gender: form.gender || null,
      voiceDesc: form.voiceDesc || null,
      spokenLanguages: serializeSpokenLanguages(form.spokenLanguages),
      mannerisms: form.mannerisms || null,
      relationships: form.relationships || null,
      visualTags: form.visualTags || null,
      seedPrompt: form.seedPrompt || null,
      soulHubId: form.soulHubId,
      artStyle: form.artStyle,
      costumesJson: costumes.length
        ? serializeCharacterCostumes(costumes)
        : null
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      // Persist soul textarea edits to a local .md so they survive reload
      let nextForm = form
      const soulText = form.soulPreview?.trim() ?? ''
      if (soulText) {
        try {
          const localPath =
            form.soulMdPath &&
            !form.soulMdPath.startsWith('soulmd-hub://') &&
            !form.soulMdPath.startsWith('http')
              ? form.soulMdPath
              : null
          const written = await getApi().characters.writeSoulContent({
            content: form.soulPreview ?? '',
            filePath: localPath,
            characterId: editingId
          })
          nextForm = {
            ...form,
            soulMdPath: written.filePath,
            soulPreview: written.content,
            // Prefer local file on next open (edited text over hub original)
            soulHubId: null
          }
          setForm(nextForm)
          setCatalogPickBody(written.content)
        } catch (e) {
          // Non-fatal: still save character profile without path update
          console.warn('[characters] writeSoulContent failed', e)
        }
      }
      const buildPayload = (): Omit<CreateCharacterInput, 'storyId'> => {
        const primary = primaryGalleryPath(
          nextForm.gallery,
          nextForm.coverPath
        )
        const costumes = ensureCostumeInLibrary(
          nextForm.costumes,
          nextForm.costume,
          {
            name: 'Default',
            artStyle: nextForm.artStyle
          }
        )
        return {
          name: nextForm.name.trim(),
          description:
            nextForm.description.trim() ||
            nextForm.appearance ||
            nextForm.name,
          soulMdPath: nextForm.soulMdPath,
          refImagePath: primary,
          refSheetPath:
            nextForm.gallery.find((g) => g.kind === 'sheet')?.path ?? primary,
          refGalleryJson: serializeCharacterGallery(nextForm.gallery),
          appearance: nextForm.appearance || null,
          personality: nextForm.personality || null,
          backstory: nextForm.backstory || null,
          costume: nextForm.costume || null,
          ageRange: nextForm.ageRange || null,
          gender: nextForm.gender || null,
          voiceDesc: nextForm.voiceDesc || null,
          spokenLanguages: serializeSpokenLanguages(
            nextForm.spokenLanguages
          ),
          mannerisms: nextForm.mannerisms || null,
          relationships: nextForm.relationships || null,
          visualTags: nextForm.visualTags || null,
          seedPrompt: nextForm.seedPrompt || null,
          soulHubId: nextForm.soulHubId,
          artStyle: nextForm.artStyle,
          costumesJson: costumes.length
            ? serializeCharacterCostumes(costumes)
            : null
        }
      }
      if (editingId) {
        const ok = await update(editingId, buildPayload())
        if (ok) {
          toast.success(t('common.saved'))
          await reload()
        } else {
          toast.error(t('common.actionFailed'))
        }
      } else {
        const ok = await create(buildPayload())
        if (ok) {
          toast.success(t('common.saved'))
          await reload()
          const list = (await getApi().characters.list(
            activeStoryId!
          )) as Character[]
          const created = list.find((c) => c.name === nextForm.name.trim())
          if (created) {
            openEdit(created)
          } else {
            closeEditor()
          }
        } else {
          toast.error(t('common.actionFailed'))
        }
      }
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleAiFill = (fromEditor = false): void => {
    const idea = aiIdea.trim() || form.seedPrompt.trim()
    // All profile inputs — button always improves when anything is filled
    const snapshot = {
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      appearance: form.appearance.trim() || undefined,
      personality: form.personality.trim() || undefined,
      backstory: form.backstory.trim() || undefined,
      costume: form.costume.trim() || undefined,
      ageRange: form.ageRange.trim() || undefined,
      gender: form.gender.trim() || undefined,
      voiceDesc: form.voiceDesc.trim() || undefined,
      spokenLanguages:
        form.spokenLanguages.length > 0
          ? form.spokenLanguages
          : undefined,
      mannerisms: form.mannerisms.trim() || undefined,
      relationships: form.relationships.trim() || undefined,
      visualTags: form.visualTags.trim() || undefined
    }
    const hasDraft = Object.values(snapshot).some((v) => {
      if (typeof v === 'string') return v.length > 0
      if (Array.isArray(v)) return v.length > 0
      return false
    })
    const soulContent =
      form.soulPreview?.trim() || catalogPickBody?.trim() || ''
    const hasSoul = soulContent.length > 0
    if (!idea && !hasDraft && !hasSoul) {
      const msg = t('characters.ideaRequired')
      setActionError(msg)
      toast.error(msg)
      return
    }
    if (characterAiBusy(editingId)) {
      toast.info(t('aiJobs.running'))
      return
    }
    setActionError(null)
    // Stay visible: open profile editor so results / progress are obvious
    if (!fromEditor) {
      setEditorOpen(true)
      setEditorPanel('profile')
    } else {
      setEditorPanel('profile')
    }
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))

    const characterId = editingId
    const locale = getAiLocale(i18n.language)
    const isImprove = hasDraft || hasSoul

    startJob({
      kind: 'character-ai-fill',
      label: isImprove
        ? t('characters.aiImproveTitle')
        : t('characters.aiCreate'),
      scope: {
        characterId: characterId ?? undefined,
        storyId: activeStoryId ?? undefined
      },
      run: async ({ setProgress, signal }) => {
        setProgress(15, 'chat')
        // If soul is linked but preview not loaded yet, try fetch once
        let soul = soulContent
        if (
          !soul &&
          (form.soulHubId != null || form.soulMdPath)
        ) {
          try {
            const r = await getApi().characters.readSoulContent({
              soulMdPath: form.soulMdPath,
              soulHubId: form.soulHubId
            })
            soul = r.content?.trim() ?? ''
          } catch {
            // optional — continue without soul
          }
        }
        if (signal.cancelled) return
        setProgress(35, 'merge')
        const r = await getApi().characters.aiFill({
          idea: idea || undefined,
          storyId: activeStoryId ?? undefined,
          locale,
          existingDraft: hasDraft ? snapshot : undefined,
          soulContent: soul || undefined
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        return {
          type: 'character-profile' as const,
          characterId: characterId ?? null,
          storyId: activeStoryId ?? null,
          profile: {
            ...r.profile,
            seedPrompt: idea || r.profile.seedPrompt || r.profile.description
          },
          profileJson: r.profileJson,
          isNew: !characterId
        }
      }
    })
  }

  const ensureSavedId = async (): Promise<string | null> => {
    if (editingId) {
      await update(editingId, payload())
      return editingId
    }
    if (!form.name.trim() || !activeStoryId) return null
    const ok = await create(payload())
    if (!ok) return null
    await reload()
    const list = (await getApi().characters.list(activeStoryId)) as Character[]
    const created = list.find((c) => c.name === form.name.trim())
    if (created) {
      setEditingId(created.id)
      return created.id
    }
    return null
  }

  const applyCostumeLook = (entry: CharacterCostumeEntry): void => {
    setForm((f) => ({
      ...f,
      costume: entry.description,
      artStyle: isArtStyleId(entry.artStyle)
        ? entry.artStyle
        : f.artStyle
    }))
    setSwapCostumeText(entry.description)
    if (entry.imagePath) {
      const hit = form.gallery.find((g) => g.path === entry.imagePath)
      if (hit) setSelectedImageId(hit.id)
    }
    setPageBanner(t('characters.costumeApplied', { name: entry.name })); toast.success(t('characters.costumeApplied', { name: entry.name }))
  }

  const handleAddCostumeToLibrary = (): void => {
    const description = (
      swapCostumeText.trim() ||
      form.costume.trim()
    )
    if (!description) {
      setActionError(t('characters.swapCostumeRequired'))
      return
    }
    try {
      const entry = createCostumeEntry({
        name: newCostumeName.trim() || undefined,
        description,
        artStyle: form.artStyle
      })
      setForm((f) => ({
        ...f,
        costume: description,
        costumes: upsertCostume(f.costumes, entry)
      }))
      setSwapCostumeText(description)
      setNewCostumeName('')
      setPageBanner(t('characters.costumeLibSaved')); toast.success(t('characters.costumeLibSaved'))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleRemoveCostumeLook = (id: string): void => {
    setForm((f) => ({ ...f, costumes: removeCostume(f.costumes, id) }))
  }

  // Default plot context to active story when editor opens costume tab
  useEffect(() => {
    if (activeStoryId && !plotStoryId) setPlotStoryId(activeStoryId)
  }, [activeStoryId, plotStoryId])

  const handleSuggestWardrobe = (): void => {
    setActionError(null)
    if (!form.name.trim()) {
      setActionError(t('characters.suggestNeedName'))
      return
    }
    if (characterAiBusy(editingId)) return
    const storyId = plotStoryId || activeStoryId || undefined
    setPageBanner(t('aiJobs.startedBackground')); toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'wardrobe-suggest',
      label: t('characters.suggestWardrobe'),
      scope: {
        characterId: editingId ?? undefined,
        storyId
      },
      run: async ({ setProgress, signal }) => {
        setProgress(15, 'llm')
        let soulExcerpt = form.soulPreview?.trim() || ''
        if (
          !soulExcerpt &&
          (form.soulHubId != null || form.soulMdPath)
        ) {
          try {
            const sr = await getApi().characters.readSoulContent({
              soulMdPath: form.soulMdPath,
              soulHubId: form.soulHubId
            })
            soulExcerpt = sr.content?.trim() ?? ''
          } catch {
            /* optional */
          }
        }
        if (signal.cancelled) return
        const r = await getApi().characters.suggestWardrobe({
          characterId: editingId ?? undefined,
          storyId,
          segmentKey: storyId ? plotSegmentKey : undefined,
          locale: getAiLocale(i18n.language),
          name: form.name,
          appearance: form.appearance,
          costume: form.costume,
          ageRange: form.ageRange,
          gender: form.gender,
          description: form.description || undefined,
          personality: form.personality || undefined,
          visualTags: form.visualTags || undefined,
          mannerisms: form.mannerisms || undefined,
          soulExcerpt: soulExcerpt || undefined,
          userRequest: aiIdea.trim() || undefined,
          existingCostumeNames: form.costumes.map((c) => c.name)
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        return {
          type: 'wardrobe-suggest' as const,
          characterId: editingId,
          storyId: storyId ?? null,
          suggestion: r.suggestion
        }
      }
    })
  }

  const handleSwapCostume = async (): Promise<void> => {
    setActionError(null)
    try {
      let id = editingId
      if (!id) {
        id = await ensureSavedId()
      }
      if (!id) {
        setActionError(t('characters.saveFirstForSheet'))
        return
      }
      if (characterAiBusy(id)) return

      const costumeDescription = swapCostumeText.trim() || form.costume.trim()
      if (!costumeDescription) {
        setActionError(t('characters.swapCostumeRequired'))
        return
      }

      const externalBase =
        useExternalRef
          ? pickExternalRefPath(form.gallery, {
              selectedId: selectedImageId
            })
          : null
      const auto = pickBestBaseImage(form.gallery, {
        ageRange: form.ageRange,
        preferredPath:
          swapBasePath || externalBase || selectedImage?.path || null
      })
      if (!auto.item) {
        setActionError(t('characters.swapCostumeNoBase'))
        return
      }

      const characterId = id
      const baseImagePath = auto.item.path
      const artStyle = form.artStyle
      setPageBanner(t('aiJobs.startedBackground')); toast.info(t('aiJobs.startedBackground'))

      startJob({
        kind: 'costume-swap',
        label: t('characters.swapCostume'),
        scope: {
          characterId,
          storyId: activeStoryId ?? undefined
        },
        run: async ({ setProgress, signal }) => {
          setProgress(10, 'edit')
          const r = await getApi().characters.swapCostume({
            characterId,
            costumeDescription,
            baseImagePath,
            artStyle,
            pose: swapPose,
            persist: false
          })
          if (signal.cancelled) {
            try {
              await getApi().media.discardSheetDraft(r.path)
            } catch {
              /* ignore */
            }
            return
          }
          setProgress(100, 'done')
          return {
            type: 'character-sheet' as const,
            characterId,
            storyId: activeStoryId ?? '',
            path: r.path,
            variant: r.variant ?? 'costume_swap',
            label: r.label ?? t('characters.swapCostume'),
            layer: r.layer ?? 'costume',
            costumeDescription,
            enhance: r.enhance
          }
        }
      })
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    }
  }

  /**
   * When true, AI image/video gens may image_edit from external refs (uploads).
   * User can turn off for pure invent.
   */
  const [useExternalRef, setUseExternalRef] = useState(true)
  /** Legacy name kept for thumbnail re-gen identity lock on any selected still. */
  const [useIdentityRef, setUseIdentityRef] = useState(false)

  const externalRefs = useMemo(
    () => listExternalRefs(form.gallery),
    [form.gallery]
  )

  const handleGenerateSheet = async (opts?: {
    characterId?: string
    referenceImagePath?: string | null
    /** When true, image_edit with ref (thumbnail re-gen). Default: false = new layout. */
    useIdentityEdit?: boolean
    /** Override external-ref preference for this call */
    useExternalRef?: boolean
    artStyle?: ArtStyleId
  }): Promise<void> => {
    setActionError(null)
    try {
      let id = opts?.characterId ?? null
      if (!id) {
        id = await ensureSavedId()
      }
      if (!id) {
        setActionError(t('characters.saveFirstForSheet'))
        return
      }
      if (characterAiBusy(id)) return

      // Pure generate unless identity lock / external ref is on.
      // Never auto-edit from gallery[0] alone — that clones the first sheet layout.
      // Body / base / bare packages: ALWAYS pure generate. image_edit on a clothed
      // or old sheet almost always returns the same old composition.
      const variant = sheetVariant
      const variantDef = getSheetVariant(variant)
      const forcePureLayout =
        variantDef.wardrobeLayer === 'nude' ||
        variantDef.wardrobeLayer === 'base' ||
        Boolean(variantDef.requiresUnclothedSupport)
      const wantIdentity =
        opts?.useIdentityEdit !== undefined
          ? opts.useIdentityEdit === true
          : useIdentityRef
      const wantExternal =
        opts?.useExternalRef !== undefined
          ? opts.useExternalRef
          : useExternalRef
      const externalPath =
        wantExternal && !forcePureLayout
          ? pickExternalRefPath(form.gallery, {
              selectedId: selectedImageId,
              preferredPath: opts?.referenceImagePath
            })
          : null
      const useIdentityEdit =
        !forcePureLayout &&
        (wantIdentity || Boolean(externalPath))
      if (forcePureLayout && (useIdentityRef || useExternalRef)) {
        // Keep UI honest: bare/body/base never use identity-edit clone path.
        if (useIdentityRef) setUseIdentityRef(false)
      }
      const preferredRef = useIdentityEdit
        ? (opts?.referenceImagePath ??
            externalPath ??
            (wantIdentity ? selectedImage?.path ?? null : null))
        : null
      const artStyle = opts?.artStyle ?? form.artStyle
      const characterId = id
      // Single toast only (avoid duplicate top-right alerts).
      toast.info(
        forcePureLayout
          ? t('characters.forcePureGenHint')
          : preferredRef
            ? t('characters.genWithExternalRef')
            : t('aiJobs.startedBackground')
      )

      startJob({
        kind: 'character-sheet',
        label: t('characters.generateSheet'),
        scope: {
          characterId,
          storyId: activeStoryId ?? undefined
        },
        run: async ({ setProgress, signal }) => {
          setProgress(10, 'image')
          const r = await getApi().characters.generateSheet({
            characterId,
            variant,
            referenceImagePath: preferredRef,
            useIdentityEdit: Boolean(useIdentityEdit && preferredRef),
            persist: false,
            artStyle
          })
          if (signal.cancelled) {
            try {
              await getApi().media.discardSheetDraft(r.path)
            } catch {
              /* ignore */
            }
            return
          }
          setProgress(100, 'done')
          return {
            type: 'character-sheet' as const,
            characterId,
            storyId: activeStoryId ?? '',
            path: r.path,
            variant: r.variant ?? variant,
            label: r.label ?? variant,
            usedEdit: r.usedEdit,
            enhance: r.enhance,
            layer: (r as { layer?: string }).layer
          }
        }
      })
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    }
  }

  /** Animate the selected still into a self-intro video using profile bible. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    if (!editingId) {
      setActionError(t('characters.saveBeforeSheet'))
      toast.error(t('characters.saveBeforeSheet'))
      return
    }
    if (!sourceImagePath?.trim()) {
      setActionError(t('characters.introVideoNeedImage'))
      return
    }
    if (characterAiBusy(editingId)) return
    setActionError(null)
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    const characterId = editingId
    const sourcePath = sourceImagePath.trim()
    startJob({
      kind: 'character-intro-video',
      label: t('characters.introVideoJob'),
      scope: {
        characterId,
        storyId: activeStoryId ?? undefined
      },
      run: async ({ setProgress, signal }) => {
        setProgress(10, 'start')
        // Persist profile first so video prompt uses full 人設 + soul
        await update(characterId, payload())
        if (signal.cancelled) return
        setProgress(25, 'llm')
        const r = await getApi().characters.generateIntroVideo({
          characterId,
          sourceImagePath: sourcePath,
          durationSeconds: 10,
          locale: getAiLocale(i18n.language)
        })
        if (signal.cancelled) return
        setProgress(90, 'generate')
        setProgress(100, 'done')
        const g = (r.gallery ?? []).map((item) => ({
          id: item.id,
          path: item.path,
          kind: item.kind as 'sheet' | 'upload' | 'gen',
          label: item.label,
          createdAt: item.createdAt,
          introVideoPath: item.introVideoPath ?? null
        }))
        setForm((f) =>
          editingId === characterId
            ? {
                ...f,
                gallery: g.length > 0 ? g : f.gallery
              }
            : f
        )
        // Do not auto-open player — user presses「播放介紹片」to watch in-app.
        toast.success(t('characters.introVideoOk'))
        return undefined
      }
    })
  }

  /** Import a still from disk as an external AI reference. */
  const handlePickExternalRef = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'external',
      label: t('characters.externalRefLabel')
    })
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath: f.coverPath ?? next[0]?.path ?? null
    }))
    setSelectedImageId(next[0]?.id ?? null)
    setUseExternalRef(true)
    toast.success(t('characters.externalRefAdded'))
  }

  const handlePickImage = async (): Promise<void> => {
    await handlePickExternalRef()
  }

  const handleReorderGallery = (fromId: string, toId: string): void => {
    if (!fromId || !toId || fromId === toId) return
    setForm((f) => {
      const next = moveGalleryItem(f.gallery, fromId, toId)
      return next === f.gallery ? f : { ...f, gallery: next }
    })
  }

  const handleRemoveImage = (id: string): void => {
    const removed = form.gallery.find((g) => g.id === id)
    const next = removeGalleryItem(form.gallery, id)
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath:
        removed && f.coverPath === removed.path
          ? primaryGalleryPath(next)
          : isGalleryCoverPath(next, f.coverPath)
            ? f.coverPath
            : primaryGalleryPath(next)
    }))
    setSelectedImageId(next[0]?.id ?? null)
  }

  const handleSetCover = (path: string): void => {
    setForm((f) => ({ ...f, coverPath: path }))
    toast.success(t('common.coverSet'))
  }

  const loadHubPage = useCallback(
    async (page: number, q?: string): Promise<void> => {
      setBusy(true)
      setActionError(null)
      try {
        if (q?.trim()) {
          const local = await getApi().souls.searchLocal(q.trim(), 24)
          if (local.items.length > 0) {
            setHubItems(local.items)
            setHubTotalPages(1)
            setHubPage(1)
          } else {
            const remote = await getApi().souls.list({
              page: 1,
              limit: 12,
              q: q.trim()
            })
            setHubItems(remote.data ?? [])
            setHubTotalPages(remote.total_pages ?? 1)
            setHubPage(1)
          }
        } else {
          const remote = await getApi().souls.list({ page, limit: 12 })
          setHubItems(remote.data ?? [])
          setHubTotalPages(remote.total_pages ?? 1)
          setHubPage(remote.current_page ?? page)
        }
      } catch (e) {
        setActionError(parseIpcError(e).message)
      } finally {
        setBusy(false)
      }
    },
    []
  )

  const ensureSoulIndex = useCallback(async (): Promise<void> => {
    try {
      const r = await getApi().souls.ensureIndex(false)
      setIndexStatus(
        t('characters.indexReady', {
          count: r.count,
          pages: r.pages,
          cache: r.fromCache ? 'cache' : 'fresh'
        })
      )
      setSuggestions(r.suggestions)
    } catch {
      /* offline ok */
    }
  }, [t])

  // Load Soul catalog when editing profile
  useEffect(() => {
    if (!editorOpen || editorPanel !== 'profile') return
    if (hubItems.length === 0) void loadHubPage(1)
    void ensureSoulIndex()
  }, [editorOpen, editorPanel, hubItems.length, loadHubPage, ensureSoulIndex])

  // Load global costumes when costume tab open
  useEffect(() => {
    if (!editorOpen || editorPanel !== 'costume') return
    void getApi()
      .costumes.list()
      .then((list) => {
        setAllGlobalCostumes(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description
          }))
        )
      })
      .catch(() => undefined)
    if (editingId) {
      void getApi()
        .costumes.listForCharacter(editingId)
        .then(setLinkedGlobalCostumes)
        .catch(() => setLinkedGlobalCostumes([]))
    } else {
      setLinkedGlobalCostumes([])
    }
  }, [editorOpen, editorPanel, editingId])

  const previewSoulFromCatalog = async (
    id: number,
    titleHint?: string
  ): Promise<void> => {
    setCatalogPickId(id)
    setCatalogPickTitle(titleHint ?? null)
    setCatalogLoading(true)
    setActionError(null)
    try {
      const detail = await getApi().souls.get(id)
      const full = (detail.contentFlat ?? '').trim()
      setCatalogPickTitle(detail.title || titleHint || `#${id}`)
      // Prefer canonical reader for long souls
      const r = await getApi().characters.readSoulContent({
        soulHubId: id,
        soulMdPath: `soulmd-hub://${id}`
      })
      const body = (r.content?.trim() || full || '').trim()
      setCatalogPickBody(body || null)
      // Keep form.soulPreview in sync so AI fill / save can use the text
      // without requiring "use soul" first when user is just browsing + editing.
      if (body) {
        setForm((f) => ({
          ...f,
          soulPreview:
            f.soulHubId === id || !f.soulPreview?.trim()
              ? body
              : f.soulPreview
        }))
      }
    } catch (e) {
      setActionError(parseIpcError(e).message)
      setCatalogPickBody(null)
    } finally {
      setCatalogLoading(false)
    }
  }

  const applySoulFromHub = async (
    id: number,
    _opts?: { stayInEditor?: boolean }
  ): Promise<void> => {
    setBusy(true)
    try {
      const detail = await getApi().souls.get(id)
      let full = (detail.contentFlat ?? '').trim()
      try {
        const r = await getApi().characters.readSoulContent({
          soulHubId: id,
          soulMdPath: `soulmd-hub://${id}`
        })
        if (r.content?.trim()) full = r.content
      } catch {
        /* use detail flat */
      }
      setForm((f) => ({
        ...f,
        soulHubId: detail.id,
        soulMdPath: `soulmd-hub://${detail.id}`,
        name: f.name.trim() ? f.name : detail.title,
        description: f.description.trim()
          ? f.description
          : detail.description || f.description,
        soulPreview: full || null,
        seedPrompt: f.seedPrompt || detail.title
      }))
      setCatalogPickId(detail.id)
      setCatalogPickTitle(detail.title)
      setCatalogPickBody(full || null)
      setEditorOpen(true)
      setEditorPanel('profile')
      setPageBanner(t('characters.soulApplied', { title: detail.title })); toast.success(t('characters.soulApplied', { title: detail.title }))
    } catch (e) {
      setActionError(parseIpcError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const handleImportSoul = async (): Promise<void> => {
    const result = await getApi().characters.importSoulMd()
    if (!result) return
    const doc = parseSoulMd(result.content)
    setForm((f) => ({
      ...f,
      soulMdPath: result.filePath,
      soulHubId: null,
      soulPreview: result.content,
      description:
        f.description.trim() ||
        extractDescriptionFromSoulMd(result.content) ||
        f.description,
      name:
        f.name.trim() ||
        doc.title ||
        extractNameFromSoulMd(result.content) ||
        f.name
    }))
    setCatalogPickId(null)
    setCatalogPickTitle(doc.title ?? extractNameFromSoulMd(result.content))
    setCatalogPickBody(result.content)
  }

  const clearSoulLink = (): void => {
    setForm((f) => ({
      ...f,
      soulMdPath: null,
      soulHubId: null,
      soulPreview: null
    }))
    setCatalogPickId(null)
    setCatalogPickTitle(null)
    setCatalogPickBody(null)
  }

  const handleGenerateSoul = (): void => {
    setActionError(null)
    const hasSource = Boolean(
      form.name.trim() ||
        form.description.trim() ||
        form.appearance.trim() ||
        form.personality.trim() ||
        form.costume.trim() ||
        form.backstory.trim() ||
        form.soulPreview?.trim()
    )
    if (!hasSource) {
      const msg = t('characters.generateSoulNeedProfile')
      setActionError(msg)
      toast.error(msg)
      return
    }
    if (characterAiBusy(editingId)) {
      toast.info(t('aiJobs.running'))
      return
    }
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    // Use a real AiJobKind; apply Soul directly — do NOT return a half-empty
    // character-profile draft (that overwrote fields on accept).
    startJob({
      kind: 'character-ai-fill',
      label: t('characters.generateSoul'),
      scope: {
        characterId: editingId ?? undefined,
        storyId: activeStoryId ?? undefined
      },
      run: async ({ setProgress, signal }) => {
        setProgress(20, 'llm')
        let existingSoul = form.soulPreview?.trim() || ''
        if (
          !existingSoul &&
          (form.soulHubId != null || form.soulMdPath)
        ) {
          try {
            const sr = await getApi().characters.readSoulContent({
              soulMdPath: form.soulMdPath,
              soulHubId: form.soulHubId
            })
            existingSoul = sr.content?.trim() ?? ''
          } catch {
            /* optional */
          }
        }
        if (signal.cancelled) return
        const r = await getApi().characters.generateSoul({
          storyId: activeStoryId ?? undefined,
          locale: getAiLocale(i18n.language),
          existingSoul: existingSoul || undefined,
          userRequest: aiIdea.trim() || undefined,
          profile: {
            name: form.name,
            description: form.description,
            appearance: form.appearance,
            personality: form.personality,
            spokenLanguages: form.spokenLanguages,
            backstory: form.backstory,
            costume: form.costume,
            ageRange: form.ageRange,
            gender: form.gender,
            voiceDesc: form.voiceDesc,
            mannerisms: form.mannerisms,
            relationships: form.relationships,
            visualTags: form.visualTags
          }
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        setForm((f) => ({
          ...f,
          soulHubId: null,
          soulMdPath: r.filePath,
          soulPreview: r.content
        }))
        setCatalogPickId(null)
        setCatalogPickTitle(r.title)
        setCatalogPickBody(r.content)
        setPageBanner(t('characters.generateSoulOk', { title: r.title }))
        toast.success(t('characters.generateSoulOk', { title: r.title }))
        // No draft — soul already applied to the open form
      }
    })
  }



  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('characters.title')}
        subtitle={t('characters.subtitle')}
        actions={
          <Button onClick={openCreate}>{t('characters.new')}</Button>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {(error || actionError) && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {error?.message ?? actionError}
          </div>
        )}
        {pageBanner && (
          <div className="mb-4 rounded-xl border border-brand-800/40 bg-brand-950/50 px-4 py-3 text-sm text-brand-100">
            {pageBanner}
            <button
              type="button"
              className="ml-3 text-xs text-brand-300 underline"
              onClick={() => setPageBanner(null)}
            >
              {t('common.dismissOk')}
            </button>
          </div>
        )}

        {/* Character library only — Soul / AI live inside the editor */}
        {!editorOpen && (
          <LibraryPageBody
            footer={
              !loading && items.length > 0 ? (
                <LibraryPagination
                  page={charBrowse.page}
                  totalPages={charBrowse.totalPages}
                  onPageChange={charBrowse.setPage}
                  filteredCount={charBrowse.filteredCount}
                  totalCount={charBrowse.totalCount}
                />
              ) : undefined
            }
          >
            {loading ? (
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            ) : items.length === 0 ? (
              <div className="mx-auto max-w-md py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-2xl">
                  🎭
                </div>
                <p className="text-ink-300">{t('characters.noCharacters')}</p>
                <div className="mt-6 flex justify-center">
                  <Button onClick={openCreate}>{t('characters.new')}</Button>
                </div>
              </div>
            ) : (
              <>
                <LibraryBrowseBar
                  q={charBrowse.q}
                  onQueryChange={charBrowse.setQ}
                  placeholder={t('library.searchPlaceholder')}
                  hasActiveFilters={charHasFilters}
                  onClearFilters={clearCharFilters}
                  filters={
                    <>
                      <LibraryFilterSelect
                        label={t('library.filterGender')}
                        ariaLabel={t('library.filterGender')}
                        value={charGender}
                        onChange={setCharGender}
                        options={charGenderOptions}
                      />
                      <LibraryFilterSelect
                        label={t('library.filterArtStyle')}
                        ariaLabel={t('library.filterArtStyle')}
                        value={charArtStyle}
                        onChange={setCharArtStyle}
                        options={charArtOptions}
                      />
                      <LibraryFilterSelect
                        label={t('library.filterImage')}
                        ariaLabel={t('library.filterImage')}
                        value={charImage}
                        onChange={setCharImage}
                        options={[
                          { value: '', label: t('library.filterAny') },
                          {
                            value: 'has',
                            label: t('library.filterHasImage')
                          },
                          {
                            value: 'none',
                            label: t('library.filterNoImage')
                          }
                        ]}
                      />
                      <LibraryFilterSelect
                        label={t('library.filterSoul')}
                        ariaLabel={t('library.filterSoul')}
                        value={charSoul}
                        onChange={setCharSoul}
                        options={[
                          { value: '', label: t('library.filterAny') },
                          {
                            value: 'has',
                            label: t('library.filterHasSoul')
                          },
                          {
                            value: 'none',
                            label: t('library.filterNoSoul')
                          }
                        ]}
                      />
                      <LibraryFilterSelect
                        label={t('library.filterLanguage')}
                        ariaLabel={t('library.filterLanguage')}
                        value={charLang}
                        onChange={setCharLang}
                        options={charLangOptions}
                      />
                    </>
                  }
                />
                {charBrowse.filteredCount === 0 ? (
                  <EmptyState message={t('library.noMatch')} />
                ) : (
                  <div className={libraryGridClass}>
                    {charBrowse.pageItems.map((c) => {
                      const cover = coverPath(c)
                      const count = galleryFromCharacter(c).length
                      return (
                        <article key={c.id} className={libraryCardClass}>
                          <div className={libraryMediaClass}>
                            {cover ? (
                              <LocalMediaImage
                                filePath={cover}
                                alt={c.name}
                                maxHeightClass="h-full max-h-none"
                                objectFit="cover"
                                className="h-full border-0 rounded-none"
                                actionsLayout="overlay"
                                regenerateBusy={characterAiBusy(c.id)}
                                onImageClick={() => openEdit(c)}
                                onRegenerate={() =>
                                  void handleGenerateSheet({
                                    characterId: c.id,
                                    // Pure generate by default so package layout can change;
                                    // only lock identity when user opted in via checkbox.
                                    ...(useIdentityRef
                                      ? {
                                          referenceImagePath: cover,
                                          useIdentityEdit: true
                                        }
                                      : { useIdentityEdit: false }),
                                    artStyle: isArtStyleId(c.artStyle)
                                      ? c.artStyle
                                      : DEFAULT_ART_STYLE
                                  })
                                }
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-600"
                                onClick={() => openEdit(c)}
                              >
                                <span className="text-3xl opacity-40">👤</span>
                                <span className="text-xs">
                                  {t('characters.refMissingBadge')}
                                </span>
                              </button>
                            )}
                            {count > 0 && (
                              <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-ink-100 backdrop-blur">
                                {count} {t('characters.photos')}
                              </span>
                            )}
                          </div>
                          <div className={libraryBodyClass}>
                            <h2 className="truncate text-base font-semibold tracking-tight text-ink-50">
                              {c.name}
                            </h2>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                              {c.description}
                            </p>
                            <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center justify-center gap-1">
                              {c.ageRange && <Chip>{c.ageRange}</Chip>}
                              {c.gender && <Chip>{c.gender}</Chip>}
                              {(() => {
                                const langs = parseSpokenLanguagesJson(
                                  c.spokenLanguages
                                )
                                if (!langs.length) return null
                                return (
                                  <Chip>
                                    🗣{' '}
                                    {formatSpokenLanguagesDisplay(
                                      langs,
                                      i18n.language
                                    )}
                                  </Chip>
                                )
                              })()}
                              {c.voiceDesc && (
                                <Chip>🎙 {t('characters.voiceShort')}</Chip>
                              )}
                            </div>
                            <div className="mt-auto flex items-center gap-2 pt-4">
                              <Button
                                variant="secondary"
                                className="min-w-0 flex-1 !py-1.5 text-xs"
                                onClick={() => openEdit(c)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                className="min-w-0 flex-1 !py-1.5 text-xs text-rose-300"
                                onClick={() => {
                                  void (async () => {
                                    const ok = await dialog.confirm({
                                      message: t('common.confirmDelete'),
                                      variant: 'danger'
                                    })
                                    if (ok) void removeWithFeedback(c.id)
                                  })()
                                }}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </LibraryPageBody>
        )}

        {/* ─── Editor (wide shell + tabs) ─── */}
        {editorOpen && (
          <EditorShell
            open={editorOpen}
            title={editingId ? t('common.edit') : t('characters.new')}
            subtitle={
              form.name.trim()
                ? form.name
                : t('characters.editorHintShort')
            }
            onClose={closeEditor}
            onSave={() => void handleSave()}
            saveDisabled={!form.name.trim()}
            saveLabel={busy ? t('common.saving') : t('common.save')}
            cancelLabel={t('common.cancel')}
            busy={busy || editorAiBusy}
            tabs={[
              { id: 'profile', label: t('characters.tabProfile') },
              { id: 'refs', label: t('characters.tabRefs') },
              { id: 'costume', label: t('characters.tabCostume') }
            ]}
            activeTab={editorPanel}
            onTabChange={(id) => setEditorPanel(id as EditorPanel)}
            preview={
              <div className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('characters.gallery')}
                  </h3>
                  <span className="text-[11px] text-ink-500">
                    {filteredGallery.length}/{form.gallery.length}
                  </span>
                </div>
                {form.gallery.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        'all',
                        'identity',
                        'nude',
                        'base',
                        'costume',
                        'detail'
                      ] as const
                    ).map((layer) => {
                      if (layer === 'nude' && isMinor) return null
                      return (
                        <button
                          key={layer}
                          type="button"
                          className={[
                            'rounded-full px-2 py-0.5 text-[10px] font-medium transition',
                            galleryLayerFilter === layer
                              ? 'bg-brand-600 text-white'
                              : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                          ].join(' ')}
                          onClick={() => setGalleryLayerFilter(layer)}
                        >
                          {t(`characters.layerFilter_${layer}`)}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="rounded-xl border border-ink-800 bg-ink-900/60">
                  {selectedImage ? (
                    <LocalMediaImage
                      filePath={selectedImage.path}
                      alt={translateCharacterGalleryLabel(
                        selectedImage.label,
                        t
                      )}
                      maxHeightClass="max-h-[min(36vh,420px)] lg:max-h-[min(48vh,520px)]"
                      showMeta
                      className="border-0 rounded-xl"
                      actionsLayout="bar"
                      regenerateBusy={editorAiBusy}
                      introVideoBusy={editorAiBusy}
                      introVideoPath={selectedImage.introVideoPath}
                      onIntroVideo={
                        editingId
                          ? () =>
                              handleGenerateIntroVideo(selectedImage.path)
                          : undefined
                      }
                      onRegenerate={() =>
                        void handleGenerateSheet({
                          characterId: editingId ?? undefined,
                          ...(useIdentityRef
                            ? {
                                referenceImagePath: selectedImage.path,
                                useIdentityEdit: true
                              }
                            : { useIdentityEdit: false })
                        })
                      }
                    />
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 px-4 text-center text-ink-500">
                      <span className="text-3xl opacity-30">🖼</span>
                      <p className="text-xs">{t('characters.noPhotos')}</p>
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          disabled={editorAiBusy}
                          onClick={() => void handlePickExternalRef()}
                        >
                          {t('characters.addExternalRef')}
                        </Button>
                        <Button
                          disabled={editorAiBusy}
                          onClick={() => {
                            setEditorPanel('refs')
                            void handleGenerateSheet()
                          }}
                        >
                          {t('characters.generateSheet')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <GalleryThumbStrip
                  items={filteredGallery}
                  selectedId={selectedImageId}
                  coverPath={form.coverPath}
                  fallbackCoverPath={primaryGalleryPath(form.gallery)}
                  onSelect={setSelectedImageId}
                  onReorder={handleReorderGallery}
                  labelOf={(g) =>
                    translateCharacterGalleryLabel(g.label, t)
                  }
                />
              </div>
            }
          >
            {/* ── Profile ── */}
            {editorPanel === 'profile' && (
              <div className={editorFormClass}>
                {actionError && (
                  <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                    {actionError}
                  </div>
                )}
                <section className="rounded-xl border border-brand-800/35 bg-gradient-to-br from-brand-950/40 via-ink-900/50 to-ink-950 p-4">
                  <h3 className="text-sm font-semibold text-brand-100">
                    {editingId
                      ? t('characters.aiImproveTitle')
                      : t('characters.aiCreate')}
                  </h3>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {editingId
                      ? t('characters.aiImproveHintShort')
                      : t('characters.aiCreateHintShort')}
                  </p>
                  <Textarea
                    className="mt-3"
                    size="md"
                    value={aiIdea}
                    onChange={(e) => setAiIdea(e.target.value)}
                    placeholder={
                      editingId
                        ? t('characters.improvePlaceholder')
                        : t('characters.ideaPlaceholder')
                    }
                  />
                  <Button
                    className="mt-3 w-full sm:w-auto"
                    disabled={editorAiBusy}
                    loading={editorAiBusy}
                    onClick={() => handleAiFill(true)}
                  >
                    {editorAiBusy
                      ? t('common.generating')
                      : editingId
                        ? t('characters.runMasterPromptImprove')
                        : t('characters.runMasterPrompt')}
                  </Button>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink-200">
                    {t('characters.profileSection')}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('characters.name')}>
                      <Input
                        value={form.name}
                        onChange={(e) => patch('name', e.target.value)}
                        placeholder={t('characters.namePlaceholder')}
                      />
                    </Field>
                    <Field label={t('characters.ageRange')}>
                      <Input
                        value={form.ageRange}
                        onChange={(e) => patch('ageRange', e.target.value)}
                        placeholder={t('characters.agePlaceholder')}
                      />
                    </Field>
                    <Field label={t('characters.gender')}>
                      <Input
                        value={form.gender}
                        onChange={(e) => patch('gender', e.target.value)}
                        placeholder={t('characters.genderPlaceholder')}
                      />
                    </Field>
                    <Field label={t('characters.visualTags')}>
                      <Input
                        value={form.visualTags}
                        onChange={(e) => patch('visualTags', e.target.value)}
                        placeholder={t('characters.visualTagsPlaceholder')}
                      />
                    </Field>
                  </div>
                  <Field label={t('characters.description')}>
                    <Textarea
                      size="md"
                      value={form.description}
                      onChange={(e) => patch('description', e.target.value)}
                    />
                  </Field>
                  <Field label={t('characters.appearance')}>
                    <Textarea
                      size="lg"
                      value={form.appearance}
                      onChange={(e) => patch('appearance', e.target.value)}
                      placeholder={t('characters.appearancePlaceholder')}
                    />
                  </Field>
                  <Field label={t('characters.costume')}>
                    <Textarea
                      size="lg"
                      value={form.costume}
                      onChange={(e) => patch('costume', e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('characters.personality')}>
                      <Textarea
                        size="md"
                        value={form.personality}
                        onChange={(e) => patch('personality', e.target.value)}
                      />
                    </Field>
                    <Field label={t('characters.backstory')}>
                      <Textarea
                        size="md"
                        value={form.backstory}
                        onChange={(e) => patch('backstory', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label={t('characters.voiceDesc')}>
                    <Textarea
                      size="md"
                      value={form.voiceDesc}
                      onChange={(e) => patch('voiceDesc', e.target.value)}
                      placeholder={t('characters.voicePlaceholder')}
                    />
                  </Field>
                  <Field label={t('characters.spokenLanguages')}>
                    <LanguageMultiPick
                      value={form.spokenLanguages}
                      onChange={(codes) =>
                        setForm((f) => ({ ...f, spokenLanguages: codes }))
                      }
                    />
                  </Field>
                  <Field label={t('characters.mannerisms')}>
                    <Textarea
                      size="md"
                      value={form.mannerisms}
                      onChange={(e) => patch('mannerisms', e.target.value)}
                      placeholder={t('characters.mannerismsPlaceholder')}
                    />
                  </Field>
                  <Field label={t('characters.relationships')}>
                    <Textarea
                      size="md"
                      value={form.relationships}
                      onChange={(e) => patch('relationships', e.target.value)}
                    />
                  </Field>
                </section>

                {/* Soul 目錄 — browse + full content (same catalog as Hub tab) */}
                <section className="rounded-xl border border-ink-700 bg-ink-900/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink-100">
                        {t('characters.soulHub')}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {t('characters.soulEditorHint')}
                      </p>
                      {indexStatus && (
                        <p className="mt-1 text-[10px] text-brand-300/90">
                          {indexStatus}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="ghost"
                        className="!py-1 text-xs"
                        onClick={() =>
                          void getApi().shell.openExternal(
                            'https://soulmd-hub.ysk.hk'
                          )
                        }
                      >
                        {t('characters.openHub')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="!py-1 text-xs"
                        onClick={() => void handleImportSoul()}
                      >
                        {t('characters.importSoul')}
                      </Button>
                      <Button
                        className="!py-1 text-xs"
                        disabled={editorAiBusy}
                        onClick={() => handleGenerateSoul()}
                        title={t('characters.generateSoulHint')}
                      >
                        {editorAiBusy
                          ? t('common.generating')
                          : t('characters.generateSoul')}
                      </Button>
                    </div>
                  </div>

                  {(form.soulHubId != null || form.soulMdPath) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-800/40 bg-brand-950/25 px-3 py-2 text-[11px]">
                      <span className="font-medium text-brand-200">
                        {t('characters.soulLinked')}
                      </span>
                      <span className="min-w-0 truncate text-ink-300">
                        {form.soulHubId != null
                          ? t('characters.soulHubIdLabel', {
                              id: form.soulHubId
                            })
                          : form.soulMdPath}
                      </span>
                      <Button
                        variant="ghost"
                        className="!py-0.5 !text-xs"
                        disabled={busy}
                        onClick={() =>
                          void loadSoulPreview({
                            soulMdPath: form.soulMdPath,
                            soulHubId: form.soulHubId
                          })
                        }
                      >
                        {t('characters.reloadSoul')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="!py-0.5 !text-xs text-rose-300"
                        onClick={clearSoulLink}
                      >
                        {t('characters.soulClear')}
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Input
                      value={hubQ}
                      onChange={(e) => setHubQ(e.target.value)}
                      placeholder={t('characters.soulSearch')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void loadHubPage(1, hubQ)
                      }}
                    />
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void loadHubPage(1, hubQ)}
                    >
                      {t('common.refresh')}
                    </Button>
                  </div>

                  {suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestions.slice(0, 16).map((s) => (
                        <button
                          key={`${s.kind}-${s.label}`}
                          type="button"
                          className="rounded-full border border-ink-700 bg-ink-950/80 px-2.5 py-0.5 text-[10px] text-ink-300 transition hover:border-brand-600/50 hover:text-brand-200"
                          onClick={() => {
                            setHubQ(s.label)
                            void loadHubPage(1, s.label)
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {/* Directory list */}
                    <div className="flex min-h-0 flex-col rounded-lg border border-ink-800 bg-ink-950/50">
                      <div className="border-b border-ink-800 px-3 py-2 text-[11px] font-medium text-ink-400">
                        {t('characters.soulCatalogList')}
                      </div>
                      <ul className="max-h-56 min-h-[8rem] flex-1 overflow-y-auto">
                        {hubItems.length === 0 ? (
                          <li className="px-3 py-6 text-center text-[11px] text-ink-500">
                            {busy
                              ? t('common.loading')
                              : t('characters.soulCatalogEmpty')}
                          </li>
                        ) : (
                          hubItems.map((it) => {
                            const active =
                              catalogPickId === it.id ||
                              form.soulHubId === it.id
                            return (
                              <li
                                key={it.id}
                                className={[
                                  'flex items-start gap-2 border-b border-ink-800/60 px-2 py-2 transition',
                                  active
                                    ? 'bg-brand-950/40'
                                    : 'hover:bg-ink-900/80'
                                ].join(' ')}
                              >
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() =>
                                    void previewSoulFromCatalog(it.id, it.title)
                                  }
                                >
                                  <span className="block truncate text-sm font-medium text-ink-100">
                                    {it.role_icon ?? '✦'} {it.title}
                                  </span>
                                  <span className="mt-0.5 line-clamp-2 block text-[11px] text-ink-500">
                                    {it.description}
                                  </span>
                                </button>
                                <Button
                                  variant="secondary"
                                  className="!shrink-0 !py-1 !text-[10px]"
                                  disabled={busy}
                                  onClick={() =>
                                    void applySoulFromHub(it.id, {
                                      stayInEditor: true
                                    })
                                  }
                                >
                                  {t('characters.useSoul')}
                                </Button>
                              </li>
                            )
                          })
                        )}
                      </ul>
                      <div className="flex items-center justify-center gap-2 border-t border-ink-800 py-1.5 text-[11px] text-ink-500">
                        <Button
                          variant="ghost"
                          className="!py-0.5 !text-xs"
                          disabled={busy || hubPage <= 1}
                          onClick={() => void loadHubPage(hubPage - 1)}
                        >
                          ←
                        </Button>
                        <span>
                          {hubPage} / {hubTotalPages}
                        </span>
                        <Button
                          variant="ghost"
                          className="!py-0.5 !text-xs"
                          disabled={busy || hubPage >= hubTotalPages}
                          onClick={() => void loadHubPage(hubPage + 1)}
                        >
                          →
                        </Button>
                      </div>
                    </div>

                    {/* Full soul content — editable */}
                    <div className="flex min-h-0 flex-col rounded-lg border border-ink-800 bg-ink-950/50">
                      <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
                        <span className="truncate text-[11px] font-medium text-ink-400">
                          {t('characters.soulFullContent')}
                          {(catalogPickTitle || form.soulHubId != null) && (
                            <span className="ml-1 text-ink-300">
                              ·{' '}
                              {catalogPickTitle ??
                                (form.soulHubId != null
                                  ? `#${form.soulHubId}`
                                  : '')}
                            </span>
                          )}
                        </span>
                        {catalogPickId != null &&
                          form.soulHubId !== catalogPickId && (
                            <Button
                              variant="secondary"
                              className="!shrink-0 !py-0.5 !text-xs"
                              disabled={busy}
                              onClick={() =>
                                void applySoulFromHub(catalogPickId, {
                                  stayInEditor: true
                                })
                              }
                            >
                              {t('characters.useSoul')}
                            </Button>
                          )}
                      </div>
                      <div className="flex min-h-[12rem] flex-1 flex-col p-2">
                        {catalogLoading ? (
                          <p className="p-2 text-center text-[11px] text-ink-500">
                            {t('characters.soulLoading')}
                          </p>
                        ) : (
                          <Textarea
                            size="fill"
                            className="min-h-[12rem] flex-1 resize-y font-mono text-[12px] leading-relaxed"
                            value={
                              catalogPickBody ?? form.soulPreview ?? ''
                            }
                            onChange={(e) => {
                              const v = e.target.value
                              setCatalogPickBody(v)
                              setForm((f) => ({
                                ...f,
                                soulPreview: v
                              }))
                            }}
                            placeholder={t('characters.soulEditPlaceholder')}
                            aria-label={t('characters.soulFullContent')}
                          />
                        )}
                        <p className="mt-1 px-1 text-[10px] leading-relaxed text-ink-600">
                          {t('characters.soulEditHint')}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ── Reference sheets ── */}
            {editorPanel === 'refs' && (
              <div className={editorFormClass}>
                <div>
                  <h3 className="text-sm font-semibold text-ink-100">
                    {t('characters.tabRefs')}
                  </h3>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {t('characters.sheetHintShort')}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <EditorField
                    label={t('characters.sheetVariant')}
                    hint={t('characters.sheetVariantHintShort')}
                  >
                    <EditorSelect
                      value={sheetVariant}
                      onChange={(e) => {
                        setSheetVariant(e.target.value as SheetVariantId)
                        setUseIdentityRef(false)
                      }}
                    >
                      {(
                        [
                          'sheetGroupCore',
                          'sheetGroupAngles',
                          'sheetGroupWardrobe',
                          'sheetGroupDetail'
                        ] as const
                      ).map((gk) =>
                        sheetGroups[gk].length === 0 ? null : (
                          <optgroup key={gk} label={t(`characters.${gk}`)}>
                            {sheetGroups[gk].map((v) => (
                              <option key={v.id} value={v.id}>
                                {t(`characters.${v.labelKey}`)}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </EditorSelect>
                  </EditorField>
                  <EditorField
                    label={t('characters.artStyle')}
                    hint={t('characters.artStyleHintShort')}
                  >
                    <EditorSelect
                      value={form.artStyle}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          artStyle: e.target.value as ArtStyleId
                        }))
                      }
                    >
                      {(
                        [
                          'artGroupPhoto',
                          'artGroup3d',
                          'artGroupAnime',
                          'artGroupIllust'
                        ] as const
                      ).map((gk) => (
                        <optgroup key={gk} label={t(`characters.${gk}`)}>
                          {artGroups[gk].map((s) => (
                            <option key={s.id} value={s.id}>
                              {t(`characters.${s.labelKey}`)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </EditorSelect>
                  </EditorField>
                </div>

                {sheetRequiresUnclothedSupport(sheetVariant) && (
                  <div
                    role="note"
                    className="rounded-lg border border-amber-800/50 bg-amber-950/35 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/95"
                  >
                    {t('characters.sheetBareBodyWarning')}
                  </div>
                )}

                <section className="rounded-xl border border-ink-700/80 bg-ink-900/35 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-ink-100">
                        {t('characters.externalRefTitle')}
                      </h4>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-500">
                        {t('characters.externalRefHint')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!shrink-0 !py-1 !text-xs"
                      disabled={editorAiBusy}
                      onClick={() => void handlePickExternalRef()}
                    >
                      {t('characters.addExternalRef')}
                    </Button>
                  </div>
                  {externalRefs.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {externalRefs.map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedImageId(g.id)}
                            className={[
                              'rounded-lg border px-2 py-1 text-[11px] transition',
                              selectedImageId === g.id
                                ? 'border-brand-500 bg-brand-950/40 text-brand-100'
                                : 'border-ink-700 bg-ink-950/60 text-ink-300 hover:border-ink-500'
                            ].join(' ')}
                          >
                            {translateCharacterGalleryLabel(g.label, t)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-ink-500">
                      {t('characters.externalRefEmpty')}
                    </p>
                  )}
                  <label
                    className={[
                      'mt-3 flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
                      externalRefs.length === 0
                        ? 'cursor-not-allowed border-ink-800/60 bg-ink-950/30 opacity-60'
                        : 'cursor-pointer border-ink-700 bg-ink-950/40'
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-ink-600"
                      checked={useExternalRef && externalRefs.length > 0}
                      disabled={externalRefs.length === 0}
                      onChange={(e) => setUseExternalRef(e.target.checked)}
                    />
                    <span className="text-[12px] leading-snug text-ink-300">
                      <span className="font-medium text-ink-100">
                        {t('characters.useExternalRef')}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-500">
                        {t('characters.useExternalRefHint')}
                      </span>
                    </span>
                  </label>
                </section>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-ink-600"
                    checked={useIdentityRef}
                    onChange={(e) => setUseIdentityRef(e.target.checked)}
                  />
                  <span className="text-[12px] leading-snug text-ink-300">
                    <span className="font-medium text-ink-100">
                      {t('characters.useIdentityRef')}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-500">
                      {t('characters.useIdentityRefHintShort')}
                    </span>
                  </span>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    className="sm:flex-1"
                    disabled={editorAiBusy}
                    onClick={() => void handleGenerateSheet()}
                  >
                    {editorAiBusy
                      ? t('common.generating')
                      : t('characters.generateSheet')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={editorAiBusy}
                    onClick={() => void handlePickExternalRef()}
                  >
                    {t('characters.addExternalRef')}
                  </Button>
                  {selectedImage &&
                    form.coverPath !== selectedImage.path && (
                      <Button
                        variant="secondary"
                        onClick={() => handleSetCover(selectedImage.path)}
                      >
                        {t('characters.setAsCover')}
                      </Button>
                    )}
                  {selectedImage && form.coverPath === selectedImage.path && (
                    <span className="inline-flex items-center rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                      {t('characters.isCover')}
                    </span>
                  )}
                  {selectedImage && (
                    <Button
                      variant="ghost"
                      className="text-rose-300"
                      onClick={() => handleRemoveImage(selectedImage.id)}
                    >
                      {t('characters.removePhoto')}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-ink-500">
                  {t('characters.coverHint')}
                </p>
              </div>
            )}

            {/* ── Costume ── */}
            {editorPanel === 'costume' && (
              <div className={editorFormClass}>
                <section className="rounded-xl border border-ink-700 bg-ink-900/35 p-4">
                  <h3 className="text-sm font-semibold text-ink-100">
                    {t('costumes.globalForCharacter')}
                  </h3>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {t('costumes.globalForCharacterHint')}
                  </p>
                  {editingId && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="min-w-[10rem] flex-1">
                        <Label>{t('costumes.linkFromLibrary')}</Label>
                        <select
                          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100"
                          value={linkCostumePickId}
                          onChange={(e) => setLinkCostumePickId(e.target.value)}
                        >
                          <option value="">
                            {t('costumes.pickCostumeToLink')}
                          </option>
                          {allGlobalCostumes
                            .filter(
                              (c) =>
                                !linkedGlobalCostumes.some((l) => l.id === c.id)
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={!linkCostumePickId || !editingId}
                        onClick={() => {
                          if (!editingId || !linkCostumePickId) return
                          void getApi()
                            .costumes.linkCharacter({
                              costumeId: linkCostumePickId,
                              characterId: editingId
                            })
                            .then(() =>
                              getApi().costumes.listForCharacter(editingId)
                            )
                            .then(setLinkedGlobalCostumes)
                            .then(() => {
                              setLinkCostumePickId('')
                              toast.success(t('common.linked'))
                            })
                            .catch((e) =>
                              toast.error(parseIpcError(e).message)
                            )
                        }}
                      >
                        {t('costumes.linkCostume')}
                      </Button>
                    </div>
                  )}
                  {!editingId ? (
                    <p className="mt-3 text-[11px] text-ink-500">
                      {t('costumes.saveCharacterFirst')}
                    </p>
                  ) : linkedGlobalCostumes.length === 0 ? (
                    <p className="mt-3 text-[11px] text-ink-500">
                      {t('costumes.noLinkedCharacters')}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {linkedGlobalCostumes.map((cos) => (
                        <li
                          key={cos.id}
                          className={[
                            'flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2',
                            cos.isActive
                              ? 'border-brand-600/60 bg-brand-950/30'
                              : 'border-ink-800 bg-ink-950/50'
                          ].join(' ')}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-ink-100">
                                {cos.name}
                              </span>
                              {cos.isActive && (
                                <span className="rounded bg-brand-700/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-brand-200">
                                  {t('characters.costumeLibActive')}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-400">
                              {cos.description}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1">
                            <Button
                              variant="secondary"
                              className="!py-1 !text-xs"
                              type="button"
                              disabled={editorAiBusy || form.gallery.length === 0}
                              onClick={() => {
                                if (!editingId) return
                                if (
                                  isBlocked({
                                    kind: ['costume-swap'],
                                    characterId: editingId
                                  })
                                ) {
                                  toast.info(t('aiJobs.running'))
                                  return
                                }
                                toast.info(t('aiJobs.startedBackground'))
                                startJob({
                                  kind: 'costume-swap',
                                  label: t('costumes.generateDressed'),
                                  scope: { characterId: editingId },
                                  run: async ({ setProgress, signal }) => {
                                    setProgress(20, 'image')
                                    const r =
                                      await getApi().costumes.generateDressed({
                                        costumeId: cos.id,
                                        characterId: editingId,
                                        baseImagePath:
                                          swapBasePath || undefined
                                      })
                                    if (signal.cancelled) return
                                    setProgress(100, 'done')
                                    const list =
                                      await getApi().costumes.listForCharacter(
                                        editingId
                                      )
                                    setLinkedGlobalCostumes(list)
                                    toast.success(t('costumes.dressedOk'))
                                    return {
                                      type: 'character-sheet' as const,
                                      characterId: editingId,
                                      storyId: '',
                                      path: r.path,
                                      variant: 'costume_swap',
                                      label: t('costumes.generateDressed'),
                                      layer: 'costume'
                                    }
                                  }
                                })
                              }}
                            >
                              {t('costumes.generateDressed')}
                            </Button>
                            {!cos.isActive && (
                              <Button
                                variant="ghost"
                                className="!py-1 !text-xs"
                                type="button"
                                onClick={() => {
                                  if (!editingId) return
                                  void getApi()
                                    .costumes.setActive({
                                      costumeId: cos.id,
                                      characterId: editingId
                                    })
                                    .then(() => {
                                      setForm((f) => ({
                                        ...f,
                                        costume: cos.description,
                                        artStyle: isArtStyleId(cos.artStyle)
                                          ? cos.artStyle
                                          : f.artStyle
                                      }))
                                      setSwapCostumeText(cos.description)
                                      return getApi().costumes.listForCharacter(
                                        editingId
                                      )
                                    })
                                    .then(setLinkedGlobalCostumes)
                                    .then(() =>
                                      toast.success(
                                        t('characters.costumeLibUse')
                                      )
                                    )
                                    .catch((e) =>
                                      toast.error(parseIpcError(e).message)
                                    )
                                }}
                              >
                                {t('characters.costumeLibUse')}
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-brand-800/35 bg-brand-950/15 p-4">
                  <h3 className="text-sm font-semibold text-ink-100">
                    {t('characters.swapCostumeTitle')}
                  </h3>
                  <p className="mt-1 text-[11px] leading-snug text-ink-500">
                    {t('characters.swapCostumeHintShort')}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <EditorField label={t('characters.swapBaseImage')}>
                      <EditorSelect
                        value={swapBasePath}
                        onChange={(e) => setSwapBasePath(e.target.value)}
                      >
                        <option value="">
                          {t('characters.swapBaseAuto')}
                        </option>
                        {swapBaseOptions.map((g) => {
                          const layer = g.layer ?? inferGalleryLayer(g)
                          return (
                            <option key={g.id} value={g.path}>
                              {translateCharacterGalleryLabel(g.label, t)}
                              {layer
                                ? ` · ${t(`characters.layerFilter_${layer}`)}`
                                : ''}
                            </option>
                          )
                        })}
                      </EditorSelect>
                    </EditorField>
                    <EditorField label={t('characters.swapPose')}>
                      <EditorSelect
                        value={swapPose}
                        onChange={(e) =>
                          setSwapPose(e.target.value as CostumeSwapPose)
                        }
                      >
                        {COSTUME_SWAP_POSES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {t(`characters.${p.labelKey}`)}
                          </option>
                        ))}
                      </EditorSelect>
                    </EditorField>
                  </div>
                  <EditorField
                    className="mt-3"
                    label={t('characters.swapCostumeDesc')}
                  >
                    <Textarea
                      size="lg"
                      value={swapCostumeText}
                      onChange={(e) => setSwapCostumeText(e.target.value)}
                      placeholder={t('characters.swapCostumePlaceholder')}
                    />
                  </EditorField>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      disabled={editorAiBusy || form.gallery.length === 0}
                      onClick={() => void handleSwapCostume()}
                    >
                      {editorAiBusy
                        ? t('common.generating')
                        : t('characters.swapCostume')}
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={!form.costume.trim()}
                      onClick={() => setSwapCostumeText(form.costume)}
                    >
                      {t('characters.swapUseProfileCostume')}
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border border-ink-700 bg-ink-900/35 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-ink-100">
                      {t('characters.costumeLibTitle')}
                    </h3>
                    <p className="mt-1 text-[11px] text-ink-500">
                      {t('characters.costumeLibHintShort')}
                    </p>
                  </div>
                  <div className="mb-4 rounded-lg border border-brand-800/30 bg-brand-950/15 p-3">
                    <p className="mb-2 text-[11px] font-medium text-ink-300">
                      {t('characters.suggestWardrobe')}
                    </p>
                    <p className="mb-2 text-[10px] text-ink-500">
                      {t('plot.pickerHint')}
                    </p>
                    <PlotContextPicker
                      stories={stories}
                      storyId={plotStoryId}
                      segmentKey={plotSegmentKey}
                      onStoryChange={(id) => {
                        setPlotStoryId(id)
                        setPlotSegmentKey('all')
                      }}
                      onSegmentChange={setPlotSegmentKey}
                    />
                    <Button
                      className="mt-3"
                      variant="secondary"
                      disabled={editorAiBusy || !form.name.trim()}
                      onClick={() => handleSuggestWardrobe()}
                    >
                      {t('characters.suggestWardrobe')}
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="min-w-[8rem] flex-1">
                      <Label>{t('characters.costumeLibName')}</Label>
                      <Input
                        className="mt-1"
                        value={newCostumeName}
                        onChange={(e) => setNewCostumeName(e.target.value)}
                        placeholder={t('characters.costumeLibNamePh')}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={handleAddCostumeToLibrary}
                    >
                      {t('characters.costumeLibAdd')}
                    </Button>
                  </div>
                  {form.costumes.length === 0 ? (
                    <p className="mt-3 text-[11px] text-ink-500">
                      {t('characters.costumeLibEmpty')}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {form.costumes.map((cos) => {
                        const active =
                          form.costume.trim().toLowerCase() ===
                          cos.description.trim().toLowerCase()
                        const displayName =
                          !cos.name.trim() ||
                          /^default$/i.test(cos.name.trim())
                            ? t('characters.costumeLibDefault')
                            : cos.name
                        const styleLabel = cos.artStyle
                          ? t(
                              `characters.${getArtStyle(cos.artStyle).labelKey}`
                            )
                          : null
                        return (
                          <li
                            key={cos.id}
                            className={[
                              'flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2',
                              active
                                ? 'border-brand-600/60 bg-brand-950/30'
                                : 'border-ink-800 bg-ink-950/50'
                            ].join(' ')}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-ink-100">
                                  {displayName}
                                </span>
                                {active && (
                                  <span className="rounded bg-brand-700/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-brand-200">
                                    {t('characters.costumeLibActive')}
                                  </span>
                                )}
                                {styleLabel && (
                                  <span className="text-[10px] text-ink-500">
                                    {styleLabel}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-400">
                                {cos.description}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="secondary"
                                className="!py-1 !text-xs"
                                type="button"
                                onClick={() => applyCostumeLook(cos)}
                              >
                                {t('characters.costumeLibUse')}
                              </Button>
                              <Button
                                variant="ghost"
                                className="!py-1 !text-xs text-rose-300"
                                type="button"
                                onClick={() =>
                                  handleRemoveCostumeLook(cos.id)
                                }
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </EditorShell>
        )}

      </div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-ink-800/90 px-2.5 py-0.5 text-center text-[10px] leading-none text-ink-300">
      {children}
    </span>
  )
}
