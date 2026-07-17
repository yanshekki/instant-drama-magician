import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { StoryStatus } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, EmptyState, Input, Label, Textarea } from '../components/ui'

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
  const [styleNote, setStyleNote] = useState('')

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
    await getApi().stories.update(renamingId, {
      title: renameTitle.trim(),
      styleNote: styleNote.trim() || null
    })
    setRenamingId(null)
    setRenameTitle('')
    setStyleNote('')
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

  const handleSeedDemo = async (): Promise<void> => {
    setCreating(true)
    try {
      const locale = t('stories.demoLocale') === 'en' ? 'en' : 'zh-HK'
      const result = await getApi().stories.seedDemo(locale)
      await refreshStories()
      setActiveStoryId(result.storyId)
      navigate('/timeline')
    } catch (e) {
      alert(parseIpcError(e).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('stories.title')}
        subtitle={t('stories.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handleImportBackup()}>
              {t('stories.importBackup')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleSeedDemo()}
              disabled={creating}
            >
              {t('stories.loadDemo')}
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
          <div className="mx-auto max-w-lg space-y-4">
            <EmptyState message={t('stories.noStories')} />
            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">
                {t('stories.onboardingTitle')}
              </h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-300">
                <li>{t('stories.step1')}</li>
                <li>{t('stories.step2')}</li>
                <li>{t('stories.step3')}</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSeedDemo()} disabled={creating}>
                  {t('stories.loadDemo')}
                </Button>
                <Button variant="secondary" onClick={() => setShowForm(true)}>
                  {t('stories.new')}
                </Button>
              </div>
              <p className="text-xs text-ink-500">{t('stories.prototypeNote')}</p>
            </Card>
          </div>
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
                    <Label>{t('stories.titleLabel')}</Label>
                    <Input
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename()
                      }}
                    />
                    <Label>{t('stories.styleNote')}</Label>
                    <Textarea
                      rows={3}
                      value={styleNote}
                      onChange={(e) => setStyleNote(e.target.value)}
                      placeholder={t('stories.styleNotePlaceholder')}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => void handleRename()}>{t('common.save')}</Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setRenamingId(null)
                          setStyleNote('')
                        }}
                      >
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
                        setStyleNote(
                          'styleNote' in story && typeof story.styleNote === 'string'
                            ? story.styleNote
                            : ''
                        )
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
