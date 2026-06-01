import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from '../empty-state'
import { InboxIcon } from 'lucide-react'

describe('EmptyState', () => {
  it('renders without crash', () => {
    const { container } = render(<EmptyState title="No data" />)
    expect(container).toBeTruthy()
  })

  it('shows title', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows description when provided', () => {
    render(<EmptyState title="Empty" description="Try adding something." />)
    expect(screen.getByText('Try adding something.')).toBeInTheDocument()
  })

  it('does not render description when omitted', () => {
    const { container } = render(<EmptyState title="Empty" />)
    expect(container.querySelectorAll('p').length).toBe(1)
  })

  it('renders icon slot', () => {
    render(<EmptyState title="Empty" icon={<InboxIcon data-testid="icon" />} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders CTA button when provided', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" cta={{ label: 'Add item', onClick }} />)
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })
})
