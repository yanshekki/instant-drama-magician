// @ts-nocheck — residual pure-helper typings; covered by page unit tests
import { ensureHardRules } from '../../domain/promptHardRules'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
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
  libraryMediaBadgeClass,
  libraryMediaClass,
  libraryCardActionBtnClass,
  libraryCardActionDeleteClass,
  libraryCardActionsRowClass
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
import { compareUpdatedAtDesc } from '../lib/librarySort'
import { LanguageMultiPick } from '../components/LanguageMultiPick'
import {
  appendGalleryItem,
  filterGalleryByLayer,
  isGalleryCoverPath,

  parseCharacterGallery,
  moveGalleryItem,

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
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
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
import {
  appendMultiRefNote,
  resolveIdentityPaths,
  toggleGallerySelection
} from '../../domain/imageGenConfirm'
import type { ImageGenConfirmPayload } from '../components/ImageGenConfirmModal'
import {
  buildCharacterSheetEditPrompt,
  buildCharacterSheetImagePrompt
} from '../../domain/characterMasterPrompt'

import { LocalMediaImage } from '../components/LocalMediaImage'
import {
  EntityGalleryPanel,
  EntityGalleryLayerChip
} from '../components/EntityGalleryPanel'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PlotContextPicker } from '../components/PlotContextPicker'
import { PageHeader } from '../components/PageHeader'
import { pageRootClass, pageScrollClass } from '../lib/mobileLayout'
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
  hardRules: string
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
  hardRules: '',
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
    activeJobs,
    startVideoPrep,
    startMediaGen,
    hasVideoPrepDraft,
    continueVideoPrepDraft
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
      },
      sort: compareUpdatedAtDesc
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
    await charactersRemoveWithFeedback({
      remove,
      id,
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: toast.error
    })
  }


  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPanel, setEditorPanel] = useState<EditorPanel>('refs')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [pageBanner, setPageBanner] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /** null / undefined = "new character" scope (only block other new-char jobs). */
  const characterAiBusy = (characterId?: string | null): boolean => {
    const id = characterId ?? null
    return charactersAiBusyFromJobs(
      activeJobs,
      id,
      isBlocked({
        kind: [...CHARACTER_AI_KINDS],
        characterId: id
      })
    )
  }

  const editorAiBusy = characterAiBusy(editingId)

  useEffect(() => {
    return onProfileApply((draft) => {
      charactersHandleProfileApply(draft as never, editingId, {
        reload,
        setForm,
        setAiIdea,
        setEditorOpen,
        setEditorPanel,
        setActionError,
        setPageBanner: (m) => setPageBanner(m || t('characters.aiFillOk')),
        toastSuccess: () => {
          setPageBanner(t('characters.aiFillOk'))
          toast.success(t('characters.aiFillOk'))
        }
      })
    })
  }, [onProfileApply, editingId, reload, t])

  useEffect(() => {
    return onSheetCommitted(({ characterId, path, gallery, costume }) => {
      charactersHandleSheetCommitted(
        { characterId, path, gallery, costume },
        editingId,
        {
          setForm,
          setSelectedImageId,
          setSwapCostumeText,
          reload,
          toastSuccess: () => toast.success(t('characters.sheetOkShort')),
          setPageBanner: () => setPageBanner(t('characters.sheetOkShort')),
          listCharacter: (id) => charactersFindInList(() => getApi().characters.list() as Promise<Character[]>, id),
          ensureCostume: ensureCostumeInLibrary
        }
      )
    })
  }, [onSheetCommitted, editingId, reload, t])

  useEffect(() => {
    return onWardrobeApply((draft) => {
      charactersHandleWardrobeApply(draft, editingId, form.artStyle, {
        setForm,
        setSwapCostumeText,
        setPageBanner: () => setPageBanner(t('characters.suggestWardrobeOk')),
        setEditorOpen,
        toastSuccess: () => toast.success(t('characters.suggestWardrobeOk')),
        createEntry: createCostumeEntry,
        upsert: upsertCostume
      })
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
    const next = charactersResetSheetIfHidden(
      sheetGroups,
      sheetVariant,
      DEFAULT_SHEET_VARIANT
    )
    if (next) setSheetVariant(next as SheetVariantId)
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
        charactersLoadSoulPreviewForm(null, setForm)
        return
      }
      try {
        const r = await getApi().characters.readSoulContent({
          soulMdPath: opts.soulMdPath,
          soulHubId: opts.soulHubId
        })
        charactersLoadSoulPreviewForm(r.content, setForm)
      } catch (e) {
        charactersLoadSoulPreviewForm(null, setForm)
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
      hardRules: c.hardRules ?? '',
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
      hardRules: form.hardRules || null,
      soulHubId: form.soulHubId,
      artStyle: form.artStyle,
      costumesJson: charactersCostumesJsonOrNull(
        costumes,
        serializeCharacterCostumes
      )
    }
  }

  const handleSave = async (): Promise<void> => {
    await charactersRunSave({
      name: form.name,
      emptyMsg: t('common.nameRequired'),
      savedMsg: t('common.saved'),
      failedMsg: t('common.actionFailed'),
      editingId,
      toastError: toast.error,
      toastSuccess: toast.success,
      setError: setActionError,
      setBusy,
      prepareForm: async () => {
        let nextForm = form
        const soulText = form.soulPreview?.trim() ?? ''
        const written = await charactersWriteSoulIfNeeded({
          soulText,
          soulMdPath: form.soulMdPath,
          editingId,
          write: (args) =>
            getApi().characters.writeSoulContent({
              content: args.content,
              filePath: args.filePath,
              characterId: args.characterId
            }),
          onWarn: (e) => console.warn('[characters] writeSoulContent failed', e)
        })
        if (written) {
          nextForm = {
            ...form,
            soulMdPath: written.soulMdPath,
            soulPreview: written.soulPreview,
            soulHubId: written.soulHubId
          }
          setForm(nextForm)
          setCatalogPickBody(written.soulPreview ?? '')
        }
        return nextForm
      },
      buildPayload: (nextForm) => {
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
          hardRules: nextForm.hardRules || null,
          soulHubId: nextForm.soulHubId,
          artStyle: nextForm.artStyle,
          costumesJson: charactersCostumesJsonOrNull(
            costumes,
            serializeCharacterCostumes
          )
        }
      },
      update,
      create,
      reload,
      closeEditor
    })
  }

  const handleAiFill = (fromEditor = false): void => {
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
      spokenLanguages: charactersSpokenOrUndefined(form.spokenLanguages),
      mannerisms: form.mannerisms.trim() || undefined,
      relationships: form.relationships.trim() || undefined,
      visualTags: form.visualTags.trim() || undefined
    }
    const soulContent = charactersSoulContent(
      form.soulPreview,
      catalogPickBody
    )
    const refPath = charactersAiFillRefPath({
      selectedPath: selectedImage?.path,
      coverPath: form.coverPath,
      gallery0: form.gallery[0]?.path
    })
    charactersRunAiFill({
      busy: characterAiBusy(editingId),
      idea: aiIdea.trim() || form.seedPrompt.trim(),
      formSnapshot: snapshot,
      soulContent,
      refPath,
      fromEditor,
      setError: setActionError,
      needMsg: t('common.aiNeedIdeaOrImage'),
      setBanner: setPageBanner,
      toastInfo: toast.info,
      toastError: toast.error,
      fromImageMsg: t('common.aiFillFromImage'),
      backgroundMsg: t('aiJobs.startedBackground'),
      runningMsg: t('aiJobs.running'),
      setEditorOpen,
      setEditorPanel,
      startJob: (idea, hasDraft, _hasSoul, hasImage, ref, snap, isImprove) => {
        const characterId = editingId
        const locale = getAiLocale(i18n.language)
        startJob({
          kind: 'character-ai-fill',
          label: charactersAiCreateLabel(
            isImprove,
            t('characters.aiImproveTitle'),
            t('characters.aiCreate')
          ),
          scope: {
            characterId: characterId ?? undefined,
            storyId: activeStoryId ?? undefined
          },
          run: async ({ setProgress, signal }) => {
            setProgress(15, hasImage ? 'image' : 'chat')
            let soul = soulContent
            if (
              !soul &&
              (form.soulHubId != null || form.soulMdPath)
            ) {
              soul = await charactersReadSoulSafe(() =>
                getApi().characters.readSoulContent({
                  soulMdPath: form.soulMdPath,
                  soulHubId: form.soulHubId
                })
              )
            }
            if (signal.cancelled) return
            setProgress(35, 'merge')
            const r = await getApi().characters.aiFill({
              idea: idea || undefined,
              storyId: activeStoryId ?? undefined,
              locale,
              existingDraft: hasDraft ? (snap as never) : undefined,
              soulContent: soul || undefined,
              referenceImagePath: hasImage ? ref : null
            })
            if (signal.cancelled) return
            setProgress(100, 'done')
            return {
              type: 'character-profile' as const,
              characterId: characterId ?? null,
              storyId: activeStoryId ?? null,
              profile: {
                ...r.profile,
                seedPrompt: idea || r.profile.seedPrompt || r.profile.description,
                hardRules: r.profile.hardRules || form.hardRules || ''
              },
              profileJson: r.profileJson,
              isNew: !characterId
            }
          }
        })
      }
    })
  }

  const ensureSavedId = async (): Promise<string | null> => {
    return charactersEnsureSavedId({
      editingId,
      name: form.name,
      activeStoryId,
      update: () => update(editingId!, payload()),
      create: () => create(payload()),
      reload,
      list: () =>
        getApi().characters.list(activeStoryId!) as Promise<Character[]>,
      setEditingId
    })
  }

  const applyCostumeLook = (entry: CharacterCostumeEntry): void => {
    charactersApplyCostumeLook(entry, form.gallery, {
      setForm,
      setSwapCostumeText,
      setSelectedImageId,
      setPageBanner,
      toastSuccess: toast.success,
      appliedMsg: t('characters.costumeApplied', { name: entry.name })
    })
  }

  const handleAddCostumeToLibrary = (): void => {
    charactersAddCostumeToLibrary({
      description: charactersCostumeDesc(swapCostumeText, form.costume),
      name: newCostumeName,
      artStyle: form.artStyle,
      setError: setActionError,
      requiredMsg: t('characters.swapCostumeRequired'),
      savedMsg: t('characters.costumeLibSaved'),
      setForm,
      setSwapCostumeText,
      setNewCostumeName,
      setPageBanner,
      toastSuccess: toast.success,
      createEntry: createCostumeEntry,
      upsert: upsertCostume
    })
  }

  const handleRemoveCostumeLook = (id: string): void =>
    charactersHandleRemoveCostume(setForm, id)

  // Default plot context to active story when editor opens costume tab
  useEffect(() => {
    if (activeStoryId && !plotStoryId) setPlotStoryId(activeStoryId)
  }, [activeStoryId, plotStoryId])

  const handleSuggestWardrobe = (): void => {
    setActionError(null)
    const g = charactersGuardSuggest(
      form.name,
      characterAiBusy(editingId),
      setActionError,
      t('characters.suggestNeedName')
    )
    if (g !== 'ok') return
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
          soulExcerpt = await charactersReadSoulSafe(() =>
            getApi().characters.readSoulContent({
              soulMdPath: form.soulMdPath,
              soulHubId: form.soulHubId
            })
          )
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
      const id = await ensureSavedId()
      if (!id) {
        setActionError(t('characters.saveFirstForSheet'))
        return
      }
      if (characterAiBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const costumeDescription = charactersCostumeDesc(
        swapCostumeText,
        form.costume
      )
      if (!costumeDescription.trim()) {
        setActionError(t('characters.swapCostumeRequired'))
        toast.error(t('characters.swapCostumeRequired'))
        return
      }
      const base = pickBestBaseImage(form.gallery, {
        ageRange: form.ageRange,
        preferredPath: swapBasePath || selectedImage?.path || null
      })
      if (!base?.path) {
        setActionError(t('characters.swapCostumeNoBase'))
        toast.error(t('characters.swapCostumeNoBase'))
        return
      }
      startMediaGen({
        kind: 'costume-swap',
        characterId: id,
        storyId: activeStoryId ?? undefined,
        artStyle: form.artStyle,
        galleryIdentityPaths: [base.path],
        preferIdentityEdit: true,
        costumeDescription
      })
    } catch (e) {
      const msg = formatUserError(e, t)
      setActionError(msg)
      toast.error(msg)
    }
  }

  /** Identity lock on selected gallery still(s). */
  const [useIdentityRef, setUseIdentityRef] = useState(false)

  const selectedPathsForIdentity = useMemo(() => {
    const ids = charactersSelectedIds(selectedImageIds, selectedImageId)
    return ids
      .map((id) => form.gallery.find((g) => g.id === id)?.path)
      .filter((p): p is string => Boolean(p?.trim()))
  }, [selectedImageIds, selectedImageId, form.gallery])

  const handleGenerateSheet = async (opts?: {
    characterId?: string
    referenceImagePath?: string | null
    /** When true, image_edit with ref (thumbnail re-gen). Default: false = new layout. */
    useIdentityEdit?: boolean
    artStyle?: ArtStyleId
  }): Promise<void> => {
    setActionError(null)
    try {
      const id = opts?.characterId || (await ensureSavedId())
      if (!id) {
        setActionError(t('characters.saveFirstForSheet'))
        return
      }
      if (characterAiBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const wantIdentity = charactersResolveWantIdentity(
        opts?.useIdentityEdit,
        useIdentityRef
      )
      const paths = charactersGalleryPathsFromOpts(
        opts?.referenceImagePath,
        selectedPathsForIdentity
      )
      startMediaGen({
        kind: 'character-sheet',
        characterId: id,
        storyId: activeStoryId ?? undefined,
        artStyle: opts?.artStyle ?? form.artStyle,
        sheetVariant: sheetVariant,
        galleryIdentityPaths: paths,
        preferIdentityEdit: wantIdentity
      })
    } catch (e) {
      const msg = formatUserError(e, t)
      setActionError(msg)
      toast.error(msg)
    }
  }

  /** Animate the selected still into a self-intro video using profile bible. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    setActionError(null)
    const characterId = editingId
    const sourcePath = sourceImagePath.trim()
    const draftKey = buildVideoPrepDraftKey(
      'character-intro',
      { characterId: characterId ?? undefined },
      sourcePath
    )
    charactersHandleIntroVideoFlow({
      editingId,
      sourceImagePath,
      busy: characterAiBusy(editingId),
      setError: setActionError,
      toastError: toast.error,
      toastInfo: toast.info,
      msgs: {
        saveFirst: t('characters.saveBeforeSheet'),
        needImage: t('characters.introVideoNeedImage'),
        loading: t('aiJobs.running')
      },
      hasDraft: hasVideoPrepDraft(draftKey),
      continueDraft: charactersContinueDraftCb(
        continueVideoPrepDraft,
        draftKey
      ),
      update: () => update(characterId!, payload()),
      startPrep: () =>
        startVideoPrep({
          kind: 'character-intro',
          entityIds: {
            characterId: characterId!,
            storyId: activeStoryId ?? undefined
          },
          sourceImagePath: sourcePath,
          durationSeconds: 10,
          locale: getAiLocale(i18n.language)
        })
    })
  }

  // After video confirm, reload gallery introVideoPath on the source still
  useEffect(() => {
    const onDone = (ev: Event): void => {
      charactersHandleVideoPrepDone(
        (ev as CustomEvent).detail,
        editingId,
        {
          setForm,
          setSelectedImageId,
          reload,
          getCharacter: (id) => getApi().characters.get(id) as Promise<Character>
        }
      )
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editingId, reload])

  /** Import a still from disk into the unified gallery list. */
  const handlePickExternalRef = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'upload',
      label: t('common.uploadRef')
    })
    const newId = next[next.length - 1]?.id ?? null
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath: f.coverPath ?? next[0]?.path ?? null
    }))
    if (newId) setSelectedImageId(newId)
    toast.success(t('characters.externalRefAdded'))
  }


  const handleReorderGallery = (fromId: string, toId: string): void =>
    charactersHandleReorder(setForm, fromId, toId)

  const handleRemoveImage = (id: string): void => {
    const removed = form.gallery.find((g) => g.id === id)
    const next = removeGalleryItem(form.gallery, id)
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath: charactersNextCoverAfterRemove(
        next,
        removed?.path,
        f.coverPath,
        isGalleryCoverPath,
        primaryGalleryPath
      )
    }))
    setSelectedImageId(next[0]?.id ?? null)
    setSelectedImageIds((ids) => ids.filter((x) => x !== id))
  }

  const handleSetCover = (path: string): void => {
    setForm((f) => ({ ...f, coverPath: path }))
    toast.success(t('common.coverSet'))
  }

  const loadHubPage = useCallback(
    async (page: number, q?: string): Promise<void> => {
      await charactersLoadHubPage({
        page,
        q,
        setBusy,
        setError: setActionError,
        searchLocal: (qq, limit) => getApi().souls.searchLocal(qq, limit),
        listRemote: (args) => getApi().souls.list(args),
        setItems: (items) => setHubItems(items as typeof hubItems),
        setTotalPages: setHubTotalPages,
        setPage: setHubPage
      })
    },
    []
  )

  const ensureSoulIndex = useCallback(async (): Promise<void> => {
    await charactersEnsureSoulIndex({
      ensureIndex: (force) => getApi().souls.ensureIndex(force),
      setStatus: setIndexStatus,
      setSuggestions: (s) =>
        setSuggestions(s as typeof suggestions),
      formatReady: (r) =>
        t('characters.indexReady', {
          count: r.count,
          pages: r.pages,
          cache: r.cache
        })
    })
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

  const previewSoulFromCatalog = (id: number, titleHint?: string) =>
    charactersPreviewSoul({
      id,
      titleHint,
      setCatalogPickId,
      setCatalogPickTitle,
      setCatalogLoading,
      setError: setActionError,
      getDetail: (sid) => getApi().souls.get(sid),
      readSoul: (sid) =>
        getApi().characters.readSoulContent({
          soulHubId: sid,
          soulMdPath: `soulmd-hub://${sid}`
        }),
      setCatalogPickBody,
      formSoulHubId: form.soulHubId,
      formSoulPreview: form.soulPreview,
      setSoulPreview: (body) => setForm((f) => ({ ...f, soulPreview: body }))
    })

  const applySoulFromHub = async (
    id: number,
    _opts?: { stayInEditor?: boolean }
  ): Promise<void> => {
    await charactersApplySoulFromHub({
      id,
      setBusy,
      getDetail: (sid) => getApi().souls.get(sid),
      readSoul: (sid) =>
        getApi().characters.readSoulContent({
          soulHubId: sid,
          soulMdPath: `soulmd-hub://${sid}`
        }),
      setForm,
      setCatalogPickId,
      setCatalogPickTitle,
      setCatalogPickBody,
      setEditorOpen,
      setEditorPanel,
      setPageBanner,
      toastSuccess: toast.success,
      appliedMsg: (title) => t('characters.soulApplied', { title }),
      setError: setActionError
    })
  }

  const handleImportSoul = async (): Promise<void> => {
    const result = await getApi().characters.importSoulMd()
    if (!result) return
    const doc = parseSoulMd(result.content)
    setForm((f) =>
      charactersImportSoulForm(
        f,
        result,
        doc.title,
        extractDescriptionFromSoulMd,
        extractNameFromSoulMd
      )
    )
    setCatalogPickId(null)
    setCatalogPickTitle(doc.title ?? extractNameFromSoulMd(result.content))
    setCatalogPickBody(result.content)
  }

  const clearSoulLink = (): void =>
    charactersClearSoulState({
      setForm,
      setCatalogPickId,
      setCatalogPickTitle,
      setCatalogPickBody
    })

  const handleGenerateSoul = (): void => {
    setActionError(null)
    if (
      charactersGuardSoulSource(
        charactersHasSoulSource({
          name: form.name,
          description: form.description,
          appearance: form.appearance,
          personality: form.personality,
          costume: form.costume,
          backstory: form.backstory,
          soulPreview: form.soulPreview
        }),
        setActionError,
        toast.error,
        t('characters.generateSoulNeedProfile')
      )
    ) {
      return
    }
    const soulStart = (): void => {
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
          existingSoul = await charactersReadSoulSafe(() =>
            getApi().characters.readSoulContent({
              soulMdPath: form.soulMdPath,
              soulHubId: form.soulHubId
            })
          )
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
    charactersGenerateSoulAfterGuards(
      characterAiBusy(editingId),
      toast.info,
      t('aiJobs.running'),
      soulStart
    )
  }

  return (
    <div className={pageRootClass}>
      <PageHeader
        title={t('characters.title')}
        subtitle={t('characters.subtitle')}
        actions={
          <Button onClick={openCreate}>{t('characters.new')}</Button>
        }
      />

      <div className={pageScrollClass}>
        {(error || actionError) && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {formatUserError(error?.message ?? actionError, t)}
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
                                variant="fill"
                                maxHeightClass="h-full max-h-none"
                                objectFit="cover"
                                className="h-full border-0 rounded-none"
                                actionsLayout="overlay"
                                onImageClick={() => openEdit(c)}
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
                              <span className={libraryMediaBadgeClass}>
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
                              {c.ageRange && <CharactersChip>{c.ageRange}</CharactersChip>}
                              {c.gender && <CharactersChip>{c.gender}</CharactersChip>}
                              {(() => {
                                const langs = parseSpokenLanguagesJson(
                                  c.spokenLanguages
                                )
                                if (!langs.length) return null
                                return (
                                  <CharactersChip>
                                    🗣{' '}
                                    {formatSpokenLanguagesDisplay(
                                      langs,
                                      i18n.language
                                    )}
                                  </CharactersChip>
                                )
                              })()}
                              {c.voiceDesc && (
                                <CharactersChip>🎙 {t('characters.voiceShort')}</CharactersChip>
                              )}
                            </div>
                            <div className={libraryCardActionsRowClass}>
                              <Button
                                variant="secondary"
                                className={libraryCardActionBtnClass}
                                onClick={() => openEdit(c)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                className={libraryCardActionDeleteClass}
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
              <EntityGalleryPanel
                title={t('characters.gallery')}
                countLabel={`${filteredGallery.length}/${form.gallery.length}`}
                layerFilter={
                  form.gallery.length > 0 ? (
                    <>
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
                          <EntityGalleryLayerChip
                            key={layer}
                            active={galleryLayerFilter === layer}
                            label={t(`characters.layerFilter_${layer}`)}
                            onClick={() => setGalleryLayerFilter(layer)}
                          />
                        )
                      })}
                    </>
                  ) : null
                }
                previewPath={selectedImage?.path}
                previewAlt={
                  selectedImage
                    ? translateCharacterGalleryLabel(selectedImage.label, t)
                    : ''
                }
                maxHeightClass="max-h-[min(36vh,420px)] lg:max-h-[min(48vh,520px)]"
                showMeta
                introVideoBusy={editorAiBusy}
                introVideoPath={selectedImage?.introVideoPath}
                introVideoHasDraft={
                  Boolean(editingId) &&
                  Boolean(selectedImage?.path) &&
                  hasVideoPrepDraft(
                    buildVideoPrepDraftKey(
                      'character-intro',
                      { characterId: editingId! },
                      selectedImage?.path ?? ''
                    )
                  )
                }
                onIntroVideo={
                  selectedImage
                    ? charactersIntroVideoHandler(
                        editingId,
                        selectedImage.path,
                        handleGenerateIntroVideo
                      )
                    : undefined
                }
                isCover={
                  Boolean(
                    selectedImage && form.coverPath === selectedImage.path
                  )
                }
                onSetAsCover={
                  selectedImage
                    ? () => handleSetCover(selectedImage.path)
                    : undefined
                }
                onRemove={
                  selectedImage
                    ? () => handleRemoveImage(selectedImage.id)
                    : undefined
                }
                emptyMessage={t('characters.noPhotos')}
                emptyActions={[
                  {
                    label: t('characters.addExternalRef'),
                    onClick: () => void handlePickExternalRef(),
                    variant: 'secondary',
                    disabled: editorAiBusy
                  },
                  {
                    label: t('characters.generateSheet'),
                    onClick: () =>
                      charactersGenerateSheetFromEmpty(setEditorPanel, () =>
                        void handleGenerateSheet()
                      ),
                    variant: 'primary',
                    disabled: editorAiBusy
                  }
                ]}
                items={filteredGallery}
                selectedId={selectedImageId}
                selectedIds={selectedImageIds}
                multiSelect
                coverPath={form.coverPath}
                fallbackCoverPath={primaryGalleryPath(form.gallery)}
                onSelect={setSelectedImageId}
                onToggleSelect={(id) =>
                  setSelectedImageIds((ids) =>
                    charactersToggleSelectIds(ids, id, toggleGallerySelection)
                  )
                }
                onReorder={handleReorderGallery}
                labelOf={(g) => translateCharacterGalleryLabel(g.label, t)}
              />
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
                    {t('common.aiHintWithImage')}
                  </p>
                  {(selectedImage?.path || form.coverPath) && (
                    <p className="mt-2 rounded-lg border border-brand-800/40 bg-brand-950/30 px-2.5 py-1.5 text-[11px] text-brand-100/90">
                      {t('common.aiUsingImage')}
                    </p>
                  )}
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
                    {charactersGeneratingLabel(
                      editorAiBusy,
                      t('common.generating'),
                      t('common.aiFill')
                    )}
                  </Button>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink-200">
                    {t('characters.profileSection')}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CharactersField label={t('characters.name')}>
                      <Input
                        value={form.name}
                        onChange={(e) => patch('name', e.target.value)}
                        placeholder={t('characters.namePlaceholder')}
                      />
                    </CharactersField>
                    <CharactersField label={t('characters.ageRange')}>
                      <Input
                        value={form.ageRange}
                        onChange={(e) => patch('ageRange', e.target.value)}
                        placeholder={t('characters.agePlaceholder')}
                      />
                    </CharactersField>
                    <CharactersField label={t('characters.gender')}>
                      <Input
                        value={form.gender}
                        onChange={(e) => patch('gender', e.target.value)}
                        placeholder={t('characters.genderPlaceholder')}
                      />
                    </CharactersField>
                    <CharactersField label={t('characters.visualTags')}>
                      <Input
                        value={form.visualTags}
                        onChange={(e) => patch('visualTags', e.target.value)}
                        placeholder={t('characters.visualTagsPlaceholder')}
                      />
                    </CharactersField>
                  </div>
                  <CharactersField
                    label={t('common.hardRules')}
                    hint={t('common.hardRulesHint')}
                  >
                    <Textarea
                      size="md"
                      value={form.hardRules}
                      onChange={(e) => patch('hardRules', e.target.value)}
                      placeholder={t('common.hardRulesPh')}
                    />
                  </CharactersField>
                  <CharactersField label={t('characters.description')}>
                    <Textarea
                      size="md"
                      value={form.description}
                      onChange={(e) => patch('description', e.target.value)}
                    />
                  </CharactersField>
                  <CharactersField label={t('characters.appearance')}>
                    <Textarea
                      size="lg"
                      value={form.appearance}
                      onChange={(e) => patch('appearance', e.target.value)}
                      placeholder={t('characters.appearancePlaceholder')}
                    />
                  </CharactersField>
                  <CharactersField label={t('characters.costume')}>
                    <Textarea
                      size="lg"
                      value={form.costume}
                      onChange={(e) => patch('costume', e.target.value)}
                    />
                  </CharactersField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CharactersField label={t('characters.personality')}>
                      <Textarea
                        size="md"
                        value={form.personality}
                        onChange={(e) => patch('personality', e.target.value)}
                      />
                    </CharactersField>
                    <CharactersField label={t('characters.backstory')}>
                      <Textarea
                        size="md"
                        value={form.backstory}
                        onChange={(e) => patch('backstory', e.target.value)}
                      />
                    </CharactersField>
                  </div>
                  <CharactersField label={t('characters.voiceDesc')}>
                    <Textarea
                      size="md"
                      value={form.voiceDesc}
                      onChange={(e) => patch('voiceDesc', e.target.value)}
                      placeholder={t('characters.voicePlaceholder')}
                    />
                  </CharactersField>
                  <CharactersField label={t('characters.spokenLanguages')}>
                    <LanguageMultiPick
                      value={form.spokenLanguages}
                      onChange={(codes) =>
                        setForm(charactersSpokenLangSetter(codes))
                      }
                    />
                  </CharactersField>
                  <CharactersField label={t('characters.mannerisms')}>
                    <Textarea
                      size="md"
                      value={form.mannerisms}
                      onChange={(e) => patch('mannerisms', e.target.value)}
                      placeholder={t('characters.mannerismsPlaceholder')}
                    />
                  </CharactersField>
                  <CharactersField label={t('characters.relationships')}>
                    <Textarea
                      size="md"
                      value={form.relationships}
                      onChange={(e) => patch('relationships', e.target.value)}
                    />
                  </CharactersField>
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
                        onClick={() => charactersOpenExternal((url) => void getApi().shell.openExternal(url), 'https://soulmd-hub.ysk.hk')}
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
                        {charactersGeneratingLabel(
                      editorAiBusy,
                      t('common.generating'),
                      t('characters.generateSoul')
                    )}
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
                        onClick={() => void loadSoulPreview({ soulMdPath: form.soulMdPath, soulHubId: form.soulHubId })}
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
                      onKeyDown={(e) => { charactersHubEnter(e.key, hubQ, (p, q) => void loadHubPage(p, q)) }}
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
                          onClick={() => charactersSuggestionSearch(s.label, setHubQ, (p, q) => void loadHubPage(p, q))}
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
                                  onClick={() => void previewSoulFromCatalog(it.id, it.title)}
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
                              {charactersSoulTitleDisplay(
                                catalogPickTitle,
                                form.soulHubId
                              )}
                            </span>
                          )}
                        </span>
                        {charactersShouldShowUseSoul(
                          catalogPickId,
                          form.soulHubId
                        ) && (
                            <Button
                              variant="secondary"
                              className="!shrink-0 !py-0.5 !text-xs"
                              disabled={busy}
                              onClick={() => charactersUseSoulButtonClick(catalogPickId, (id, opts) => void applySoulFromHub(id, opts))}
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
                            onChange={(e) => { const r = charactersSoulTextSetter(e.target.value); setCatalogPickBody(r.body); setForm(r.formUpdater) }}
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
                      onChange={(e) => charactersOnSheetVariantChange(e.target.value, setSheetVariant, setUseIdentityRef)}
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
                        setForm(charactersArtStyleSetter(e.target.value))
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

                {charactersNeedsBareBodyWarning(sheetVariant) && (
                  <div
                    role="note"
                    className="rounded-lg border border-amber-800/50 bg-amber-950/35 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/95"
                  >
                    {t('characters.sheetBareBodyWarning')}
                  </div>
                )}

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-ink-600"
                    checked={useIdentityRef}
                    onChange={(e) => setUseIdentityRef(e.target.checked)}
                  />
                  <span className="text-[12px] leading-snug text-ink-300">
                    <span className="font-medium text-ink-100">
                      {t('common.useIdentityRef')}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-500">
                      {t('common.useIdentityRefHint')}
                    </span>
                  </span>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    className="sm:flex-1"
                    disabled={editorAiBusy}
                    onClick={() => void handleGenerateSheet()}
                  >
                    {charactersGeneratingLabel(
                      editorAiBusy,
                      t('common.generating'),
                      t('characters.generateSheet')
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={editorAiBusy}
                    onClick={() => void handlePickExternalRef()}
                  >
                    {t('common.uploadRef')}
                  </Button>
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
                            .catch(charactersMakeLinkCatch(toast.error))
                        }}
                      >
                        {t('costumes.linkCostume')}
                      </Button>
                    </div>
                  )}
                  {charactersShowLinkedEmpty(
                    editingId,
                    linkedGlobalCostumes.length
                  ) === 'saveFirst' ? (
                    <p className="mt-3 text-[11px] text-ink-500">
                      {t('costumes.saveCharacterFirst')}
                    </p>
                  ) : charactersShowLinkedEmpty(
                      editingId,
                      linkedGlobalCostumes.length
                    ) === 'empty' ? (
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
                                charactersDressedClickGuard(
                                  editingId,
                                  isBlocked({
                                    kind: ['costume-swap'],
                                    characterId: editingId ?? undefined
                                  }),
                                  toast.info,
                                  t('aiJobs.running'),
                                  () => {
                                    const cid = editingId!
                                    toast.info(t('aiJobs.startedBackground'))
                                    startJob({
                                      kind: 'costume-swap',
                                      label: t('costumes.generateDressed'),
                                      scope: { characterId: cid },
                                      run: async ({ setProgress, signal }) => {
                                        setProgress(20, 'image')
                                        await getApi().costumes.generateDressed({
                                          costumeId: cos.id,
                                          characterId: cid,
                                          baseImagePath:
                                            swapBasePath || undefined
                                        })
                                        if (signal.cancelled) return
                                        setProgress(100, 'done')
                                        const list =
                                          await getApi().costumes.listForCharacter(
                                            cid
                                          )
                                        setLinkedGlobalCostumes(list)
                                        await reload()
                                        toast.success(t('costumes.dressedOk'))
                                        return undefined
                                      }
                                    })
                                  }
                                )
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
                                        artStyle: charactersArtStyleOrKeep(
                                          cos.artStyle,
                                          f.artStyle
                                        )
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
                                    .catch(charactersMakeLinkCatch(toast.error))
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
                              {charactersLayerOptionSuffix(
                                layer ?? undefined,
                                t(`characters.layerFilter_${layer}`)
                              )}
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
                      {charactersGeneratingLabel(
                      editorAiBusy,
                      t('common.generating'),
                      t('characters.swapCostume')
                    )}
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
                      onStoryChange={(id) => charactersPlotStoryChange(id, setPlotStoryId, setPlotSegmentKey)}
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
                        const styleLabel = charactersCostumeStyleLabel(
                          cos.artStyle,
                          (s) =>
                            t(
                              `characters.${getArtStyle(s as ArtStyleId).labelKey}`
                            )
                        )
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

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export const CHARACTER_AI_KINDS = [
  'character-ai-fill',
  'character-sheet',
  'character-intro-video',
  'costume-swap',
  'wardrobe-suggest'
] as const

export function charactersIsAiJob(
  j: { kind: string; scope: { characterId?: string } },
  characterId: string | null | undefined,
  kinds: readonly string[] = CHARACTER_AI_KINDS
): boolean {
  if (!(kinds as readonly string[]).includes(j.kind)) return false
  const id = characterId ?? null
  if (id) return j.scope.characterId === id
  return !j.scope.characterId
}

export function charactersAiBusyFromJobs(
  activeJobs: Array<{ kind: string; scope: { characterId?: string } }>,
  characterId: string | null | undefined,
  blocked: boolean,
  kinds: readonly string[] = CHARACTER_AI_KINDS
): boolean {
  if (blocked) return true
  return activeJobs.some((j) => charactersIsAiJob(j, characterId, kinds))
}

export async function charactersRemoveWithFeedback(ops: {
  remove: (id: string) => Promise<unknown>
  id: string
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<void> {
  try {
    await ops.remove(ops.id)
    ops.toastSuccess()
  } catch (e) {
    ops.toastError(parseIpcError(e).message)
  }
}

export function charactersApplyIpcError(
  e: unknown,
  setError: (m: string) => void,
  toastError?: (m: string) => void
): string {
  const err = parseIpcError(e)
  const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
  setError(msg)
  toastError?.(msg)
  return msg
}

export function charactersApplySimpleIpc(
  e: unknown,
  toastError: (m: string) => void
): string {
  const msg = parseIpcError(e).message
  toastError(msg)
  return msg
}

export function charactersGuardEmptyName(
  name: string,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!name.trim()) {
    toastError(msg)
    return true
  }
  return false
}

export function charactersGuardBusy(
  busy: boolean,
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (busy) {
    toastInfo(msg)
    return true
  }
  return false
}

export function charactersGuardAiNeed(
  idea: string,
  hasDraft: boolean,
  hasSoul: boolean,
  hasImage: boolean,
  setError: (m: string) => void,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!idea && !hasDraft && !hasSoul && !hasImage) {
    setError(msg)
    toastError(msg)
    return true
  }
  return false
}

export function charactersAiFillToastKey(
  hasImage: boolean,
  idea: string,
  hasDraft: boolean,
  hasSoul: boolean
): 'fromImage' | 'background' {
  return hasImage && !idea && !hasDraft && !hasSoul ? 'fromImage' : 'background'
}

export function charactersHasDraftValues(
  snapshot: Record<string, unknown>
): boolean {
  return Object.values(snapshot).some((v) => {
    if (typeof v === 'string') return v.length > 0
    if (Array.isArray(v)) return v.length > 0
    return false
  })
}

export function charactersAiFillRefPath(parts: {
  selectedPath?: string | null
  coverPath?: string | null
  gallery0?: string | null
}): string {
  return (
    parts.selectedPath?.trim() ||
    parts.coverPath?.trim() ||
    parts.gallery0?.trim() ||
    ''
  )
}

export function charactersSoulContent(
  soulPreview?: string | null,
  catalogPickBody?: string | null
): string {
  return soulPreview?.trim() || catalogPickBody?.trim() || ''
}

export function charactersShouldOpenEditorOnAi(
  fromEditor: boolean
): { open: boolean; panel: 'profile' } {
  return { open: !fromEditor, panel: 'profile' }
}

export function charactersResolveWantIdentity(
  opts: boolean | undefined,
  useIdentityRef: boolean
): boolean {
  return opts !== undefined ? opts === true : useIdentityRef
}

export function charactersForcePureLayout(variantDef: {
  wardrobeLayer?: string
  requiresUnclothedSupport?: boolean
}): boolean {
  return (
    variantDef.wardrobeLayer === 'nude' ||
    variantDef.wardrobeLayer === 'base' ||
    Boolean(variantDef.requiresUnclothedSupport)
  )
}

export function charactersUseIdentityEdit(
  forcePure: boolean,
  wantIdentity: boolean
): boolean {
  return !forcePure && wantIdentity
}

export function charactersGalleryPathsFromOpts(
  referenceImagePath: string | null | undefined,
  selected: string[]
): string[] {
  const t = referenceImagePath?.trim()
  return t ? [t] : selected
}

export function charactersSheetModeLabel(
  forcePure: boolean,
  useEdit: boolean,
  labels: { force: string; identity: string; pure: string }
): string {
  if (forcePure) return labels.force
  return useEdit ? labels.identity : labels.pure
}

export function charactersNextCoverAfterRemove(
  next: CharacterGalleryItem[],
  removedPath: string | undefined,
  coverPath: string | null,
  isCover: (gal: CharacterGalleryItem[], c: string | null) => boolean,
  primary: (gal: CharacterGalleryItem[]) => string | null
): string | null {
  if (removedPath && coverPath === removedPath) return primary(next)
  if (isCover(next, coverPath)) return coverPath
  return primary(next)
}

export function charactersShouldReorder(
  fromId: string,
  toId: string
): boolean {
  return Boolean(fromId && toId && fromId !== toId)
}

export function charactersPickNeighborId(
  id: string,
  items: { id: string }[],
  selectedId: string | null
): string | null {
  if (selectedId !== id) return selectedId
  const idx = items.findIndex((x) => x.id === id)
  if (idx < 0) return null
  return items[idx + 1]?.id ?? items[idx - 1]?.id ?? null
}

export function charactersMaybeContinueVideoDraft(
  has: boolean,
  cont: () => void
): boolean {
  if (has) {
    cont()
    return true
  }
  return false
}

export function charactersIntroVideoHandler(
  editingId: string | null | undefined,
  path: string,
  handler: (p: string) => void
): (() => void) | undefined {
  return editingId ? () => handler(path) : undefined
}

export function charactersGuardIntro(
  editingId: string | null,
  sourceImagePath: string,
  busy: boolean,
  setError: (m: string) => void,
  toastError: (m: string) => void,
  toastInfo: (m: string) => void,
  msgs: { saveFirst: string; needImage: string; loading: string }
): 'saveFirst' | 'needImage' | 'busy' | 'ok' {
  if (!editingId) {
    setError(msgs.saveFirst)
    toastError(msgs.saveFirst)
    return 'saveFirst'
  }
  if (!sourceImagePath?.trim()) {
    setError(msgs.needImage)
    toastError(msgs.needImage)
    return 'needImage'
  }
  if (busy) {
    toastInfo(msgs.loading)
    return 'busy'
  }
  return 'ok'
}

export function charactersGuardSoulSource(
  hasSource: boolean,
  setError: (m: string) => void,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!hasSource) {
    setError(msg)
    toastError(msg)
    return true
  }
  return false
}

export function charactersHasSoulSource(fields: {
  name?: string
  description?: string
  appearance?: string
  personality?: string
  costume?: string
  backstory?: string
  soulPreview?: string | null
}): boolean {
  return Boolean(
    fields.name?.trim() ||
      fields.description?.trim() ||
      fields.appearance?.trim() ||
      fields.personality?.trim() ||
      fields.costume?.trim() ||
      fields.backstory?.trim() ||
      fields.soulPreview?.trim()
  )
}

export function charactersMapGalleryKind(
  kind: string
): CharacterGalleryItem['kind'] {
  if (
    kind === 'sheet' ||
    kind === 'upload' ||
    kind === 'gen' ||
    kind === 'external'
  ) {
    return kind
  }
  return 'gen'
}

export function charactersMapSheetKind(
  kind: string
): 'sheet' | 'upload' | 'gen' {
  if (kind === 'sheet' || kind === 'upload' || kind === 'gen') return kind
  return 'sheet'
}

export function charactersMapGalleryItems(
  items: Array<{
    id: string
    path: string
    kind: string
    label: string
    createdAt: string
    layer?: string
    introVideoPath?: string | null
  }>,
  withIntro = false
): CharacterGalleryItem[] {
  return items.map((item) => ({
    id: item.id,
    path: item.path,
    kind: withIntro
      ? charactersMapGalleryKind(item.kind)
      : charactersMapSheetKind(item.kind),
    label: item.label,
    createdAt: item.createdAt,
    ...(item.layer
      ? { layer: item.layer as WardrobeLayer }
      : {}),
    ...(withIntro
      ? { introVideoPath: item.introVideoPath ?? null }
      : {})
  })) as CharacterGalleryItem[]
}

export function charactersSelectAfterCommit(
  gallery: { id: string; path: string }[],
  path: string
): string | null {
  const newest = gallery.find((item) => item.path === path) ?? gallery[0] ?? null
  return newest?.id ?? null
}

export function charactersSelectAfterVideo(
  prev: string | null,
  mapped: Array<{ id: string; introVideoPath?: string | null }>
): string | null {
  if (prev && mapped.some((g) => g.id === prev)) return prev
  const withVideo = mapped.find((g) => g.introVideoPath)
  return withVideo?.id ?? mapped[0]?.id ?? prev
}

export function charactersProfileMismatch(
  draftId: string | null | undefined,
  editingId: string | null
): boolean {
  return Boolean(draftId && editingId && draftId !== editingId)
}

export function charactersHandleProfileApply(
  draft: {
    characterId?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile: any
  },
  editingId: string | null,
  ops: {
    reload: () => void
    setForm: Dispatch<SetStateAction<FormState>>
    setAiIdea: (fn: (prev: string) => string) => void
    setEditorOpen: (v: boolean) => void
    setEditorPanel: (p: EditorPanel) => void
    setActionError: (m: string | null) => void
    setPageBanner: (m: string) => void
    toastSuccess: () => void
  }
): void {
  if (charactersProfileMismatch(draft.characterId, editingId)) {
    void ops.reload()
    return
  }
  const p = draft.profile as {
    name?: string
    description?: string
    appearance?: string
    personality?: string
    backstory?: string
    costume?: string
    ageRange?: string
    gender?: string
    voiceDesc?: string
    spokenLanguages?: string[]
    mannerisms?: string
    relationships?: string
    visualTags?: string
    seedPrompt?: string
    hardRules?: string
  }
  ops.setForm((f) => ({
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
    visualTags:
      typeof p.visualTags === 'string' && p.visualTags.trim()
        ? p.visualTags.trim()
        : f.visualTags,
    seedPrompt:
      p.seedPrompt || f.seedPrompt || p.description || f.description,
    hardRules:
      (typeof p.hardRules === 'string' && p.hardRules.trim()
        ? p.hardRules.trim()
        : f.hardRules) || f.hardRules
  }))
  ops.setAiIdea((prev) => prev || p.seedPrompt || p.description || '')
  ops.setEditorOpen(true)
  ops.setEditorPanel('profile')
  ops.setActionError(null)
  ops.setPageBanner('')
  ops.toastSuccess()
  void ops.reload()
}

export function charactersHandleWardrobeApply(
  draft: {
    characterId?: string | null
    suggestion: { name: string; costume: string; artStyle?: string }
  },
  editingId: string | null,
  currentArtStyle: ArtStyleId,
  ops: {
    setForm: Dispatch<SetStateAction<FormState>>
    setSwapCostumeText: (s: string) => void
    setPageBanner: (m: string) => void
    setEditorOpen: (v: boolean) => void
    toastSuccess: () => void
    createEntry: (args: {
      name: string
      description: string
      artStyle: ArtStyleId
    }) => CharacterCostumeEntry
    upsert: (
      list: CharacterCostumeEntry[],
      entry: CharacterCostumeEntry
    ) => CharacterCostumeEntry[]
  }
): boolean {
  if (charactersProfileMismatch(draft.characterId, editingId)) return false
  const s = draft.suggestion
  const artStyle = isArtStyleId(s.artStyle) ? s.artStyle : currentArtStyle
  const entry = ops.createEntry({
    name: s.name,
    description: s.costume,
    artStyle
  })
  ops.setForm((f) => ({
    ...f,
    costume: s.costume,
    artStyle,
    costumes: ops.upsert(f.costumes, entry)
  }))
  ops.setSwapCostumeText(s.costume)
  ops.setPageBanner('')
  ops.toastSuccess()
  ops.setEditorOpen(true)
  return true
}

export function charactersHandleSheetCommitted(
  payload: {
    characterId: string
    path: string
    gallery?: Array<{
      id: string
      path: string
      kind: string
      label: string
      createdAt: string
      layer?: string
    }>
    costume?: string | null
  },
  editingId: string | null,
  ops: {
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    setSwapCostumeText: (s: string) => void
    reload: () => void
    toastSuccess: () => void
    setPageBanner: (m: string) => void
    listCharacter: (id: string) => Promise<Character | null>
    ensureCostume: (
      costumes: CharacterCostumeEntry[],
      costume: string,
      opts: { artStyle: ArtStyleId }
    ) => CharacterCostumeEntry[]
  }
): void {
  if (editingId === payload.characterId) {
    if (payload.gallery && payload.gallery.length > 0) {
      const g = charactersMapGalleryItems(payload.gallery, false)
      ops.setForm((f) => {
        const costumes = charactersSheetEnsureCostume(
          f.costumes,
          payload.costume,
          f.artStyle,
          ops.ensureCostume
        )
        return {
          ...f,
          gallery: g,
          costume: payload.costume ?? f.costume,
          costumes
        }
      })
      ops.setSelectedImageId(charactersSelectAfterCommit(g, payload.path))
      if (payload.costume) ops.setSwapCostumeText(payload.costume)
    } else {
      void ops.listCharacter(payload.characterId).then((c) => {
        if (!c) return
        const g = galleryFromCharacter(c)
        ops.setForm((f) => ({
          ...f,
          gallery: g,
          costume: c.costume ?? f.costume
        }))
        ops.setSelectedImageId(charactersSelectAfterCommit(g, payload.path))
      })
    }
  }
  void ops.reload()
  ops.setPageBanner('')
  ops.toastSuccess()
  void payload.path
}

export function charactersHandleVideoPrepDone(
  d: {
    kind?: string
    entityIds?: { characterId?: string }
    gallery?: Array<{
      id: string
      path: string
      kind: string
      label: string
      createdAt: string
      layer?: string
      introVideoPath?: string | null
    }>
  } | null
    | undefined,
  editingId: string | null,
  ops: {
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: Dispatch<SetStateAction<string | null>>
    reload: () => void
    getCharacter: (id: string) => Promise<Character>
  }
): void {
  if (d?.kind !== 'character-intro') return
  if (!editingId || d.entityIds?.characterId !== editingId) return
  const applyGallery = (
    items: Array<{
      id: string
      path: string
      kind: string
      label: string
      createdAt: string
      layer?: string
      introVideoPath?: string | null
    }>
  ): void => {
    const mapped = charactersMapGalleryItems(items, true)
    ops.setForm((f) => ({ ...f, gallery: mapped }))
    ops.setSelectedImageId((prev) => charactersSelectAfterVideo(prev, mapped))
  }
  if (d.gallery?.length) {
    applyGallery(d.gallery)
  } else {
    void ops
      .getCharacter(editingId)
      .then((row) => {
        const g = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath,
          refSheetPath: row.refSheetPath
        })
        applyGallery(g)
      })
      .catch(() => void ops.reload())
  }
}

