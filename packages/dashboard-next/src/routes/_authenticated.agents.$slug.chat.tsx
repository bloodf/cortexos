import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  api,
  callAgentChat,
  callSetAgentModel,
  callMintApproval,
  listModels,
} from "@/lib/api/client";
import { csrfHeaders } from "@/lib/csrf";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { bytes, relativeTime } from "@/lib/format";
import type { Agent, AgentRunState } from "@/mocks/types";

// ---------------------------------------------------------------------------
// Local types — mirror AgentChat.tsx (the legacy drawer) so the data flow and
// attachment limits stay identical; only the presentation moves to a full page.
// ---------------------------------------------------------------------------

interface PendingAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

/** One displayed turn. Assistant turns carry the per-turn metadata the API
 *  returned (model/reasoning used + usage + latency) so the footer is honest. */
interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: PendingAttachment[];
  at: string;
  // assistant-only
  model?: string;
  reasoning?: "low" | "medium" | "high";
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs?: number;
}

/** Maximum combined base64 bytes per message enforced by the profile API (P1.1). */
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;
const REASONING_OPTIONS = ["low", "medium", "high"] as const;

const STATE_DOT: Record<AgentRunState, string> = {
  running: "bg-[var(--success)]",
  idle: "bg-[var(--muted-foreground)]",
  stopped: "bg-muted-foreground/50",
  error: "bg-[var(--destructive)]",
};
const STATE_LABEL: Record<AgentRunState, string> = {
  running: "Online",
  idle: "Idle",
  stopped: "Stopped",
  error: "Error",
};

/** Estimate decoded bytes of an already-read base64 attachment. */
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

