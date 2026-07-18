import { describe, expect, it } from 'vitest'
import {
  createdAtFromExportFileName,
  inferExportKindFromFileName,
  isUserFacingExportFileName,
  parseExportHistoryJson,
  sortExportHistoryNewestFirst
} from './exportHistory'

describe('exportHistory', () => {
  it('infers kind from filename', () => {
    expect(inferExportKindFromFileName('demo_final_1.mp4')).toBe('final')
    expect(inferExportKindFromFileName('demo_board_1.mp4')).toBe('board')
  })

  it('parses timestamp from filename', () => {
    const iso = createdAtFromExportFileName('demo_final_1710000000000.mp4')
    expect(iso).toBe(new Date(1710000000000).toISOString())
  })

  it('sorts newest first', () => {
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
      }
    ])
    expect(items[0]?.id).toBe('b')
  })

  it('filters ffmpeg intermediates', () => {
    expect(isUserFacingExportFileName('demo_final_1.mp4')).toBe(true)
    expect(isUserFacingExportFileName('雨夜買包_final_1784371297999.mp4')).toBe(
      true
    )
    expect(isUserFacingExportFileName('_fnorm_0_1.mp4')).toBe(false)
    expect(isUserFacingExportFileName('_raw_1.mp4')).toBe(false)
    expect(isUserFacingExportFileName('exports-history.json')).toBe(false)
  })

  it('parses history json', () => {
    const items = parseExportHistoryJson(
      JSON.stringify([
        {
          id: 'exp_x',
          path: '/Videos/x.mp4',
          fileName: 'x.mp4',
          kind: 'final',
          createdAt: '2024-06-01T00:00:00.000Z'
        }
      ]),
      'story1'
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.storyId).toBe('story1')
    expect(items[0]?.path).toBe('/Videos/x.mp4')
  })
})
