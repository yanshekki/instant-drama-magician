import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  parseSoulMd,
  type SoulMdDocument
} from '../../domain/character'
import { getApi } from '../../lib/api'
import { useApp } from '../context/AppContext'
import { useCharacters } from '../hooks/useCharacters'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

export function CharactersPage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId } = useApp()
  const { items, loading, error, create, update, remove } = useCharacters(activeStoryId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [soulMdPath, setSoulMdPath] = useState<string | null>(null)
  const [soulPreview, setSoulPreview] = useState<string | null>(null)
  const [soulDoc, setSoulDoc] = useState<SoulMdDocument | null>(null)
  const [refImagePath, setRefImagePath] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [soulUrl, setSoulUrl] = useState('')

  const resetForm = (): void => {
    setName('')
    setDescription('')
    setSoulMdPath(null)
    setSoulPreview(null)
    setSoulDoc(null)
    setRefImagePath(null)
    setEditingId(null)
    setShowForm(false)
  }

  const handleImportSoul = async (): Promise<void> => {
    const result = await getApi().characters.importSoulMd()
    if (!result) return
    setSoulMdPath(result.filePath)
    const doc = parseSoulMd(result.content)
    setSoulDoc(doc)
    setSoulPreview(doc.body.slice(0, 600))
    if (!description.trim()) {
      setDescription(extractDescriptionFromSoulMd(result.content))
    }
    if (!name.trim()) {
      const extracted = doc.title ?? extractNameFromSoulMd(result.content)
      if (extracted) setName(extracted)
    }
  }

  const openSoulHub = (): void => {
    void getApi().shell.openExternal('https://soulmd-hub.ysk.hk')
  }

  const handleImportSoulUrl = async (): Promise<void> => {
    if (!soulUrl.trim()) return
    const result = await getApi().characters.importSoulMdUrl(soulUrl.trim())
    setSoulMdPath(result.url)
    setSoulDoc(result.parsed as SoulMdDocument)
    setSoulPreview(result.content.slice(0, 600))
    if (!description.trim()) setDescription(result.description)
    if (!name.trim() && result.name) setName(result.name)
  }

  const handlePickRefImage = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (result) setRefImagePath(result.filePath)
  }

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) return
    if (editingId) {
      const ok = await update(editingId, {
        name: name.trim(),
        description: description.trim() || (soulPreview ?? ''),
        soulMdPath,
        refImagePath
      })
      if (ok) resetForm()
      return
    }
    const ok = await create({
      name: name.trim(),
      description: description.trim() || (soulPreview ?? ''),
      soulMdPath,
      refImagePath
    })
    if (ok) resetForm()
  }

  const startEdit = (id: string): void => {
    const c = items.find((x) => x.id === id)
    if (!c) return
    setEditingId(c.id)
    setName(c.name)
    setDescription(c.description)
    setSoulMdPath(c.soulMdPath)
    setRefImagePath(c.refImagePath)
    setSoulPreview(null)
    setShowForm(true)
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
          <Button
            onClick={() => {
              setEditingId(null)
              setShowForm((v) => !v)
            }}
          >
            {t('characters.new')}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {error && (
          <p className="mb-4 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {error.message}
          </p>
        )}

        {showForm && (
          <Card className="mb-6 max-w-xl space-y-3">
            <div>
              <Label>{t('characters.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('characters.namePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('characters.description')}</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('characters.descriptionPlaceholder')}
              />
            </div>
            <div className="rounded-lg border border-dashed border-ink-700 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-ink-200">
                    {t('characters.soulMd')}
                  </div>
                  <p className="text-xs text-ink-500">{t('characters.importHint')}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={openSoulHub}>
                    {t('characters.openHub')}
                  </Button>
                  <Button variant="secondary" onClick={() => void handleImportSoul()}>
                    {t('characters.importSoul')}
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={soulUrl}
                  onChange={(e) => setSoulUrl(e.target.value)}
                  placeholder={t('characters.soulUrl')}
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleImportSoulUrl()}
                  disabled={!soulUrl.trim()}
                >
                  {t('characters.importUrl')}
                </Button>
              </div>
              {soulMdPath && (
                <p className="mt-2 truncate text-xs text-brand-300">{soulMdPath}</p>
              )}
              {soulDoc && (
                <div className="mt-2 space-y-1 rounded bg-ink-950/80 p-2 text-[11px] text-ink-300">
                  {soulDoc.title && (
                    <div className="font-semibold text-ink-100">{soulDoc.title}</div>
                  )}
                  {soulDoc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {soulDoc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-brand-900/40 px-1.5 py-0.5 text-brand-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {Object.keys(soulDoc.frontmatter).length > 0 && (
                    <pre className="max-h-16 overflow-auto text-ink-500">
                      {Object.entries(soulDoc.frontmatter)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n')}
                    </pre>
                  )}
                </div>
              )}
              {soulPreview && (
                <pre className="mt-2 max-h-28 overflow-auto rounded bg-ink-950/80 p-2 text-[11px] text-ink-400">
                  {soulPreview}
                  {soulPreview.length >= 600 ? '…' : ''}
                </pre>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-ink-400">{t('characters.refImage')}</div>
                {refImagePath && (
                  <p className="truncate text-[11px] text-brand-300">{refImagePath}</p>
                )}
              </div>
              <Button variant="secondary" onClick={() => void handlePickRefImage()}>
                {t('characters.pickImage')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleSubmit()} disabled={!name.trim()}>
                {editingId ? t('common.save') : t('common.create')}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                {t('common.cancel')}
              </Button>
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
                <h2 className="font-semibold text-ink-50">{c.name}</h2>
                <p className="mt-2 line-clamp-4 text-sm text-ink-400">{c.description}</p>
                {c.soulMdPath && (
                  <p className="mt-2 truncate text-[11px] text-brand-400">
                    soul.md · {c.soulMdPath}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" onClick={() => startEdit(c.id)}>
                    {t('common.edit')}
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
  )
}
