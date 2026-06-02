"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderTree, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeBlock } from "@/components/sys-pilot/CodeBlock";
import { cn } from "@/lib/utils";

interface AgentFile {
  name: string;
  path: string;
}

interface FilesResponse {
  files: AgentFile[];
  agent: {
    slug: string;
    name: string;
    emoji?: string;
    model: string;
    project: string;
  };
}

interface FileContentResponse {
  content: string;
  filename: string;
}

function languageForFile(name: string): string {
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  return "text";
}

async function fetchFiles(slug: string): Promise<FilesResponse> {
  const res = await fetch(`/api/agents/${encodeURIComponent(slug)}/files`);
  if (!res.ok) throw new Error(`Failed to load files (${res.status})`);
  return res.json();
}

async function fetchFileContent(slug: string, filename: string): Promise<FileContentResponse> {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(slug)}/files/${encodeURIComponent(filename)}`,
  );
  if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
  return res.json();
}

export function AgentFileViewer({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["agent-files", agentId],
    queryFn: () => fetchFiles(agentId),
  });

  const files = useMemo(() => data?.files ?? [], [data]);
  const selected = activeFile ?? files[0]?.name ?? null;

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ["agent-file", agentId, selected],
    queryFn: () => fetchFileContent(agentId, selected as string),
    enabled: Boolean(selected),
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(false);
    setDraft(fileData?.content ?? "");
  }, [fileData?.content, selected]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No file selected");
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(selected)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to save (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Saved ${selected}`);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["agent-file", agentId, selected] });
      queryClient.invalidateQueries({ queryKey: ["agent-files", agentId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save file");
    },
  });

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr] min-h-[60vh]">
      <Card className="elev-1 p-2 space-y-0.5">
        <div className="flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          <FolderTree className="size-3" />
          Files
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </div>
        )}
        {!isLoading && files.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted-foreground">No files found.</p>
        )}
        {files.map((f) => (
          <button
            type="button"
            key={f.path}
            onClick={() => setActiveFile(f.name)}
            className={cn(
              "w-full text-left rounded px-2 py-1.5 text-sm flex items-center gap-2 hover:bg-muted/40 font-mono",
              selected === f.name && "bg-accent text-accent-foreground",
            )}
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="truncate">{f.name}</span>
          </button>
        ))}
      </Card>

      <Card className="elev-1 p-0 overflow-hidden flex flex-col">
        {selected && (
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="font-mono text-xs text-muted-foreground truncate">{selected}</span>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setDraft(fileData?.content ?? "");
                    }}
                    disabled={saveMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={fileLoading}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {fileLoading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading file…
            </div>
          )}
          {!fileLoading && selected && editing && (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-full min-h-[50vh] resize-none rounded-none border-0 font-mono text-xs"
              spellCheck={false}
            />
          )}
          {!fileLoading && selected && !editing && (
            <CodeBlock
              language={languageForFile(selected)}
              code={fileData?.content ?? ""}
              className="border-0 rounded-none h-full"
            />
          )}
          {!fileLoading && !selected && (
            <p className="p-4 text-sm text-muted-foreground">Select a file to view its contents.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
