import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton } from "@/components/skeletons";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  callCreateGeneratorSession,
  callGeneratorSend,
  callBuildGeneratorProfile,
  callMintApproval,
  api,
  listModels,
  listGeneratorPresets,
} from "@/lib/api/client";
import { csrfHeaders } from "@/lib/csrf";
import { useAuth } from "@/hooks/useAuth";
import { bytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  openGeneratorWs,
  type GeneratorFrame,
  type GeneratorSession,
  type GeneratorState as WsState,
} from "@/lib/api/generatorWs";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const REASONING_OPTIONS = ["low", "medium", "high"] as const;
type Reasoning = (typeof REASONING_OPTIONS)[number];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: PendingAttachment[];
}

interface PendingAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;

function decodedBytes(att: PendingAttachment): number {
  const len = att.dataBase64.length;
  const pad = att.dataBase64.endsWith("==") ? 2 : att.dataBase64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - pad;
}

/** A single attachment chip / thumbnail. `onRemove` present ⇒ pending (composer). */
function AttachmentChip({ att, onRemove }: { att: PendingAttachment; onRemove?: () => void }) {
  const isImage = att.mime.startsWith("image/");
  const size = decodedBytes(att);
  if (isImage) {
    return (
      <div className="group/att relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted/30">
        {/* data: URL preview — the base64 we already hold, no extra fetch. */}
        <img
          src={`data:${att.mime};base64,${att.dataBase64}`}
          alt={att.filename}
          className="size-full object-cover"
        />
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${att.filename}`}
            onClick={onRemove}
            className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/att:opacity-100"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex max-w-[200px] items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate" title={att.filename}>
        {att.filename}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{bytes(size)}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${att.filename}`}
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Agent Generator (P2.5) — admin-only page.
 *
 * 1. Pick a model → auto-create a generator session.
 * 2. Chat with the AI; the model interviews and refines the spec.
 * 3. When the model emits a complete spec (status=done), the "Create agent"
 *    button enables, mints an approval token, and builds the profile.
 * 4. On success → navigate to the new agent's chat page.
 *
 * P9 reskin: the interview is now a full ai-sdk Elements chat (Conversation +
 * PromptInput), mirroring the agent chat page. All WS/RPC/build/spec machinery
 * is preserved — only the presentation changed.
 */
/** Mask operator-provided secrets (MCP env values + Telegram token) in the
    displayed spec so they aren't shown in plaintext in the live panel. */
function redactSpec(spec: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  if (typeof clone.telegramBotToken === "string" && clone.telegramBotToken) {
    clone.telegramBotToken = "••••••••";
  }
  if (typeof clone.soul === "string" && clone.soul.length > 0) {
    clone.soul = `(persona — ${clone.soul.length} chars)`;
  }
  if (Array.isArray(clone.mcps)) {
    for (const m of clone.mcps as Array<Record<string, unknown>>) {
      if (m && typeof m === "object" && m.env && typeof m.env === "object") {
        const env = m.env as Record<string, unknown>;
        for (const k of Object.keys(env)) if (env[k]) env[k] = "••••••••";
      }
    }
  }
  return clone;
}

const STATUS_BADGE: Record<
  "draft" | "done" | "building" | "error",
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  done: { label: "Ready", variant: "default" },
  building: { label: "Building", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
};

export default function AgentGeneratorPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [model, setModel] = useState<string>("");
  const [reasoning, setReasoning] = useState<Reasoning>("medium");
  const [spec, setSpec] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<"draft" | "done" | "building" | "error">("draft");
  // Driven by the sidecar's status frames; the WS send mutation resolves
  // immediately (the reply streams async), so it can't track "thinking".
  const [thinking, setThinking] = useState(false);
  // P3.4 WS layer: streaming chat/advisor/skeptic panels + live root PTY.
  // Falls back to the P2 RPC path when the sidecar is unavailable.
  const [wsState, setWsState] = useState<WsState>("connecting");
  const [ptyOutput, setPtyOutput] = useState("");
  const [advisorBuf, setAdvisorBuf] = useState("");
  const [skepticBuf, setSkepticBuf] = useState("");
  // P3.4b Channels tab — Telegram bot token sent once with build payload;
  // empty/absent → omitted from the build mint payload.
  const [telegramToken, setTelegramToken] = useState("");
  // Sidebar collapsibles (advisor/skeptic/PTY) — open by default on the desktop
  // rail; the whole rail collapses behind a toggle on narrow screens.
  const [showRail, setShowRail] = useState(false);
  const wsRef = useRef<GeneratorSession | null>(null);
  const wsStateRef = useRef<WsState>("connecting");
  wsStateRef.current = wsState;
  // Latest-value ref so the mount-once xterm effect can replay buffered PTY
  // output without listing ptyOutput as a dependency (which would re-init xterm).
  const ptyOutputRef = useRef("");
  ptyOutputRef.current = ptyOutput;
  const termContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: modelsData } = useQuery({
    queryKey: ["agent-models"],
    queryFn: () => listModels({ data: {} }),
  });
  const models = modelsData?.models ?? [];
  const { data: presets } = useQuery({
    queryKey: ["generator-presets"],
    queryFn: () => listGeneratorPresets({ data: {} }),
    enabled: !!user?.is_admin,
    staleTime: 60 * 60 * 1000,
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: api.agents,
    enabled: !!user?.is_admin,
  });

  const createSessionMut = useMutation({
    mutationFn: async () =>
      callCreateGeneratorSession({
        data: { model, reasoning },
        headers: csrfHeaders(),
      }),
    onSuccess: (res) => {
      setSessionId(res.id);
      setMessages([
        {
          role: "assistant",
          content: "Hi — describe the agent you want to build and I'll interview you.",
        },
      ]);
    },
    onError: (e: unknown) => {
      toast.error("Failed to start generator", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("no session");
      // WS path: text + model + attachments all travel in one user frame.
      // The sidecar converts images to multimodal parts and emits a text
      // manifest for the advisor/skeptic panels. The RPC fallback only runs
      // when the sidecar is unavailable.
      if (wsState === "live" && wsRef.current) {
        wsRef.current.send(text, {
          model,
          reasoning,
          ...(pending.length > 0 ? { attachments: pending } : {}),
        });
        return {
          via: "ws" as const,
          reply: "",
          spec: {} as Record<string, unknown>,
          status: "draft" as const,
        };
      }
      const rpc = await callGeneratorSend({
        data: { sessionId, text, attachments: pending.length > 0 ? pending : undefined },
        headers: csrfHeaders(),
      });
      return { via: "rpc" as const, reply: rpc.reply, spec: rpc.spec, status: rpc.status };
    },
    onSuccess: (res) => {
      const sentAttachments = pending.length > 0 ? pending : undefined;
      setMessages((m) => [...m, { role: "user", content: text, attachments: sentAttachments }]);
      if (res.via === "ws") {
        // Empty assistant bubble; WS `chat` frames will append into it.
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        setText("");
        setPending([]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      setText("");
      setPending([]);
      setSpec(res.spec);
      setStatus(res.status);
    },
    onError: (e: unknown) => {
      toast.error("Send failed", { description: e instanceof Error ? e.message : String(e) });
    },
  });

  const buildMut = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("no session");
      const slug = typeof spec.slug === "string" ? spec.slug : "";
      if (!slug) throw new Error("spec missing slug");
      // Mint a hash over the COMPLETE request body (the pipeline hashes action+input).
      const trimmedToken = telegramToken.trim();
      const payload: {
        sessionId: number;
        slug: string;
        spec: Record<string, unknown>;
        telegramBotToken?: string;
      } = {
        sessionId,
        slug,
        spec,
        ...(trimmedToken ? { telegramBotToken: trimmedToken } : {}),
      };
      const mint = await callMintApproval({
        data: { action: "agents.generator.build", payload },
      });
      return callBuildGeneratorProfile({
        data: payload,
        headers: { ...csrfHeaders(), "x-cortex-approval-token": mint.token },
      });
    },
    onSuccess: (res) => {
      toast.success(`Agent ${res.slug} created`, { description: `Port ${res.apiPort}` });
      qc.invalidateQueries({ queryKey: ["agents"] }).catch(() => {});
      navigate({ to: "/agents" });
    },
    onError: (e: unknown) => {
      setStatus("error");
      toast.error("Build failed", { description: e instanceof Error ? e.message : String(e) });
    },
  });

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    if (pending.length + fileArr.length > MAX_ATTACHMENTS) {
      toast.error("Too many attachments");
      return;
    }
    let running = pending.reduce((n, p) => n + decodedBytes(p), 0);
    for (const file of fileArr) {
      if (running + file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} exceeds the combined limit`);
        continue;
      }
      running += file.size;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        const dataBase64 = comma >= 0 ? result.slice(comma + 1) : result;
        setPending((p) =>
          [
            ...p,
            { filename: file.name, mime: file.type || "application/octet-stream", dataBase64 },
          ].slice(0, MAX_ATTACHMENTS),
        );
      };
      reader.readAsDataURL(file);
    }
  }

  // Auto-create session once a model is chosen.
  useEffect(() => {
    if (user?.is_admin && model && !sessionId && !createSessionMut.isPending) {
      createSessionMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, user?.is_admin]);

  // P3.4a — xterm PTY: mount once, replay initial ptyOutput, write incoming
  // frames into the terminal, send raw keystrokes back to the sidecar while
  // the WS is live. Cleanup disposes the terminal + ResizeObserver.
  useEffect(() => {
    const container = termContainerRef.current;
    if (!container) return;
    const term = new XTerm({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      cursorBlink: true,
      convertEol: true,
      theme: { background: "#000000", foreground: "#86efac" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    try {
      fit.fit();
    } catch {
      /* container not yet sized */
    }
    if (ptyOutputRef.current) term.write(ptyOutputRef.current);
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => {
      try {
        fit.fit();
      } catch {
        /* noop */
      }
      if (wsStateRef.current === "live") {
        wsRef.current?.resizePty(term.cols, term.rows);
      }
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);
    window.addEventListener("resize", onResize);

    const dataDisposable = term.onData((data) => {
      if (wsStateRef.current === "live") {
        wsRef.current?.sendPty(data);
      }
    });

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      dataDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // Mount only once; wsState is read via wsStateRef to avoid retriggering.
  }, []);

  // P3.4 — open the generator WS once we have a session; close on unmount.
  useEffect(() => {
    if (!sessionId) return;
    const handleFrame = (frame: GeneratorFrame) => {
      switch (frame.type) {
        case "chat":
          // Append the streaming delta into the current (last) assistant bubble.
          setMessages((m) => {
            const last = m.at(-1);
            if (last && last.role === "assistant") {
              return [
                ...m.slice(0, -1),
                { role: "assistant", content: last.content + frame.delta },
              ];
            }
            return [...m, { role: "assistant", content: frame.delta }];
          });
          return;
        case "advisor":
          setAdvisorBuf((b) => b + frame.delta);
          return;
        case "skeptic":
          setSkepticBuf((b) => b + frame.delta);
          return;
        case "pty":
          // Cap the PTY buffer to avoid unbounded growth (WhatsApp QR can be long).
          setPtyOutput((p) => (p + frame.data).slice(-32_000));
          termRef.current?.write(frame.data);
          return;
        case "spec":
          setSpec(frame.spec);
          return;
        case "status":
          if (frame.status === "thinking") setThinking(true);
          if (frame.status === "idle") {
            setThinking(false);
            setStatus("draft");
          }
          if (frame.status === "ready") {
            setThinking(false);
            setStatus("done");
          }
          if (frame.status === "error") {
            setThinking(false);
            setStatus("error");
          }
          return;
        case "exit":
          // Shell exited; no-op UI-wise, the user can restart via build/Channels.
          return;
        default:
          return;
      }
    };
    const session = openGeneratorWs({ onFrame: handleFrame, onState: setWsState });
    wsRef.current = session;
    return () => {
      wsRef.current = null;
      session.close();
    };
  }, [sessionId]);

  const pendingBytes = useMemo(
    () => pending.reduce((sum, p) => sum + decodedBytes(p), 0),
    [pending],
  );

  if (!user?.is_admin) {
    return (
      <div className="space-y-5">
        <PageHeader
          icon={<Sparkles className="size-5" />}
          title="Agent Generator"
          description="Admin only."
        />
        <Card className="elev-1 p-6">
          <EmptyState
            icon={<Sparkles className="size-8" />}
            title="Admin required"
            description="You need admin role to create agents."
          />
        </Card>
      </div>
    );
  }

  const canSend =
    !!sessionId && (text.trim().length > 0 || pending.length > 0) && !sendMut.isPending;
  const canBuild = status === "done" && typeof spec.slug === "string" && !buildMut.isPending;
  const currentSlug = typeof spec.slug === "string" ? spec.slug : "";
  const canConnectWhatsapp = wsState === "live" && currentSlug.length > 0;
  const submitStatus = sendMut.isPending || thinking ? "submitted" : undefined;
  const statusBadge = STATUS_BADGE[status];

  function handleSubmit(raw: string) {
    const trimmed = raw.trim();
    setText(trimmed);
    if (!sessionId) return;
    if ((trimmed.length === 0 && pending.length === 0) || sendMut.isPending) return;
    sendMut.mutate();
  }

  // ── Sidebar build rail — Live spec, Create agent, Advisor/Skeptic/PTY ──────
  const rail = (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-0.5">
      {/* Live spec preview (redacted; never shows secrets in plaintext). */}
      <Card className="elev-1 flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Bot className="size-3.5" /> Live spec
          </div>
          <Badge variant={statusBadge.variant} className="h-5 px-1.5 text-[10px]">
            {statusBadge.label}
          </Badge>
        </div>
        <pre className="max-h-[360px] min-h-[180px] overflow-y-auto whitespace-pre-wrap break-all rounded bg-muted/30 p-2 font-mono text-[10px]">
          {Object.keys(spec).length === 0
            ? "(empty — waiting for the model)"
            : JSON.stringify(redactSpec(spec), null, 2)}
        </pre>
      </Card>

      {/* Create agent — approval+admin gated server-side. Telegram token sent
          once with the build payload; WhatsApp runs in the live PTY pane. */}
      <Card className="elev-1 flex flex-col gap-3 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="size-3.5" /> Create agent
        </div>
        <div className="space-y-1">
          <label
            htmlFor="telegram-token"
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            Telegram bot token (optional, used at build time)
          </label>
          <Input
            id="telegram-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="123456:ABCDEF…"
            value={telegramToken}
            onChange={(e) => setTelegramToken(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>
        <Button
          size="sm"
          className="h-8 w-full text-xs"
          disabled={!canBuild}
          onClick={() => buildMut.mutate()}
          title={
            canBuild
              ? "Mint an approval token and build the Hermes profile."
              : "Enabled once the model emits a complete spec (status=ready) with a slug."
          }
        >
          {buildMut.isPending ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Building…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 size-3.5" /> Create agent
            </>
          )}
        </Button>
        {status === "error" && (
          <p className="text-[10px] text-destructive">
            Build failed — see the toast for details, then adjust the spec and retry.
          </p>
        )}
        <Separator />
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full text-xs"
          disabled={!canConnectWhatsapp}
          onClick={() => {
            wsRef.current?.sendPty(`hermes-${currentSlug} whatsapp setup\n`);
          }}
          title={
            canConnectWhatsapp
              ? "Run `hermes-<slug> whatsapp setup` in the live PTY pane; scan the QR in xterm."
              : "Needs WS live and a settled slug; build the profile first to install the binary."
          }
        >
          <TerminalIcon className="mr-1.5 size-3.5" /> Connect WhatsApp in PTY
        </Button>
      </Card>

      {/* Advisor — streaming buffer, collapsible. */}
      <RailPanel icon={<Sparkles className="size-3.5" />} title="Advisor" defaultOpen={false}>
        <pre className="max-h-[240px] min-h-[80px] overflow-y-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 font-mono text-[10px]">
          {advisorBuf || "(no advisory yet — fires after each user turn)"}
        </pre>
      </RailPanel>

      {/* Skeptic — streaming buffer, collapsible. */}
      <RailPanel icon={<Bot className="size-3.5" />} title="Skeptic" defaultOpen={false}>
        <pre className="max-h-[240px] min-h-[80px] overflow-y-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 font-mono text-[10px]">
          {skepticBuf || "(no challenge yet — fires after each user turn)"}
        </pre>
      </RailPanel>

      {/* Live root PTY — xterm mounts into this div. `forceMount` keeps the
          div in the DOM even while collapsed, so the mount-once xterm effect
          can attach to the ref; collapsing only hides it visually. */}
      <RailPanel
        icon={<TerminalIcon className="size-3.5" />}
        title="Live PTY (root bash)"
        defaultOpen={false}
        forceMount
      >
        <div
          ref={termContainerRef}
          className="h-[260px] min-h-[160px] overflow-hidden rounded bg-black p-1"
        />
      </RailPanel>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <PageHeader
        icon={<Sparkles className="size-5" />}
        title="Agent Generator"
        description="Describe the agent you want. The interview builds a Hermes profile spec; approve to create."
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_22rem]">
        {/* ---------------------------------------------------------------- */}
        {/* Main chat column — the interview as an Elements chat              */}
        {/* ---------------------------------------------------------------- */}
        <Card className="elev-1 flex min-h-0 min-w-0 flex-col overflow-hidden p-0">
          {/* Status / header strip: title + WS connection + thinking + rail toggle */}
          <header className="flex flex-wrap items-center gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-semibold">Interview</h1>
                {currentSlug && (
                  <span className="font-mono text-[10px] text-muted-foreground">{currentSlug}</span>
                )}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {thinking || sendMut.isPending ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> thinking…
                  </span>
                ) : (
                  <span>Refine the spec turn by turn, then build.</span>
                )}
              </p>
            </div>
            <Badge
              variant={
                wsState === "live"
                  ? "default"
                  : wsState === "unavailable"
                    ? "destructive"
                    : "secondary"
              }
              className="h-6 shrink-0 text-[10px] uppercase tracking-wide"
              title={
                wsState === "unavailable"
                  ? "Sidecar unreachable; using the P2 RPC fallback"
                  : "Generator sidecar WebSocket state"
              }
            >
              WS {wsState}
            </Badge>
            {/* Rail toggle — only meaningful on narrow screens (rail is inline below). */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-xs lg:hidden"
              onClick={() => setShowRail((v) => !v)}
              aria-expanded={showRail}
              aria-controls="generator-rail"
            >
              {showRail ? "Hide" : "Build panel"}
            </Button>
          </header>

          {/* Conversation (autoscrolls via use-stick-to-bottom) */}
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-6">
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<Sparkles className="size-8" />}
                  title="Agent Generator"
                  description={
                    model
                      ? "Loading session…"
                      : "Pick a model in the composer below to start the interview."
                  }
                />
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <Message key={i} from="user">
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                          {m.attachments.map((att, idx) => (
                            <AttachmentChip key={`${att.filename}-${idx}`} att={att} />
                          ))}
                        </div>
                      )}
                      {m.content && (
                        <MessageContent>
                          <span className="whitespace-pre-wrap break-words">{m.content}</span>
                        </MessageContent>
                      )}
                    </Message>
                  ) : (
                    <Message key={i} from="assistant">
                      <MessageContent>
                        {/* Markdown reply via Streamdown (matches the chat page). */}
                        <MessageResponse>{m.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ),
                )
              )}
              {/* Preset archetypes — seed the interview; stay visible (through the
                  assistant greeting) until the user sends their first turn. */}
              {!messages.some((m) => m.role === "user") &&
                presets &&
                presets.archetypes.length > 0 && (
                  <div className="w-full max-w-md self-center">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Start from an archetype
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {presets.archetypes.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          title={a.desc}
                          onClick={() =>
                            setText(
                              `I want to build a ${a.name}: ${a.desc}` +
                                (a.integrations.length
                                  ? ` Suggested integrations: ${a.integrations.join(", ")}.`
                                  : ""),
                            )
                          }
                          className="rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <Sparkles className="size-3 text-primary" /> {a.name}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                            {a.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              {(thinking || sendMut.isPending) && (
                <Message from="assistant">
                  <MessageContent>
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> thinking…
                    </span>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Composer */}
          <div className="border-t bg-card/60 p-3">
            {/* Pending attachment previews (above the composer) */}
            {pending.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {pending.map((att, i) => (
                  <AttachmentChip
                    key={`${att.filename}-${i}`}
                    att={att}
                    onRemove={() => setPending((arr) => arr.filter((_, idx) => idx !== i))}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground">
                  {pending.length}/{MAX_ATTACHMENTS} · {bytes(pendingBytes)}
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*,*"
              className="hidden"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <PromptInput
              onSubmit={(msg) => {
                handleSubmit(msg.text ?? "");
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  value={text}
                  onChange={(e) => setText(e.currentTarget.value)}
                  placeholder={
                    sessionId
                      ? "Reply… (Enter to send, Shift+Enter for newline)"
                      : model
                        ? "Loading session…"
                        : "Pick a model first…"
                  }
                  disabled={!sessionId || sendMut.isPending}
                />
                <PromptInputFooter>
                  <PromptInputTools>
                    <PromptInputButton
                      tooltip="Attach files"
                      aria-label="Attach files"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!sessionId}
                    >
                      <Paperclip className="size-4" />
                    </PromptInputButton>

                    {/* Model pick — seeds session creation, then travels with each turn. */}
                    <PromptInputSelect value={model} onValueChange={setModel}>
                      <PromptInputSelectTrigger className="h-7 text-xs" aria-label="Model">
                        <PromptInputSelectValue placeholder="Pick a model…" />
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent>
                        {models.map((m) => (
                          <PromptInputSelectItem key={m} value={m} className="font-mono text-xs">
                            {m}
                          </PromptInputSelectItem>
                        ))}
                      </PromptInputSelectContent>
                    </PromptInputSelect>

                    {/* Reasoning effort (9router ignores it for non-reasoning models). */}
                    <PromptInputSelect
                      value={reasoning}
                      onValueChange={(v) => setReasoning(v as Reasoning)}
                    >
                      <PromptInputSelectTrigger
                        className="h-7 text-xs"
                        aria-label="Reasoning effort"
                      >
                        <PromptInputSelectValue />
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent>
                        {REASONING_OPTIONS.map((r) => (
                          <PromptInputSelectItem key={r} value={r} className="text-xs capitalize">
                            {r}
                          </PromptInputSelectItem>
                        ))}
                      </PromptInputSelectContent>
                    </PromptInputSelect>
                  </PromptInputTools>

                  <PromptInputSubmit
                    status={submitStatus}
                    disabled={!canSend}
                    aria-label="Send message"
                  />
                </PromptInputFooter>
              </PromptInputBody>
            </PromptInput>
          </div>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Build rail — Live spec, Create agent, advisor/skeptic/PTY.        */}
        {/* Rendered ONCE (single xterm mount). On desktop it's the right     */}
        {/* column; on narrow screens it collapses behind the header toggle. */}
        {/* ---------------------------------------------------------------- */}
        <div
          id="generator-rail"
          className={cn("min-h-0 lg:block", showRail ? "block" : "hidden lg:block")}
        >
          {rail}
        </div>
      </div>

      {/* Existing agents — quick reference of what's already built. */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Existing agents</div>
        {agentsLoading ? (
          <div className="grid gap-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} lines={2} />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card className="elev-1 p-3">
            <EmptyState icon={<Bot className="size-6" />} title="No existing agents" />
          </Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {agents.map((a) => (
              <Card key={a.slug} className="elev-1 p-3 text-xs">
                <div className="truncate font-semibold">{a.name}</div>
                <div className="truncate font-mono text-muted-foreground">{a.slug}</div>
                <div className="mt-0.5 truncate text-muted-foreground">{a.model}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Collapsible sidebar panel for the streaming advisor/skeptic/PTY buffers.
    Defined at module scope (pure presentational helper, no hooks of its own
    beyond Collapsible's) so it doesn't add a react-refresh export warning. */
function RailPanel({
  icon,
  title,
  defaultOpen,
  forceMount,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen: boolean;
  /** Keep content mounted while collapsed (only hide it). Needed for the PTY
      pane so xterm's mount-once effect can attach to its container ref. */
  forceMount?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="elev-1 p-3">
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-1.5 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            {icon} {title}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        {/* `forceMount` keeps children in the DOM; `data-[state=closed]:hidden`
            hides them visually so the collapse still works. */}
        <CollapsibleContent
          {...(forceMount ? { forceMount: true } : {})}
          className="pt-2 data-[state=closed]:hidden"
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
