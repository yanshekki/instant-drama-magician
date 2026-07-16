import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd
} from '../../domain/character'
import { getApi } from '../../lib/api'
import type { Character } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

export function CharactersPage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId } = useApp()
  const [items, setItems] = useState<Character[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [soulMdPath, setSoulMdPath] = useState<string | null>(null)
  const [soulPreview, setSoulPreview] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!activeStoryId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const list = (await getApi().characters.list(activeStoryId)) as Character[]
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [activeStoryId])

  useEffect(() => {
    void load()
  }, [load])

  const handleImportSoul = async (): Promise<void> => {
    const result = await getApi().characters.importSoulMd()
    if (!result) return
    setSoulMdPath(result.filePath)
    setSoulPreview(result.content.slice(0, 400))
    if (!description.trim()) {
      setDescription(extractDescriptionFromSoulMd(result.content))
    }
    if (!name.trim()) {
      const extracted = extractNameFromSoulMd(result.content)
      if (extracted) setName(extracted)
    }
  }

  const handleCreate = async (): Promise<void> => {
    if (!activeStoryId || !name.trim()) return
    await getApi().characters.create({
      storyId: activeStoryId,
      name: name.trim(),
      description: description.trim() || (soulPreview ?? ''),
      soulMdPath
    })
    setName('')
    setDescription('')
    setSoulMdPath(null)
    setSoulPreview(null)
    setShowForm(false)
    await load()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm(t('common.confirmDelete'))) return
    await getApi().characters.delete(id)
    await load()
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
          <Button onClick={() => setShowForm((v) => !v)}>{t('characters.new')}</Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-ink-200">
                    {t('characters.soulMd')}
                  </div>
                  <p className="text-xs text-ink-500">{t('characters.importHint')}</p>
                </div>
                <Button variant="secondary" onClick={() => void handleImportSoul()}>
                  {t('characters.importSoul')}
                </Button>
              </div>
              {soulMdPath && (
                <p className="mt-2 truncate text-xs text-brand-300">{soulMdPath}</p>
              )}
              {soulPreview && (
                <pre className="mt-2 max-h-28 overflow-auto rounded bg-ink-950/80 p-2 text-[11px] text-ink-400">
                  {soulPreview}
                  {soulPreview.length >= 400 ? '…' : ''}
                </pre>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleCreate()} disabled={!name.trim()}>
                {t('common.create')}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
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
                <div className="mt-4">
                  <Button variant="danger" onClick={() => void handleDelete(c.id)}>
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