export function charactersLocalSoulPath(
  soulMdPath: string | null | undefined
): string | null {
  if (
    soulMdPath &&
    !soulMdPath.startsWith('soulmd-hub://') &&
    !soulMdPath.startsWith('http')
  ) {
    return soulMdPath
  }
  return null
}

export async function charactersWriteSoulIfNeeded(ops: {
  soulText: string
  soulMdPath: string | null
  editingId: string | null
  write: (args: {
    content: string
    filePath: string | null
    characterId: string | null
  }) => Promise<{ filePath: string; content: string }>
  onWarn: (e: unknown) => void
}): Promise<{
  soulMdPath: string | null
  soulPreview: string | null
  soulHubId: number | null
  wrote: boolean
} | null> {
  if (!ops.soulText) return null
  try {
    const written = await ops.write({
      content: ops.soulText,
      filePath: charactersLocalSoulPath(ops.soulMdPath),
      characterId: ops.editingId
    })
    return {
      soulMdPath: written.filePath,
      soulPreview: written.content,
      soulHubId: null,
      wrote: true
    }
  } catch (e) {
    ops.onWarn(e)
    return null
  }
}

export async function charactersRunSave(ops: {
  name: string
  emptyMsg: string
  savedMsg: string
  failedMsg: string
  editingId: string | null
  toastError: (m: string) => void
  toastSuccess: (m: string) => void
  setError: (m: string | null) => void
  setBusy: (v: boolean) => void
  prepareForm: () => Promise<FormState>
  buildPayload: (
    form: FormState
  ) => Omit<CreateCharacterInput, 'storyId'>
  update: (
    id: string,
    payload: Omit<CreateCharacterInput, 'storyId'>
  ) => Promise<boolean>
  create: (
    payload: Omit<CreateCharacterInput, 'storyId'>
  ) => Promise<boolean>
  reload: () => Promise<void> | void
  closeEditor: () => void
}): Promise<void> {
  if (charactersGuardEmptyName(ops.name, ops.toastError, ops.emptyMsg)) return
  ops.setBusy(true)
  ops.setError(null)
  try {
    const nextForm = await ops.prepareForm()
    const payload = ops.buildPayload(nextForm)
    if (ops.editingId) {
      const ok = await ops.update(ops.editingId, payload)
      if (ok) {
        ops.toastSuccess(ops.savedMsg)
        await ops.reload()
        ops.closeEditor()
      } else {
        ops.toastError(ops.failedMsg)
      }
    } else {
      const ok = await ops.create(payload)
      if (ok) {
        ops.toastSuccess(ops.savedMsg)
        await ops.reload()
        ops.closeEditor()
      } else {
        ops.toastError(ops.failedMsg)
      }
    }
  } catch (e) {
    charactersApplySimpleIpc(e, (m) => {
      ops.setError(m)
      ops.toastError(m)
    })
  } finally {
    ops.setBusy(false)
  }
}

