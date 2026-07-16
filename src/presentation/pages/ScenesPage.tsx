import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import type { Scene } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

export function ScenesPage(): JSX.Element {
  const { t } = useTranslation()
  const { activeStoryId } = useApp()
  const [items, setItems] = useState<Scene[]>([])
  const [sceneNumber, setSceneNumber] = useState(1)
  const [description, setDescription] = useState('')
  const [script, setScript] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!activeStoryId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const list = (await getApi().scenes.list(activeStoryId)) as Scene[]
      setItems(list)
      setSceneNumber(list.length + 1)
    } finally {
      setLoading(false)
    }
  }, [activeStoryId])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (): Promise<void> => {
    if (!activeStoryId || !description.trim()) return
    await getApi().scenes.create({
      storyId: activeStoryId,
      sceneNumber,
      description: description.trim(),
      script: script.trim() || null
    })
    setDescription('')
    setScript('')
    setShowForm(false)
    await load()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm(t('common.confirmDelete'))) return
    await getApi().scenes.delete(id)
    await load()
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
        actions={<Button onClick={() => setShowForm((v) => !v)}>{t('scenes.new')}</Button>}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
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
              <Button onClick={() => void handleCreate()} disabled={!description.trim()}>
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
          <EmptyState message={t('scenes.noScenes')} />
        ) : (
          <div className="space-y-3">
            {items.map((s) => (
              <Card key={s.id} className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-brand-400">
                    {t('scenes.number')} {s.sceneNumber}
                  </div>
                  <p className="mt-1 text-sm text-ink-100">{s.description}</p>
                  {s.script && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-ink-400">
                      {s.script}
                    </pre>
                  )}
                </div>
                <Button variant="danger" onClick={() => void handleDelete(s.id)}>
                  {t('common.delete')}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
