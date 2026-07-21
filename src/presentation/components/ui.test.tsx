import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Textarea
} from './ui'

describe('ui components', () => {
  it('Button variants, loading, click', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <Button onClick={onClick} variant="primary">
        Go
      </Button>
    )
    fireEvent.click(screen.getByText('Go'))
    expect(onClick).toHaveBeenCalled()

    for (const variant of ['secondary', 'danger', 'ghost'] as const) {
      rerender(
        <Button variant={variant} loading>
          Busy
        </Button>
      )
      const btn = screen.getByText('Busy').closest('button')!
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('aria-busy')).toBe('true')
    }
    cleanup()
  })

  it('Input, Textarea sizes, Label, Card, EmptyState, Select', () => {
    render(
      <>
        <Label>Name</Label>
        <Input value="x" onChange={() => undefined} data-testid="inp" />
        <Textarea size="sm" data-testid="ta-sm" />
        <Textarea size="md" data-testid="ta-md" />
        <Textarea size="lg" data-testid="ta-lg" />
        <Textarea size="xl" data-testid="ta-xl" />
        <Textarea size="fill" data-testid="ta-fill" />
        <Textarea size={'bogus' as 'md'} data-testid="ta-bad" />
        <Card className="extra">card body</Card>
        <EmptyState message="nothing here" />
        <Select data-testid="sel">
          <option value="a">A</option>
        </Select>
      </>
    )
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByTestId('inp')).toBeTruthy()
    expect(screen.getByTestId('ta-sm').className).toContain('min-h-[5rem]')
    expect(screen.getByTestId('ta-fill').className).toContain('min-h-')
    expect(screen.getByTestId('ta-bad').className).toContain('min-h-[7.5rem]')
    expect(screen.getByText('card body')).toBeTruthy()
    expect(screen.getByText('nothing here')).toBeTruthy()
    expect(screen.getByTestId('sel')).toBeTruthy()
    cleanup()
  })
})
