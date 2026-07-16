/** Extract a display name from soul.md markdown content (first ATX heading). */
export function extractNameFromSoulMd(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m)
  if (!match) return null
  const name = match[1].trim()
  return name.length > 0 ? name : null
}

/** First non-empty paragraph after optional heading, capped for description. */
export function extractDescriptionFromSoulMd(
  content: string,
  maxLength = 500
): string {
  const withoutFrontMatter = content.replace(/^---[\s\S]*?---\s*/m, '')
  const lines = withoutFrontMatter.split(/\r?\n/)
  const body: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) continue
    if (trimmed.length === 0) {
      if (body.length > 0) break
      continue
    }
    body.push(trimmed)
  }

  const text = body.join(' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

export function validateCharacterName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'name is required'
  if (trimmed.length > 100) return 'name must be at most 100 characters'
  return null
}

export function isSoulMdPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.md')
}