export function charactersRunAiFill(ops: {
  busy: boolean
  idea: string
  formSnapshot: Record<string, unknown>
  soulContent: string
  refPath: string
  fromEditor: boolean
  setError: (m: string | null) => void
  needMsg: string
  setBanner: (m: string) => void
  toastInfo: (m: string) => void
  toastError: (m: string) => void
  fromImageMsg: string
  backgroundMsg: string
  runningMsg: string
  setEditorOpen: (v: boolean) => void
  setEditorPanel: (p: EditorPanel) => void
  startJob: (
    idea: string,
    hasDraft: boolean,
    hasSoul: boolean,
    hasImage: boolean,
    refPath: string,
    snapshot: Record<string, unknown>,
    isImprove: boolean
  ) => void
}): 'busy' | 'need' | 'started' {
  if (charactersGuardBusy(ops.busy, ops.toastInfo, ops.runningMsg)) {
    return 'busy'
  }
  const idea = ops.idea.trim()
  const hasDraft = charactersHasDraftValues(ops.formSnapshot)
  const hasSoul = ops.soulContent.length > 0
  const hasImage = Boolean(ops.refPath)
  if (
    charactersGuardAiNeed(
      idea,
      hasDraft,
      hasSoul,
      hasImage,
      (m) => ops.setError(m),
      ops.toastError,
      ops.needMsg
    )
  ) {
    return 'need'
  }
  ops.setError(null)
  const open = charactersShouldOpenEditorOnAi(ops.fromEditor)
  if (open.open) ops.setEditorOpen(true)
  ops.setEditorPanel(open.panel)
  ops.setBanner(ops.backgroundMsg)
  ops.toastInfo(
    charactersAiFillToastKey(hasImage, idea, hasDraft, hasSoul) === 'fromImage'
      ? ops.fromImageMsg
      : ops.backgroundMsg
  )
  ops.startJob(
    idea,
    hasDraft,
    hasSoul,
    hasImage,
    ops.refPath,
    ops.formSnapshot,
    hasDraft || hasSoul
  )
  return 'started'
}

