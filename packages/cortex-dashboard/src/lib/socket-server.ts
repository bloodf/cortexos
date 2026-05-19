import type { Server } from "socket.io";
import { hostExec } from "./host-exec";
import { getEnabledAlertRules, insertAlertHistory } from "./db/alerts";
import { execute } from "./db/client";
import { getSessionByToken } from "./db/admin";

const INTERVALS = {
	services: 10000,
	system: 5000,
	processes: 5000,
	network: 5000,
	docker: 10000,
	alerts: 10000,
};

const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SESSION_COOKIE_RE = /(?:^|;)\s*session_token=([^;]+)/;

async function fetchInternal(port: number, path: string) {
	try {
		const res = await fetch(`http://localhost:${port}${path}`, {
			cache: "no-store",
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

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

function getDockerStatus() {
	try {
		const stdout = hostExec(
			"docker ps --format '{{.Names}}|{{.Status}}'",
			5000,
		);
		const containers = stdout
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [name, status] = line.split("|");
				return { name, status };
			});
		return { containers, timestamp: Date.now() };
	} catch {
		return { containers: [], timestamp: Date.now() };
	}
}

export function initSocketServer(io: Server, port: number) {
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
	const previousStatuses = new Map<number, string>();

	timers.push(
		setInterval(async () => {
			const data = await fetchInternal(port, "/api/services?raw=1");
			if (data) io.emit("services:status", data);
		}, INTERVALS.services),
	);

	timers.push(
		setInterval(async () => {
			const data = await fetchInternal(port, "/api/system");
			if (data) io.emit("system:metrics", data);
		}, INTERVALS.system),
	);

	timers.push(
		setInterval(async () => {
			const data = await fetchInternal(port, "/api/processes");
			if (data) io.emit("processes:list", data);
		}, INTERVALS.processes),
	);

	timers.push(
		setInterval(async () => {
			const data = await fetchInternal(port, "/api/network");
			if (data) io.emit("network:stats", data);
		}, INTERVALS.network),
	);

	timers.push(
		setInterval(() => {
			const data = getDockerStatus();
			io.emit("docker:status", data);
		}, INTERVALS.docker),
	);

	timers.push(
		setInterval(async () => {
			const data = await fetchInternal(port, "/api/services");
			if (!data || !Array.isArray(data.services)) return;

			const rules = await getEnabledAlertRules().catch(() => []);
			const rulesByService = new Map<number, typeof rules>();
			for (const rule of rules) {
				const list = rulesByService.get(rule.service_id) || [];
				list.push(rule);
				rulesByService.set(rule.service_id, list);
			}

			for (const svc of data.services) {
				const prev = previousStatuses.get(svc.id);
				const curr = svc.status as string;
				previousStatuses.set(svc.id, curr);

				if (prev && prev !== curr) {
					const serviceRules = rulesByService.get(svc.id) || [];
					for (const rule of serviceRules) {
						let triggered = false;
						let message = "";

						if (rule.condition === "offline" && curr === "offline") {
							triggered = true;
							message = `${svc.name} is offline`;
						} else if (rule.condition === "online" && curr === "online") {
							triggered = true;
							message = `${svc.name} is back online`;
						}

						if (triggered) {
							try {
								await insertAlertHistory(rule.id, svc.id, curr, message);
							} catch {
								// ignore history insert failures
							}
							io.emit("alert:triggered", {
								ruleId: rule.id,
								ruleName: rule.name,
								serviceId: svc.id,
								serviceName: svc.name,
								status: curr,
								message,
								timestamp: Date.now(),
							});
						}
					}
				}

				// response_time check (no state change required)
				const serviceRules = rulesByService.get(svc.id) || [];
				for (const rule of serviceRules) {
					if (
						rule.condition === "response_time" &&
						rule.threshold_ms != null &&
						typeof svc.responseTime === "number" &&
						svc.responseTime > rule.threshold_ms
					) {
						const message = `${svc.name} response time ${svc.responseTime}ms exceeds ${rule.threshold_ms}ms`;
						try {
							await insertAlertHistory(rule.id, svc.id, curr, message);
						} catch {
							// ignore
						}
						io.emit("alert:triggered", {
							ruleId: rule.id,
							ruleName: rule.name,
							serviceId: svc.id,
							serviceName: svc.name,
							status: curr,
							message,
							timestamp: Date.now(),
						});
					}
				}
			}
		}, INTERVALS.alerts),
	);

	process.on("SIGINT", () => {
		timers.forEach(clearInterval);
		io.close(() => process.exit(0));
	});
}
