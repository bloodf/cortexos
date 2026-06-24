import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  Lock,
  Paperclip,
  RefreshCw,
  Sparkles,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/components/ai-elements/plan";
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
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorItem,
  ModelSelectorEmpty,
  ModelSelectorLogo,
  ModelSelectorName,
  type ModelSelectorLogoProps,
} from "@/components/ai-elements/model-selector";
import {
  callCreateGeneratorSession,
  callGeneratorSend,
  callBuildGeneratorProfile,
  callMintApproval,
  callSetGeneratorSecret,
  callGetGeneratorSession,
  listModels,
  listGeneratorPresets,
} from "@/lib/api/client";
import { csrfHeaders } from "@/lib/csrf";
import { useAuth } from "@/hooks/useAuth";
import { bytes } from "@/lib/format";
import {
  type PendingAttachment,
  MAX_ATTACHMENTS,
  decodedBytes,
  AttachmentChip,
  readAttachments,
} from "@/lib/attachment";
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

/**
 * Map a 9router model id to a models.dev provider slug for the logo.
 * Returns null for unknown prefixes — caller skips the logo entirely
 * (avoids a broken-image icon in the UI).
 *
 * Grounded in the live 9router /v1/models catalog (78 models across these
 * prefixes): cc, cf, cu, cx, gc, gh, glm, kimi, minimax, ollama-local, openrouter.
 */
function providerFor(modelId: string): ModelSelectorLogoProps["provider"] | null {
  const slash = modelId.indexOf("/");
  if (slash <= 0) return null;
  const prefix = modelId.slice(0, slash);
  switch (prefix) {
    case "cc":
      return "anthropic";
    case "cf":
      return "cloudflare-workers-ai";
    case "cx":
      return "openai";
    case "gc":
      return "google";
    case "gh":
      return "github-models";
    case "glm":
      return "zai-coding-plan";
    case "kimi":
      return "moonshotai";
    case "openrouter":
      return "openrouter";
    // cu, minimax, ollama-local: no models.dev equivalent — skip logo.
    default:
      return null;
  }
}

const REASONING_OPTIONS = ["low", "medium", "high"] as const;
type Reasoning = (typeof REASONING_OPTIONS)[number];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: PendingAttachment[];
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