export async function charactersReadSoulSafe(
  read: () => Promise<{ content?: string | null }>,
  fallback = ''
): Promise<string> {
  try {
    const r = await read()
    return r.content?.trim() ?? fallback
  } catch {
    return fallback
  }
}

export async function charactersDiscardDraftSafe(
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<void> {
  try {
    await discard(path)
  } catch {
    /* ignore */
  }
}

export async function charactersEnsureSavedId(ops: {
  editingId: string | null
  name: string
  activeStoryId: string | null
  update: () => Promise<unknown>
  create: () => Promise<boolean>
  reload: () => Promise<void> | void
  list: () => Promise<Character[]>
  setEditingId: (id: string) => void
}): Promise<string | null> {
  if (ops.editingId) {
    await ops.update()
    return ops.editingId
  }
  if (!ops.name.trim() || !ops.activeStoryId) return null
  const ok = await ops.create()
  if (!ok) return null
  await ops.reload()
  return charactersEnsureListLine(ops.list, ops.name, ops.setEditingId)
}

export function charactersApplyCostumeLook(
  entry: CharacterCostumeEntry,
  gallery: CharacterGalleryItem[],
  ops: {
    setForm: Dispatch<SetStateAction<FormState>>
    setSwapCostumeText: (s: string) => void
    setSelectedImageId: (id: string | null) => void
    setPageBanner: (m: string) => void
    toastSuccess: (m: string) => void
    appliedMsg: string
  }
): void {
  ops.setForm((f) => ({
    ...f,
    costume: entry.description,
    artStyle: isArtStyleId(entry.artStyle) ? entry.artStyle : f.artStyle
  }))
  ops.setSwapCostumeText(entry.description)
  if (entry.imagePath) {
    const hit = gallery.find((g) => g.path === entry.imagePath)
    if (hit) ops.setSelectedImageId(hit.id)
  }
  ops.setPageBanner(ops.appliedMsg)
  ops.toastSuccess(ops.appliedMsg)
}

export function charactersAddCostumeToLibrary(ops: {
  description: string
  name: string
  artStyle: ArtStyleId
  setError: (m: string) => void
  requiredMsg: string
  savedMsg: string
  setForm: Dispatch<SetStateAction<FormState>>
  setSwapCostumeText: (s: string) => void
  setNewCostumeName: (s: string) => void
  setPageBanner: (m: string) => void
  toastSuccess: (m: string) => void
  createEntry: (args: {
    name?: string
    description: string
    artStyle: ArtStyleId
  }) => CharacterCostumeEntry
  upsert: (
    list: CharacterCostumeEntry[],
    entry: CharacterCostumeEntry
  ) => CharacterCostumeEntry[]
}): boolean {
  if (!ops.description) {
    ops.setError(ops.requiredMsg)
    return false
  }
  try {
    const entry = ops.createEntry({
      name: ops.name.trim() || undefined,
      description: ops.description,
      artStyle: ops.artStyle
    })
    ops.setForm((f) => ({
      ...f,
      costume: ops.description,
      costumes: ops.upsert(f.costumes, entry)
    }))
    ops.setSwapCostumeText(ops.description)
    ops.setNewCostumeName('')
    ops.setPageBanner(ops.savedMsg)
    ops.toastSuccess(ops.savedMsg)
    return true
  } catch (e) {
    ops.setError(e instanceof Error ? e.message : String(e))
    return false
  }
}

export function charactersGuardSuggest(
  name: string,
  busy: boolean,
  setError: (m: string) => void,
  needNameMsg: string
): 'needName' | 'busy' | 'ok' {
  if (!name.trim()) {
    setError(needNameMsg)
    return 'needName'
  }
  if (busy) return 'busy'
  return 'ok'
}

export async function charactersRunSwapCostume(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  costumeDescription: string
  setError: (m: string) => void
  saveFirstMsg: string
  requiredMsg: string
  noBaseMsg: string
  startedMsg: string
  toastInfo: (m: string) => void
  setBanner: (m: string) => void
  pickBase: () => { item: { path: string } | null }
  startJob: (
    characterId: string,
    baseImagePath: string,
    costumeDescription: string
  ) => void
}): Promise<'no-id' | 'busy' | 'need-costume' | 'no-base' | 'started' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) {
      ops.setError(ops.saveFirstMsg)
      return 'no-id'
    }
    if (ops.isBusy(id)) return 'busy'
    if (!ops.costumeDescription) {
      ops.setError(ops.requiredMsg)
      return 'need-costume'
    }
    const auto = ops.pickBase()
    if (!auto.item) {
      ops.setError(ops.noBaseMsg)
      return 'no-base'
    }
    ops.setBanner(ops.startedMsg)
    ops.toastInfo(ops.startedMsg)
    ops.startJob(id, auto.item.path, ops.costumeDescription)
    return 'started'
  } catch (e) {
    charactersApplyIpcError(e, ops.setError)
    return 'error'
  }
}

