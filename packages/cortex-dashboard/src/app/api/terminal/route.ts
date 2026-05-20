import { readFileSync } from "fs";
import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import { NextRequest, NextResponse } from "next/server";

interface Session {
	client: Client;
	stream: ClientChannel | null;
	buffer: string[];
	listeners: Set<(data: string) => void>;
	connected: boolean;
	lastActivity: number;
}

const MAX_SESSIONS = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const sessions = new Map<string, Session>();

function publish(session: Session, data: string) {
	session.buffer.push(data);
	if (session.buffer.length > 1000) session.buffer.shift();
	session.lastActivity = Date.now();
	session.listeners.forEach((fn) => fn(data));
}

function closeSession(id: string, message?: string) {
	const session = sessions.get(id);
	if (!session) return;
	if (message) publish(session, message);
	session.connected = false;
	session.stream?.close();
	session.client.end();
	sessions.delete(id);
}

function cleanupStaleSessions() {
	const now = Date.now();
	for (const [id, session] of sessions) {
		if (now - session.lastActivity > SESSION_TIMEOUT_MS || !session.connected) closeSession(id);
	}
}

function sshConfig(): ConnectConfig {
	const host = process.env.TERMINAL_SSH_HOST || "localhost";
	const port = Number(process.env.TERMINAL_SSH_PORT || "22");
	const username = process.env.TERMINAL_SSH_USER || "root";
	const keyPath = process.env.TERMINAL_SSH_KEY;
	const password = process.env.TERMINAL_SSH_PASSWORD;
	const config: ConnectConfig = { host, port, username, readyTimeout: 15_000, keepaliveInterval: 15_000 };
	if (keyPath) config.privateKey = readFileSync(keyPath);
	if (password) config.password = password;
	return config;
}

function createSession(id: string): Session {
	const client = new Client();
	const session: Session = { client, stream: null, buffer: [], listeners: new Set(), connected: true, lastActivity: Date.now() };

	client.on("ready", () => {
		client.shell({ term: "xterm-256color", cols: 120, rows: 30 }, (err, stream) => {
			if (err) {
				publish(session, `\r\n[terminal error] ${err.message}\r\n`);
				closeSession(id);
				return;
			}
			session.stream = stream;
			publish(session, "\r\n[ssh connected]\r\n");
			stream.on("data", (data: Buffer) => publish(session, data.toString("utf-8")));
			stream.stderr.on("data", (data: Buffer) => publish(session, data.toString("utf-8")));
			stream.on("close", () => closeSession(id, "\r\n[terminal exited]\r\n"));
		});
	});
	client.on("error", (error) => closeSession(id, `\r\n[ssh error] ${error.message}\r\n`));
	client.on("close", () => {
		if (sessions.has(id)) closeSession(id, "\r\n[ssh disconnected]\r\n");
	});
	client.connect(sshConfig());
	return session;
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { action, sessionId, data, cols, rows } = body;
		if (!sessionId || !SESSION_ID_RE.test(String(sessionId))) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
		if (!action || !["connect", "exec", "resize", "disconnect"].includes(String(action))) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		cleanupStaleSessions();

		if (action === "connect") {
			if (sessions.has(sessionId)) return NextResponse.json({ success: true });
			if (sessions.size >= MAX_SESSIONS) return NextResponse.json({ error: "Maximum session limit reached" }, { status: 429 });
			sessions.set(sessionId, createSession(sessionId));
			return NextResponse.json({ success: true });
		}

		const session = sessions.get(sessionId);
		if (action === "exec") {
			if (session?.connected && session.stream) {
				const input = String(data || "");
				if (input.length > 4096) return NextResponse.json({ error: "Input too large" }, { status: 400 });
				session.stream.write(input);
				session.lastActivity = Date.now();
			}
			return NextResponse.json({ success: true });
		}
		if (action === "resize") {
			if (session?.connected && session.stream) session.stream.setWindow(Number(rows) || 30, Number(cols) || 120, 0, 0);
			return NextResponse.json({ success: true });
		}
		if (action === "disconnect") {
			closeSession(sessionId);
			return NextResponse.json({ success: true });
		}
		return NextResponse.json({ error: "Unknown action" }, { status: 400 });
	} catch (error) {
		console.error("Terminal operation failed", error);
		return NextResponse.json({ error: "Terminal operation failed" }, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	const sessionId = request.nextUrl.searchParams.get("sessionId");
	if (!sessionId || !SESSION_ID_RE.test(sessionId)) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
	const encoder = new TextEncoder();
	let removeListener: (() => void) | null = null;
	let heartbeat: NodeJS.Timeout | null = null;
	const stream = new ReadableStream({
		start(controller) {
			const enqueue = (payload: string) => {
				try { controller.enqueue(encoder.encode(payload)); } catch {}
			};
			const send = (output: string) => enqueue(`data: ${JSON.stringify({ output })}\n\n`);
			const session = sessions.get(sessionId);
			if (!session) {
				enqueue(`data: ${JSON.stringify({ error: "Session not found" })}\n\n`);
				controller.close();
				return;
			}
			session.buffer.forEach(send);
			session.listeners.add(send);
			removeListener = () => session.listeners.delete(send);
			heartbeat = setInterval(() => enqueue(": keepalive\n\n"), 15000);
		},
		cancel() {
			if (removeListener) removeListener();
			if (heartbeat) clearInterval(heartbeat);
		},
	});
	return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

export const dynamic = "force-dynamic";
