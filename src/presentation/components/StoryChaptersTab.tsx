import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import type { Chapter } from '../../types/domain'
import {
  CHAPTER_AI_COUNT_DEFAULT,
  CHAPTER_AI_COUNT_MAX,
  CHAPTER_AI_COUNT_MIN,
  CHAPTER_AI_WORDS_DEFAULT,
  CHAPTER_AI_WORDS_MAX,
  CHAPTER_AI_WORDS_MIN,
  clampChapterAiCount,
  clampChapterAiWords,
  hasNonEmptyChapterBody
} from '../../domain/storyChapterPrompt'
import { useAiJobs } from '../context/AiJobsContext'
import { useDialog } from '../context/DialogContext'
import { useOptionalPromptTemplate } from '../context/PromptTemplateContext'
import { useToast } from '../context/ToastContext'
import { Button, EmptyState, Input, Textarea } from './ui'
import { editorFormWideClass } from './EditorShell'

export function storiesGuardNeedChapters(
  editingId: string | null,
  chapters: Array<{ body?: string | null }>,
  setError: (m: string) => void,
  needSave: string,
  needChapters: string
): 'needSave' | 'needChapters' | 'ok' {
  if (!editingId) {
    setError(needSave)
    return 'needSave'
  }
  if (!hasNonEmptyChapterBody(chapters)) {
    setError(needChapters)
    return 'needChapters'
  }
  return 'ok'
}

type CastSummary = { create: number; link: number; skip: number }

