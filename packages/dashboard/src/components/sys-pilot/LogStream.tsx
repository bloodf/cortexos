"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogViewer } from "@/components/sys-pilot/LogViewer";

const SOURCES = ["systemd", "docker", "incus", "kernel", "auditd", "ollama", "caddy"];
const LEVELS = ["INFO", "INFO", "INFO", "INFO", "WARN", "DEBUG", "ERROR"] as const;
const MESSAGES = [
  "request handled in 4ms",
  "container heartbeat ok",
  "tls handshake complete",
  "scheduled flush 128KiB",
  "queue depth 3 → 2",
  "model inference q=512 tokens=128",
  "cgroup pressure cpu=12%",
  "config reloaded without restart",
  "health probe ok",
  "GET /api/status 200",
  "incus instance backup-runner exited 0",
  "auditd: USER_AUTH uid=1000 res=success",
  "kernel: br0: port 2 entered learning state",
];

function makeLine() {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const src = SOURCES[Math.floor(Math.random() * SOURCES.length)];
  const lvl = LEVELS[Math.floor(Math.random() * LEVELS.length)];
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  return `[${ts}] ${lvl.padEnd(5)} ${src.padEnd(8)} ${msg}`;
}

export function LogStream({ height = 480, intervalMs = 700, max = 400 }: { height?: number; intervalMs?: number; max?: number }) {
  const [lines, setLines] = useState<string[]>(() => Array.from({ length: 40 }, makeLine));
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => {
      setLines((prev) => {
        const next = [...prev, makeLine()];
        return next.length > max ? next.slice(next.length - max) : next;
      });
    }, intervalMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [paused, intervalMs, max]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground tabular-nums">
          {lines.length} lines · {paused ? "paused" : `streaming every ${intervalMs}ms`}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setPaused((p) => !p)}>
            {paused ? <><Play className="size-3.5 mr-1" />Resume</> : <><Pause className="size-3.5 mr-1" />Pause</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLines([])}>
            <Trash2 className="size-3.5 mr-1" />Clear
          </Button>
        </div>
      </div>
      <LogViewer lines={lines} height={height} />
    </div>
  );
}
