import type { Server } from "socket.io";
import { execute } from "./db/client";
import { getSessionByToken } from "./db/admin";

const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SESSION_COOKIE_RE = /(?:^|;)\s*session_token=([^;]+)/;

function getSessionToken(cookieHeader: string | undefined): string {
	if (!cookieHeader) return "";
	const match = cookieHeader.match(SESSION_COOKIE_RE);
	return match?.[1] ? decodeURIComponent(match[1]) : "";
}

async function runRetentionCleanup() {
	try {
		await execute("DELETE FROM service_health_log WHERE checked_at < NOW() - INTERVAL '30 days'");
		await execute("DELETE FROM alert_history WHERE created_at < NOW() - INTERVAL '90 days'");
	} catch (error) {
		console.error("[retention-cleanup] failed", error);
	}
}

export function initSocketServer(io: Server, _port: number) {
	io.use(async (socket, next) => {
		try {
			const token = getSessionToken(socket.handshake.headers.cookie);
			if (!token) return next(new Error("Unauthorized"));
			const session = await getSessionByToken(token);
			if (!session) return next(new Error("Unauthorized"));
			return next();
		} catch {
			return next(new Error("Unauthorized"));
		}
	});

	io.on("connection", (socket) => {
		socket.on("disconnect", () => {});
	});

	const timers: NodeJS.Timeout[] = [];
	runRetentionCleanup();
	timers.push(setInterval(runRetentionCleanup, RETENTION_INTERVAL_MS));

	process.on("SIGINT", () => {
		timers.forEach(clearInterval);
		io.close(() => process.exit(0));
	});
}