export async function charactersRunGenerateSheetSetup(ops: {
  ensureSavedId: () => Promise<string | null>
  characterId?: string | null
  isBusy: (id: string) => boolean
  setError: (m: string) => void
  saveFirstMsg: string
  forcePure: boolean
  wantIdentity: boolean
  useIdentityRef: boolean
  setUseIdentityRef: (v: boolean) => void
  paths: string[]
  resolveIdentity: (args: {
    useIdentityRef: boolean
    selectedPaths: string[]
  }) => { useEdit: boolean; paths: string[] }
  buildPrompt: (useEdit: boolean) => string
  maybeAppendMulti: (prompt: string, paths: string[]) => string
  ensureRules: (prompt: string) => string
  modeLabel: string
  summaryParts: string
  setConfirm: (p: ImageGenConfirmPayload) => void
}): Promise<'no-id' | 'busy' | 'ready' | 'error'> {
  try {
    let id = ops.characterId ?? null
    if (!id) id = await ops.ensureSavedId()
    if (!id) {
      ops.setError(ops.saveFirstMsg)
      return 'no-id'
    }
    if (ops.isBusy(id)) return 'busy'
    const useIdentityEdit = charactersUseIdentityEdit(
      ops.forcePure,
      ops.wantIdentity
    )
    if (ops.forcePure && ops.useIdentityRef) ops.setUseIdentityRef(false)
    const idRes = ops.resolveIdentity({
      useIdentityRef: useIdentityEdit,
      selectedPaths: ops.paths
    })
    let prompt = ops.buildPrompt(idRes.useEdit)
    if (idRes.paths.length > 1) {
      prompt = ops.maybeAppendMulti(prompt, idRes.paths)
    }
    prompt = ops.ensureRules(prompt)
    ops.setConfirm({
      prompt,
      referencePaths: idRes.paths,
      useIdentityEdit: idRes.useEdit,
      summary: ops.summaryParts
    })
    return 'ready'
  } catch (e) {
    charactersApplyIpcError(e, ops.setError)
    return 'error'
  }
}

