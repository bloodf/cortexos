"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import {
  SendHorizonalIcon,
  XIcon,
  MessageSquareIcon,
  Loader2Icon,
} from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { IconButton } from "@/components/ui/icon-button"
import { cn } from "@/lib/utils"

// ─── Persisted state ──────────────────────────────────────────────────────────

const PANEL_STORAGE_KEY = "cortex:chat-panel"
const SESSION_STORAGE_KEY = "cortex_chat_session_id"

interface PanelState {
  panel_open: boolean
  width: number
}

function readPanelStorage(): PanelState {
  if (typeof window === "undefined") return { panel_open: false, width: 380 }
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PanelState) : { panel_open: false, width: 380 }
  } catch {
    return { panel_open: false, width: 380 }
  }
}

function writePanelStorage(value: PanelState): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(value))
}

function createSessionId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID()
      } catch {
        // fall through
      }
    }
    if (typeof crypto.getRandomValues === "function") {
      try {
        const bytes = new Uint8Array(16)
        crypto.getRandomValues(bytes)
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
      } catch {
        // fall through
      }
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function ensureSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!id) {
    id = createSessionId()
    localStorage.setItem(SESSION_STORAGE_KEY, id)
  }
  return id
}

// ─── Tool-result inspection helpers ───────────────────────────────────────────

interface ConfirmationRequiredOutput {
  kind: "confirmation_required"
  tool: string
  args: Record<string, unknown>
  token: string
  approvalId: string
  expiresAt?: string
}

function isConfirmationRequired(output: unknown): output is ConfirmationRequiredOutput {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as { kind?: unknown }).kind === "confirmation_required"
  )
}

interface ToolUIPartLike {
  type: string
  toolCallId?: string
  toolName?: string
  state?: string
  input?: unknown
  output?: unknown
}

function isToolUIPart(part: unknown): part is ToolUIPartLike {
  return (
    typeof part === "object" &&
    part !== null &&
    typeof (part as { type?: unknown }).type === "string" &&
    (part as { type: string }).type.startsWith("tool-")
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function ChatPanel() {
  const [open, setOpenState] = React.useState<boolean>(() => readPanelStorage().panel_open)
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 767px)").matches
  })
  const [sessionId] = React.useState<string>(() => ensureSessionId())
  const [input, setInput] = React.useState("")
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const setOpen = React.useCallback((value: boolean) => {
    setOpenState(value)
    const stored = readPanelStorage()
    const next = { ...stored, panel_open: value }
    writePanelStorage(next)
    fetch("/api/chat-sessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panel_open: value, width: stored.width }),
    }).catch(() => {})
  }, [])

  // Mobile detection (subscribe to mq change events)
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Esc collapses panel
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, setOpen])

  // Transport — supplies sessionId on every send.
  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/ai/chat",
      body: () => ({ sessionId: sessionId || "pending" }),
    })
  }, [sessionId])

  const chat = useChat({ transport })

  // Scroll on new messages
  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [chat.messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput("")
    chat.sendMessage?.({ text }).catch(() => {})
  }

  const handleConfirm = (
    toolCallId: string,
    toolName: string,
    output: ConfirmationRequiredOutput,
  ) => {
    // Resubmit by sending an explicit tool-use message containing the token.
    const text = `Confirmed for ${toolName}. confirmationToken=${output.token}`
    chat.sendMessage?.({ text }).catch(() => {})
  }

  const handleReject = (_toolCallId: string) => {
    chat.sendMessage?.({ text: "Action cancelled." }).catch(() => {})
  }

  // Body shared by mobile + desktop layouts.
  const body = (
    <ChatPanelInner
      messages={chat.messages}
      input={input}
      loading={chat.status === "submitted" || chat.status === "streaming"}
      scrollRef={scrollRef}
      onInput={setInput}
      onSend={handleSend}
      onClose={() => setOpen(false)}
      onConfirm={handleConfirm}
      onReject={handleReject}
    />
  )

  // ── Mobile: full-screen Sheet ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open Cortex chat"
            className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <MessageSquareIcon className="size-5" />
          </button>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-full p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Cortex chat</SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  // ── Desktop: persistent right-side dock ───────────────────────────────────
  return (
    <aside
      aria-label="Cortex chat"
      data-slot="chat-panel"
      data-state={open ? "open" : "collapsed"}
      className={cn(
        "fixed right-0 top-0 z-30 flex h-svh flex-col border-l border-border bg-background transition-[width] duration-200 ease-in-out",
        open ? "w-[380px]" : "w-12",
      )}
    >
      {open ? (
        body
      ) : (
        <div className="flex flex-col items-center py-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open Cortex chat"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MessageSquareIcon className="size-4" />
          </button>
        </div>
      )}
    </aside>
  )
}

