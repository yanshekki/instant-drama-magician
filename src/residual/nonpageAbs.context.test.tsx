/**
 * Residual: Toast/Dialog hooks throw outside providers.
 */
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useToast } from '../presentation/context/ToastContext'
import { useDialog } from '../presentation/context/DialogContext'

describe('mop6: context outside provider', () => {
  it('useToast throws', () => {
    expect(() => renderHook(() => useToast())).toThrow(/ToastProvider/)
  })
  it('useDialog throws', () => {
    expect(() => renderHook(() => useDialog())).toThrow(/Dialog|provider/i)
  })
})
