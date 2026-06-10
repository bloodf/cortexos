import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TermIcon, Lock, Plus, X, Send, Radio, Play, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUI } from "@/hooks/useUI";
import { cn } from "@/lib/utils";
import { listTerminalOps, dispatchTerminalOp } from "@/lib/api/client";

const PROMPT = (user: string) => `\x1b[32m${user}@cortex\x1b[0m:\x1b[34m~\x1b[0m$ `;

// Live PTY sidecar (WP-19). Same-origin WebSocket; Caddy proxies
// `/terminal/ws` → 127.0.0.1:3081. Built relative to the current page so it
// works on any host (Tailscale, localhost, etc.).
function terminalWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/terminal/ws`;
}

type LiveState = "connecting" | "live" | "mock" | "closed";

const BANNER = [
  "\x1b[1;36mCortexOS shell\x1b[0m · \x1b[33mlocal mock\x1b[0m (live PTY unavailable — sidecar not reachable)",
  "Interactive shell is a local mock. Use \x1b[36mNamed Operations\x1b[0m below for real server commands.",
  "Type \x1b[33mhelp\x1b[0m for mock commands. Use \x1b[33mclear\x1b[0m to wipe the screen.",
  "",
];

const HELP = [
  "Available commands:",
  "  \x1b[33mhelp\x1b[0m                — this message",
  "  \x1b[33mwhoami\x1b[0m              — current user",
  "  \x1b[33muname -a\x1b[0m            — host info",
  "  \x1b[33muptime\x1b[0m              — system uptime",
  "  \x1b[33mfree -h\x1b[0m             — memory usage",
  "  \x1b[33mdf -h\x1b[0m               — disk usage",
  "  \x1b[33msystemctl status\x1b[0m    — list managed units",
  "  \x1b[33mjournalctl -u <unit>\x1b[0m — recent logs",
  "  \x1b[33mdocker ps\x1b[0m           — running containers",
  "  \x1b[33mincus list\x1b[0m          — incus instances",
  "  \x1b[33mtmux\x1b[0m                — list tmux sessions",
  "  \x1b[33mclear\x1b[0m               — clear screen",
  "  \x1b[33mexit\x1b[0m                — close session",
];

function run(cmd: string, user: string): string[] {
  const c = cmd.trim();
  if (!c) return [];
  if (c === "help") return HELP;
  if (c === "whoami") return [user];
  if (c === "uname -a") return ["Linux cortex 6.8.0-cortex #1 SMP x86_64 GNU/Linux"];
  if (c === "uptime") return [` ${new Date().toTimeString().slice(0, 5)} up 14 days,  3:42,  2 users,  load average: 0.42, 0.51, 0.49`];
  if (c === "free -h") return [
    "              total        used        free      shared",
    "Mem:           62Gi        24Gi        20Gi       1.2Gi",
    "Swap:         8.0Gi          0B       8.0Gi",
  ];
  if (c === "df -h") return [
    "Filesystem      Size  Used Avail Use% Mounted on",
    "/dev/nvme0n1p2  1.8T  720G  1.1T  40% /",
    "/dev/nvme1n1    3.6T  1.2T  2.4T  34% /var/lib/incus",
    "tmpfs            32G  124M   32G   1% /tmp",
  ];
  if (c === "systemctl status") return [
    "\x1b[32m●\x1b[0m caddy.service     – active (running)",
    "\x1b[32m●\x1b[0m docker.service    – active (running)",
    "\x1b[32m●\x1b[0m incus.service     – active (running)",
    "\x1b[32m●\x1b[0m postgresql        – active (running)",
    "\x1b[31m●\x1b[0m mysql.service     – \x1b[31mfailed\x1b[0m",
  ];
  if (c.startsWith("journalctl -u ")) {
    const unit = c.slice(14);
    return Array.from({ length: 8 }, (_, i) =>
      `${new Date(Date.now() - i * 2000).toISOString().slice(11, 19)} cortex ${unit}: handled request in ${(8 + Math.random() * 40).toFixed(1)}ms`
    );
  }
  if (c === "docker ps") return [
    "CONTAINER ID  IMAGE                STATUS         PORTS              NAMES",
    "a1b2c3d4e5f6  ollama/ollama:latest Up 4 days      11434->11434/tcp   ollama",
    "b2c3d4e5f6a1  grafana/grafana      Up 4 days      3000->3000/tcp     grafana",
    "c3d4e5f6a1b2  redis:7              Up 4 days      6379->6379/tcp     redis",
  ];
  if (c === "incus list") return [
    "+----------+---------+------------------+-----------+",
    "|   NAME   |  STATE  |      IPv4        |   TYPE    |",
    "+----------+---------+------------------+-----------+",
    "| dev-vm   | RUNNING | 10.42.0.12       | VIRTUAL   |",
    "| build-c  | RUNNING | 10.42.0.13       | CONTAINER |",
    "| pg-snap  | STOPPED | -                | CONTAINER |",
    "+----------+---------+------------------+-----------+",
  ];
  if (c === "tmux" || c === "tmux ls") return [
    "cortex: 3 windows (created Mon May 27 09:00:12 2026)",
    "deploy: 1 windows (created Mon May 27 12:14:08 2026)",
  ];
  if (c.startsWith("tmux send-keys")) {
    return [`\x1b[36m[tmux]\x1b[0m dispatched: ${c.slice(15)}`];
  }
  if (c === "ls" || c === "ls -la") return [
    "drwxr-xr-x  4 admin admin 4096 May 30 09:12 .",
    "drwxr-xr-x  3 root  root  4096 May 28 12:00 ..",
    "-rw-r--r--  1 admin admin  220 May 28 12:00 .bashrc",
    "drwxr-xr-x  2 admin admin 4096 May 30 09:00 projects",
    "drwxr-xr-x  2 admin admin 4096 May 30 09:00 .ssh",
  ];
  if (c === "exit") return ["\x1b[33msession closed.\x1b[0m"];
  return [`\x1b[31mmock: command not found:\x1b[0m ${c}`];
}

export interface TabHandle {
  execute: (cmd: string) => void;
  focus: () => void;
}

interface TerminalTabProps {
  id: string;
  active: boolean;
  username: string;
  dark: boolean;
  onReady: (id: string, handle: TabHandle) => void;
  onState?: (id: string, state: LiveState) => void;
}

function TerminalTab({ id, active, username, dark, onReady, onState }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef({ buffer: "", history: [] as string[], hIdx: -1 });

  // Mount xterm once per tab
  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      theme: dark
        ? { background: "#0b0f17", foreground: "#e6edf3", cursor: "#7c3aed" }
        : { background: "#fafafa", foreground: "#1a1a1a", cursor: "#7c3aed" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try { fit.fit(); } catch { /* noop */ }
    termRef.current = term;
    fitRef.current = fit;

    // ---- live-shell disposers (set only in live mode) ----
    let mockKeyDisposable: { dispose: () => void } | null = null;
    let liveDataDisposable: { dispose: () => void } | null = null;
    let ws: WebSocket | null = null;
    let disposed = false;

    const setState = (s: LiveState) => { if (!disposed) onState?.(id, s); };

    // Push xterm dimensions to the PTY so it matches the visible viewport.
    const sendResize = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        } catch { /* socket gone */ }
      }
    };

    // ---- mock command handler (fallback) ----
    const submit = (line: string) => {
      const s = stateRef.current;
      if (line.trim()) s.history.unshift(line);
      s.hIdx = -1;
      if (line.trim() === "clear") {
        term.clear();
      } else {
        run(line, username).forEach((l) => term.writeln(l));
      }
      s.buffer = "";
      term.write(PROMPT(username));
    };

    // Attach the local mock key handler + banner. Used when the live PTY
    // sidecar is unreachable so the page degrades gracefully.
    const attachMock = () => {
      setState("mock");
      BANNER.forEach((l) => term.writeln(l));
      term.write(PROMPT(username));
      mockKeyDisposable = term.onKey(({ key, domEvent }) => {
        const ev = domEvent;
        const s = stateRef.current;
        if (ev.key === "Enter") {
          term.write("\r\n");
          submit(s.buffer);
        } else if (ev.key === "Backspace") {
          if (s.buffer.length > 0) { s.buffer = s.buffer.slice(0, -1); term.write("\b \b"); }
        } else if (ev.key === "ArrowUp") {
          if (s.hIdx + 1 < s.history.length) {
            s.hIdx++;
            term.write("\r" + PROMPT(username) + " ".repeat(s.buffer.length) + "\r" + PROMPT(username));
            s.buffer = s.history[s.hIdx];
            term.write(s.buffer);
          }
        } else if (ev.key === "ArrowDown") {
          if (s.hIdx > 0) {
            s.hIdx--;
            term.write("\r" + PROMPT(username) + " ".repeat(s.buffer.length) + "\r" + PROMPT(username));
            s.buffer = s.history[s.hIdx];
            term.write(s.buffer);
          } else if (s.hIdx === 0) {
            s.hIdx = -1;
            term.write("\r" + PROMPT(username) + " ".repeat(s.buffer.length) + "\r" + PROMPT(username));
            s.buffer = "";
          }
        } else if (ev.ctrlKey && ev.key === "c") {
          term.write("^C\r\n" + PROMPT(username));
          s.buffer = "";
        } else if (ev.ctrlKey && ev.key === "l") {
          term.clear();
          term.write(PROMPT(username) + s.buffer);
        } else if (key.length === 1 && key.charCodeAt(0) >= 32) {
          s.buffer += key;
          term.write(key);
        }
      });
    };

    // ---- live PTY (WP-19): bind xterm I/O straight to the sidecar WS ----
    const connectLive = () => {
      setState("connecting");
      try {
        ws = new WebSocket(terminalWsUrl());
      } catch {
        attachMock();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) { ws?.close(); return; }
        setState("live");
        try { fit.fit(); } catch { /* noop */ }
        sendResize();
        // Raw keystrokes → PTY (xterm onData yields the encoded bytes).
        liveDataDisposable = term.onData((data) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: "input", data })); } catch { /* gone */ }
          }
        });
        term.focus();
      };

      // Sidecar sends raw pty bytes as text frames, plus a JSON {type:'exit'}.
      ws.onmessage = (ev) => {
        const data = typeof ev.data === "string" ? ev.data : "";
        if (data.startsWith("{") && data.includes('"type"')) {
          try {
            const msg = JSON.parse(data);
            if (msg && msg.type === "exit") {
              term.writeln(`\r\n\x1b[33m[process exited${typeof msg.code === "number" ? ` with code ${msg.code}` : ""}]\x1b[0m`);
              return;
            }
          } catch { /* not control — fall through and print */ }
        }
        term.write(data);
      };

      ws.onclose = (ev) => {
        liveDataDisposable?.dispose();
        liveDataDisposable = null;
        if (disposed) return;
        wsRef.current = null;
        // 4401/4403 are auth rejections — never fall back to mock for those.
        if (ev.code === 4401) {
          setState("closed");
          term.writeln("\r\n\x1b[31m[session expired — reload to re-authenticate]\x1b[0m");
        } else if (ev.code === 4403) {
          setState("closed");
          term.writeln("\r\n\x1b[31m[forbidden — admin access required]\x1b[0m");
        } else if (ev.code === 4408) {
          setState("closed");
          term.writeln("\r\n\x1b[33m[disconnected — idle timeout]\x1b[0m");
        } else if (ev.code === 4000 || ev.code === 1000 || ev.code === 1012) {
          // clean shell exit / normal / server restart
          setState("closed");
          term.writeln("\r\n\x1b[33m[disconnected]\x1b[0m");
        } else {
          // Transport never established or hard failure → degrade to mock.
          setState("mock");
          term.writeln("\r\n\x1b[33m[live shell unavailable — falling back to local mock]\x1b[0m");
          attachMock();
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror; let onclose decide fallback.
      };
    };

    connectLive();

    const handle: TabHandle = {
      execute: (cmd: string) => {
        // Live mode: type the command straight into the PTY.
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try { wsRef.current.send(JSON.stringify({ type: "input", data: cmd + "\n" })); } catch { /* gone */ }
          return;
        }
        // Mock mode: overwrite current buffer with cmd, echo, and submit.
        const s = stateRef.current;
        if (s.buffer.length) {
          term.write("\r" + PROMPT(username) + " ".repeat(s.buffer.length) + "\r" + PROMPT(username));
        }
        s.buffer = cmd;
        term.write(cmd + "\r\n");
        submit(cmd);
      },
      focus: () => term.focus(),
    };
    onReady(id, handle);

    const onResize = () => {
      try { fitRef.current?.fit(); } catch { /* noop */ }
      sendResize();
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      mockKeyDisposable?.dispose();
      liveDataDisposable?.dispose();
      if (ws) { try { ws.close(1000, "tab closed"); } catch { /* noop */ } }
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refit when becoming active
  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => { try { fitRef.current?.fit(); } catch { /* noop */ } });
    }
  }, [active]);

  // Update theme on toggle
  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.theme = dark
      ? { background: "#0b0f17", foreground: "#e6edf3", cursor: "#7c3aed" }
      : { background: "#fafafa", foreground: "#1a1a1a", cursor: "#7c3aed" };
  }, [dark]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full", !active && "hidden")}
    />
  );
}

interface TabMeta { id: string; name: string }

export function TerminalPage() {
  const t = useT();
  const { user } = useAuth();
  const { effective } = useUI();
  const [tabs, setTabs] = useState<TabMeta[]>([{ id: "t1", name: "shell-1" }]);
  const [activeId, setActiveId] = useState("t1");
  const [broadcast, setBroadcast] = useState(false);
  const [cmd, setCmd] = useState("");
  const [states, setStates] = useState<Record<string, LiveState>>({});
  const handlesRef = useRef<Map<string, TabHandle>>(new Map());
  const counterRef = useRef(1);

  const onReady = useCallback((id: string, handle: TabHandle) => {
    handlesRef.current.set(id, handle);
  }, []);

  const onState = useCallback((id: string, state: LiveState) => {
    setStates((prev) => (prev[id] === state ? prev : { ...prev, [id]: state }));
  }, []);

  const activeState = states[activeId] ?? "connecting";

  const addTab = () => {
    counterRef.current += 1;
    const id = `t${counterRef.current}`;
    const name = `shell-${counterRef.current}`;
    setTabs((prev) => [...prev, { id, name }]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    handlesRef.current.delete(id);
    setTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id);
      if (next.length === 0) {
        counterRef.current += 1;
        const nid = `t${counterRef.current}`;
        const nm = `shell-${counterRef.current}`;
        setActiveId(nid);
        return [{ id: nid, name: nm }];
      }
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const sendCommand = (override?: string) => {
    const text = (override ?? cmd).trim();
    if (!text) return;
    if (broadcast) {
      handlesRef.current.forEach((h) => h.execute(text));
    } else {
      handlesRef.current.get(activeId)?.execute(text);
    }
    setCmd("");
  };

  if (!user?.is_admin) {
    return (
      <div className="space-y-5">
        <PageHeader icon={<TermIcon className="size-5" />} title={t.nav.terminal} description="Interactive shell on the host." />
        <Card className="elev-1"><EmptyState icon={<Lock className="size-10" />} title="403 · Admin only" description="Terminal access is restricted to administrators." /></Card>
      </div>
    );
  }

  const dark = effective === "dark";

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<TermIcon className="size-5" />}
        title={t.nav.terminal}
        description="Live interactive shell on the host (admin-only PTY). Falls back to a local mock when the sidecar is unreachable. Open multiple tabs and broadcast send-keys to all panes."
      />

      <Card className="elev-1 overflow-hidden">
        {/* Tab strip */}
        <div className="flex items-center gap-1 border-b bg-muted/20 px-2 py-1.5 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono cursor-pointer border",
                tab.id === activeId
                  ? "bg-card border-border text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/40"
              )}
              onClick={() => {
                setActiveId(tab.id);
                requestAnimationFrame(() => handlesRef.current.get(tab.id)?.focus());
              }}
            >
              <TermIcon className="size-3" />
              <span>{tab.name}</span>
              <button
                aria-label={`Close ${tab.name}`}
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-50 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addTab} aria-label="New tab">
            <Plus className="size-3.5" />
          </Button>
          <div className="ml-auto pr-1">
            <ConnStateBadge state={activeState} />
          </div>
        </div>

        {/* Terminals */}
        <div className="h-[60vh] w-full bg-card p-3">
          {tabs.map((tab) => (
            <TerminalTab
              key={tab.id}
              id={tab.id}
              active={tab.id === activeId}
              username={user.username}
              dark={dark}
              onReady={onReady}
              onState={onState}
            />
          ))}
        </div>

        {/* Send / broadcast bar */}
        <div className="flex items-center gap-2 border-t bg-muted/20 px-3 py-2">
          <Button
            type="button"
            variant={broadcast ? "default" : "outline"}
            size="sm"
            onClick={() => setBroadcast((v) => !v)}
            title="Broadcast to all tabs (tmux setw synchronize-panes)"
          >
            <Radio className="size-3.5 mr-1.5" />
            {broadcast ? "Broadcast: ON" : "Broadcast: OFF"}
          </Button>
          <Input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendCommand(); } }}
            placeholder={broadcast ? "send-keys to all panes…" : `send-keys to ${tabs.find((tab) => tab.id === activeId)?.name ?? "active"}…`}
            className="font-mono h-8"
          />
          <Button size="sm" onClick={() => sendCommand()} disabled={!cmd.trim()}>
            <Send className="size-3.5 mr-1.5" />Send
          </Button>
        </div>
      </Card>

      <NamedOpsPanel />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConnStateBadge — live PTY connection indicator (WP-19)
// ---------------------------------------------------------------------------

function ConnStateBadge({ state }: { state: LiveState }) {
  const map: Record<LiveState, { label: string; cls: string; dot: string }> = {
    connecting: { label: "connecting", cls: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500 animate-pulse" },
    live: { label: "live shell", cls: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
    mock: { label: "local mock", cls: "text-muted-foreground", dot: "bg-muted-foreground/60" },
    closed: { label: "disconnected", cls: "text-destructive", dot: "bg-destructive" },
  };
  const m = map[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-mono", m.cls)}>
      <span className={cn("inline-block size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// NamedOpsPanel — real server-side named-op dispatch (WP-19)
// ---------------------------------------------------------------------------

type TermOp = {
  op: string;
  description: string;
  requiresApproval: boolean;
  placeholders: readonly string[];
};

type OpResult = {
  op: string;
  argv: readonly string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

// Cast helpers — same gate-middleware boundary pattern as client.ts.
const listTerminalOpsFn = listTerminalOps as unknown as (opts: { data: Record<string, never> }) => Promise<{ ops: TermOp[] }>;
const dispatchTerminalOpFn = dispatchTerminalOp as unknown as (opts: { data: { op: string; args: Record<string, unknown> } }) => Promise<OpResult>;

function NamedOpsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["terminal", "ops"],
    queryFn: () => listTerminalOpsFn({ data: {} }),
  });

  const ops = data?.ops ?? [];
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="elev-1">
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          <CardTitle className="text-sm">Named Operations</CardTitle>
          <span className="text-xs text-muted-foreground ml-1">real server dispatch · allowlisted ops only</span>
          {isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-auto" />}
          {!isLoading && <span className="text-xs text-muted-foreground ml-auto">{ops.length} ops</span>}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-2">
          {ops.length === 0 && !isLoading && (
            <p className="text-xs text-muted-foreground py-2">No allowlisted terminal ops registered.</p>
          )}
          {ops.map((op) => (
            <NamedOpRow key={op.op} op={op} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function NamedOpRow({ op }: { op: TermOp }) {
  const [args, setArgs] = useState<Record<string, string>>(() =>
    Object.fromEntries(op.placeholders.map((p) => [p, ""]))
  );
  const [result, setResult] = useState<OpResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      dispatchTerminalOpFn({ data: { op: op.op, args } }),
    onSuccess: (data) => setResult(data),
  });

  const canRun = op.placeholders.every((p) => (args[p] ?? "").trim() !== "");

  return (
    <div className="rounded-md border bg-muted/10 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-medium">{op.op}</span>
            {op.requiresApproval && <Badge variant="outline" className="text-[10px] h-4 px-1">approval</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{op.description}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 shrink-0"
          disabled={!canRun || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        </Button>
      </div>

      {op.placeholders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {op.placeholders.map((ph) => (
            <div key={ph} className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">{ph}:</span>
              <Input
                value={args[ph] ?? ""}
                onChange={(e) => setArgs((prev) => ({ ...prev, [ph]: e.target.value }))}
                className="h-6 text-xs font-mono w-36 px-2"
                placeholder={`<${ph}>`}
              />
            </div>
          ))}
        </div>
      )}

      {mutation.isError && (
        <p className="text-xs text-destructive font-mono">{String(mutation.error)}</p>
      )}

      {result && (
        <div className="rounded border bg-background p-2 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{result.argv.join(" ")}</span>
            <span className="ml-auto">exit {result.exitCode} · {result.durationMs}ms</span>
          </div>
          {result.stdout && (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{result.stdout}</pre>
          )}
          {result.stderr && (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-20 overflow-y-auto text-destructive">{result.stderr}</pre>
          )}
        </div>
      )}
    </div>
  );
}
