import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import type { Prop } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

export function PropsPage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId } = useApp()
  const [items, setItems] = useState<Prop[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!activeStoryId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const list = (await getApi().props.list(activeStoryId)) as Prop[]
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [activeStoryId])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (): Promise<void> => {
    if (!activeStoryId || !name.trim()) return
    await getApi().props.create({
      storyId: activeStoryId,
      name: name.trim(),
      description: description.trim()
    })
    setName('')
    setDescription('')
    setShowForm(false)
    await load()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm(t('common.confirmDelete'))) return
    await getApi().props.delete(id)
    await load()
  }

  if (!activeStoryId) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('props.title')} subtitle={t('props.subtitle')} />
        <div className="p-8">
          <EmptyState message={t('common.selectStory')} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('props.title')}
        subtitle={t('props.subtitle')}
        actions={<Button onClick={() => setShowForm((v) => !v)}>{t('props.new')}</Button>}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {showForm && (
          <Card className="mb-6 max-w-xl space-y-3">
            <div>
              <Label>{t('props.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('props.namePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('props.description')}</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('props.descriptionPlaceholder')}
              />
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
          <EmptyState message={t('props.noProps')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id}>
                <h2 className="font-semibold text-ink-50">{p.name}</h2>
                <p className="mt-2 text-sm text-ink-400">{p.description}</p>
                <div className="mt-4">
                  <Button variant="danger" onClick={() => void handleDelete(p.id)}>
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
