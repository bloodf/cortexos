import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Paperclip, Send, Sparkles, Terminal as TerminalIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton } from "@/components/skeletons";
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
}

interface PendingAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function decodedBytes(att: PendingAttachment): number {
  const len = att.dataBase64.length;
  const pad = att.dataBase64.endsWith("==") ? 2 : att.dataBase64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - pad;
}

/**
 * Agent Generator (P2.5) — admin-only page.
 *
 * 1. Pick a model → auto-create a generator session.
 * 2. Chat with the AI; the model interviews and refines the spec.
 * 3. When the model emits a complete spec (status=done), the "Create agent"
 *    button enables, mints an approval token, and builds the profile.
 * 4. On success → navigate to the new agent's chat page.
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
      // Sidecar converts images to multimodal parts and emits a text
      // manifest for the advisor/skeptic panels. RPC fallback only runs
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
      setMessages((m) => [...m, { role: "user", content: text }]);
      if (res.via === "ws") {
        // Empty assistant bubble; the WS `chat` frames will append into it.
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
      // Mint must hash the COMPLETE request body (pipeline hashes action+input).
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
    if (pending.length + fileArr.length > 8) {
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
          ].slice(0, 8),
        );
      };
      reader.readAsDataURL(file);
    }
  }

  // Auto-create a session once a model is chosen.
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
          // Cap PTY buffer to avoid unbounded growth (WhatsApp QR can be long).
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

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Sparkles className="size-5" />}
        title="Agent Generator"
        description="Describe the agent you want. The interview builds a Hermes profile spec; approve and create."
      />

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card className="elev-1 p-4 flex flex-col gap-3 min-h-[520px]">
          <div className="flex items-center gap-2">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Pick a model to start…" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs font-mono">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Effort applies to reasoning models; 9router ignores it for
                others, so it's always selectable. */}
            <Select value={reasoning} onValueChange={(v) => setReasoning(v as Reasoning)}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONING_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!canBuild}
              onClick={() => buildMut.mutate()}
            >
              {buildMut.isPending ? <Loader2 className="size-3 animate-spin" /> : "Create agent"}
            </Button>
            <Badge
              variant={
                wsState === "live"
                  ? "default"
                  : wsState === "unavailable"
                    ? "destructive"
                    : "secondary"
              }
              className="h-7 text-[10px] uppercase tracking-wide"
              title={
                wsState === "unavailable" ? "Sidecar unreachable; using P2 RPC fallback" : undefined
              }
            >
              WS {wsState}
            </Badge>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/20 p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                {model ? "Loading session…" : "Pick a model to start the interview."}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-background border",
                )}
              >
                {m.content}
              </div>
            ))}
            {(thinking || sendMut.isPending) && (
              <div className="mr-auto text-sm">
                <Loader2 className="size-3.5 animate-spin inline mr-1" /> thinking…
              </div>
            )}
          </div>

          {presets && messages.length <= 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground mr-0.5">Start from:</span>
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
                  className="rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] hover:bg-muted transition-colors"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pending.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px]"
                >
                  <Paperclip className="size-3" /> {p.filename}
                  <button onClick={() => setPending((a) => a.filter((_, idx) => idx !== i))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,audio/*,video/*,*"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) sendMut.mutate();
                }
              }}
              placeholder={sessionId ? "Reply…" : "Pick a model first…"}
              className="min-h-[36px] max-h-40 resize-none text-sm"
              rows={1}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!canSend}
              onClick={() => sendMut.mutate()}
            >
              {sendMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </Card>

        <Card className="elev-1 p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <Bot className="size-3.5" /> Live spec
          </div>
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-all bg-muted/30 rounded p-2 min-h-[200px] max-h-[420px] overflow-y-auto">
            {Object.keys(spec).length === 0
              ? "(empty — waiting for the model)"
              : JSON.stringify(redactSpec(spec), null, 2)}
          </pre>
        </Card>
      </div>

      {/* P3.4b Channels row — Telegram token is sent once with the build
          payload; WhatsApp runs `hermes-<slug> whatsapp setup` in the live PTY
          pane. WhatsApp needs the binary built, so the honest UX is to gate
          on the WS being live AND a slug being settled; the actual install
          requires the agent to be built first (after which the operator can
          SSH/run from the terminal page). */}
      <Card className="elev-1 p-3 flex flex-col gap-2">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <Sparkles className="size-3.5" /> Channels
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr,auto] items-end">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Telegram bot token (optional, used at build time)
            </label>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="123456:ABCDEF…"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            variant="outline"
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
            Connect WhatsApp in PTY
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="elev-1 p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Advisor
          </div>
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-2 min-h-[120px] max-h-[280px] overflow-y-auto">
            {advisorBuf || "(no advisory yet — fires after each user turn)"}
          </pre>
        </Card>
        <Card className="elev-1 p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <Bot className="size-3.5" /> Skeptic
          </div>
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-2 min-h-[120px] max-h-[280px] overflow-y-auto">
            {skepticBuf || "(no challenge yet — fires after each user turn)"}
          </pre>
        </Card>
        <Card className="elev-1 p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <TerminalIcon className="size-3.5" /> Live PTY (root bash)
          </div>
          <div
            ref={termContainerRef}
            className="h-[280px] min-h-[180px] overflow-hidden rounded bg-black p-1"
          />
        </Card>
      </div>

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
                <div className="font-semibold truncate">{a.name}</div>
                <div className="text-muted-foreground font-mono truncate">{a.slug}</div>
                <div className="text-muted-foreground truncate mt-0.5">{a.model}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
