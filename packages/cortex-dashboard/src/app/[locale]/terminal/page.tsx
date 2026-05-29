"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Plus, X, Monitor, Copy, ClipboardPaste, Trash, TerminalIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import "@xterm/xterm/css/xterm.css";

interface SessionMeta {
	id: string;
	name: string;
	connected: boolean;
}

interface SessionState {
	meta: SessionMeta;
	terminal?: XTerm;
	fitAddon?: FitAddon;
	eventSource?: EventSource;
}

const STORAGE_KEY = "cortex-terminal-sessions";

function loadSessionMetas(): SessionMeta[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch (error) {
		console.debug("Failed to load terminal sessions", error);
	}
	return [];
}

function saveSessionMetas(metas: SessionMeta[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(metas));
	} catch (error) {
		console.debug("Failed to save terminal sessions", error);
	}
}

function makeId() {
	return Math.random().toString(36).slice(2, 9);
}

const terminalThemes = {
	dark: {
		background: "rgba(0, 0, 0, 0.85)",
		foreground: "#e2e8f0",
		cursor: "#64748b",
		selectionBackground: "#334155",
		black: "#0f172a",
		red: "#f87171",
		green: "#4ade80",
		yellow: "#facc15",
		blue: "#60a5fa",
		magenta: "#c084fc",
		cyan: "#22d3ee",
		white: "#e2e8f0",
	},
	light: {
		background: "rgba(248, 250, 252, 0.85)",
		foreground: "#0f172a",
		cursor: "#4f46e5",
		selectionBackground: "#c7d2fe",
		black: "#0f172a",
		red: "#dc2626",
		green: "#16a34a",
		yellow: "#ca8a04",
		blue: "#2563eb",
		magenta: "#9333ea",
		cyan: "#0891b2",
		white: "#f8fafc",
	},
} as const;

