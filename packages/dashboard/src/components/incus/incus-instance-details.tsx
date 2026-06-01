"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/skeleton";

interface IncusDetailData {
  data?: {
    name?: string;
    status?: string;
    state?: {
      cpu?: Record<string, unknown>;
      memory?: {
        usage?: number;
        total?: number;
        swap_usage?: number;
      };
      disk?: Record<string, { usage?: number }>;
      processes?: number;
      network?: Record<
        string,
        {
          addresses?: Array<{ family: string; address: string; netmask?: string }>;
          counters?: { bytes_received?: number; bytes_sent?: number };
        }
      >;
    };
    profiles?: string[];
    snapshots?: Array<{ name: string; created_at?: string }>;
    created_at?: string;
  };
  error?: string;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function IncusInstanceDetails({
  name,
  status,
  onClose,
}: {
  name: string;
  status?: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<IncusDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const [execOutput, setExecOutput] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [execRunning, setExecRunning] = useState(false);

  const isRunning = (status ?? info?.data?.status ?? "").toLowerCase() === "running";

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd || execRunning) return;
    setExecRunning(true);
    setExecError(null);
    setExecOutput(null);
    try {
      const res = await fetch(`/api/incus/${encodeURIComponent(name)}/shell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const json = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        error?: string;
      };
      if (!res.ok) {
        setExecError(json.error || `HTTP ${res.status}`);
      } else {
        const out = [json.stdout, json.stderr].filter(Boolean).join("\n");
        setExecOutput(out.length > 0 ? out : "(no output)");
      }
    } catch (err) {
      setExecError(err instanceof Error ? err.message : "Network error");
    } finally {
      setExecRunning(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/incus/${encodeURIComponent(name)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as IncusDetailData;
        if (mounted) {
          setInfo(json);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setInfo({ error: e instanceof Error ? e.message : "Failed to fetch" });
          setLoading(false);
        }
      }
    };
    fetchInfo();
    return () => {
      mounted = false;
    };
  }, [name]);

  const d = info?.data;
  const state = d?.state;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{name} Details</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonTable rows={3} cols={2} />
        ) : info?.error ? (
          <div className="text-sm text-destructive">{info.error}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                <p className="text-sm text-foreground">{d?.status || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Processes</p>
                <p className="text-sm text-foreground">{state?.processes ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Memory</p>
                <p className="text-sm text-foreground">
                  {formatBytes(state?.memory?.usage)} / {formatBytes(state?.memory?.total)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Created</p>
                <p className="text-sm text-foreground">{d?.created_at ? new Date(d.created_at).toLocaleString() : "—"}</p>
              </div>
            </div>

            {state?.network && Object.keys(state.network).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Network</p>
                <div className="space-y-1">
                  {Object.entries(state.network).map(([iface, net]) => (
                    <div key={iface} className="text-sm text-foreground">
                      <span className="font-mono text-xs">{iface}:</span>{" "}
                      {net.addresses
                        ?.filter((a) => a.family === "inet")
                        .map((a) => `${a.address}/${a.netmask || ""}`)
                        .join(", ") || "—"}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(d?.profiles) && d.profiles.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profiles</p>
                <div className="flex flex-wrap gap-2">
                  {d.profiles.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(d?.snapshots) && d.snapshots.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Snapshots</p>
                <div className="space-y-1">
                  {d.snapshots.map((s) => (
                    <div key={s.name} className="text-sm text-foreground flex justify-between">
                      <span className="font-mono text-xs">{s.name}</span>
                      <span className="text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Console
              </p>
              {isRunning ? (
                <form onSubmit={runCommand} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="e.g. uname -a"
                      className="font-mono text-xs"
                    />
                    <Button type="submit" size="sm" disabled={execRunning || command.trim().length === 0}>
                      {execRunning ? "Running…" : "Run"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Runs <span className="font-mono">incus exec {name} -- sh -c &lt;command&gt;</span> via the
                    audited root helper.
                  </p>
                  {execError && <p className="text-xs text-destructive">{execError}</p>}
                  {execOutput !== null && (
                    <pre className="max-h-64 overflow-auto rounded-md bg-secondary p-3 font-mono text-xs whitespace-pre-wrap text-foreground">
                      {execOutput}
                    </pre>
                  )}
                </form>
              ) : (
                <p className="text-xs text-muted-foreground">Instance must be running to execute commands.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