// ─── Inner panel ──────────────────────────────────────────────────────────────

interface ChatPanelInnerProps {
  messages: UIMessage[]
  input: string
  loading: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  onInput: (v: string) => void
  onSend: () => void
  onClose: () => void
  onConfirm: (
    toolCallId: string,
    toolName: string,
    output: ConfirmationRequiredOutput,
  ) => void
  onReject: (toolCallId: string) => void
}

function ChatPanelInner({
  messages,
  input,
  loading,
  scrollRef,
  onInput,
  onSend,
  onClose,
  onConfirm,
  onReject,
}: ChatPanelInnerProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">Cortex</span>
        <IconButton
          variant="ghost"
          tooltip="Collapse"
          onClick={onClose}
          aria-label="Collapse chat"
        >
          <XIcon />
        </IconButton>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Ask Cortex anything about your VPS.
          </p>
        )}
        {messages.map((msg) => (
          <MessageRender
            key={msg.id}
            message={msg}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <PromptInput
        value={input}
        onChange={onInput}
        onSubmit={onSend}
        disabled={loading}
      />
    </div>
  )
}

// ─── Per-message rendering ────────────────────────────────────────────────────

interface MessageRenderProps {
  message: UIMessage
  onConfirm: (
    toolCallId: string,
    toolName: string,
    output: ConfirmationRequiredOutput,
  ) => void
  onReject: (toolCallId: string) => void
}

function MessageRender({ message, onConfirm, onReject }: MessageRenderProps) {
  const role = message.role as "user" | "assistant" | "system" | "tool"
  const parts = (message.parts ?? []) as unknown[]

  return (
    <div className="flex flex-col gap-1">
      {parts.map((p, idx) => {
        if (typeof p === "object" && p !== null) {
          const part = p as { type?: string; text?: string }
          if (part.type === "text" && typeof part.text === "string") {
            return (
              <div
                key={idx}
                data-slot="ai-message"
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  role === "user"
                    ? "ml-6 self-end bg-primary text-primary-foreground"
                    : "mr-6 self-start bg-muted text-foreground",
                )}
              >
                {part.text}
              </div>
            )
          }
          if (isToolUIPart(part)) {
            const out = part.output
            if (isConfirmationRequired(out)) {
              return (
                <ConfirmationCard
                  key={idx}
                  toolName={out.tool}
                  args={out.args}
                  onAccept={() =>
                    onConfirm(part.toolCallId ?? "", out.tool, out)
                  }
                  onReject={() => onReject(part.toolCallId ?? "")}
                />
              )
            }
            return (
              <ToolCard
                key={idx}
                name={part.toolName ?? "tool"}
                input={part.input}
                output={part.output}
                state={part.state}
              />
            )
          }
        }
        return null
      })}
    </div>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────

interface ConfirmationCardProps {
  toolName: string
  args: Record<string, unknown>
  onAccept: () => void
  onReject: () => void
}

function ConfirmationCard({
  toolName,
  args,
  onAccept,
  onReject,
}: ConfirmationCardProps) {
  return (
    <div
      data-slot="confirmation-required"
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
    >
      <p className="mb-2 font-medium text-amber-700 dark:text-amber-400">
        Confirm tool: <span className="font-mono">{toolName}</span>
      </p>
      <pre className="mb-2 whitespace-pre-wrap text-xs">
        {JSON.stringify(args, null, 2)}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          aria-label="Confirm tool call"
          className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
        >
          Confirm
        </button>
        <button
          onClick={onReject}
          aria-label="Reject tool call"
          className="rounded border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

interface ToolCardProps {
  name: string
  input?: unknown
  output?: unknown
  state?: string
}

function ToolCard({ name, input, output, state }: ToolCardProps) {
  return (
    <details
      data-slot="tool-call"
      className="rounded border border-border bg-muted/50 px-2 py-1 text-xs"
    >
      <summary className="cursor-pointer select-none font-mono">
        {name} {state ? <span className="opacity-50">({state})</span> : null}
      </summary>
      {input !== undefined && (
        <pre className="mt-1 whitespace-pre-wrap">
          input: {JSON.stringify(input, null, 2)}
        </pre>
      )}
      {output !== undefined && (
        <pre className="mt-1 whitespace-pre-wrap">
          output: {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </details>
  )
}

// ─── Prompt input ─────────────────────────────────────────────────────────────

interface PromptInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
}

function PromptInput({ value, onChange, onSubmit, disabled }: PromptInputProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }
  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Ask Cortex…"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
        aria-label="Chat input"
      />
      <IconButton
        variant="primary"
        tooltip="Send"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <SendHorizonalIcon />
      </IconButton>
    </div>
  )
}

export { ChatPanel }