/** Derive required secret key names from a spec (MCP env keys + TELEGRAM_BOT_TOKEN). */
function requiredSecretKeys(spec: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const mcps = Array.isArray((spec as { mcps?: unknown }).mcps)
    ? (spec as { mcps: Array<{ env?: Record<string, unknown> }> }).mcps
    : [];
  for (const mcp of mcps) {
    if (mcp && mcp.env && typeof mcp.env === "object") {
      for (const k of Object.keys(mcp.env)) if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k)) keys.add(k);
    }
  }
  if (typeof (spec as { telegramBotToken?: unknown }).telegramBotToken === "string")
    keys.add("TELEGRAM_BOT_TOKEN");
  return [...keys];
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
  const [modelOpen, setModelOpen] = useState(false);
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
  // Live PTY modal visibility. The xterm host div is ALWAYS mounted (so the
  // mount-once effect never tears down); this flag only reveals/hides the
  // overlay chrome that frames it. Opening triggers a fit() so xterm sizes to
  // the now-visible container.
  const [ptyOpen, setPtyOpen] = useState(false);
  // Which assistant bubble most recently had its body copied (drives the
  // Copy→Check icon flip on the message action).
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
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
  // WS in-flight guard: prevents overlapping turns that corrupt state.history ordering.
  const wsTurnPending = useRef(false);
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
    mutationFn: async ({
      sentText,
      sentPending,
    }: {
      sentText: string;
      sentPending: PendingAttachment[];
    }) => {
      if (!sessionId) throw new Error("no session");
      // WS path: text + model + attachments all travel in one user frame.
      // The sidecar converts images to multimodal parts and emits a text
      // manifest for the advisor/skeptic panels. The RPC fallback only runs
      // when the sidecar is unavailable.
      if (wsState === "live" && wsRef.current) {
        // Fix #2: block overlapping WS turns — corrupts sidecar state.history.
        if (wsTurnPending.current) throw new Error("Turn already in progress");
        wsTurnPending.current = true;
        wsRef.current.send(sentText, {
          model,
          reasoning,
          ...(sentPending.length > 0 ? { attachments: sentPending } : {}),
        });
        return {
          via: "ws" as const,
          reply: "",
          spec: {} as Record<string, unknown>,
          status: "draft" as const,
          sentText,
          sentPending,
        };
      }
      // RPC fallback intentionally sends only sessionId/text/attachments. The
      // server resolves model + reasoning from the session (fixed at session
      // creation), so they are not forwarded per-turn on this path.
      const rpc = await callGeneratorSend({
        data: {
          sessionId,
          text: sentText,
          attachments: sentPending.length > 0 ? sentPending : undefined,
        },
        headers: csrfHeaders(),
      });
      return {
        via: "rpc" as const,
        reply: rpc.reply,
        spec: rpc.spec,
        status: rpc.status,
        sentText,
        sentPending,
      };
    },
    onSuccess: (res) => {
      // Fix #3: use mutation variables (snapshots), not live state, so the
      // bubble matches exactly what was sent even if the operator edits mid-flight.
      const sentAttachments = res.sentPending.length > 0 ? res.sentPending : undefined;
      setMessages((m) => [
        ...m,
        { role: "user", content: res.sentText, attachments: sentAttachments },
      ]);
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
      // Don't clear wsTurnPending for the "Turn already in progress" guard throw —
      // that path never set the flag, so clearing it would release the in-flight turn.
      if (!(e instanceof Error && e.message === "Turn already in progress")) {
        wsTurnPending.current = false;
      }
      toast.error("Send failed", { description: e instanceof Error ? e.message : String(e) });
    },
  });

  const buildMut = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("no session");
      const slug = typeof spec.slug === "string" ? spec.slug : "";
      if (!slug) throw new Error("spec missing slug");
      // Deep-sanitize spec before hashing/sending: secret values (MCP env +
      // telegramBotToken) are staged out-of-band and must never travel in
      // the build payload. Keys are preserved so the builder knows what's staged.
      const sanitizedSpec: Record<string, unknown> = JSON.parse(JSON.stringify(spec));
      if (typeof sanitizedSpec.telegramBotToken === "string") sanitizedSpec.telegramBotToken = "";
      if (Array.isArray(sanitizedSpec.mcps)) {
        for (const mcp of sanitizedSpec.mcps as Array<Record<string, unknown>>) {
          if (mcp && typeof mcp.env === "object" && mcp.env !== null) {
            const env = mcp.env as Record<string, unknown>;
            for (const k of Object.keys(env)) env[k] = "";
          }
        }
      }
      const payload: { sessionId: number; slug: string; spec: Record<string, unknown> } = {
        sessionId,
        slug,
        spec: sanitizedSpec,
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
    readAttachments(files, pending, (att) =>
      setPending((p) => [...p, att].slice(0, MAX_ATTACHMENTS)),
    );
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
            wsTurnPending.current = false;
          }
          if (frame.status === "ready") {
            setThinking(false);
            setStatus("done");
            wsTurnPending.current = false;
          }
          if (frame.status === "error") {
            setThinking(false);
            setStatus("error");
            wsTurnPending.current = false;
          }
          return;
        case "exit":
          // Shell exited; no-op UI-wise, the user can restart via build/Channels.
          return;
        default:
          return;
      }
    };
    // Bug #5 fix: if the WS closes or becomes unavailable while `thinking` is
    // true (e.g. a mid-stream disconnect), the spinner would stick forever.
    // Clear `thinking` and mark the trailing empty assistant bubble as errored.
    const handleState = (next: WsState) => {
      setWsState(next);
      if (next === "closed" || next === "unavailable") {
        wsTurnPending.current = false;
        setThinking((wasThinking) => {
          if (wasThinking) {
            setMessages((m) => {
              const last = m.at(-1);
              if (last && last.role === "assistant" && last.content === "") {
                return [...m.slice(0, -1), { role: "assistant", content: "[connection lost]" }];
              }
              return m;
            });
          }
          return false;
        });
      }
    };
    const session = openGeneratorWs({ onFrame: handleFrame, onState: handleState });
    wsRef.current = session;
    return () => {
      wsRef.current = null;
      session.close();
    };
  }, [sessionId]);

  // When the PTY modal opens, the host div transitions from display:none to
  // visible, so xterm must refit to the freshly-laid-out container and push
  // the new dimensions back to the sidecar. The terminal itself is never
  // remounted — only re-measured.
  useEffect(() => {
    if (!ptyOpen) return;
    const id = window.requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        /* container not yet sized */
      }
      const term = termRef.current;
      if (term && wsStateRef.current === "live") {
        wsRef.current?.resizePty(term.cols, term.rows);
      }
      term?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [ptyOpen]);

  // ── Secrets panel state ──────────────────────────────────────────────────
  // secretValues: in-progress masked input values, cleared per key after
  // a successful post. NEVER written into spec, messages, or any log.
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  // stagedKeys: key names confirmed staged server-side (no values stored here).
  const [stagedKeys, setStagedKeys] = useState<string[]>([]);
  const requiredKeys = useMemo(() => requiredSecretKeys(spec), [spec]);
  const missingSecrets = requiredKeys.filter((k) => !stagedKeys.includes(k));

  const setSecretMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!sessionId) throw new Error("no session");
      return callSetGeneratorSecret({
        data: { sessionId, key, value },
        headers: csrfHeaders(),
      });
    },
    onSuccess: (res, { key }) => {
      setStagedKeys(res.staged);
      setSecretValues((m) => {
        const n = { ...m };
        delete n[key];
        return n;
      });
      toast.success(`${key} stored`);
    },
    onError: (e: unknown, { key }) => {
      toast.error("Failed to store secret", {
        description: `${key}: ${e instanceof Error ? e.message : String(e)}`,
      });
    },
  });

  // Seed stagedKeys from server truth whenever the session changes. The effect
  // is keyed on sessionId, so a secret saved WITHIN a session (which does not
  // change sessionId) never re-runs this and is never clobbered; switching to a
  // new/empty session correctly RESETS to that session's staged set (no stale
  // keys leaking across sessions and falsely satisfying the build gate).
  useEffect(() => {
    if (!sessionId) {
      setStagedKeys([]);
      return;
    }
    let cancelled = false;
    callGetGeneratorSession({ data: { sessionId } })
      .then((session) => {
        if (!cancelled) setStagedKeys(session.stagedSecretKeys);
      })
      .catch(() => {
        /* non-fatal; user can re-enter */
      });
    return () => {
      cancelled = true;
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
  const canBuild =
    status === "done" &&
    typeof spec.slug === "string" &&
    !buildMut.isPending &&
    missingSecrets.length === 0;
  const currentSlug = typeof spec.slug === "string" ? spec.slug : "";
  const canConnectWhatsapp = wsState === "live" && currentSlug.length > 0;
  // Modal enablement — each tool opens only when there's something to see.
  // The Live PTY keeps its existing WS-live + slug gate (it requires a real
  // build to install the hermes-<slug> binary before the QR can run).
  const hasSpec = Object.keys(spec).length > 0;
  const hasAdvisor = advisorBuf.trim().length > 0;
  const hasSkeptic = skepticBuf.trim().length > 0;
  const submitStatus =
    sendMut.isPending || thinking || wsTurnPending.current ? "submitted" : undefined;
  const canSend =
    !!sessionId &&
    (text.trim().length > 0 || pending.length > 0) &&
    !sendMut.isPending &&
    !wsTurnPending.current;

  const statusBadge = STATUS_BADGE[status];
  // Index of the last assistant bubble — only it gets a Retry action.
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === "assistant" ? i : acc), -1);

  // Build progress for the Plan view. The build is a single synchronous RPC
  // (callBuildGeneratorProfile) — the per-step buildLogs accumulate server-side
  // and aren't streamed back into this component, so the rows here reflect the
  // real client-observable state machine (spec ready → mint+build → done/error)
  // rather than a fabricated log stream.
  const buildState: "pending" | "active" | "done" | "error" = buildMut.isError
    ? "error"
    : buildMut.isSuccess
      ? "done"
      : buildMut.isPending
        ? "active"
        : "pending";
  const buildSteps: { label: string; state: "pending" | "active" | "done" | "error" }[] = [
    {
      label: "Spec ready",
      state: status === "done" || buildMut.isPending || buildMut.isSuccess ? "done" : "pending",
    },
    {
      label: "Mint approval & build profile",
      state:
        buildState === "error"
          ? "error"
          : buildMut.isSuccess
            ? "done"
            : buildMut.isPending
              ? "active"
              : "pending",
    },
    {
      label: "Provision Hermes profile",
      state: buildMut.isSuccess ? "done" : "pending",
    },
  ];

  function handleSubmit(raw: string) {
    const trimmed = raw.trim();
    setText(trimmed);
    if (!sessionId) return;
    if (
      (trimmed.length === 0 && pending.length === 0) ||
      sendMut.isPending ||
      wsTurnPending.current
    )
      return;
    sendMut.mutate({ sentText: trimmed, sentPending: pending });
  }

  // Copy an assistant message body; flips the icon to a check briefly.
  function copyMessage(idx: number, content: string) {
    navigator.clipboard.writeText(content).then(
      () => {
        setCopiedIdx(idx);
        window.setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
      },
      () => toast.error("Copy failed"),
    );
  }

  // Retry the last turn: directly mutate with the last user message text,
  // bypassing handleSubmit to avoid the setText→stale-closure race.
  function retryLastTurn() {
    if (sendMut.isPending || wsTurnPending.current) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content) return;
    sendMut.mutate({ sentText: lastUser.content, sentPending: lastUser.attachments ?? [] });
  }

  // ── Build-tool toolbar — Live spec / Advisor / Skeptic / Live PTY modals ───
  // Each tool is a button that opens its own modal. The spec/advisor/skeptic
  // bodies live inside shadcn Dialogs (no mount constraints). The PTY is a
  // controlled overlay (see ptyOverlay below) because the xterm host div must
  // never unmount — a Dialog would tear it down on close.
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-t bg-card/40 px-3 py-2">
      {/* Live spec — redacted JSON + status badge. */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={!hasSpec}
            title={hasSpec ? "View the live spec" : "Available once the model emits a spec"}
          >
            <Bot className="size-3.5" /> Live spec
            <Badge variant={statusBadge.variant} className="ml-0.5 h-4 px-1.5 text-[9px]">
              {statusBadge.label}
            </Badge>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-4" /> Live spec
              <Badge variant={statusBadge.variant} className="h-5 px-1.5 text-[10px]">
                {statusBadge.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {/* Build progress as a Plan — shimmers the title while building. */}
          <Plan isStreaming={buildMut.isPending} defaultOpen>
            <PlanHeader>
              <div className="space-y-1">
                <PlanTitle>{currentSlug ? `Building ${currentSlug}` : "Build profile"}</PlanTitle>
                <PlanDescription>
                  {buildState === "error"
                    ? "Build failed — adjust the spec and retry."
                    : buildState === "done"
                      ? "Profile created."
                      : buildState === "active"
                        ? "Minting approval and provisioning the Hermes profile…"
                        : status === "done"
                          ? "Spec ready — approve to create the agent."
                          : "Refine the spec until it's ready, then build."}
                </PlanDescription>
              </div>
              <PlanTrigger />
            </PlanHeader>
            <PlanContent className="space-y-1.5">
              {buildSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-2 text-xs">
                  {step.state === "done" ? (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                  ) : step.state === "error" ? (
                    <X className="size-3.5 shrink-0 text-destructive" />
                  ) : step.state === "active" ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <div className="size-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
                  )}
                  <span
                    className={cn(
                      step.state === "pending" && "text-muted-foreground",
                      step.state === "error" && "text-destructive",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </PlanContent>
          </Plan>
          {/* Redacted; never shows secrets in plaintext. */}
          <pre className="max-h-[50vh] min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded bg-muted/30 p-3 font-mono text-[11px]">
            {Object.keys(spec).length === 0
              ? "(empty — waiting for the model)"
              : JSON.stringify(redactSpec(spec), null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Advisor — streaming buffer. */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={!hasAdvisor}
            title={
              hasAdvisor ? "View advisor feedback" : "Available after the model fires advisory text"
            }
          >
            <Sparkles className="size-3.5" /> Advisor
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> Advisor
            </DialogTitle>
          </DialogHeader>
          {/* Advisor buffer is AI-generated text → render as markdown. */}
          <div className="max-h-[60vh] min-h-[160px] overflow-auto rounded bg-muted/30 p-3">
            <Message from="assistant">
              <MessageContent>
                {advisorBuf ? (
                  <MessageResponse>{advisorBuf}</MessageResponse>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    (no advisory yet — fires after each user turn)
                  </span>
                )}
              </MessageContent>
            </Message>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skeptic — streaming buffer. */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={!hasSkeptic}
            title={
              hasSkeptic
                ? "View skeptic challenge"
                : "Available after the model fires challenge text"
            }
          >
            <Bot className="size-3.5" /> Skeptic
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-4" /> Skeptic
            </DialogTitle>
          </DialogHeader>
          {/* Skeptic buffer is AI-generated text → render as markdown. */}
          <div className="max-h-[60vh] min-h-[160px] overflow-auto rounded bg-muted/30 p-3">
            <Message from="assistant">
              <MessageContent>
                {skepticBuf ? (
                  <MessageResponse>{skepticBuf}</MessageResponse>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    (no challenge yet — fires after each user turn)
                  </span>
                )}
              </MessageContent>
            </Message>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live PTY — opens the always-mounted overlay (NOT a Dialog; see below). */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        disabled={ptyOutput.trim().length === 0}
        onClick={() => setPtyOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={ptyOpen}
        title={
          ptyOutput.trim().length > 0
            ? "Open the live root-bash PTY"
            : "Available once a turn produces PTY output"
        }
      >
        <TerminalIcon className="size-3.5" /> Live PTY
      </Button>
    </div>
  );

  // ── Live PTY overlay — the xterm host div is ALWAYS rendered so the
  // mount-once effect keeps its container; `ptyOpen` only toggles visibility
  // (display, not unmount). The "Connect WhatsApp in PTY" action lives here.
  const ptyOverlay = (
    <div
      role="dialog"
      aria-label="Live PTY (root bash)"
      aria-modal={ptyOpen}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        ptyOpen ? "" : "pointer-events-none invisible",
      )}
    >
      {/* Backdrop — click to close. Hidden (and inert) while the modal is shut. */}
      <div
        aria-hidden
        onClick={() => setPtyOpen(false)}
        className={cn(
          "absolute inset-0 bg-black/80 transition-opacity",
          ptyOpen ? "opacity-100" : "opacity-0",
        )}
      />
      <Card
        className={cn(
          "elev-sheet relative flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 p-4 transition-opacity",
          ptyOpen ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <TerminalIcon className="size-4" /> Live PTY (root bash)
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
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
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Close PTY"
              onClick={() => setPtyOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        {/* xterm host — never unmounts; only revealed/hidden with the overlay. */}
        <div
          ref={termContainerRef}
          className="h-[55vh] min-h-[260px] w-full overflow-hidden rounded bg-black p-1"
        />
      </Card>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <PageHeader
        icon={<Sparkles className="size-5" />}
        title="Agent Generator"
        description="Describe the agent you want. The interview builds a Hermes profile spec; approve to create."
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* ---------------------------------------------------------------- */}
        {/* Single-column interview — full-width Elements chat                */}
        {/* ---------------------------------------------------------------- */}
        <Card className="elev-1 flex min-h-0 min-w-0 flex-col overflow-hidden p-0">
          {/* Status / header strip: title + WS connection + thinking */}
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
                    <div key={i} className="flex flex-col items-end gap-1.5">
                      <Message from="user">
                        {m.content && (
                          <MessageContent>
                            <span className="whitespace-pre-wrap break-words">{m.content}</span>
                          </MessageContent>
                        )}
                      </Message>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {m.attachments.map((att, idx) => (
                            <AttachmentChip key={`${att.filename}-${idx}`} att={att} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Message key={i} from="assistant">
                      <MessageContent>
                        {/* Markdown reply via Streamdown (matches the chat page). */}
                        <MessageResponse>{m.content}</MessageResponse>
                      </MessageContent>
                      {/* Copy on every assistant turn; Retry only on the last. */}
                      {m.content && (
                        <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                          <MessageAction
                            tooltip="Copy"
                            label="Copy message"
                            onClick={() => copyMessage(i, m.content)}
                          >
                            {copiedIdx === i ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </MessageAction>
                          {i === lastAssistantIdx && (
                            <MessageAction
                              tooltip="Retry"
                              label="Retry last turn"
                              disabled={sendMut.isPending || wsTurnPending.current || !sessionId}
                              onClick={retryLastTurn}
                            >
                              <RefreshCw className="size-3.5" />
                            </MessageAction>
                          )}
                        </MessageActions>
                      )}
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

          {/* Build-tool toolbar — opens the spec/advisor/skeptic/PTY modals. */}
          {toolbar}

          {/* Composer */}
          <div
            data-testid="composer-wrapper"
            className="border-t bg-card/60 p-3"
            onDragOverCapture={(e) => {
              if (e.dataTransfer?.types?.includes("Files")) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDropCapture={(e) => {
              if (e.dataTransfer?.types?.includes("Files")) {
                e.preventDefault();
                e.stopPropagation();
              }
              onPickFiles(e.dataTransfer?.files ?? null);
            }}
          >
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
                      ? "Reply… (Enter to send, Shift+Enter for newline, paste/drop files)"
                      : model
                        ? "Loading session…"
                        : "Pick a model first…"
                  }
                  disabled={!sessionId || sendMut.isPending || wsTurnPending.current}
                  onPaste={(e) => {
                    const files = e.clipboardData?.files;
                    if (files && files.length > 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      onPickFiles(files);
                    }
                  }}
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
                    <ModelSelector open={modelOpen} onOpenChange={setModelOpen}>
                      <ModelSelectorTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-label="Model"
                          disabled={models.length === 0}
                          className="h-7 text-xs inline-flex items-center gap-1 max-w-[180px]"
                        >
                          {model ? (
                            <>
                              {providerFor(model) && (
                                <ModelSelectorLogo provider={providerFor(model)!} />
                              )}
                              <ModelSelectorName>{model}</ModelSelectorName>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {models.length === 0 ? "Loading…" : "Pick a model…"}
                            </span>
                          )}
                        </Button>
                      </ModelSelectorTrigger>
                      <ModelSelectorContent title="Pick a model" className="max-w-[420px]">
                        <ModelSelectorInput autoFocus placeholder="Search models…" />
                        <ModelSelectorList>
                          <ModelSelectorEmpty>No matching models</ModelSelectorEmpty>
                          {models.map((m) => (
                            <ModelSelectorItem
                              key={m}
                              value={m}
                              onSelect={() => {
                                setModel(m);
                                setModelOpen(false);
                              }}
                            >
                              {providerFor(m) && <ModelSelectorLogo provider={providerFor(m)!} />}
                              <ModelSelectorName>{m}</ModelSelectorName>
                            </ModelSelectorItem>
                          ))}
                        </ModelSelectorList>
                      </ModelSelectorContent>
                    </ModelSelector>

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

          {/* ------------------------------------------------------------ */}
          {/* Secrets panel — shown when spec declares required credentials */}
          {/* Values are never written into spec/messages/logs.             */}
          {/* ------------------------------------------------------------ */}
          {requiredKeys.length > 0 && (status === "draft" || status === "done") && (
            <div className="border-t bg-card/40 px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Required secrets</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Values are stored securely on the server and written to the profile at build time —
                never shown in chat.
              </p>
              <div className="space-y-2">
                {requiredKeys.map((key) => {
                  const isStaged = stagedKeys.includes(key);
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span
                        className="w-48 shrink-0 font-mono text-[11px] text-foreground truncate"
                        title={key}
                      >
                        {key}
                      </span>
                      <input
                        type="password"
                        autoComplete="off"
                        value={secretValues[key] ?? ""}
                        onChange={(e) => setSecretValues((m) => ({ ...m, [key]: e.target.value }))}
                        placeholder={isStaged ? "re-enter to update" : "enter value…"}
                        className="h-7 min-w-0 flex-1 rounded border bg-background px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs shrink-0"
                        disabled={!(secretValues[key] ?? "").trim() || setSecretMut.isPending}
                        onClick={() => setSecretMut.mutate({ key, value: secretValues[key] ?? "" })}
                      >
                        Save
                      </Button>
                      {isStaged ? (
                        <span className="flex items-center gap-1 shrink-0 text-[10px] text-emerald-500">
                          <Check className="size-3" /> stored
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 shrink-0 text-[10px] text-amber-500">
                          <span className="size-2 rounded-full bg-amber-500 inline-block" /> needed
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* Create agent — below the composer; approval+admin gated      */}
          {/* server-side. Secrets staged out-of-band before build.        */}
          {/* ------------------------------------------------------------ */}
          <div className="flex flex-wrap items-end gap-3 border-t bg-card/60 p-3">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!canBuild}
              onClick={() => buildMut.mutate()}
              title={
                canBuild
                  ? "Mint an approval token and build the Hermes profile."
                  : missingSecrets.length > 0
                    ? `Enter required secrets first: ${missingSecrets.join(", ")}`
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
              <p className="w-full text-[10px] text-destructive">
                Build failed — see the toast for details, then adjust the spec and retry.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Live PTY overlay — always rendered (xterm host never unmounts). */}
      {ptyOverlay}
    </div>
  );
}