export function StoryChaptersTab(props: {
  editingId: string | null
  aiIdea: string
  onAiIdeaChange: (v: string) => void
  chapters: Chapter[]
  onChaptersChange: (rows: Chapter[]) => void
  ensureStoryId: () => Promise<string | null>
  onCastApplied?: () => Promise<void>
  setActionError: (m: string | null) => void
  setPageBanner: (m: string | null) => void
  aiBusy: boolean
}) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const { startJob } = useAiJobs()
  const { pick } = useOptionalPromptTemplate()
  const {
    editingId,
    aiIdea,
    onAiIdeaChange,
    chapters,
    onChaptersChange,
    ensureStoryId,
    onCastApplied,
    setActionError,
    setPageBanner,
    aiBusy
  } = props
  const [chapterCount, setChapterCount] = useState(CHAPTER_AI_COUNT_DEFAULT)
  const [chapterWords, setChapterWords] = useState(CHAPTER_AI_WORDS_DEFAULT)
  const [chapterReplace, setChapterReplace] = useState(false)

  const addChapter = async (): Promise<void> => {
    const id = await ensureStoryId()
    if (!id) return
    const row = (await getApi().chapters.create({
      storyId: id,
      title: '',
      body: ''
    })) as Chapter
    onChaptersChange([...chapters, row])
  }

  const saveChapter = async (
    id: string,
    patch: { title?: string; body?: string }
  ): Promise<void> => {
    const row = (await getApi().chapters.update(id, patch)) as Chapter
    onChaptersChange(chapters.map((c) => (c.id === id ? { ...c, ...row } : c)))
  }

  const removeChapter = async (id: string): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('common.confirmDelete'),
      variant: 'danger'
    })
    if (!ok) return
    await getApi().chapters.delete(id)
    onChaptersChange(chapters.filter((c) => c.id !== id))
  }

  const moveChapter = async (id: string, dir: -1 | 1): Promise<void> => {
    if (!editingId) return
    const idx = chapters.findIndex((c) => c.id === id)
    const next = idx + dir
    if (idx < 0 || next < 0 || next >= chapters.length) return
    const ordered = [...chapters]
    const [item] = ordered.splice(idx, 1)
    ordered.splice(next, 0, item)
    onChaptersChange(ordered)
    const rows = (await getApi().chapters.reorder(
      editingId,
      ordered.map((c) => c.id)
    )) as Chapter[]
    onChaptersChange(rows)
    toast.success(t('stories.chapterMoved'))
  }

  const handleAiFill = async (): Promise<void> => {
    const id = await ensureStoryId()
    if (!id) {
      setActionError(t('stories.saveFirst'))
      return
    }
    const promptTemplateId = await pick('copy')
    if (!promptTemplateId) return
    const replace = chapters.length > 0 && chapterReplace
    if (replace) {
      const ok = await dialog.confirm({
        message: t('stories.aiReplaceChaptersConfirm'),
        variant: 'danger',
        confirmLabel: t('common.ok')
      })
      if (!ok) return
    }
    setActionError(null)
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'story-ai-chapters',
      label: t('stories.aiFillChapters'),
      scope: { storyId: id },
      run: async ({ setProgress, signal }) => {
        setProgress(15, 'llm')
        const r = await getApi().chapters.aiFill({
          storyId: id,
          idea: aiIdea,
          locale: i18n.language,
          replace,
          chapterCount,
          wordsPerChapter: chapterWords,
          promptTemplateId
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        onChaptersChange(r.chapters as Chapter[])
        setPageBanner(t('stories.aiChaptersOk', { n: r.chapters.length }))
        toast.success(t('stories.aiChaptersOk', { n: r.chapters.length }))
      }
    })
  }

  const handlePolish = async (chapterId: string): Promise<void> => {
    if (!editingId) return
    const promptTemplateId = await pick('copy')
    if (!promptTemplateId) return
    startJob({
      kind: 'story-ai-chapter-polish',
      label: t('stories.aiPolishChapter'),
      scope: { storyId: editingId },
      run: async ({ setProgress, signal }) => {
        setProgress(20, 'llm')
        await getApi().chapters.aiPolish({
          storyId: editingId,
          chapterId,
          idea: aiIdea,
          locale: i18n.language,
          promptTemplateId
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        const rows = (await getApi().chapters.list(editingId)) as Chapter[]
        onChaptersChange(rows)
        toast.success(t('common.saved'))
      }
    })
  }

  const handleGenerateCast = async (): Promise<void> => {
    const g = storiesGuardNeedChapters(
      editingId,
      chapters,
      setActionError,
      t('stories.saveFirst'),
      t('stories.aiNeedChapters')
    )
    if (g !== 'ok' || !editingId) return
    const promptTemplateId = await pick('copy')
    if (!promptTemplateId) return
    startJob({
      kind: 'story-ai-chapter-cast',
      label: t('stories.generateCastFromChapters'),
      scope: { storyId: editingId },
      run: async ({ setProgress, signal }) => {
        setProgress(20, 'llm')
        const preview = await getApi().chapters.generateCast({
          storyId: editingId,
          locale: i18n.language,
          preview: true,
          promptTemplateId
        })
        if (signal.cancelled) return
        setProgress(70, 'confirm')
        const summary = preview.summary as CastSummary
        const ok = await dialog.confirm({
          message: t('stories.generateCastConfirm', {
            create: summary.create,
            link: summary.link,
            skip: summary.skip
          }),
          confirmLabel: t('common.ok')
        })
        if (!ok) return
        setProgress(85, 'apply')
        const applied = await getApi().chapters.generateCast({
          storyId: editingId,
          locale: i18n.language,
          preview: false,
          drafts: preview.drafts,
          promptTemplateId
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        const s = applied.summary as CastSummary
        toast.success(
          t('stories.generateCastOk', {
            create: s.create,
            link: s.link
          })
        )
        await onCastApplied?.()
      }
    })
  }

  return (
    <div className={editorFormWideClass}>
      {!editingId ? (
        <p className="mb-4 rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3 text-sm text-ink-400">
          {t('stories.metaHint')}
        </p>
      ) : null}
      <section className="rounded-xl border border-brand-800/35 bg-brand-950/15 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-brand-100">
              {t('stories.aiFillChapters')}
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {t('stories.aiChaptersHint')}
            </p>
          </div>
          <Button disabled={aiBusy} onClick={() => void handleAiFill()}>
            {aiBusy ? t('common.generating') : t('stories.aiFillChapters')}
          </Button>
        </div>
        <Textarea
          className="mt-2"
          size="md"
          value={aiIdea}
          onChange={(e) => onAiIdeaChange(e.target.value)}
          placeholder={t('stories.aiIdeaPlaceholder')}
        />
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[7rem] flex-col gap-1 text-[11px] text-ink-400">
            {t('stories.aiChapterCount')}
            <Input
              type="number"
              min={CHAPTER_AI_COUNT_MIN}
              max={CHAPTER_AI_COUNT_MAX}
              value={chapterCount}
              aria-label={t('stories.aiChapterCount')}
              onChange={(e) =>
                setChapterCount(clampChapterAiCount(e.target.value))
              }
            />
          </label>
          <label className="flex min-w-[8rem] flex-col gap-1 text-[11px] text-ink-400">
            {t('stories.aiChapterWords')}
            <Input
              type="number"
              min={CHAPTER_AI_WORDS_MIN}
              max={CHAPTER_AI_WORDS_MAX}
              value={chapterWords}
              aria-label={t('stories.aiChapterWords')}
              onChange={(e) =>
                setChapterWords(clampChapterAiWords(e.target.value))
              }
            />
          </label>
        </div>
        {chapters.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant={chapterReplace ? 'ghost' : 'secondary'}
              className="!py-1 !text-xs"
              onClick={() => setChapterReplace(false)}
            >
              {t('stories.aiScriptAppend')}
            </Button>
            <Button
              variant={chapterReplace ? 'secondary' : 'ghost'}
              className="!py-1 !text-xs"
              onClick={() => setChapterReplace(true)}
            >
              {t('stories.aiScriptReplace')}
            </Button>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-100">
            {t('stories.chaptersTitle')}
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {t('stories.chaptersHint')}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void addChapter()}>
          {t('stories.addChapter')}
        </Button>
      </div>

      {chapters.length === 0 ? (
        <EmptyState message={t('stories.noChapters')} />
      ) : (
        <ul className="space-y-3">
          {chapters.map((ch, idx) => (
            <li
              key={ch.id}
              className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-brand-200">
                  {t('stories.chapterN', { n: idx + 1 })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="!py-0.5 !px-2 !text-xs"
                    disabled={idx === 0}
                    onClick={() => void moveChapter(ch.id, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    className="!py-0.5 !px-2 !text-xs"
                    disabled={idx === chapters.length - 1}
                    onClick={() => void moveChapter(ch.id, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    className="!py-0.5 !px-2 !text-xs"
                    disabled={aiBusy || !editingId}
                    onClick={() => void handlePolish(ch.id)}
                  >
                    {t('stories.aiPolishChapter')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!py-0.5 !px-2 !text-xs text-rose-300"
                    onClick={() => void removeChapter(ch.id)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
              <Input
                className="mb-2"
                value={ch.title}
                placeholder={t('stories.chapterTitlePh')}
                onChange={(e) =>
                  onChaptersChange(
                    chapters.map((c) =>
                      c.id === ch.id ? { ...c, title: e.target.value } : c
                    )
                  )
                }
                onBlur={() => void saveChapter(ch.id, { title: ch.title })}
              />
              <Textarea
                size="md"
                value={ch.body}
                placeholder={t('stories.chapterBodyPh')}
                onChange={(e) =>
                  onChaptersChange(
                    chapters.map((c) =>
                      c.id === ch.id ? { ...c, body: e.target.value } : c
                    )
                  )
                }
                onBlur={() => void saveChapter(ch.id, { body: ch.body })}
              />
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border border-brand-800/35 bg-brand-950/15 p-3">
        <h3 className="text-sm font-semibold text-brand-100">
          {t('stories.generateCastFromChapters')}
        </h3>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {t('stories.generateCastHint')}
        </p>
        <Button
          className="mt-3"
          disabled={aiBusy || !editingId}
          onClick={() => void handleGenerateCast()}
        >
          {aiBusy ? t('common.generating') : t('stories.generateCastFromChapters')}
        </Button>
      </section>
    </div>
  )
}
