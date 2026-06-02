"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TermIcon, Lock } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { EmptyState } from "@/components/sys-pilot/EmptyState";
import { Card } from "@/components/ui/card";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";

function newSessionId(): string {
  const rnd =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2);
  return `term-${rnd}`.slice(0, 64);
}

export default function TerminalPage() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!user?.is_admin || !containerRef.current) return;
    const dark = resolvedTheme === "dark";
    const term = new XTerm({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      convertEol: false,
      theme: dark
        ? { background: "#0b0f17", foreground: "#e6edf3", cursor: "#7c3aed" }
        : { background: "#fafafa", foreground: "#1a1a1a", cursor: "#7c3aed" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const sessionId = newSessionId();
    let evtSource: EventSource | null = null;
    let disposed = false;

    const post = (action: string, data?: string) =>
      fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId, data }),
      });

    const connect = async () => {
      try {
        const res = await post("connect");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          term.writeln(`\x1b[31m[connect failed] ${body.error || res.status}\x1b[0m`);
          return;
        }
        if (disposed) return;

        evtSource = new EventSource(`/api/terminal?sessionId=${encodeURIComponent(sessionId)}`);
        evtSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data) as { output?: string; error?: string };
            if (payload.output !== undefined) term.write(payload.output);
            else if (payload.error) term.writeln(`\x1b[31m[${payload.error}]\x1b[0m`);
          } catch {
            /* ignore non-JSON frames (e.g. keepalive) */
          }
        };
        evtSource.onerror = () => {
          if (!disposed) term.writeln("\r\n\x1b[33m[stream disconnected]\x1b[0m");
        };
      } catch (err) {
        term.writeln(`\x1b[31m[connect error] ${(err as Error).message}\x1b[0m`);
      }
    };

    void connect();

    // Forward raw keystrokes (including control sequences) to the real shell stdin.
    term.onData((data) => {
      void post("exec", data);
    });

    const onResize = () => { try { fit.fit(); } catch { /* noop */ } };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      evtSource?.close();
      void post("disconnect");
      term.dispose();
      termRef.current = null;
    };
  }, [user, resolvedTheme]);

  if (!user?.is_admin) {
    return (
      <div className="space-y-5">
        <PageHeader icon={<TermIcon className="size-5" />} title={"Terminal"} description="Interactive shell on the host." />
        <Card className="elev-1"><EmptyState icon={<Lock className="size-10" />} title="403 · Admin only" description="Terminal access is restricted to administrators." /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<TermIcon className="size-5" />}
        title={"Terminal"}
        description="Interactive shell on the host."
      />
      <Card className="elev-1 p-0 overflow-hidden">
        <div ref={containerRef} className="h-[68vh] w-full" />
      </Card>
    </div>
  );
}
