import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock useChat — supply controllable messages per-test.
const useChatMock = vi.fn()
vi.mock('@ai-sdk/react', () => ({
  useChat: (opts: unknown) => useChatMock(opts),
}))
vi.mock('ai', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ai')
  return {
    ...actual,
    DefaultChatTransport: class {
      constructor(_opts: unknown) {}
    },
  }
})

import { ChatPanel } from '../chat-panel'

// Stub localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    clear: () => {
      store = {}
    },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Stub fetch (panel uses it for /api/chat-sessions PUT)
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

beforeEach(() => {
  localStorageMock.clear()
  useChatMock.mockReturnValue({
    messages: [],
    status: 'ready',
    sendMessage: vi.fn().mockResolvedValue(undefined),
  })
})

describe('ChatPanel', () => {
  it('renders without crash', () => {
    const { container } = render(<ChatPanel />)
    expect(container).toBeTruthy()
  })

  it('shows collapsed rail by default', () => {
    render(<ChatPanel />)
    const panel = document.querySelector('[data-slot="chat-panel"]')
    expect(panel).toHaveAttribute('data-state', 'collapsed')
  })

  it('expands when rail button is clicked', () => {
    render(<ChatPanel />)
    const openBtn = screen.getByLabelText('Open Cortex chat')
    fireEvent.click(openBtn)
    const panel = document.querySelector('[data-slot="chat-panel"]')
    expect(panel).toHaveAttribute('data-state', 'open')
  })

  it('Esc key collapses an open panel', () => {
    render(<ChatPanel />)
    const openBtn = screen.getByLabelText('Open Cortex chat')
    fireEvent.click(openBtn)
    fireEvent.keyDown(document, { key: 'Escape' })
    const panel = document.querySelector('[data-slot="chat-panel"]')
    expect(panel).toHaveAttribute('data-state', 'collapsed')
  })

  it('has accessible aside landmark when open', () => {
    render(<ChatPanel />)
    fireEvent.click(screen.getByLabelText('Open Cortex chat'))
    const aside = screen.getByRole('complementary', { name: /cortex chat/i })
    expect(aside).toBeInTheDocument()
  })

  it('renders confirmation_required card for privileged tool output', () => {
    useChatMock.mockReturnValue({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-env_read',
              toolCallId: 'tc-1',
              toolName: 'env_read',
              state: 'output-available',
              input: { path: '/opt/cortexos/secrets/dashboard.env' },
              output: {
                kind: 'confirmation_required',
                tool: 'env_read',
                args: { path: '/opt/cortexos/secrets/dashboard.env' },
                token: 'tok-abc',
                approvalId: 'ap-1',
              },
            },
          ],
        },
      ],
      status: 'ready',
      sendMessage: vi.fn().mockResolvedValue(undefined),
    })
    render(<ChatPanel />)
    fireEvent.click(screen.getByLabelText('Open Cortex chat'))
    const card = document.querySelector('[data-slot="confirmation-required"]')
    expect(card).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm tool call')).toBeInTheDocument()
    expect(screen.getByLabelText('Reject tool call')).toBeInTheDocument()
  })
})
