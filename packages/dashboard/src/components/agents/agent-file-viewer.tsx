"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";

interface FileInfo {
  name: string;
  path: string;
}

interface Props {
  slug: string;
  files: FileInfo[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AgentFileViewer({ slug, files }: Props) {
  const [activeFile, setActiveFile] = useState(files[0]?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const apiUrl = activeFile
    ? `/api/agents/${slug}/files/${activeFile}`
    : null;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

  const startEdit = useCallback(() => {
    setDraft(data?.content ?? "");
    setEditing(true);
    setSaveError(null);
  }, [data?.content]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft("");
    setSaveError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!apiUrl) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }

      setEditing(false);
      await mutate(apiUrl);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [apiUrl, draft]);

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No .md files found for this agent.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* File tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {files.map((f) => (
          <button
            key={f.name}
            type="button"
            onClick={() => {
              setActiveFile(f.name);
              setEditing(false);
              setSaveError(null);
            }}
            className={`px-3 py-1.5 text-sm font-mono rounded-lg shrink-0 transition-colors ${
              activeFile === f.name
                ? "bg-secondary text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/20">
          <span className="text-xs font-mono text-muted-foreground">
            {activeFile}
          </span>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                disabled={isLoading || !!error}
                className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {saveError}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {isLoading && (
            <div className="text-sm text-muted-foreground animate-pulse">
              Loading…
            </div>
          )}

          {error && !isLoading && (
            <div className="text-sm text-destructive">
              Failed to load file content.
            </div>
          )}

          {!isLoading && !error && data && (
            <>
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full min-h-[400px] bg-transparent text-sm font-mono text-foreground/90 resize-y focus:outline-none"
                  spellCheck={false}
                />
              ) : (
                <pre className="text-sm font-mono text-foreground/90 whitespace-pre-wrap break-words">
                  <code>{data.content}</code>
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
