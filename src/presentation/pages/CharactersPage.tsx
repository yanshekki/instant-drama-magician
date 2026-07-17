import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  parseSoulMd,
  type SoulMdDocument
} from '../../domain/character'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { Character } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { useCharacters } from '../hooks/useCharacters'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

type Panel = 'form' | 'hub' | 'ai'

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
  refImagePath: string | null
  refSheetPath: string | null
  soulHubId: number | null
  soulPreview: string | null
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
  refImagePath: null,
  refSheetPath: null,
  soulHubId: null,
  soulPreview: null
})

export function CharactersPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { activeStoryId } = useApp()
  const { items, loading, error, create, update, remove, reload } =
    useCharacters(activeStoryId)

  const [panel, setPanel] = useState<Panel>('form')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [soulDoc, setSoulDoc] = useState<SoulMdDocument | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Soul hub browser
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
  const [aiIdea, setAiIdea] = useState('')
  const [sheetVariant, setSheetVariant] = useState<
    'bible' | 'turnaround' | 'expression' | 'costume'
  >('bible')

  const patchForm = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const resetForm = (): void => {
    setForm(emptyForm())
    setSoulDoc(null)
    setEditingId(null)
    setShowForm(false)
    setAiIdea('')
  }

  const loadHubPage = useCallback(async (page: number, q?: string): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      if (q?.trim()) {
        // Prefer local 50-page index; also try hub
        const local = await getApi().souls.searchLocal(q.trim(), 24)
        if (local.items.length > 0) {
          setHubItems(local.items)
          setHubTotalPages(1)
          setHubPage(1)
          setIndexStatus(
            local.fromCache
              ? t('characters.indexLocalHits', { n: local.items.length })
              : null
          )
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
  }, [t])

  useEffect(() => {
    if (panel !== 'hub') return
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
    void getApi()
      .souls.suggestions()
      .then(setSuggestions)
      .catch(() => undefined)
  }, [panel, loadHubPage, t])

  const handleImportSoul = async (): Promise<void> => {
    const result = await getApi().characters.importSoulMd()
    if (!result) return
    patchForm('soulMdPath', result.filePath)
    const doc = parseSoulMd(result.content)
    setSoulDoc(doc)
    patchForm('soulPreview', doc.body.slice(0, 800))
    if (!form.description.trim()) {
      patchForm('description', extractDescriptionFromSoulMd(result.content))
    }
    if (!form.name.trim()) {
      const extracted = doc.title ?? extractNameFromSoulMd(result.content)
      if (extracted) patchForm('name', extracted)
    }
  }

  const handlePickRefImage = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (result) patchForm('refImagePath', result.filePath)
  }

  const applySoulFromHub = async (id: number): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      const detail = await getApi().souls.get(id)
      patchForm('soulHubId', detail.id)
      patchForm('soulMdPath', `soulmd-hub://${detail.id}`)
      patchForm('name', detail.title)
      patchForm('description', detail.description || form.description)
      patchForm('soulPreview', detail.contentFlat.slice(0, 1200))
      if (!form.seedPrompt) patchForm('seedPrompt', detail.title)
      setPanel('form')
      setShowForm(true)
      setBanner(t('characters.soulApplied', { title: detail.title }))
    } catch (e) {
      setActionError(parseIpcError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const handleAiFill = async (): Promise<void> => {
    const idea = aiIdea.trim() || form.seedPrompt.trim()
    if (!idea) {
      setActionError(t('characters.ideaRequired'))
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      const locale = i18n.language === 'en' ? 'en' : 'zh-HK'
      const r = await getApi().characters.aiFill({
        idea,
        storyId: activeStoryId ?? undefined,
        locale
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
        seedPrompt: idea,
        soulPreview: f.soulPreview
      }))
      setShowForm(true)
      setPanel('form')
      setBanner(t('characters.aiFillOk'))
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const payloadFromForm = (): Omit<
    import('../../types/domain').CreateCharacterInput,
    'storyId'
  > => ({
    name: form.name.trim(),
    description: form.description.trim() || form.appearance || form.name,
    soulMdPath: form.soulMdPath,
    refImagePath: form.refImagePath,
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
    refSheetPath: form.refSheetPath || null,
    soulHubId: form.soulHubId
  })

  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim()) return
    setBusy(true)
    try {
      if (editingId) {
        const ok = await update(editingId, payloadFromForm())
        if (ok) {
          resetForm()
          setBanner(t('common.success'))
        }
      } else {
        const ok = await create(payloadFromForm())
        if (ok) {
          resetForm()
          setBanner(t('common.success'))
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (c: Character): void => {
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
      refImagePath: c.refImagePath,
      refSheetPath: c.refSheetPath ?? null,
      soulHubId: c.soulHubId ?? null,
      soulPreview: null
    })
    setShowForm(true)
    setPanel('form')
  }

  const handleGenerateSheet = async (characterId: string): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      // Persist form first if editing this character
      if (editingId === characterId) {
        await update(characterId, payloadFromForm())
      }
      const r = await getApi().characters.generateSheet({
        characterId,
        variant: sheetVariant
      })
      setBanner(t('characters.sheetOk', { path: r.path }))
      if (editingId === characterId) {
        patchForm('refSheetPath', r.path)
        patchForm('refImagePath', r.path)
      }
      await reload()
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    } finally {
      setBusy(false)
    }
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
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('characters.title')}
        subtitle={t('characters.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={panel === 'hub' ? 'primary' : 'secondary'}
              onClick={() => setPanel('hub')}
            >
              {t('characters.soulHub')}
            </Button>
            <Button
              variant={panel === 'ai' ? 'primary' : 'secondary'}
              onClick={() => {
                setPanel('ai')
                setShowForm(true)
              }}
            >
              {t('characters.aiCreate')}
            </Button>
            <Button
              onClick={() => {
                setEditingId(null)
                setForm(emptyForm())
                setShowForm(true)
                setPanel('form')
              }}
            >
              {t('characters.new')}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {(error || actionError) && (
            <p className="mb-4 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
              {error?.message ?? actionError}
            </p>
          )}
          {banner && (
            <p className="mb-4 rounded-lg bg-brand-950/40 px-3 py-2 text-sm text-brand-200">
              {banner}
            </p>
          )}

          {panel === 'hub' && (
            <Card className="mb-6 space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">
                {t('characters.soulHub')}
              </h2>
              <p className="text-xs text-ink-500">{t('characters.soulHubHint')}</p>
              {indexStatus && (
                <p className="text-[11px] text-brand-300">{indexStatus}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[200px] flex-1"
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
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    void getApi()
                      .souls.ensureIndex(true)
                      .then((r) => {
                        setIndexStatus(
                          t('characters.indexReady', {
                            count: r.count,
                            pages: r.pages,
                            cache: 'fresh'
                          })
                        )
                        setSuggestions(r.suggestions)
                      })
                      .catch((e) => setActionError(parseIpcError(e).message))
                      .finally(() => setBusy(false))
                  }}
                >
                  {t('characters.rebuildIndex')}
                </Button>
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 24).map((s) => (
                    <button
                      key={`${s.kind}-${s.label}`}
                      type="button"
                      className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-200 hover:bg-brand-900/40"
                      onClick={() => {
                        setHubQ(s.label)
                        void loadHubPage(1, s.label)
                      }}
                    >
                      {s.kind === 'role' ? '🎭' : s.kind === 'domain' ? '🏷' : '✨'}{' '}
                      {s.label}
                      {s.count ? ` (${s.count})` : ''}
                    </button>
                  ))}
                </div>
              )}
              <ul className="max-h-96 space-y-2 overflow-y-auto">
                {hubItems.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-ink-100">
                        {it.role_icon ?? ''} {it.title}
                      </div>
                      <p className="line-clamp-2 text-xs text-ink-400">
                        {it.description}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-500">
                        {[it.role, it.domain].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void applySoulFromHub(it.id)}
                    >
                      {t('characters.useSoul')}
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-xs text-ink-400">
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
            </Card>
          )}

          {panel === 'ai' && (
            <Card className="mb-6 space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">
                {t('characters.aiCreate')}
              </h2>
              <p className="text-xs text-ink-500">{t('characters.aiCreateHint')}</p>
              <Textarea
                rows={5}
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('characters.ideaPlaceholder')}
              />
              <Button disabled={busy} onClick={() => void handleAiFill()}>
                {busy ? t('common.loading') : t('characters.runMasterPrompt')}
              </Button>
            </Card>
          )}

          {showForm && (
            <Card className="mb-6 max-w-3xl space-y-4">
              <h2 className="text-sm font-semibold text-ink-100">
                {editingId ? t('common.edit') : t('characters.new')}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t('characters.name')}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => patchForm('name', e.target.value)}
                    placeholder={t('characters.namePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('characters.ageRange')}</Label>
                  <Input
                    value={form.ageRange}
                    onChange={(e) => patchForm('ageRange', e.target.value)}
                    placeholder={t('characters.agePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('characters.gender')}</Label>
                  <Input
                    value={form.gender}
                    onChange={(e) => patchForm('gender', e.target.value)}
                    placeholder={t('characters.genderPlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('characters.visualTags')}</Label>
                  <Input
                    value={form.visualTags}
                    onChange={(e) => patchForm('visualTags', e.target.value)}
                    placeholder="short hair, rain jacket, neon"
                  />
                </div>
              </div>

              <div>
                <Label>{t('characters.description')}</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => patchForm('description', e.target.value)}
                  placeholder={t('characters.descriptionPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.appearance')}</Label>
                <Textarea
                  rows={3}
                  value={form.appearance}
                  onChange={(e) => patchForm('appearance', e.target.value)}
                  placeholder={t('characters.appearancePlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.costume')}</Label>
                <Textarea
                  rows={2}
                  value={form.costume}
                  onChange={(e) => patchForm('costume', e.target.value)}
                  placeholder={t('characters.costumePlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.personality')}</Label>
                <Textarea
                  rows={2}
                  value={form.personality}
                  onChange={(e) => patchForm('personality', e.target.value)}
                  placeholder={t('characters.personalityPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.backstory')}</Label>
                <Textarea
                  rows={2}
                  value={form.backstory}
                  onChange={(e) => patchForm('backstory', e.target.value)}
                  placeholder={t('characters.backstoryPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.voiceDesc')}</Label>
                <Textarea
                  rows={2}
                  value={form.voiceDesc}
                  onChange={(e) => patchForm('voiceDesc', e.target.value)}
                  placeholder={t('characters.voicePlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.mannerisms')}</Label>
                <Textarea
                  rows={2}
                  value={form.mannerisms}
                  onChange={(e) => patchForm('mannerisms', e.target.value)}
                  placeholder={t('characters.mannerismsPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.relationships')}</Label>
                <Textarea
                  rows={2}
                  value={form.relationships}
                  onChange={(e) => patchForm('relationships', e.target.value)}
                  placeholder={t('characters.relationshipsPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('characters.seedPrompt')}</Label>
                <Textarea
                  rows={2}
                  value={form.seedPrompt}
                  onChange={(e) => patchForm('seedPrompt', e.target.value)}
                />
              </div>

              <div className="rounded-lg border border-dashed border-ink-700 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-ink-200">{t('characters.soulMd')}</div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
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
                      onClick={() => void handleImportSoul()}
                    >
                      {t('characters.importSoul')}
                    </Button>
                  </div>
                </div>
                {form.soulMdPath && (
                  <p className="mt-2 truncate text-xs text-brand-300">
                    {form.soulMdPath}
                    {form.soulHubId != null ? ` · hub#${form.soulHubId}` : ''}
                  </p>
                )}
                {form.soulPreview && (
                  <pre className="mt-2 max-h-28 overflow-auto rounded bg-ink-950/80 p-2 text-[11px] text-ink-400">
                    {form.soulPreview}
                  </pre>
                )}
                {soulDoc?.title && (
                  <p className="mt-1 text-xs text-ink-400">{soulDoc.title}</p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-ink-700 p-3">
                <div className="text-sm font-medium text-ink-200">
                  {t('characters.refImage')}
                </div>
                {(form.refSheetPath || form.refImagePath) && (
                  <LocalMediaImage
                    filePath={form.refSheetPath || form.refImagePath}
                    alt={form.name || 'character'}
                    maxHeightClass="max-h-80"
                  />
                )}
                {form.refImagePath && (
                  <p className="truncate text-[11px] text-brand-300">
                    {form.refImagePath}
                  </p>
                )}
                {form.refSheetPath && form.refSheetPath !== form.refImagePath && (
                  <p className="truncate text-[11px] text-emerald-300">
                    sheet: {form.refSheetPath}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void handlePickRefImage()}
                  >
                    {t('characters.pickImage')}
                  </Button>
                  {(form.refImagePath || form.refSheetPath) && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (form.refImagePath) {
                          void getApi().media.openClip(form.refImagePath)
                        }
                      }}
                    >
                      {t('characters.openImage')}
                    </Button>
                  )}
                  {form.refImagePath && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        patchForm('refImagePath', null)
                        patchForm('refSheetPath', null)
                      }}
                    >
                      {t('characters.clearRef')}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-2 pt-2">
                  <div>
                    <Label>{t('characters.sheetVariant')}</Label>
                    <select
                      className="mt-1 rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm"
                      value={sheetVariant}
                      onChange={(e) =>
                        setSheetVariant(
                          e.target.value as typeof sheetVariant
                        )
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
                  <Button
                    disabled={busy || !editingId}
                    onClick={() =>
                      editingId && void handleGenerateSheet(editingId)
                    }
                    title={
                      !editingId
                        ? t('characters.saveFirstForSheet')
                        : undefined
                    }
                  >
                    {t('characters.generateSheet')}
                  </Button>
                </div>
                <p className="text-[11px] text-ink-500">
                  {t('characters.sheetHint')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={!form.name.trim() || busy}
                >
                  {editingId ? t('common.save') : t('common.create')}
                </Button>
                <Button variant="ghost" onClick={resetForm}>
                  {t('common.cancel')}
                </Button>
                {!editingId && form.name.trim() && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        const ok = await create(payloadFromForm())
                        if (ok) {
                          await reload()
                          // find by name - imperfect but ok after create
                          const list =
                            (await getApi().characters.list(
                              activeStoryId
                            )) as Character[]
                          const created = list.find(
                            (c) => c.name === form.name.trim()
                          )
                          if (created) {
                            setEditingId(created.id)
                            setBanner(t('characters.savedThenSheet'))
                            await handleGenerateSheet(created.id)
                          }
                        }
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    {t('characters.createAndSheet')}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {loading ? (
            <p className="text-sm text-ink-400">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <EmptyState message={t('characters.noCharacters')} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-ink-50">{c.name}</h2>
                    <span
                      className={[
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase',
                        c.refImagePath || c.refSheetPath
                          ? 'bg-emerald-900/50 text-emerald-200'
                          : 'bg-amber-900/40 text-amber-200'
                      ].join(' ')}
                    >
                      {c.refSheetPath
                        ? t('characters.sheetBadge')
                        : c.refImagePath
                          ? t('characters.refOk')
                          : t('characters.refMissingBadge')}
                    </span>
                  </div>
                  {(c.refSheetPath || c.refImagePath) && (
                    <div className="mt-3">
                      <LocalMediaImage
                        filePath={c.refSheetPath || c.refImagePath}
                        alt={c.name}
                        maxHeightClass="max-h-48"
                      />
                    </div>
                  )}
                  <p className="mt-2 line-clamp-3 text-sm text-ink-400">
                    {c.description}
                  </p>
                  {c.voiceDesc && (
                    <p className="mt-1 line-clamp-1 text-[11px] text-ink-500">
                      🎙 {c.voiceDesc}
                    </p>
                  )}
                  {c.mannerisms && (
                    <p className="line-clamp-1 text-[11px] text-ink-500">
                      ✋ {c.mannerisms}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => startEdit(c)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void handleGenerateSheet(c.id)}
                    >
                      {t('characters.generateSheet')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(t('common.confirmDelete'))) void remove(c.id)
                      }}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
