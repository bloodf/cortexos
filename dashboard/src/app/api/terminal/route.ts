import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";

interface Session {
	process: ChildProcessWithoutNullStreams;
	buffer: string[];
	listeners: Set<(data: string) => void>;
	connected: boolean;
	lastActivity: number;
}

const MAX_SESSIONS = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const sessions = new Map<string, Session>();

function cleanupStaleSessions() {
	const now = Date.now();
	for (const [id, session] of sessions) {
		if (now - session.lastActivity > SESSION_TIMEOUT_MS || !session.connected) {
			session.process.kill("SIGTERM");
			sessions.delete(id);
		}
	}
}

function publish(session: Session, data: string) {
	session.buffer.push(data);
	if (session.buffer.length > 1000) session.buffer.shift();
	session.lastActivity = Date.now();
	session.listeners.forEach((fn) => fn(data));
}

function shellCommand() {
	return process.env.TERMINAL_SHELL || process.env.SHELL || "/bin/bash";
}

function createSession(id: string): Session {
	const shell = shellCommand();
	const useScript = existsSync("/usr/bin/script") || existsSync("/bin/script");
	const scriptBin = existsSync("/usr/bin/script")
		? "/usr/bin/script"
		: "/bin/script";
	const cwd = process.env.HOME || "/root";
	const env = {
		...process.env,
		TERM: "xterm-256color",
		COLORTERM: "truecolor",
	};

	const child = useScript
		? spawn(scriptBin, ["-q", "-f", "-c", `${shell} -l`, "/dev/null"], {
				cwd,
				env,
			})
		: spawn(shell, ["-l"], { cwd, env });

	const session: Session = {
		process: child,
		buffer: [],
		listeners: new Set(),
		connected: true,
		lastActivity: Date.now(),
	};

	child.stdout.on("data", (data: Buffer) =>
		publish(session, data.toString("utf-8")),
	);
	child.stderr.on("data", (data: Buffer) =>
		publish(session, data.toString("utf-8")),
	);
	child.on("error", (error) => {
		publish(session, `\r\n[terminal error] ${error.message}\r\n`);
		session.connected = false;
		sessions.delete(id);
	});
	child.on("close", (code) => {
		publish(
			session,
			`\r\n[terminal exited${code === null ? "" : ` with code ${code}`}]\r\n`,
		);
		session.connected = false;
		sessions.delete(id);
	});

	return session;
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { action, sessionId, data } = body;

		if (!sessionId || !SESSION_ID_RE.test(String(sessionId))) {
			return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
		}

		const validActions = ["connect", "exec", "resize", "disconnect"];
		if (!action || !validActions.includes(String(action))) {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}

		cleanupStaleSessions();

		if (action === "connect") {
			if (sessions.has(sessionId)) {
				return NextResponse.json({ success: true });
			}
			if (sessions.size >= MAX_SESSIONS) {
				return NextResponse.json(
					{ error: "Maximum session limit reached" },
					{ status: 429 },
				);
			}
			const session = createSession(sessionId);
			sessions.set(sessionId, session);
			return NextResponse.json({ success: true });
		}

		if (action === "exec") {
			const session = sessions.get(sessionId);
			if (session?.connected) {
				const input = String(data || "");
				if (input.length > 4096) {
					return NextResponse.json(
						{ error: "Input too large" },
						{ status: 400 },
					);
				}
				session.process.stdin.write(input);
				session.lastActivity = Date.now();
			}
			return NextResponse.json({ success: true });
		}

		if (action === "resize") {
			// Local process backend does not expose a resize API. Keep this a successful no-op
			// so the xterm client can call it freely.
			return NextResponse.json({ success: true });
		}

		if (action === "disconnect") {
			const session = sessions.get(sessionId);
			if (session) {
				session.process.kill("SIGTERM");
				sessions.delete(sessionId);
			}
			return NextResponse.json({ success: true });
		}

		return NextResponse.json({ error: "Unknown action" }, { status: 400 });
	} catch (error) {
		console.error("Terminal operation failed", error);
		return NextResponse.json(
			{ error: "Terminal operation failed" },
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest) {
	const sessionId = request.nextUrl.searchParams.get("sessionId");
	if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
		return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
	}

	const encoder = new TextEncoder();
	let removeListener: (() => void) | null = null;
	let heartbeat: NodeJS.Timeout | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const enqueue = (payload: string) => {
				try {
					controller.enqueue(encoder.encode(payload));
				} catch {
					// stream closed
				}
			};
			const send = (data: string) => {
				enqueue(`data: ${JSON.stringify({ output: data })}\n\n`);
			};

			const session = sessions.get(sessionId);
			if (session) {
				session.buffer.forEach(send);
				session.listeners.add(send);
				removeListener = () => session.listeners.delete(send);
				heartbeat = setInterval(() => enqueue(": keepalive\n\n"), 15000);
			} else {
				enqueue(`data: ${JSON.stringify({ error: "Session not found" })}\n\n`);
				controller.close();
			}
		},
		cancel() {
			if (removeListener) removeListener();
			if (heartbeat) clearInterval(heartbeat);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}

export const dynamic = "force-dynamic";