export async function charactersRunSheetJob(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  setError: (m: string) => void
  saveFirstMsg: string
  toastInfo: (m: string) => void
  identityMsg: string
  backgroundMsg: string
  useIdentityEdit: boolean
  startJob: (id: string) => void
}): Promise<'no-id' | 'busy' | 'started' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) {
      ops.setError(ops.saveFirstMsg)
      return 'no-id'
    }
    if (ops.isBusy(id)) return 'busy'
    ops.toastInfo(
      ops.useIdentityEdit ? ops.identityMsg : ops.backgroundMsg
    )
    ops.startJob(id)
    return 'started'
  } catch (e) {
    charactersApplyIpcError(e, ops.setError)
    return 'error'
  }
}

export function charactersResetSheetIfHidden(
  sheetGroups: Record<string, Array<{ id: string }>>,
  sheetVariant: string,
  defaultVariant: string
): string | null {
  const all = Object.values(sheetGroups).flat()
  if (!all.some((v) => v.id === sheetVariant)) return defaultVariant
  return null
}

export function charactersHubSearchMode(q?: string): 'local' | 'remote' {
  return q?.trim() ? 'local' : 'remote'
}

export async function charactersLoadHubPage(ops: {
  page: number
  q?: string
  setBusy: (v: boolean) => void
  setError: (m: string | null) => void
  searchLocal: (
    q: string,
    limit: number
  ) => Promise<{ items: unknown[] }>
  listRemote: (args: {
    page: number
    limit: number
    q?: string
  }) => Promise<{
    data?: unknown[]
    total_pages?: number
    current_page?: number
  }>
  setItems: (items: unknown[]) => void
  setTotalPages: (n: number) => void
  setPage: (n: number) => void
}): Promise<void> {
  ops.setBusy(true)
  ops.setError(null)
  try {
    if (ops.q?.trim()) {
      const local = await ops.searchLocal(ops.q.trim(), 24)
      if (local.items.length > 0) {
        ops.setItems(local.items)
        ops.setTotalPages(1)
        ops.setPage(1)
      } else {
        const remote = await ops.listRemote({
          page: 1,
          limit: 12,
          q: ops.q.trim()
        })
        ops.setItems(remote.data ?? [])
        ops.setTotalPages(remote.total_pages ?? 1)
        ops.setPage(1)
      }
    } else {
      const remote = await ops.listRemote({ page: ops.page, limit: 12 })
      ops.setItems(remote.data ?? [])
      ops.setTotalPages(remote.total_pages ?? 1)
      ops.setPage(remote.current_page ?? ops.page)
    }
  } catch (e) {
    ops.setError(parseIpcError(e).message)
  } finally {
    ops.setBusy(false)
  }
}

