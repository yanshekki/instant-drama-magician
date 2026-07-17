import { describe, expect, it } from 'vitest'
import { SoulMdHubClient } from './SoulMdHubClient'

describe('SoulMdHubClient', () => {
  it('flattens single_md content', () => {
    const t = SoulMdHubClient.flattenContent('## Identity\nHello', 'single_md')
    expect(t).toContain('Hello')
  })

  it('flattens full_soul_folder JSON map', () => {
    const content = JSON.stringify({
      'SOUL.md': 'You are a hero',
      'STYLE.md': 'Speak softly'
    })
    const t = SoulMdHubClient.flattenContent(content, 'full_soul_folder')
    expect(t).toContain('hero')
    expect(t).toContain('softly')
  })

  it('filters local index', () => {
    const index = {
      builtAt: new Date().toISOString(),
      pages: 1,
      items: [
        {
          id: 1,
          title: '香港律師',
          description: '法律顧問',
          role: 'Writer',
          domain: 'Legal'
        },
        {
          id: 2,
          title: 'Developer',
          description: 'codes',
          role: 'Developer',
          domain: 'Tech'
        }
      ],
      suggestions: []
    }
    const hits = SoulMdHubClient.filterIndex(index, '法律', 10)
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe(1)
  })
})
