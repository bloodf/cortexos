import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorPicker, pickTextColor } from '../color-picker'

vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
    <input
      data-testid="hex-picker"
      value={color}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

describe('pickTextColor', () => {
  it('black bg → white text', () => {
    expect(pickTextColor('#000000')).toBe('#ffffff')
  })

  it('white bg → black text', () => {
    expect(pickTextColor('#ffffff')).toBe('#000000')
  })

  it('blue #2563eb → white text (WCAG AA)', () => {
    expect(pickTextColor('#2563eb')).toBe('#ffffff')
  })

  it('yellow #facc15 → black text (high luminance)', () => {
    expect(pickTextColor('#facc15')).toBe('#000000')
  })
})

describe('ColorPicker', () => {
  it('renders without crash', () => {
    const { container } = render(<ColorPicker />)
    expect(container).toBeTruthy()
  })

  it('shows hex input', () => {
    render(<ColorPicker value="#ff0000" />)
    expect(screen.getByRole('textbox', { name: /hex color/i })).toBeInTheDocument()
  })

  it('shows preview label when provided', () => {
    render(<ColorPicker value="#ff0000" previewLabel="My color" />)
    expect(screen.getByText('My color')).toBeInTheDocument()
  })
})
