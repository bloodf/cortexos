"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCode, Eye, EyeOff, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Backend shape (see src/app/api/env-browser/route.ts):
//   GET /api/env-browser?path=<abs>  ->  { path, lines: EnvLine[] }
//   where EnvLine = { line, raw, type: "kv"|"comment"|"blank",
//                     key?, value?, exported?, masked? }
// Reveal (cleartext) and POST writes require an X-Cortex-Confirmation-Token
// that has no UI-accessible mint endpoint, so those remain gated/blocked.
// ---------------------------------------------------------------------------

interface EnvLine {
  line: number;
  raw: string;
  type: "kv" | "comment" | "blank";
  key?: string;
  value?: string;
  exported?: boolean;
  masked?: string;
}

interface EnvFileResponse {
  path: string;
  lines: EnvLine[];
}

const DEFAULT_PATH = "/opt/cortexos/.secrets/9router.env";

async function fetchEnvFile(path: string): Promise<EnvFileResponse> {
  const res = await fetch(`/api/env-browser?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load ${path} (${res.status})`);
  }
  return (await res.json()) as EnvFileResponse;
}

export default function AdminEnvPage() {
  const [path, setPath] = useState(DEFAULT_PATH);
  const [query, setQuery] = useState(DEFAULT_PATH);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["env-browser", query],
    queryFn: () => fetchEnvFile(query),
    enabled: query.length > 0,
    retry: false,
  });

  // Only kv lines have keys/values to surface in the UI.
  const kvLines = useMemo(
    () => (data?.lines ?? []).filter((l): l is EnvLine & { key: string } => l.type === "kv" && !!l.key),
    [data],
  );

  // Sidebar lists the env file(s) currently loaded (no enumeration endpoint exists).
  const files = data ? [{ path: data.path, keys: kvLines.map((l) => l.key) }] : [];

  async function copyValue(key: string, displayed: string) {
    try {
      await navigator.clipboard.writeText(displayed);
      toast.success(`Copied ${key}`);
    } catch {
      toast.error(`Could not copy ${key}`);
    }
  }

  function onReveal(key: string) {
    // Cleartext reveal requires a confirmation-token handshake the dashboard UI
    // cannot mint on its own. Toggle to show whatever the backend returned
    // (masked secrets stay masked) and explain when nothing more is available.
    setReveal((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Env Browser" description="Inspect environment secrets for managed services." />

      <Card className="p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(path.trim());
          }}
        >
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/opt/cortexos/.secrets/<file>.env"
            className="h-8 font-mono text-xs"
          />
          <Button type="submit" size="sm" disabled={!path.trim()}>
            Load
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <Card className="p-2 h-fit">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-2">Env files</div>
          {files.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No file loaded</div>
          ) : (
            files.map((f) => (
              <div
                key={f.path}
                className="w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 text-sm bg-accent text-accent-foreground"
              >
                <FileCode className="size-3.5 shrink-0" />
                <span className="truncate font-mono text-xs">{f.path.split("/").pop()}</span>
              </div>
            ))
          )}
        </Card>

        <Card className="p-4">
          {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {isError && (
            <div className="text-xs text-destructive">{error instanceof Error ? error.message : "Failed to load env file"}</div>
          )}
          {data && !isLoading && (
            <>
              <div className="flex items-center justify-between mb-3">
                <code className="text-xs text-muted-foreground">{data.path}</code>
                <span className="text-xs text-muted-foreground">{kvLines.length} keys</span>
              </div>
              <div className="space-y-2">
                {kvLines.map((l) => {
                  const k = l.key;
                  // masked present => secret key; show dots unless revealed (and a
                  // cleartext value is actually available, which it is not via masked read).
                  const isSecret = typeof l.masked === "string";
                  const cleartext = l.value ?? "";
                  const shown = reveal[k]
                    ? isSecret
                      ? "(reveal requires confirmation)"
                      : cleartext
                    : isSecret
                      ? l.masked || "••••••••"
                      : cleartext;
                  return (
                    <div key={k} className="grid grid-cols-[200px_1fr_auto] gap-2 items-center">
                      <code className="text-xs font-semibold">{k}</code>
                      <Input value={shown} readOnly className="h-8 font-mono text-xs" />
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onReveal(k)}>
                          {reveal[k] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copyValue(k, shown)}>
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {kvLines.length === 0 && <div className="text-xs text-muted-foreground">No keys in this file.</div>}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
