import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callAgentChat, callSetAgentModel, callMintApproval, listModels } from "@/lib/api/client";
import { csrfHeaders } from "@/lib/csrf";
import { cn } from "@/lib/utils";
import type { Agent } from "@/mocks/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PendingAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

/** Maximum base64 bytes per attachment enforced by the profile API (P1.1). */
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const REASONING_OPTIONS = ["low", "medium", "high"] as const;

/**
 * Agent chat drawer (P1.5). A right-side sheet that lets an admin:
 *   - send text + image/audio/video/file attachments to the agent
 *   - swap the agent's model + reasoning (approval-gated)
 *
 * Attachments are read with FileReader (readAsDataURL → split the `;base64,`
 * prefix to get canonical base64) and capped at MAX_ATTACHMENT_BYTES client
 * side; the profile API re-validates.
 */
export function AgentChat({
  agent,
  open,
  onOpenChange,
}: {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [model, setModel] = useState<string>("");
  const [reasoning, setReasoning] = useState<(typeof REASONING_OPTIONS)[number]>("medium");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slug = agent?.slug ?? "";

  const { data: modelsData } = useQuery({
    queryKey: ["agent-models"],
    queryFn: () => listModels({ data: {} }),
    enabled: open,
  });
  const models = modelsData?.models ?? [];

  // Seed the model select with the agent's current model when opened.
  // In an effect (not the render body) so it never sets state during render —
  // which is unsafe under SSR and triggers React's update-during-render warning.
  const lastSeedSlug = useRef<string>("");
  useEffect(() => {
    if (open && slug && slug !== lastSeedSlug.current) {
      lastSeedSlug.current = slug;
      if (!model && agent?.model) setModel(agent.model);
    }
  }, [open, slug, agent?.model, model]);

  const chatMutation = useMutation({
    mutationFn: async () => {
      return callAgentChat({
        data: {
          slug,
          text,
          attachments: pending.length > 0 ? pending : undefined,
          model: model || undefined,
          reasoning,
        },
        headers: csrfHeaders(),
      });
    },
    onSuccess: (res) => {
      setMessages((m) => [
        ...m,
        { role: "user", content: text },
        { role: "assistant", content: res.reply },
      ]);
      setText("");
      setPending([]);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Chat failed", { description: message });
    },
  });

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
      toast.success("Model updated", {
        description: `${slug} → ${model} (${reasoning})`,
      });
      qc.invalidateQueries({ queryKey: ["agents"] }).catch(() => {});
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Model swap failed", { description: message });
    },
  });

  /** Estimate decoded bytes of an already-read base64 attachment. */
  function decodedBytes(att: PendingAttachment): number {
    const len = att.dataBase64.length;
    const pad = att.dataBase64.endsWith("==") ? 2 : att.dataBase64.endsWith("=") ? 1 : 0;
    return Math.floor((len * 3) / 4) - pad;
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    if (pending.length + fileArr.length > 8) {
      toast.error("Too many attachments", { description: "At most 8 per message." });
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
          ].slice(0, 8),
        );
      };
      reader.readAsDataURL(file);
    }
  }

  const canSend =
    !!slug && (text.trim().length > 0 || pending.length > 0) && !chatMutation.isPending;
  const canSwap = !!slug && model.length > 0 && !modelMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-4 p-4">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="size-4" />
            <span className="truncate">Chat · {agent?.name ?? slug}</span>
          </SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs font-mono">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={reasoning}
              onValueChange={(v) => setReasoning(v as (typeof REASONING_OPTIONS)[number])}
            >
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
              variant="outline"
              className="h-8 text-xs"
              disabled={!canSwap || model === agent?.model}
              onClick={() => modelMutation.mutate()}
            >
              {modelMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/20 p-3 space-y-3">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Send a message to start chatting with {agent?.name ?? "the agent"}.
            </p>
          ) : (
            messages.map((m, i) => (
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
            ))
          )}
          {chatMutation.isPending && (
            <div className="mr-auto max-w-[85%] rounded-lg px-3 py-2 text-sm bg-background border">
              <Loader2 className="size-3.5 animate-spin inline mr-1" /> thinking…
            </div>
          )}
        </div>

        {pending.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pending.map((p, i) => (
              <span
                key={`${p.filename}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px]"
              >
                <Paperclip className="size-3" />
                <span className="max-w-[120px] truncate">{p.filename}</span>
                <button
                  type="button"
                  onClick={() => setPending((arr) => arr.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-foreground"
                >
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
            accept="image/*,audio/*,video/*,*"
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            title="Attach files"
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
                if (canSend) chatMutation.mutate();
              }
            }}
            placeholder="Message…  (Enter to send, Shift+Enter for newline)"
            className="min-h-[36px] max-h-40 resize-none text-sm"
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!canSend}
            onClick={() => chatMutation.mutate()}
          >
            {chatMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