/** Copy-to-clipboard button with a transient check state. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-6 text-muted-foreground hover:text-foreground"
      aria-label="Copy reply"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => toast.error("Copy failed"));
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function ChatPage() {
  const { slug } = useParams({ from: "/_authenticated/agents/$slug/chat" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = !!user?.is_admin;

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [model, setModel] = useState<string>("");
  const [reasoning, setReasoning] = useState<(typeof REASONING_OPTIONS)[number]>("medium");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seededModel = useRef(false);

  // Load the agent the same way the Agents list does (queryKey ["agents"],
  // queryFn api.agents → Agent[]), then pick this slug. No separate single
  // agent endpoint exists, so we filter the registry+status merge.
  const {
    data: agents = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["agents"],
    queryFn: api.agents,
    refetchInterval: 15_000,
  });
  const agent: Agent | undefined = agents.find((a) => a.slug === slug);

  // Live model catalog for the composer's model dropdown + the header swap.
  const { data: modelsData } = useQuery({
    queryKey: ["agent-models"],
    queryFn: () => listModels({ data: {} }),
  });
  const models = modelsData?.models ?? [];

  // Seed the composer's model select with the agent's current model once it
  // loads — in render is unsafe under SSR, so guard with a ref + only-once.
  if (agent && !seededModel.current) {
    seededModel.current = true;
    if (agent.model) setModel(agent.model);
  }

  const chatMutation = useMutation({
    mutationFn: async (vars: { text: string; attachments: PendingAttachment[] }) => {
      return callAgentChat({
        data: {
          slug,
          text: vars.text,
          attachments: vars.attachments.length > 0 ? vars.attachments : undefined,
          model: model || undefined,
          reasoning,
        },
        headers: csrfHeaders(),
      });
    },
    onMutate: (vars) => {
      // Optimistically append the user turn so the conversation feels live.
      const userTurn: ChatTurn = {
        id: `u-${Date.now()}`,
        role: "user",
        content: vars.text,
        attachments: vars.attachments.length > 0 ? vars.attachments : undefined,
        at: new Date().toISOString(),
      };
      setTurns((t) => [...t, userTurn]);
      setPending([]);
    },
    onSuccess: (res) => {
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          at: new Date().toISOString(),
          model: model || agent?.model,
          reasoning,
          usage: res.usage,
          latencyMs: res.latencyMs,
        },
      ]);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Chat failed", { description: message });
    },
  });

  // Approval-gated model persist (header "Apply"). Mint a single-use token for
  // action `agents.model` with the COMPLETE payload, then dispatch with the
  // token + CSRF headers. PRESERVED verbatim from the legacy drawer.
  const modelMutation = useMutation({
    mutationFn: async () => {
      const mint = await callMintApproval({
        data: { action: "agents.model", payload: { slug, model, reasoning } },
      });
      return callSetAgentModel({
        data: { slug, model, reasoning },
        headers: {
          ...csrfHeaders(),
          "x-cortex-approval-token": mint.token,
        },
      });
    },
    onSuccess: () => {
      toast.success("Model updated", { description: `${slug} → ${model} (${reasoning})` });
      qc.invalidateQueries({ queryKey: ["agents"] }).catch(() => {});
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Model swap failed", { description: message });
    },
  });

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    if (pending.length + fileArr.length > MAX_ATTACHMENTS) {
      toast.error("Too many attachments", {
        description: `At most ${MAX_ATTACHMENTS} per message.`,
      });
      return;
    }
    let runningBytes = pending.reduce((sum, p) => sum + decodedBytes(p), 0);
    for (const file of fileArr) {
      if (runningBytes + file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} exceeds the combined limit`, {
          description: `Max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB total per message.`,
        });
        continue;
      }
      runningBytes += file.size;
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

  const status = chatMutation.isPending ? "submitted" : undefined;

  function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (!isAdmin) {
      toast.error("Admin only", { description: "You need admin role to chat with agents." });
      return;
    }
    if ((trimmed.length === 0 && pending.length === 0) || chatMutation.isPending) return;
    chatMutation.mutate({ text: trimmed, attachments: pending });
  }

  const canSwap = isAdmin && model.length > 0 && model !== agent?.model && !modelMutation.isPending;

  const pendingBytes = useMemo(
    () => pending.reduce((sum, p) => sum + decodedBytes(p), 0),
    [pending],
  );

  // -------------------------------------------------------------------------
  // Loading / error / not-found
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-7rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading agent…
      </div>
    );
  }
  if (isError || !agent) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/agents">
            <ArrowLeft className="mr-1 size-3.5" /> Agents
          </Link>
        </Button>
        <Card className="elev-1 grid place-items-center gap-2 p-12 text-center">
          <Bot className="size-8 text-muted-foreground" />
          <h2 className="font-semibold">{isError ? "Failed to load agents" : "Agent not found"}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isError
              ? "Could not read the Hermes profiles registry."
              : `No agent with slug “${slug}” is registered.`}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/agents">
          <ArrowLeft className="mr-1 size-3.5" /> Agents
        </Link>
      </Button>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_18rem]">
        {/* ---------------------------------------------------------------- */}
        {/* Main chat column                                                  */}
        {/* ---------------------------------------------------------------- */}
        <Card className="elev-1 flex min-h-0 min-w-0 flex-col overflow-hidden p-0">
          {/* Sticky agent status header */}
          <header className="flex flex-wrap items-center gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur">
            <div className="relative shrink-0">
              <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                <Bot className="size-5" />
              </div>
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-card",
                  STATE_DOT[agent.state],
                  agent.state === "running" && "animate-pulse motion-reduce:animate-none",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-semibold">{agent.name}</h1>
                <span className="font-mono text-[10px] text-muted-foreground">{agent.slug}</span>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full", STATE_DOT[agent.state])} />
                  {STATE_LABEL[agent.state]}
                </span>
                <span aria-hidden>·</span>
                <span className="truncate font-mono" title={agent.model}>
                  {agent.model}
                </span>
              </p>
            </div>

            {/* Approval-gated model persist (distinct from the per-turn pick in
                the composer). Reuses the model+effort currently in the composer. */}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 text-xs"
                disabled={!canSwap}
                onClick={() => modelMutation.mutate()}
                title="Persist this model + effort to the agent profile (approval-gated)"
              >
                {modelMutation.isPending ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-3.5" />
                )}
                Apply model
              </Button>
            )}
          </header>

          {/* Conversation (autoscrolls via use-stick-to-bottom) */}
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-6">
              {turns.length === 0 ? (
                <ConversationEmptyState
                  icon={<Bot className="size-8" />}
                  title={`Chat with ${agent.name}`}
                  description="Send a message to start the conversation. Markdown replies, attachments, and per-turn model selection are supported."
                />
              ) : (
                turns.map((turn) =>
                  turn.role === "user" ? (
                    <Message key={turn.id} from="user">
                      {turn.attachments && turn.attachments.length > 0 && (
                        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                          {turn.attachments.map((att, i) => (
                            <AttachmentChip key={`${att.filename}-${i}`} att={att} />
                          ))}
                        </div>
                      )}
                      {turn.content && (
                        <MessageContent>
                          <span className="whitespace-pre-wrap break-words">{turn.content}</span>
                        </MessageContent>
                      )}
                      <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                        <User className="size-3" />
                        <span>{relativeTime(turn.at)}</span>
                      </div>
                    </Message>
                  ) : (
                    <Message key={turn.id} from="assistant">
                      <MessageContent>
                        {/* Markdown reply via Streamdown */}
                        <MessageResponse>{turn.content}</MessageResponse>
                      </MessageContent>
                      {/* Per-turn metadata + copy + token/latency footer */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10px] text-muted-foreground">
                        <CopyButton text={turn.content} />
                        {turn.model && (
                          <span className="font-mono" title="Model used for this turn">
                            {turn.model}
                          </span>
                        )}
                        {turn.reasoning && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 text-[9px] font-normal capitalize"
                          >
                            {turn.reasoning}
                          </Badge>
                        )}
                        <span aria-hidden>·</span>
                        <span>{relativeTime(turn.at)}</span>
                        {typeof turn.latencyMs === "number" && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums" title="Round-trip latency">
                              {(turn.latencyMs / 1000).toFixed(turn.latencyMs >= 1000 ? 1 : 2)}s
                            </span>
                          </>
                        )}
                        {turn.usage && (
                          <>
                            <span aria-hidden>·</span>
                            <span
                              className="tabular-nums"
                              title={`prompt ${turn.usage.promptTokens} · completion ${turn.usage.completionTokens} · total ${turn.usage.totalTokens} tokens`}
                            >
                              {turn.usage.promptTokens}↑ {turn.usage.completionTokens}↓{" "}
                              {turn.usage.totalTokens} tok
                            </span>
                          </>
                        )}
                      </div>
                    </Message>
                  ),
                )
              )}
              {chatMutation.isPending && (
                <Message from="assistant">
                  <MessageContent>
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Thinking…
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
                  placeholder={
                    isAdmin
                      ? "Message… (Enter to send, Shift+Enter for newline)"
                      : "Admin role required to chat"
                  }
                  disabled={!isAdmin || chatMutation.isPending}
                />
                <PromptInputFooter>
                  <PromptInputTools>
                    <PromptInputButton
                      tooltip="Attach files"
                      aria-label="Attach files"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!isAdmin || chatMutation.isPending}
                    >
                      <Paperclip className="size-4" />
                    </PromptInputButton>

                    {/* Per-turn model pick (does NOT persist; the header Apply does) */}
                    <PromptInputSelect value={model} onValueChange={setModel}>
                      <PromptInputSelectTrigger
                        className="h-7 text-xs"
                        aria-label="Model for this message"
                      >
                        <PromptInputSelectValue placeholder="Model" />
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent>
                        {models.map((m) => (
                          <PromptInputSelectItem key={m} value={m} className="font-mono text-xs">
                            {m}
                          </PromptInputSelectItem>
                        ))}
                      </PromptInputSelectContent>
                    </PromptInputSelect>

                    {/* Reasoning effort */}
                    <PromptInputSelect
                      value={reasoning}
                      onValueChange={(v) => setReasoning(v as (typeof REASONING_OPTIONS)[number])}
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
                    status={status}
                    disabled={!isAdmin || chatMutation.isPending}
                    aria-label="Send message"
                  />
                </PromptInputFooter>
              </PromptInputBody>
            </PromptInput>
          </div>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Persona / info sidebar                                            */}
        {/* ---------------------------------------------------------------- */}
        <Card className="elev-1 hidden min-h-0 flex-col overflow-y-auto p-4 lg:flex">
          <div className="flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{agent.name}</h2>
              <span className="font-mono text-[10px] text-muted-foreground">{agent.slug}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1">
              <span className={cn("size-1.5 rounded-full", STATE_DOT[agent.state])} />
              {STATE_LABEL[agent.state]}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              v{agent.version}
            </Badge>
          </div>

          {agent.description && (
            <>
              <Separator className="my-3" />
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Persona
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">{agent.description}</p>
              </div>
            </>
          )}

          <Separator className="my-3" />
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Model</dt>
              <dd className="truncate font-mono" title={agent.model}>
                {agent.model}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="capitalize">{agent.modelProvider}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Effort (next turn)</dt>
              <dd className="capitalize">{reasoning}</dd>
            </div>
          </dl>

          <Separator className="my-3" />
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href={agent.hermesUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 size-3.5" /> Open Hermes UI
            </a>
          </Button>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/agents/$slug/chat")({
  component: ChatPage,
});
