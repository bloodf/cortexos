/**
 * Shared systemd / docker action helpers.
 *
 * Factored out from `/api/systemd/actions` and `/api/docker/actions` so they
 * can be reused by the AI tool registry without re-issuing HTTP calls.
 */

import { createActionLog } from "@/lib/db/action-log";
import { executeRootCommand } from "@/lib/root-helper/executor";

const SYSTEMD_VALID = new Set(["start", "stop", "restart", "reload"]);
const SYSTEMD_NAME_RE = /^[a-zA-Z0-9_.@:-]+$/;

const DOCKER_VALID = new Set(["start", "stop", "restart", "prune"]);
const DOCKER_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:/@-]{0,255}$/;
const PRUNE_TARGETS = new Set(["containers", "images", "volumes", "networks", "all"]);

export interface ActorContext {
	userId: number;
	sessionId?: string;
}

export interface HostOpResult {
	stdout: string;
	stderr: string;
}

export async function systemdAction(
	action: string,
	unit: string,
	actor: ActorContext,
): Promise<HostOpResult> {
	const a = action.toLowerCase();
	if (!SYSTEMD_VALID.has(a)) throw new Error(`Invalid systemd action: ${action}`);
	if (!SYSTEMD_NAME_RE.test(unit)) throw new Error("Invalid unit name");
	const { stdout, stderr } = await executeRootCommand({
		command: "systemctl",
		argv: [a, unit],
		timeoutMs: 30_000,
		requestedBy: `dashboard-user-${actor.userId}`,
		dashboardSessionId: actor.sessionId ?? null,
		mutationClass: "service-control",
		targetScope: "host",
		metadata: { caller: "runtime.host-ops", unit, action: a },
	});
	await createActionLog({
		user_id: actor.userId,
		username: null,
		target_type: "systemd",
		target_name: unit,
		action: a,
		status: "success",
		message: stderr || stdout || null,
	}).catch(() => {});
	return { stdout, stderr };
}

export async function dockerAction(
	action: string,
	target: string,
	actor: ActorContext,
): Promise<HostOpResult> {
	const a = action.toLowerCase();
	if (!DOCKER_VALID.has(a)) throw new Error(`Invalid docker action: ${action}`);

	if (a === "prune") {
		const t = target.toLowerCase();
		if (!PRUNE_TARGETS.has(t)) throw new Error("Invalid prune target");
		const subcmd = t === "all" ? "system" : t.replace(/s$/, "");
		const { stdout, stderr } = await executeRootCommand({
			command: "docker",
			argv: [subcmd, "prune", "-f"],
			timeoutMs: 60_000,
			requestedBy: `dashboard-user-${actor.userId}`,
			dashboardSessionId: actor.sessionId ?? null,
			mutationClass: "docker-prune",
			targetScope: "host",
			metadata: { caller: "runtime.host-ops", target: t, action: "prune" },
		});
		await createActionLog({
			user_id: actor.userId,
			username: null,
			target_type: "docker",
			target_name: t,
			action: "prune",
			status: "success",
			message: stderr || stdout || null,
		}).catch(() => {});
		return { stdout, stderr };
	}

	if (!DOCKER_NAME_RE.test(target)) throw new Error("Invalid target name");
	const { stdout, stderr } = await executeRootCommand({
		command: "docker",
		argv: [a, target],
		timeoutMs: 30_000,
		requestedBy: `dashboard-user-${actor.userId}`,
		dashboardSessionId: actor.sessionId ?? null,
		mutationClass: "docker-control",
		targetScope: "host",
		metadata: { caller: "runtime.host-ops", target, action: a },
	});
	await createActionLog({
		user_id: actor.userId,
		username: null,
		target_type: "docker",
		target_name: target,
		action: a,
		status: "success",
		message: stderr || stdout || null,
	}).catch(() => {});
	return { stdout, stderr };
}
