"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TermIcon, Lock } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { EmptyState } from "@/components/sys-pilot/EmptyState";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";

const PROMPT = (user: string) => `\x1b[32m${user}@cortex\x1b[0m:\x1b[34m~\x1b[0m$ `;

const BANNER = [
  "\x1b[1;36mCortexOS shell\x1b[0m · interactive mock terminal",
  "Type \x1b[33mhelp\x1b[0m for available commands. Use \x1b[33mclear\x1b[0m to wipe the screen.",
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

export default function TerminalPage() {
  const t = useTranslations();
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
      convertEol: true,
      theme: dark
        ? { background: "#0b0f17", foreground: "#e6edf3", cursor: "#7c3aed" }
        : { background: "#fafafa", foreground: "#1a1a1a", cursor: "#7c3aed" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const username = user.username;
    let buffer = "";
    const history: string[] = [];
    let hIdx = -1;

    const writeBanner = () => {
      BANNER.forEach((l) => term.writeln(l));
      term.write(PROMPT(username));
    };
    writeBanner();

    const onResize = () => { try { fit.fit(); } catch { /* noop */ } };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    term.onKey(({ key, domEvent }) => {
      const ev = domEvent;
      if (ev.key === "Enter") {
        term.write("\r\n");
        if (buffer.trim()) history.unshift(buffer);
        hIdx = -1;
        if (buffer.trim() === "clear") {
          term.clear();
        } else {
          const out = run(buffer, username);
          out.forEach((l) => term.writeln(l));
        }
        buffer = "";
        term.write(PROMPT(username));
      } else if (ev.key === "Backspace") {
        if (buffer.length > 0) { buffer = buffer.slice(0, -1); term.write("\b \b"); }
      } else if (ev.key === "ArrowUp") {
        if (hIdx + 1 < history.length) {
          hIdx++;
          // clear current
          term.write("\r" + PROMPT(username) + " ".repeat(buffer.length) + "\r" + PROMPT(username));
          buffer = history[hIdx];
          term.write(buffer);
        }
      } else if (ev.key === "ArrowDown") {
        if (hIdx > 0) {
          hIdx--;
          term.write("\r" + PROMPT(username) + " ".repeat(buffer.length) + "\r" + PROMPT(username));
          buffer = history[hIdx];
          term.write(buffer);
        } else if (hIdx === 0) {
          hIdx = -1;
          term.write("\r" + PROMPT(username) + " ".repeat(buffer.length) + "\r" + PROMPT(username));
          buffer = "";
        }
      } else if (ev.ctrlKey && ev.key === "c") {
        term.write("^C\r\n" + PROMPT(username));
        buffer = "";
      } else if (ev.ctrlKey && ev.key === "l") {
        term.clear();
        term.write(PROMPT(username) + buffer);
      } else if (key.length === 1 && key.charCodeAt(0) >= 32) {
        buffer += key;
        term.write(key);
      }
    });

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
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
        description="Interactive shell on the host. Mock PTY — try help, systemctl status, journalctl -u caddy."
      />
      <Card className="elev-1 p-0 overflow-hidden">
        <div ref={containerRef} className="h-[68vh] w-full" />
      </Card>
    </div>
  );
}
