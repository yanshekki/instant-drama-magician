import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../../lib/api'
import type { StoryStatus } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label } from '../components/ui'

const statusKey: Record<StoryStatus, string> = {
  DRAFT: 'stories.statusDraft',
  GENERATING: 'stories.statusGenerating',
  COMPLETED: 'stories.statusCompleted',
  FAILED: 'stories.statusFailed'
}

const statusColor: Record<StoryStatus, string> = {
  DRAFT: 'bg-ink-700 text-ink-200',
  GENERATING: 'bg-amber-900/60 text-amber-200',
  COMPLETED: 'bg-emerald-900/50 text-emerald-200',
  FAILED: 'bg-rose-900/50 text-rose-200'
}

export function StoriesPage(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { stories, setActiveStoryId, refreshStories, loading } = useApp()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const story = await getApi().stories.create({ title: title.trim() })
      setTitle('')
      setShowForm(false)
      await refreshStories()
      setActiveStoryId(story.id as string)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm(t('common.confirmDelete'))) return
    await getApi().stories.delete(id)
    await refreshStories()
  }

  const handleRename = async (): Promise<void> => {
    if (!renamingId || !renameTitle.trim()) return
    await getApi().stories.update(renamingId, { title: renameTitle.trim() })
    setRenamingId(null)
    setRenameTitle('')
    await refreshStories()
  }

  const handleOpen = (id: string): void => {
    setActiveStoryId(id)
    navigate('/timeline')
  }

  const handleExportBackup = async (id: string): Promise<void> => {
    await getApi().project.exportBackup(id)
  }

  const handleImportBackup = async (): Promise<void> => {
    const result = await getApi().project.importBackup()
    if (result) {
      await refreshStories()
      setActiveStoryId(result.storyId)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('stories.title')}
        subtitle={t('stories.subtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void handleImportBackup()}>
              {t('stories.importBackup')}
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>{t('stories.new')}</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {showForm && (
          <Card className="mb-6 max-w-lg">
            <Label>{t('stories.titleLabel')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('stories.titlePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void handleCreate()} disabled={creating || !title.trim()}>
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
        ) : stories.length === 0 ? (
          <EmptyState message={t('stories.noStories')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stories.map((story) => (
              <Card key={story.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-ink-50">{story.title}</h2>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      statusColor[story.status]
                    ].join(' ')}
                  >
                    {t(statusKey[story.status])}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  {t('stories.counts', {
                    characters: story._count?.characters ?? 0,
                    scenes: story._count?.scenes ?? 0,
                    props: story._count?.props ?? 0,
                    timeline: story._count?.timeline ?? 0
                  })}
                </p>
                {renamingId === story.id ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename()
                      }}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => void handleRename()}>{t('common.save')}</Button>
                      <Button variant="ghost" onClick={() => setRenamingId(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => handleOpen(story.id)}>{t('stories.open')}</Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRenamingId(story.id)
                        setRenameTitle(story.title)
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void handleExportBackup(story.id)}
                    >
                      {t('stories.exportBackup')}
                    </Button>
                    <Button variant="danger" onClick={() => void handleDelete(story.id)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
