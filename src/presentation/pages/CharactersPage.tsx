import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  appendGalleryItem,
  parseCharacterGallery,
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
import { useCharacters } from '../hooks/useCharacters'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { PageHeader } from '../components/PageHeader'
import { Button, EmptyState, Input, Label, Textarea } from '../components/ui'

type Tab = 'library' | 'hub' | 'ai'

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
  mannerisms: string
  relationships: string
  visualTags: string
  seedPrompt: string
  soulMdPath: string | null
  soulHubId: number | null
  soulPreview: string | null
  gallery: CharacterGalleryItem[]
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
  mannerisms: '',
  relationships: '',
  visualTags: '',
  seedPrompt: '',
  soulMdPath: null,
  soulHubId: null,
  soulPreview: null,
  gallery: []
})

function galleryFromCharacter(c: Character): CharacterGalleryItem[] {
  return parseCharacterGallery(c.refGalleryJson, {
    refImagePath: c.refImagePath,
    refSheetPath: c.refSheetPath
  })
}

function coverPath(c: Character): string | null {
  const g = galleryFromCharacter(c)
  return primaryGalleryPath(g) ?? c.refImagePath ?? c.refSheetPath ?? null
}

export function CharactersPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { activeStoryId } = useApp()
  const { items, loading, error, create, update, remove, reload } =
    useCharacters(activeStoryId)

  const [tab, setTab] = useState<Tab>('library')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [aiIdea, setAiIdea] = useState('')
  const [sheetVariant, setSheetVariant] = useState<
    'bible' | 'turnaround' | 'expression' | 'costume'
  >('bible')

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
    setEditorOpen(true)
    setTab('library')
  }

  const openEdit = (c: Character): void => {
    const gallery = galleryFromCharacter(c)
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
      mannerisms: c.mannerisms ?? '',
      relationships: c.relationships ?? '',
      visualTags: c.visualTags ?? '',
      seedPrompt: c.seedPrompt ?? '',
      soulMdPath: c.soulMdPath,
      soulHubId: c.soulHubId ?? null,
      soulPreview: null,
      gallery
    })
    // Prefill improve box with seed / short brief for instant refine
    setAiIdea(c.seedPrompt?.trim() || '')
    setSelectedImageId(gallery[0]?.id ?? null)
    setEditorOpen(true)
  }

  const payload = (): Omit<CreateCharacterInput, 'storyId'> => {
    const primary = primaryGalleryPath(form.gallery)
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
      mannerisms: form.mannerisms || null,
      relationships: form.relationships || null,
      visualTags: form.visualTags || null,
      seedPrompt: form.seedPrompt || null,
      soulHubId: form.soulHubId
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      if (editingId) {
        const ok = await update(editingId, payload())
        if (ok) {
          setToast(t('characters.saved'))
          await reload()
        }
      } else {
        const ok = await create(payload())
        if (ok) {
          setToast(t('characters.saved'))
          await reload()
          const list = (await getApi().characters.list(
            activeStoryId!
          )) as Character[]
          const created = list.find((c) => c.name === form.name.trim())
          if (created) {
            openEdit(created)
          } else {
            closeEditor()
          }
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const handleAiFill = async (fromEditor = false): Promise<void> => {
    const idea = aiIdea.trim() || form.seedPrompt.trim()
    const hasDraft = Boolean(
      form.name.trim() ||
        form.description.trim() ||
        form.appearance.trim() ||
        form.personality.trim() ||
        form.voiceDesc.trim() ||
        form.mannerisms.trim()
    )
    if (!idea && !hasDraft) {
      setActionError(t('characters.ideaRequired'))
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      const locale = i18n.language === 'en' ? 'en' : 'zh-HK'
      const r = await getApi().characters.aiFill({
        idea: idea || undefined,
        storyId: activeStoryId ?? undefined,
        locale,
        existingDraft: hasDraft
          ? {
              name: form.name || undefined,
              description: form.description || undefined,
              appearance: form.appearance || undefined,
              personality: form.personality || undefined,
              backstory: form.backstory || undefined,
              costume: form.costume || undefined,
              ageRange: form.ageRange || undefined,
              gender: form.gender || undefined,
              voiceDesc: form.voiceDesc || undefined,
              mannerisms: form.mannerisms || undefined,
              relationships: form.relationships || undefined,
              visualTags: form.visualTags || undefined
            }
          : undefined
      })
      const p = r.profile
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
        mannerisms: p.mannerisms ?? f.mannerisms,
        relationships: p.relationships ?? f.relationships,
        visualTags: p.visualTags ?? f.visualTags,
        seedPrompt: idea || f.seedPrompt || p.description
      }))
      setEditorOpen(true)
      if (!fromEditor) setTab('library')
      setToast(
        hasDraft ? t('characters.aiImproveOk') : t('characters.aiFillOk')
      )
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    } finally {
      setBusy(false)
    }
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

  const handleGenerateSheet = async (): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      const id = await ensureSavedId()
      if (!id) {
        setActionError(t('characters.saveFirstForSheet'))
        return
      }
      const r = await getApi().characters.generateSheet({
        characterId: id,
        variant: sheetVariant
      })
      const next: CharacterGalleryItem[] = (r.gallery as CharacterGalleryItem[] | undefined) ??
        appendGalleryItem(form.gallery, {
          path: r.path,
          kind: 'sheet',
          label: sheetVariant
        })
      setForm((f) => ({ ...f, gallery: next }))
      setSelectedImageId(next[0]?.id ?? null)
      setToast(t('characters.sheetOkShort'))
      await reload()
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'upload',
      label: t('characters.uploadLabel')
    })
    setForm((f) => ({ ...f, gallery: next }))
    setSelectedImageId(next[0]?.id ?? null)
  }

  const handleRemoveImage = (id: string): void => {
    const next = removeGalleryItem(form.gallery, id)
    setForm((f) => ({ ...f, gallery: next }))
    setSelectedImageId(next[0]?.id ?? null)
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

  useEffect(() => {
    if (tab !== 'hub') return
    void loadHubPage(1)
    void getApi()
      .souls.ensureIndex(false)
      .then((r) => {
        setIndexStatus(
          t('characters.indexReady', {
            count: r.count,
            pages: r.pages,
            cache: r.fromCache ? 'cache' : 'fresh'
          })
        )
        setSuggestions(r.suggestions)
      })
      .catch(() => undefined)
  }, [tab, loadHubPage, t])

  const applySoulFromHub = async (id: number): Promise<void> => {
    setBusy(true)
    try {
      const detail = await getApi().souls.get(id)
      setForm((f) => ({
        ...f,
        soulHubId: detail.id,
        soulMdPath: `soulmd-hub://${detail.id}`,
        name: detail.title,
        description: detail.description || f.description,
        soulPreview: detail.contentFlat.slice(0, 800),
        seedPrompt: f.seedPrompt || detail.title
      }))
      setEditorOpen(true)
      setTab('library')
      setToast(t('characters.soulApplied', { title: detail.title }))
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
      soulPreview: doc.body.slice(0, 800),
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
  }

  if (!activeStoryId) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('characters.title')} subtitle={t('characters.subtitle')} />
        <div className="p-8">
          <EmptyState message={t('common.selectStory')} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('characters.title')}
        subtitle={t('characters.subtitle')}
        actions={
          <Button onClick={openCreate} className="shadow-lg shadow-brand-900/30">
            + {t('characters.new')}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-ink-800/80 px-8">
        <div className="flex gap-1">
          {(
            [
              ['library', t('characters.tabLibrary')],
              ['hub', t('characters.soulHub')],
              ['ai', t('characters.aiCreate')]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'relative px-4 py-3 text-sm font-medium transition',
                tab === id
                  ? 'text-brand-200'
                  : 'text-ink-400 hover:text-ink-200'
              ].join(' ')}
            >
              {label}
              {tab === id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {(error || actionError) && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {error?.message ?? actionError}
          </div>
        )}
        {toast && (
          <div className="mb-4 rounded-xl border border-brand-800/40 bg-brand-950/50 px-4 py-3 text-sm text-brand-100">
            {toast}
            <button
              type="button"
              className="ml-3 text-xs text-brand-300 underline"
              onClick={() => setToast(null)}
            >
              OK
            </button>
          </div>
        )}

        {/* ─── Library ─── */}
        {tab === 'library' && !editorOpen && (
          <>
            {loading ? (
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            ) : items.length === 0 ? (
              <div className="mx-auto max-w-md py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-2xl">
                  🎭
                </div>
                <p className="text-ink-300">{t('characters.noCharacters')}</p>
                <div className="mt-6 flex justify-center gap-2">
                  <Button onClick={openCreate}>{t('characters.new')}</Button>
                  <Button variant="secondary" onClick={() => setTab('ai')}>
                    {t('characters.aiCreate')}
                  </Button>
                  <Button variant="ghost" onClick={() => setTab('hub')}>
                    {t('characters.soulHub')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((c) => {
                  const cover = coverPath(c)
                  const count = galleryFromCharacter(c).length
                  return (
                    <article
                      key={c.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-900/40 shadow-xl shadow-black/20 transition hover:border-brand-700/40 hover:shadow-brand-950/20"
                    >
                      <button
                        type="button"
                        className="relative aspect-[4/3] w-full overflow-hidden bg-ink-950"
                        onClick={() => openEdit(c)}
                      >
                        {cover ? (
                          <LocalMediaImage
                            filePath={cover}
                            alt={c.name}
                            maxHeightClass="h-full max-h-none"
                            objectFit="cover"
                            className="h-full border-0 rounded-none"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-600">
                            <span className="text-3xl opacity-40">👤</span>
                            <span className="text-xs">{t('characters.refMissingBadge')}</span>
                          </div>
                        )}
                        {count > 0 && (
                          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-ink-100 backdrop-blur">
                            {count} {t('characters.photos')}
                          </span>
                        )}
                      </button>
                      <div className="flex flex-1 flex-col p-4">
                        <h2 className="truncate text-base font-semibold tracking-tight text-ink-50">
                          {c.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                          {c.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {c.ageRange && (
                            <Chip>{c.ageRange}</Chip>
                          )}
                          {c.gender && <Chip>{c.gender}</Chip>}
                          {c.voiceDesc && (
                            <Chip>🎙 {t('characters.voiceShort')}</Chip>
                          )}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="secondary"
                            className="flex-1 !py-1.5 text-xs"
                            onClick={() => openEdit(c)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            className="!py-1.5 text-xs text-rose-300"
                            onClick={() => {
                              if (confirm(t('common.confirmDelete'))) {
                                void remove(c.id)
                              }
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

        {/* ─── Editor (overlay panel) ─── */}
        {editorOpen && (
          <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/60 backdrop-blur-sm">
            <div className="flex h-full w-full max-w-3xl flex-col border-l border-ink-800 bg-ink-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-50">
                    {editingId ? t('common.edit') : t('characters.new')}
                  </h2>
                  <p className="text-xs text-ink-500">
                    {t('characters.editorHint')}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                  onClick={closeEditor}
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {/* Gallery */}
                <section className="mb-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink-200">
                      {t('characters.gallery')}
                    </h3>
                    <span className="text-[11px] text-ink-500">
                      {form.gallery.length} {t('characters.photos')}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/50">
                    {selectedImage ? (
                      <LocalMediaImage
                        filePath={selectedImage.path}
                        alt={selectedImage.label}
                        maxHeightClass="max-h-[min(50vh,520px)]"
                        showMeta
                        className="border-0 rounded-none"
                      />
                    ) : (
                      <div className="flex h-52 flex-col items-center justify-center gap-2 text-ink-600">
                        <span className="text-4xl opacity-30">🖼</span>
                        <span className="text-xs">{t('characters.noPhotos')}</span>
                      </div>
                    )}
                  </div>

                  {form.gallery.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {form.gallery.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedImageId(g.id)}
                          className={[
                            'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition',
                            selectedImageId === g.id ||
                            (!selectedImageId && g.id === form.gallery[0]?.id)
                              ? 'border-brand-500'
                              : 'border-ink-700 opacity-80 hover:opacity-100'
                          ].join(' ')}
                        >
                          <LocalMediaImage
                            filePath={g.path}
                            alt={g.label}
                            maxHeightClass="h-full max-h-none"
                            className="h-full border-0 rounded-none"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] text-ink-100">
                            {g.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <div>
                      <Label>{t('characters.sheetVariant')}</Label>
                      <select
                        className="mt-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100"
                        value={sheetVariant}
                        onChange={(e) =>
                          setSheetVariant(e.target.value as typeof sheetVariant)
                        }
                      >
                        <option value="bible">{t('characters.sheetBible')}</option>
                        <option value="turnaround">
                          {t('characters.sheetTurnaround')}
                        </option>
                        <option value="expression">
                          {t('characters.sheetExpression')}
                        </option>
                        <option value="costume">
                          {t('characters.sheetCostume')}
                        </option>
                      </select>
                    </div>
                    <Button disabled={busy} onClick={() => void handleGenerateSheet()}>
                      {busy ? t('common.loading') : t('characters.generateSheet')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void handlePickImage()}
                    >
                      {t('characters.pickImage')}
                    </Button>
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
                  <p className="mt-2 text-[11px] text-ink-500">
                    {t('characters.sheetHint')}
                  </p>
                </section>

                {/* AI create / improve — always available in new + edit */}
                <section className="mb-8 rounded-2xl border border-brand-800/40 bg-gradient-to-br from-brand-950/50 via-ink-900/80 to-ink-950 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-brand-100">
                      {editingId
                        ? t('characters.aiImproveTitle')
                        : t('characters.aiCreate')}
                    </h3>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-ink-400">
                    {editingId
                      ? t('characters.aiImproveHint')
                      : t('characters.aiCreateHint')}
                  </p>
                  <Textarea
                    rows={3}
                    value={aiIdea}
                    onChange={(e) => setAiIdea(e.target.value)}
                    placeholder={
                      editingId
                        ? t('characters.improvePlaceholder')
                        : t('characters.ideaPlaceholder')
                    }
                  />
                  <Button
                    className="mt-3 w-full"
                    disabled={busy}
                    onClick={() => void handleAiFill(true)}
                  >
                    {busy
                      ? t('common.loading')
                      : editingId
                        ? t('characters.runMasterPromptImprove')
                        : t('characters.runMasterPrompt')}
                  </Button>
                </section>

                {/* Profile fields */}
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
                        placeholder="neon, rain jacket…"
                      />
                    </Field>
                  </div>
                  <Field label={t('characters.description')}>
                    <Textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => patch('description', e.target.value)}
                    />
                  </Field>
                  <Field label={t('characters.appearance')}>
                    <Textarea
                      rows={3}
                      value={form.appearance}
                      onChange={(e) => patch('appearance', e.target.value)}
                      placeholder={t('characters.appearancePlaceholder')}
                    />
                  </Field>
                  <Field label={t('characters.costume')}>
                    <Textarea
                      rows={2}
                      value={form.costume}
                      onChange={(e) => patch('costume', e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('characters.personality')}>
                      <Textarea
                        rows={2}
                        value={form.personality}
                        onChange={(e) => patch('personality', e.target.value)}
                      />
                    </Field>
                    <Field label={t('characters.backstory')}>
                      <Textarea
                        rows={2}
                        value={form.backstory}
                        onChange={(e) => patch('backstory', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label={t('characters.voiceDesc')}>
                    <Textarea
                      rows={2}
                      value={form.voiceDesc}
                      onChange={(e) => patch('voiceDesc', e.target.value)}
                      placeholder={t('characters.voicePlaceholder')}
                    />
                  </Field>
                  <Field label={t('characters.mannerisms')}>
                    <Textarea
                      rows={2}
                      value={form.mannerisms}
                      onChange={(e) => patch('mannerisms', e.target.value)}
                      placeholder={t('characters.mannerismsPlaceholder')}
                    />
                  </Field>
                  <Field label={t('characters.relationships')}>
                    <Textarea
                      rows={2}
                      value={form.relationships}
                      onChange={(e) => patch('relationships', e.target.value)}
                    />
                  </Field>

                  <div className="rounded-xl border border-ink-800 bg-ink-900/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-300">
                        {t('characters.soulMd')}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="!py-1 text-xs"
                          onClick={() =>
                            void getApi().shell.openExternal(
                              'https://soulmd-hub.ysk.hk'
                            )
                          }
                        >
                          Hub
                        </Button>
                        <Button
                          variant="secondary"
                          className="!py-1 text-xs"
                          onClick={() => void handleImportSoul()}
                        >
                          {t('characters.importSoul')}
                        </Button>
                      </div>
                    </div>
                    {form.soulHubId != null && (
                      <p className="text-[11px] text-brand-300">
                        Soul #{form.soulHubId}
                      </p>
                    )}
                    {form.soulPreview && (
                      <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-ink-950/80 p-2 text-[11px] text-ink-400">
                        {form.soulPreview}
                      </pre>
                    )}
                  </div>
                </section>
              </div>

              <div className="flex gap-2 border-t border-ink-800 px-6 py-4">
                <Button
                  className="flex-1"
                  disabled={!form.name.trim() || busy}
                  onClick={() => void handleSave()}
                >
                  {busy ? t('common.loading') : t('common.save')}
                </Button>
                <Button variant="ghost" onClick={closeEditor}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Hub ─── */}
        {tab === 'hub' && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5">
              <h2 className="text-base font-semibold text-ink-50">
                {t('characters.soulHub')}
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                {t('characters.soulHubHint')}
              </p>
              {indexStatus && (
                <p className="mt-2 text-[11px] text-brand-300/90">{indexStatus}</p>
              )}
              <div className="mt-4 flex gap-2">
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
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 20).map((s) => (
                    <button
                      key={`${s.kind}-${s.label}`}
                      type="button"
                      className="rounded-full border border-ink-700 bg-ink-900/80 px-2.5 py-1 text-[11px] text-ink-300 transition hover:border-brand-600/50 hover:text-brand-200"
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
            </div>
            <ul className="space-y-2">
              {hubItems.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-800/80 bg-ink-900/30 px-4 py-3 transition hover:border-ink-600"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink-100">
                      {it.role_icon ?? '✦'} {it.title}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">
                      {it.description}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => void applySoulFromHub(it.id)}
                  >
                    {t('characters.useSoul')}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-center gap-3 text-xs text-ink-500">
              <Button
                variant="ghost"
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
                disabled={busy || hubPage >= hubTotalPages}
                onClick={() => void loadHubPage(hubPage + 1)}
              >
                →
              </Button>
            </div>
          </div>
        )}

        {/* ─── AI ─── */}
        {tab === 'ai' && (
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-ink-800 bg-gradient-to-br from-brand-950/40 via-ink-900/60 to-ink-950 p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-ink-50">
                {t('characters.aiCreate')}
              </h2>
              <p className="mt-2 text-sm text-ink-400">
                {t('characters.aiCreateHint')}
              </p>
              <Textarea
                className="mt-4 min-h-[140px]"
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('characters.ideaPlaceholder')}
              />
              <Button
                className="mt-4 w-full"
                disabled={busy}
                onClick={() => void handleAiFill(false)}
              >
                {busy ? t('common.loading') : t('characters.runMasterPrompt')}
              </Button>
            </div>
          </div>
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
    <span className="rounded-full bg-ink-800/90 px-2 py-0.5 text-[10px] text-ink-300">
      {children}
    </span>
  )
}
