import { describe, expect, it } from 'vitest'
import {
  createdAtFromExportFileName,
  inferExportKindFromFileName,
  isUserFacingExportFileName,
  makeExportHistoryId,
  parseExportHistoryJson,
  serializeExportHistory,
  sortExportHistoryNewestFirst
} from './exportHistory'

describe('exportHistory', () => {
  it('makeExportHistoryId has exp_ prefix', () => {
    expect(makeExportHistoryId()).toMatch(/^exp_/)
  })

  it('infers kind from filename', () => {
    expect(inferExportKindFromFileName('demo_final_1.mp4')).toBe('final')
    expect(inferExportKindFromFileName('demo_board_1.mp4')).toBe('board')
    expect(inferExportKindFromFileName('demo_board.mp4')).toBe('board')
    expect(inferExportKindFromFileName('plain.mp4')).toBe('final')
  })

  it('parses timestamp from filename', () => {
    const iso = createdAtFromExportFileName('demo_final_1710000000000.mp4')
    expect(iso).toBe(new Date(1710000000000).toISOString())
    expect(createdAtFromExportFileName('no_ts.mp4')).toBeNull()
    expect(createdAtFromExportFileName('short_123.mp4')).toBeNull()
  })

  it('sorts newest first and ties by fileName', () => {
    const items = sortExportHistoryNewestFirst([
      {
        id: 'a',
        storyId: 's',
        kind: 'final',
        fileName: 'a.mp4',
        path: '/a.mp4',
        createdAt: '2020-01-01T00:00:00.000Z'
      },
      {
        id: 'b',
        storyId: 's',
        kind: 'final',
        fileName: 'b.mp4',
        path: '/b.mp4',
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'c',
        storyId: 's',
        kind: 'final',
        fileName: 'z.mp4',
        path: '/z.mp4',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    ])
    expect(items[0]?.id).toBe('c')
    expect(items.map((i) => i.id)).toContain('b')
  })

  it('filters ffmpeg intermediates', () => {
    expect(isUserFacingExportFileName('demo_final_1.mp4')).toBe(true)
    expect(isUserFacingExportFileName('雨夜買包_final_1784371297999.mp4')).toBe(
      true
    )
    expect(isUserFacingExportFileName('_fnorm_0_1.mp4')).toBe(false)
    expect(isUserFacingExportFileName('_raw_1.mp4')).toBe(false)
    expect(isUserFacingExportFileName('fallback_1.mp4')).toBe(false)
    expect(isUserFacingExportFileName('.hidden.mp4')).toBe(false)
    expect(isUserFacingExportFileName('exports-history.json')).toBe(false)
    expect(isUserFacingExportFileName('')).toBe(false)
    expect(isUserFacingExportFileName('clip.webm')).toBe(true)
  })

  it('parses history json with defaults and skips invalid', () => {
    expect(parseExportHistoryJson(null, 's')).toEqual([])
    expect(parseExportHistoryJson('not-json', 's')).toEqual([])
    expect(parseExportHistoryJson('{}', 's')).toEqual([])
    const items = parseExportHistoryJson(
      JSON.stringify([
        {
          id: 'exp_x',
          path: '/Videos/x.mp4',
          fileName: 'x.mp4',
          kind: 'final',
          createdAt: '2024-06-01T00:00:00.000Z',
          workPath: ' /work/x.mp4 ',
          sizeBytes: 100
        },
        { path: '/b.mp4', kind: 'board' },
        { path: '', fileName: 'skip.mp4' },
        null,
        'skip',
        { path: '/c.mp4', sizeBytes: 'nope' }
      ]),
      'story1'
    )
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.find((i) => i.id === 'exp_x')?.storyId).toBe('story1')
    expect(items.find((i) => i.id === 'exp_x')?.workPath).toBe('/work/x.mp4')
    expect(items.find((i) => i.path === '/b.mp4')?.kind).toBe('board')
    expect(items.find((i) => i.path === '/b.mp4')?.fileName).toBe('b.mp4')
  })

  it('serialize round-trips newest first', () => {
    const raw = serializeExportHistory([
      {
        id: 'a',
        storyId: 's',
        kind: 'final',
        fileName: 'a.mp4',
        path: '/a.mp4',
        createdAt: '2020-01-01T00:00:00.000Z'
      },
      {
        id: 'b',
        storyId: 's',
        kind: 'final',
        fileName: 'b.mp4',
        path: '/b.mp4',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    ])
    const parsed = parseExportHistoryJson(raw, 's')
    expect(parsed[0]?.id).toBe('b')
  })
})
