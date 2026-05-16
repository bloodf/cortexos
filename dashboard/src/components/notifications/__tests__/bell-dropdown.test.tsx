import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BellDropdown } from '../bell-dropdown'

vi.mock('swr', () => ({
  default: vi.fn(),
  mutate: vi.fn(),
}))

import useSWR from 'swr'

const mockUseSWR = useSWR as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockUseSWR.mockReturnValue({ data: [], isLoading: false })
})

describe('BellDropdown', () => {
  it('renders without crash', () => {
    const { container } = render(<BellDropdown />)
    expect(container).toBeTruthy()
  })

  it('renders bell button', () => {
    render(<BellDropdown />)
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
  })

  it('does not show badge when no unread alerts', () => {
    mockUseSWR.mockReturnValue({ data: [], isLoading: false })
    render(<BellDropdown />)
    expect(screen.queryByText('9+')).not.toBeInTheDocument()
  })

  it('shows unread badge count', () => {
    mockUseSWR.mockReturnValue({
      data: [
        { id: '1', title: 'Alert 1', message: 'msg', severity: 'info', created_at: '', read_at: null },
        { id: '2', title: 'Alert 2', message: 'msg', severity: 'warning', created_at: '', read_at: null },
      ],
      isLoading: false,
    })
    render(<BellDropdown />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('bell button is keyboard focusable', () => {
    render(<BellDropdown />)
    const btn = screen.getByRole('button', { name: /notifications/i })
    btn.focus()
    expect(document.activeElement).toBe(btn)
  })

  it('shows 9+ for >9 unread', () => {
    const alerts = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      title: `Alert ${i}`,
      message: 'msg',
      severity: 'info' as const,
      created_at: '',
      read_at: null,
    }))
    mockUseSWR.mockReturnValue({ data: alerts, isLoading: false })
    render(<BellDropdown />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })
})