export default function TerminalPage() {
	const t = useTranslations("Infrastructure");
	const { resolvedTheme } = useTheme();
	const theme: "light" | "dark" = resolvedTheme === "light" ? "light" : "dark";
	const [sessions, setSessions] = useState<SessionState[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const nextIndex = useRef(1);

	const didInit = useRef(false);
	// Initialize from localStorage or create default
	useEffect(() => {
		if (didInit.current) return;
		didInit.current = true;
		const metas = loadSessionMetas();
		if (metas.length > 0) {
			const states = metas.map((m) => ({ meta: { ...m, connected: false } }));
			setTimeout(() => {
				setSessions(states);
				setActiveId(states[0].meta.id);
			}, 0);
			nextIndex.current = metas.length + 1;
		} else {
			const id = makeId();
			const name = "Session 1";
			const state: SessionState = { meta: { id, name, connected: false } };
			setTimeout(() => {
				setSessions([state]);
				setActiveId(id);
			}, 0);
			saveSessionMetas([{ id, name, connected: false }]);
			nextIndex.current = 2;
		}
	}, []);

	const createSession = useCallback(() => {
		const id = makeId();
		const name = `Session ${nextIndex.current++}`;
		const state: SessionState = { meta: { id, name, connected: false } };
		setSessions((prev) => {
			const next = [...prev, state];
			saveSessionMetas(next.map((s) => s.meta));
			return next;
		});
		setActiveId(id);
	}, []);

	const closeSession = useCallback(
		(id: string) => {
			setSessions((prev) => {
				const session = prev.find((s) => s.meta.id === id);
				if (session?.eventSource) session.eventSource.close();
				if (session?.terminal) session.terminal.dispose();
				// disconnect backend
				fetch("/api/terminal", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "disconnect", sessionId: id }),
				}).catch(() => {});
				const next = prev.filter((s) => s.meta.id !== id);
				saveSessionMetas(next.map((s) => s.meta));
				if (activeId === id && next.length > 0) setActiveId(next[0].meta.id);
				if (next.length === 0) setActiveId(null);
				return next;
			});
		},
		[activeId],
	);

	const handleCopy = useCallback(() => {
		const session = sessions.find((s) => s.meta.id === activeId);
		if (session?.terminal) {
			const sel = session.terminal.getSelection();
			if (sel) navigator.clipboard.writeText(sel);
		}
	}, [sessions, activeId]);

	const handlePaste = useCallback(async () => {
		const session = sessions.find((s) => s.meta.id === activeId);
		if (session?.terminal) {
			try {
				const text = await navigator.clipboard.readText();
				session.terminal.paste(text);
			} catch (error) {
				console.debug("Failed to read clipboard", error);
			}
		}
	}, [sessions, activeId]);

	const handleClear = useCallback(() => {
		const session = sessions.find((s) => s.meta.id === activeId);
		if (session?.terminal) {
			session.terminal.clear();
		}
	}, [sessions, activeId]);

	// Initialize terminals
	useEffect(() => {
		sessions.forEach((session) => {
			if (session.terminal || !containerRefs.current.get(session.meta.id))
				return;
			const container = containerRefs.current.get(session.meta.id)!;

			const term = new XTerm({
				cursorBlink: true,
				fontSize: 13,
				fontFamily: "JetBrains Mono, monospace",
				scrollback: 10000,
				theme: terminalThemes[theme],
			});

			const fitAddon = new FitAddon();
			term.loadAddon(fitAddon);
			term.loadAddon(new WebLinksAddon());
			term.open(container);
			fitAddon.fit();

			// Connect to backend
			const sid = session.meta.id;
			fetch("/api/terminal", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "connect", sessionId: sid }),
			})
				.then(() => {
					const es = new EventSource(`/api/terminal?sessionId=${sid}`);
					es.onmessage = (ev) => {
						try {
							const msg = JSON.parse(ev.data);
							if (msg.output) term.write(msg.output);
						} catch (error) {
							console.debug("Failed to parse terminal event", error);
						}
					};
					es.onerror = () => {
						term.writeln("\r\n\x1b[1;31m[Connection lost]\x1b[0m");
					};
					session.eventSource = es;
					setSessions((prev) =>
						prev.map((s) =>
							s.meta.id === sid
								? { ...s, meta: { ...s.meta, connected: true } }
								: s,
						),
					);
				})
				.catch((err) => {
					term.writeln(`\r\n\x1b[1;31m[SSH Error: ${err.message}]\x1b[0m`);
				});

			term.onData((data) => {
				fetch("/api/terminal", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "exec", sessionId: sid, data }),
				}).catch(() => {});
			});

			term.onResize(({ cols, rows }) => {
				fetch("/api/terminal", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "resize",
						sessionId: sid,
						cols,
						rows,
					}),
				}).catch(() => {});
			});

			session.terminal = term;
			session.fitAddon = fitAddon;
		});

		const handleResize = () => {
			sessions.forEach((s) => s.fitAddon?.fit());
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [sessions, theme]);

	useEffect(() => {
		sessions.forEach((session) => {
			if (session.terminal) {
				session.terminal.options.theme = terminalThemes[theme];
			}
		});
	}, [sessions, theme]);

	return (
		<div className="flex flex-col gap-4 p-6" style={{ height: "calc(100vh - 64px)" }}>
			<PageHeader
				title={t("TerminalTitle")}
				description={t("TerminalDescription")}
				icon={<TerminalIcon />}
			/>

			{/* Tabs + Toolbar */}
			<div className="flex items-end gap-2">
				<div className="flex items-end gap-1 overflow-x-auto flex-1">
					{sessions.map((s) => (
						<div
							key={s.meta.id}
							onClick={() => setActiveId(s.meta.id)}
							className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t border-l border-r shrink-0 ${
								activeId === s.meta.id
									? "-mb-px bg-card text-foreground border-border border-b-0"
									: "bg-muted text-muted-foreground border-transparent hover:text-foreground"
							}`}
						>
							<Monitor className="w-3 h-3" />
							<span>{s.meta.name}</span>
							{s.meta.connected && (
								<span className="w-1.5 h-1.5 rounded-full bg-success" />
							)}
							<button
								onClick={(e) => {
									e.stopPropagation();
									closeSession(s.meta.id);
								}}
								className="ml-1 hover:text-destructive"
							>
								<X className="w-3 h-3" />
							</button>
						</div>
					))}
					<button
						onClick={createSession}
						className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
					>
						<Plus className="w-3.5 h-3.5" />
						{t("NewSession")}
					</button>
				</div>

				{/* Toolbar */}
				<div className="flex items-center gap-1 shrink-0">
					<button
						onClick={handleCopy}
						className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
						title="Copy"
					>
						<Copy className="w-3.5 h-3.5" />
					</button>
					<button
						onClick={handlePaste}
						className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
						title="Paste"
					>
						<ClipboardPaste className="w-3.5 h-3.5" />
					</button>
					<button
						onClick={handleClear}
						className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
						title="Clear"
					>
						<Trash className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			{/* Terminal containers — surface kept aligned with xterm JS theme backgrounds */}
			<div className="flex-1 relative border border-border rounded-b-lg rounded-tr-lg bg-black/85 light:bg-slate-50/85 overflow-hidden">
				{sessions.map((s) => (
					<div
						key={s.meta.id}
						ref={(el) => {
							if (el) containerRefs.current.set(s.meta.id, el);
						}}
						className={`absolute inset-0 p-1 ${activeId === s.meta.id ? "visible z-10" : "invisible z-0"}`}
						style={{ overflow: "hidden" }}
					/>
				))}
				{sessions.length === 0 && (
					<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
						{t("NoSessions")}
					</div>
				)}
			</div>
		</div>
	);
}