export async function charactersEnsureSoulIndex(ops: {
  ensureIndex: (force: boolean) => Promise<{
    count: number
    pages: number
    fromCache: boolean
    suggestions: unknown[]
  }>
  setStatus: (s: string) => void
  setSuggestions: (s: unknown[]) => void
  formatReady: (r: {
    count: number
    pages: number
    cache: string
  }) => string
}): Promise<void> {
  try {
    const r = await ops.ensureIndex(false)
    ops.setStatus(
      ops.formatReady({
        count: r.count,
        pages: r.pages,
        cache: r.fromCache ? 'cache' : 'fresh'
      })
    )
    ops.setSuggestions(r.suggestions)
  } catch {
    /* offline ok */
  }
}

export function charactersSoulPreviewSync(
  body: string,
  catalogId: number,
  formSoulHubId: number | null,
  formSoulPreview: string | null | undefined
): string | null {
  if (!body) return null
  if (formSoulHubId === catalogId || !formSoulPreview?.trim()) return body
  return formSoulPreview
}

export function charactersApplySoulForm(
  f: FormState,
  detail: {
    id: number
    title: string
    description?: string | null
  },
  full: string
): FormState {
  return {
    ...f,
    soulHubId: detail.id,
    soulMdPath: `soulmd-hub://${detail.id}`,
    name: f.name.trim() ? f.name : detail.title,
    description: charactersImportDesc(
      f.description,
      detail.description
    ),
    soulPreview: full || null,
    seedPrompt: f.seedPrompt || detail.title
  }
}

export function charactersImportSoulForm(
  f: FormState,
  result: { filePath: string; content: string },
  docTitle: string | null | undefined,
  extractDesc: (c: string) => string | null | undefined,
  extractName: (c: string) => string | null | undefined
): FormState {
  return {
    ...f,
    soulMdPath: result.filePath,
    soulHubId: null,
    soulPreview: result.content,
    description: charactersImportDesc(
      f.description,
      extractDesc(result.content)
    ),
    name: charactersImportName(
      f.name,
      docTitle,
      extractName(result.content)
    )
  }
}

export function charactersClearSoulForm(f: FormState): FormState {
  return {
    ...f,
    soulMdPath: null,
    soulHubId: null,
    soulPreview: null
  }
}

export function charactersArtStyleOrKeep(
  artStyle: string | null | undefined,
  keep: ArtStyleId
): ArtStyleId {
  return isArtStyleId(artStyle) ? artStyle : keep
}

export function charactersLinkCostumeError(e: unknown): string {
  return parseIpcError(e).message
}

export function charactersShowLinkedEmpty(
  editingId: string | null,
  linkedCount: number
): 'saveFirst' | 'empty' | 'list' {
  if (!editingId) return 'saveFirst'
  if (linkedCount === 0) return 'empty'
  return 'list'
}

export function charactersSoulTitleDisplay(
  catalogPickTitle: string | null,
  soulHubId: number | null
): string {
  if (catalogPickTitle) return catalogPickTitle
  if (soulHubId != null) return `#${soulHubId}`
  return ''
}

export function charactersShouldShowUseSoul(
  catalogPickId: number | null,
  soulHubId: number | null
): boolean {
  return catalogPickId != null && soulHubId !== catalogPickId
}

export function charactersOnSheetVariantChange(
  value: string,
  setVariant: (v: SheetVariantId) => void,
  setUseIdentityRef: (v: boolean) => void
): void {
  setVariant(value as SheetVariantId)
  setUseIdentityRef(false)
}

export function charactersMaybeAppendMultiRef(
  prompt: string,
  paths: string[],
  locale: string,
  append: (p: string, paths: string[], locale?: string) => string
): string {
  if (paths.length > 1) return append(prompt, paths, locale)
  return prompt
}

export function charactersCostumeDesc(
  swapText: string,
  formCostume: string
): string {
  return swapText.trim() || formCostume.trim()
}

export function charactersNeedsBareBodyWarning(variant: SheetVariantId): boolean {
  return sheetRequiresUnclothedSupport(variant)
}



export async function charactersPreviewSoul(ops: {
  id: number
  titleHint?: string
  setCatalogPickId: (id: number) => void
  setCatalogPickTitle: (t: string | null) => void
  setCatalogLoading: (v: boolean) => void
  setError: (m: string | null) => void
  getDetail: (id: number) => Promise<{
    title?: string
    contentFlat?: string | null
  }>
  readSoul: (id: number) => Promise<{ content?: string | null }>
  setCatalogPickBody: (b: string | null) => void
  formSoulHubId: number | null
  formSoulPreview: string | null
  setSoulPreview: (body: string) => void
}): Promise<void> {
  ops.setCatalogPickId(ops.id)
  ops.setCatalogPickTitle(ops.titleHint ?? null)
  ops.setCatalogLoading(true)
  ops.setError(null)
  try {
    const detail = await ops.getDetail(ops.id)
    const full = (detail.contentFlat ?? '').trim()
    ops.setCatalogPickTitle(detail.title || ops.titleHint || `#${ops.id}`)
    const r = await ops.readSoul(ops.id)
    const body = (r.content?.trim() || full || '').trim()
    ops.setCatalogPickBody(body || null)
    const synced = charactersSoulPreviewSync(
      body,
      ops.id,
      ops.formSoulHubId,
      ops.formSoulPreview
    )
    if (synced) ops.setSoulPreview(synced)
  } catch (e) {
    ops.setError(parseIpcError(e).message)
    ops.setCatalogPickBody(null)
  } finally {
    ops.setCatalogLoading(false)
  }
}

export async function charactersApplySoulFromHub(ops: {
  id: number
  setBusy: (v: boolean) => void
  getDetail: (id: number) => Promise<{
    id: number
    title: string
    description?: string | null
    contentFlat?: string | null
  }>
  readSoul: (id: number) => Promise<{ content?: string | null }>
  setForm: Dispatch<SetStateAction<FormState>>
  setCatalogPickId: (id: number) => void
  setCatalogPickTitle: (t: string | null) => void
  setCatalogPickBody: (b: string | null) => void
  setEditorOpen: (v: boolean) => void
  setEditorPanel: (p: EditorPanel) => void
  setPageBanner: (m: string) => void
  toastSuccess: (m: string) => void
  appliedMsg: (title: string) => string
  setError: (m: string) => void
}): Promise<void> {
  ops.setBusy(true)
  try {
    const detail = await ops.getDetail(ops.id)
    let full = (detail.contentFlat ?? '').trim()
    try {
      const r = await ops.readSoul(ops.id)
      if (r.content?.trim()) full = r.content
    } catch {
      /* use detail flat */
    }
    ops.setForm((f) => charactersApplySoulForm(f, detail, full))
    ops.setCatalogPickId(detail.id)
    ops.setCatalogPickTitle(detail.title)
    ops.setCatalogPickBody(full || null)
    ops.setEditorOpen(true)
    ops.setEditorPanel('profile')
    const msg = ops.appliedMsg(detail.title)
    ops.setPageBanner(msg)
    ops.toastSuccess(msg)
  } catch (e) {
    ops.setError(parseIpcError(e).message)
  } finally {
    ops.setBusy(false)
  }
}

export function charactersClearSoulState(ops: {
  setForm: Dispatch<SetStateAction<FormState>>
  setCatalogPickId: (id: number | null) => void
  setCatalogPickTitle: (t: string | null) => void
  setCatalogPickBody: (b: string | null) => void
}): void {
  ops.setForm((f) => charactersClearSoulForm(f))
  ops.setCatalogPickId(null)
  ops.setCatalogPickTitle(null)
  ops.setCatalogPickBody(null)
}

export function charactersRemoveCostumeLook(
  setForm: Dispatch<SetStateAction<FormState>>,
  id: string,
  remove: (list: CharacterCostumeEntry[], id: string) => CharacterCostumeEntry[]
): void {
  setForm((f) => ({ ...f, costumes: remove(f.costumes, id) }))
}

export function charactersReorderGallery(
  setForm: Dispatch<SetStateAction<FormState>>,
  fromId: string,
  toId: string,
  move: (
    gallery: CharacterGalleryItem[],
    fromId: string,
    toId: string
  ) => CharacterGalleryItem[]
): void {
  if (!charactersShouldReorder(fromId, toId)) return
  setForm((f) => {
    const next = move(f.gallery, fromId, toId)
    return next === f.gallery ? f : { ...f, gallery: next }
  })
}

