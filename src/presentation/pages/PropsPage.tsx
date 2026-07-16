import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { useProps } from '../hooks/useProps'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

export function PropsPage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId } = useApp()
  const { items, loading, error, create, update, remove } = useProps(activeStoryId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const resetForm = (): void => {
    setName('')
    setDescription('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) return
    if (editingId) {
      const ok = await update(editingId, {
        name: name.trim(),
        description: description.trim()
      })
      if (ok) resetForm()
      return
    }
    const ok = await create({
      name: name.trim(),
      description: description.trim()
    })
    if (ok) resetForm()
  }

  const startEdit = (id: string): void => {
    const p = items.find((x) => x.id === id)
    if (!p) return
    setEditingId(p.id)
    setName(p.name)
    setDescription(p.description)
    setShowForm(true)
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
        actions={
          <Button
            onClick={() => {
              setEditingId(null)
              setShowForm((v) => !v)
            }}
          >
            {t('props.new')}
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
          <EmptyState message={t('props.noProps')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id}>
                <h2 className="font-semibold text-ink-50">{p.name}</h2>
                <p className="mt-2 text-sm text-ink-400">{p.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" onClick={() => startEdit(p.id)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(t('common.confirmDelete'))) void remove(p.id)
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
