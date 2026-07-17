import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { AIProviderStatus, StoryWithCounts } from '../../types/domain'
import { getApi } from '../../lib/api'

interface AppContextValue {
  stories: StoryWithCounts[]
  activeStoryId: string | null
  setActiveStoryId: (id: string | null) => void
  refreshStories: () => Promise<void>
  aiStatus: AIProviderStatus | null
  refreshAiStatus: () => Promise<void>
  loading: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [stories, setStories] = useState<StoryWithCounts[]>([])
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AIProviderStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshStories = useCallback(async () => {
    const list = (await getApi().stories.list()) as StoryWithCounts[]
    setStories(list)
    setActiveStoryId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev
      return list[0]?.id ?? null
    })
  }, [])

  const refreshAiStatus = useCallback(async () => {
    try {
      const status = (await getApi().ai.status()) as AIProviderStatus
      setAiStatus(status)
    } catch {
      setAiStatus({
        available: false,
        baseUrl: 'http://127.0.0.1:3847/v1',
        model: 'grok-4.5',
        message: 'Unable to query AI status'
      })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await Promise.all([refreshStories(), refreshAiStatus()])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshStories, refreshAiStatus])

  const value = useMemo(
    () => ({
      stories,
      activeStoryId,
      setActiveStoryId,
      refreshStories,
      aiStatus,
      refreshAiStatus,
      loading
    }),
    [
      stories,
      activeStoryId,
      refreshStories,
      aiStatus,
      refreshAiStatus,
      loading
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