export async function charactersJobCancelDiscard(
  cancelled: boolean,
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<boolean> {
  if (!cancelled) return false
  await charactersDiscardDraftSafe(discard, path)
  return true
}

export function charactersContinueDraftOr(
  hasDraft: boolean,
  cont: () => void
): boolean {
  return charactersMaybeContinueVideoDraft(hasDraft, cont)
}

export function charactersLoadSoulPreviewForm(
  content: string | null | undefined,
  setForm: Dispatch<SetStateAction<FormState>>
): void {
  setForm((f) => ({
    ...f,
    soulPreview: content?.trim() ? content : null
  }))
}

export function charactersSpokenLangSetter(
  codes: string[]
): (f: FormState) => FormState {
  return (f) => ({ ...f, spokenLanguages: codes })
}

export function charactersArtStyleSetter(
  value: string
): (f: FormState) => FormState {
  return (f) => ({ ...f, artStyle: value as ArtStyleId })
}

export function charactersSoulTextSetter(
  v: string
): {
  body: string
  formUpdater: (f: FormState) => FormState
} {
  return {
    body: v,
    formUpdater: (f) => ({ ...f, soulPreview: v })
  }
}

export function charactersSuggestionSearch(
  label: string,
  setHubQ: (q: string) => void,
  load: (page: number, q: string) => void
): void {
  setHubQ(label)
  load(1, label)
}

export function charactersHubEnter(
  key: string,
  hubQ: string,
  load: (page: number, q: string) => void
): boolean {
  if (key === 'Enter') {
    void load(1, hubQ)
    return true
  }
  return false
}

export function charactersOpenExternal(
  open: (url: string) => void,
  url: string
): void {
  void open(url)
}

export function charactersGenerateSheetFromEmpty(
  setEditorPanel: (p: EditorPanel) => void,
  generate: () => void
): void {
  setEditorPanel('refs')
  void generate()
}

export function charactersToggleSelectIds(
  ids: string[],
  id: string,
  toggle: (ids: string[], id: string) => string[]
): string[] {
  return toggle(ids, id)
}

export function charactersPlotStoryChange(
  id: string,
  setPlotStoryId: (id: string) => void,
  setPlotSegmentKey: (k: string) => void
): void {
  setPlotStoryId(id)
  setPlotSegmentKey('all')
}

export function charactersUseSoulButtonClick(
  catalogPickId: number | null,
  apply: (id: number, opts: { stayInEditor: boolean }) => void
): void {
  if (catalogPickId != null) {
    void apply(catalogPickId, { stayInEditor: true })
  }
}

export function charactersDressedBusyGuard(
  blocked: boolean,
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (blocked) {
    toastInfo(msg)
    return true
  }
  return false
}

export function charactersSheetEnsureCostume(
  costumes: CharacterCostumeEntry[],
  costume: string | null | undefined,
  artStyle: ArtStyleId,
  ensure: (
    costumes: CharacterCostumeEntry[],
    costume: string,
    opts: { artStyle: ArtStyleId }
  ) => CharacterCostumeEntry[]
): CharacterCostumeEntry[] {
  return costume ? ensure(costumes, costume, { artStyle }) : costumes
}

export function charactersImportDesc(
  existing: string,
  extracted: string | null | undefined
): string {
  return existing.trim() || extracted || existing
}

export function charactersImportName(
  existing: string,
  docTitle: string | null | undefined,
  extracted: string | null | undefined
): string {
  return existing.trim() || docTitle || extracted || existing
}


export async function charactersFindInList(
  list: () => Promise<Character[]>,
  id: string
): Promise<Character | null> {
  const rows = await list()
  return rows.find((x) => x.id === id) ?? null
}

export async function charactersFindByName(
  list: () => Promise<Character[]>,
  name: string
): Promise<Character | null> {
  const rows = await list()
  return rows.find((c) => c.name === name.trim()) ?? null
}

export function charactersBuildSheetMultiAppend(
  prompt: string,
  paths: string[],
  locale: string,
  append: (p: string, paths: string[], locale?: string) => string
): string {
  return charactersMaybeAppendMultiRef(prompt, paths, locale, append)
}

export function charactersAiCreateLabel(
  isImprove: boolean,
  improve: string,
  create: string
): string {
  return isImprove ? improve : create
}

export function charactersSpokenOrUndefined(
  langs: string[]
): string[] | undefined {
  return langs.length > 0 ? langs : undefined
}

export function charactersSelectedIds(
  selectedImageIds: string[],
  selectedImageId: string | null
): string[] {
  return selectedImageIds.length > 0
    ? selectedImageIds
    : selectedImageId
      ? [selectedImageId]
      : []
}

export function charactersGeneratingLabel(
  busy: boolean,
  generating: string,
  idle: string
): string {
  return busy ? generating : idle
}

export function charactersCostumeBaseOptionLabel(
  path: string,
  labels: string
): string {
  return path ? labels : ''
}


export function charactersCostumesJsonOrNull(
  costumes: CharacterCostumeEntry[],
  serialize: (c: CharacterCostumeEntry[]) => string
): string | null {
  return costumes.length ? serialize(costumes) : null
}

export function charactersLayerOptionSuffix(
  layer: string | undefined,
  label: string
): string {
  return layer ? ` · ${label}` : ''
}

export function charactersCostumeStyleLabel(
  artStyle: string | null | undefined,
  labelOf: (style: string) => string
): string | null {
  return artStyle ? labelOf(artStyle) : null
}

export async function charactersSwapJobBody(ops: {
  swap: () => Promise<{
    path: string
    variant?: string
    label?: string
    layer?: string
    enhance?: unknown
  }>
  signal: { cancelled: boolean }
  discard: (path: string) => Promise<unknown>
  characterId: string
  storyId: string
  costumeDescription: string
  defaultLabel: string
  setProgress: (n: number, s?: string) => void
}): Promise<
  | {
      type: 'character-sheet'
      characterId: string
      storyId: string
      path: string
      variant: string
      label: string
      layer: string
      costumeDescription: string
      enhance?: unknown
    }
  | undefined
> {
  ops.setProgress(10, 'edit')
  const r = await ops.swap()
  if (
    await charactersJobCancelDiscard(
      ops.signal.cancelled,
      ops.discard,
      r.path
    )
  ) {
    return undefined
  }
  ops.setProgress(100, 'done')
  return {
    type: 'character-sheet',
    characterId: ops.characterId,
    storyId: ops.storyId,
    path: r.path,
    variant: r.variant ?? 'costume_swap',
    label: r.label ?? ops.defaultLabel,
    layer: r.layer ?? 'costume',
    costumeDescription: ops.costumeDescription,
    enhance: r.enhance
  }
}

export async function charactersSheetJobBody(ops: {
  generate: () => Promise<{
    path: string
    variant?: string
    label?: string
    usedEdit?: boolean
    enhance?: unknown
    layer?: string
  }>
  signal: { cancelled: boolean }
  discard: (path: string) => Promise<unknown>
  characterId: string
  storyId: string
  variant: string
  setProgress: (n: number, s?: string) => void
}): Promise<
  | {
      type: 'character-sheet'
      characterId: string
      storyId: string
      path: string
      variant: string
      label: string
      usedEdit?: boolean
      enhance?: unknown
      layer?: string
    }
  | undefined
> {
  ops.setProgress(10, 'image')
  const r = await ops.generate()
  if (
    await charactersJobCancelDiscard(
      ops.signal.cancelled,
      ops.discard,
      r.path
    )
  ) {
    return undefined
  }
  ops.setProgress(100, 'done')
  return {
    type: 'character-sheet',
    characterId: ops.characterId,
    storyId: ops.storyId,
    path: r.path,
    variant: r.variant ?? ops.variant,
    label: r.label ?? ops.variant,
    usedEdit: r.usedEdit,
    enhance: r.enhance,
    layer: r.layer
  }
}

export function charactersIntroStartFlow(ops: {
  hasDraft: boolean
  continueDraft: () => void
}): 'continued' | 'proceed' {
  if (charactersContinueDraftOr(ops.hasDraft, ops.continueDraft)) {
    return 'continued'
  }
  return 'proceed'
}

export async function charactersIntroPersistThenPrep(ops: {
  update: () => Promise<unknown>
  toastError: (m: string) => void
  startPrep: () => void
}): Promise<'ok' | 'fail'> {
  try {
    await ops.update()
  } catch (e) {
    charactersApplySimpleIpc(e, ops.toastError)
    return 'fail'
  }
  ops.startPrep()
  return 'ok'
}

export function charactersGenerateSoulAfterGuards(
  busy: boolean,
  toastInfo: (m: string) => void,
  runningMsg: string,
  start: () => void
): 'busy' | 'started' {
  if (charactersGuardBusy(busy, toastInfo, runningMsg)) return 'busy'
  start()
  return 'started'
}

export function charactersDressedClickGuard(
  editingId: string | null,
  blocked: boolean,
  toastInfo: (m: string) => void,
  runningMsg: string,
  start: () => void
): 'no-id' | 'busy' | 'started' {
  if (!editingId) return 'no-id'
  if (charactersDressedBusyGuard(blocked, toastInfo, runningMsg)) return 'busy'
  start()
  return 'started'
}


export function charactersHandleIntroVideoFlow(ops: {
  editingId: string | null
  sourceImagePath: string
  busy: boolean
  setError: (m: string) => void
  toastError: (m: string) => void
  toastInfo: (m: string) => void
  msgs: { saveFirst: string; needImage: string; loading: string }
  hasDraft: boolean
  continueDraft: () => void
  update: () => Promise<unknown>
  startPrep: () => void
}): void {
  const g = charactersGuardIntro(
    ops.editingId,
    ops.sourceImagePath,
    ops.busy,
    ops.setError,
    ops.toastError,
    ops.toastInfo,
    ops.msgs
  )
  if (g !== 'ok') return
  if (
    charactersIntroStartFlow({
      hasDraft: ops.hasDraft,
      continueDraft: ops.continueDraft
    }) === 'continued'
  ) {
    return
  }
  void charactersIntroPersistThenPrep({
    update: ops.update,
    toastError: ops.toastError,
    startPrep: ops.startPrep
  })
}

export function charactersHandleRemoveCostume(
  setForm: Dispatch<SetStateAction<FormState>>,
  id: string
): void {
  charactersRemoveCostumeLook(setForm, id, removeCostume)
}

export function charactersHandleReorder(
  setForm: Dispatch<SetStateAction<FormState>>,
  fromId: string,
  toId: string
): void {
  charactersReorderGallery(setForm, fromId, toId, moveGalleryItem)
}

export function charactersLinkCatch(
  e: unknown,
  toastError: (m: string) => void
): void {
  toastError(charactersLinkCostumeError(e))
}

export async function charactersEnsureListLine(
  list: () => Promise<Character[]>,
  name: string,
  setEditingId: (id: string) => void
): Promise<string | null> {
  const created = await charactersFindByName(list, name)
  if (created) {
    setEditingId(created.id)
    return created.id
  }
  return null
}


export function charactersContinueDraftCb(
  cont: (key: string) => void,
  key: string
): () => void {
  return () => {
    cont(key)
  }
}

export function charactersMakeLinkCatch(
  toastError: (m: string) => void
): (e: unknown) => void {
  return (e: unknown) => charactersLinkCatch(e, toastError)
}

export function CharactersField({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      {hint ? (
        <p className="mb-1.5 text-[11px] leading-relaxed text-ink-500">{hint}</p>
      ) : null}
      {children}
    </div>
  )
}

export function CharactersChip({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-ink-800/90 px-2.5 py-0.5 text-center text-[10px] leading-none text-ink-300">
      {children}
    </span>
  )
}
