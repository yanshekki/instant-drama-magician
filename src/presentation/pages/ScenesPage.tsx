import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nextSceneNumber } from '../../domain/scene'
import { useApp } from '../context/AppContext'
import { useScenes } from '../hooks/useScenes'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

export function ScenesPage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId } = useApp()
  const { items, loading, error, create, update, remove } = useScenes(activeStoryId)
  const [sceneNumber, setSceneNumber] = useState(1)
  const [description, setDescription] = useState('')
  const [script, setScript] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const resetForm = (): void => {
    setDescription('')
    setScript('')
    setEditingId(null)
    setShowForm(false)
    setSceneNumber(nextSceneNumber(items.map((s) => s.sceneNumber)))
  }

  const handleSubmit = async (): Promise<void> => {
    if (!description.trim()) return
    if (editingId) {
      const ok = await update(editingId, {
        sceneNumber,
        description: description.trim(),
        script: script.trim() || null
      })
      if (ok) resetForm()
      return
    }
    const ok = await create({
      sceneNumber,
      description: description.trim(),
      script: script.trim() || null
    })
    if (ok) resetForm()
  }

  const startEdit = (id: string): void => {
    const s = items.find((x) => x.id === id)
    if (!s) return
    setEditingId(s.id)
    setSceneNumber(s.sceneNumber)
    setDescription(s.description)
    setScript(s.script ?? '')
    setShowForm(true)
  }

  if (!activeStoryId) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('scenes.title')} subtitle={t('scenes.subtitle')} />
        <div className="p-8">
          <EmptyState message={t('common.selectStory')} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('scenes.title')}
        subtitle={t('scenes.subtitle')}
        actions={
          <Button
            onClick={() => {
              setEditingId(null)
              setSceneNumber(nextSceneNumber(items.map((s) => s.sceneNumber)))
              setShowForm((v) => !v)
            }}
          >
            {t('scenes.new')}
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
              <Label>{t('scenes.number')}</Label>
              <Input
                type="number"
                min={1}
                value={sceneNumber}
                onChange={(e) => setSceneNumber(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>{t('scenes.description')}</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('scenes.descriptionPlaceholder')}
              />
            </div>
            <div>
              <Label>{t('scenes.script')}</Label>
              <Textarea
                rows={4}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={t('scenes.scriptPlaceholder')}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleSubmit()} disabled={!description.trim()}>
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
          <EmptyState message={t('scenes.noScenes')} />
        ) : (
          <div className="space-y-3">
            {items.map((s) => (
              <Card key={s.id} className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-brand-400">
                      {t('scenes.number')} {s.sceneNumber}
                    </span>
                    <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-300">
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-100">{s.description}</p>
                  {s.script && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-ink-400">
                      {s.script}
                    </pre>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => startEdit(s.id)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(t('common.confirmDelete'))) void remove(s.id)
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
