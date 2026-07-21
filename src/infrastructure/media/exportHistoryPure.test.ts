import { describe, expect, it } from 'vitest'
import { isWorkExportsPath, mergeExportByName } from './exportHistoryPure'
import { sep } from 'path'

describe('exportHistoryPure', () => {
  it('covers work/public merge branches', () => {
    expect(isWorkExportsPath(`/a${sep}exports${sep}x.mp4`, sep)).toBe(true)
    expect(isWorkExportsPath(`/a${sep}exports`, sep)).toBe(true)
    expect(isWorkExportsPath('/a/public/x.mp4', sep)).toBe(false)

    const work = {
      id: 'w',
      fileName: 'f.mp4',
      path: `/media/s1${sep}exports${sep}f.mp4`,
      workPath: null
    }
    const pub = {
      id: 'p',
      fileName: 'f.mp4',
      path: '/public/f.mp4',
      workPath: null as string | null
    }
    const m1 = mergeExportByName(work, pub, sep)
    expect(m1.path).toBe('/public/f.mp4')
    expect(m1.workPath).toContain('exports')
    expect(m1.id).toBe('w')

    const m2 = mergeExportByName(
      { ...pub, workPath: null },
      { ...work, workPath: work.path },
      sep
    )
    expect(m2.workPath).toBeTruthy()

    const m3 = mergeExportByName(pub, { ...pub, id: 'p2' }, sep)
    expect(m3.id).toBe('p')
  })
})
