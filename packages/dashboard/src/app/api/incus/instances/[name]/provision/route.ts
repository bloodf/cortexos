/**
 * /api/incus/instances/[name]/provision — run the canonical provisioning script.
 *
 * Blocking: invokes scripts/ops/cortex-incus-instance-create.sh through the
 * audited root helper and waits for completion. Progress is written by the
 * script to /run/cortexos/incus-provision/<requestId>.log (the status route
 * polls that file concurrently). On completion the buffered result is
 * authoritative → status active|failed + action_log.
 */
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { executeRootCommand } from "@/lib/root-helper/executor";
import {
	getIncusInstance,
	updateIncusInstanceStatus,
	SAFE_NAME_RE,
} from "@/lib/db/incus-instances";
import {
	buildScriptArgv,
	type IncusInstanceConfig,
} from "@/lib/incus/instance-config";

const SCRIPT_PATH =
	process.env.CORTEX_INCUS_SCRIPT ??
	"/opt/cortexos/scripts/ops/cortex-incus-instance-create.sh";
const PROVISION_TIMEOUT_MS = 15 * 60 * 1000;

interface ProvisionActor {
	username: string | null;
	userId: number | null;
}

async function runProvision(
	name: string,
	cfg: IncusInstanceConfig,
	requestId: string,
	actor: ProvisionActor,
): Promise<{ stdout: string; stderr: string }> {
	const argv = [SCRIPT_PATH, ...buildScriptArgv(cfg), "--force", "--json-progress"];
	return executeRootCommand({
		command: "bash",
		argv,
		timeoutMs: PROVISION_TIMEOUT_MS,
		env: { CORTEX_INCUS_REQUEST_ID: requestId },
		requestedBy: actor.username ?? "trusted-dashboard",
		dashboardSessionId: actor.userId !== null ? `user-${actor.userId}` : null,
		mutationClass: "incus-provision",
		targetScope: "host",
		metadata: { route: "/api/incus/instances/provision", name, requestId },
	});
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ name: string }> },
) {
	const auth = await requireAdmin(request, { tool: "incus.instances.provision" });
	if (auth.error) return auth.error;

	const { name } = await params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid name" }, { status: 400 });
	}

	const row = await getIncusInstance(name);
	if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = (await request.json().catch(() => ({}))) as { force?: boolean };
	const force = body?.force === true;
	if (row.status !== "validated" && !force) {
		return NextResponse.json(
			{ error: `Instance must be validated before provisioning (status: ${row.status})` },
			{ status: 409 },
		);
	}

	const cfg = row.config as unknown as IncusInstanceConfig;
	const requestId = randomUUID();
	const actor: ProvisionActor = {
		username: auth.session?.username ?? null,
		userId: auth.session?.user_id ?? null,
	};

	await updateIncusInstanceStatus(name, "provisioning", { lastRequestId: requestId });

	try {
		const { stdout, stderr } = await runProvision(name, cfg, requestId, actor);
		await updateIncusInstanceStatus(name, "active");
		await createActionLog({
			user_id: actor.userId,
			username: actor.username,
			target_type: "incus",
			target_name: name,
			action: "provision",
			status: "success",
			message: stderr || stdout?.slice(-1000) || null,
		});
		return NextResponse.json({ success: true, requestId, stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "provision failed";
		await updateIncusInstanceStatus(name, "failed").catch(() => {});
		await createActionLog({
			user_id: actor.userId,
			username: actor.username,
			target_type: "incus",
			target_name: name,
			action: "provision",
			status: "failure",
			message: msg.slice(0, 1000),
		}).catch(() => {});
		return NextResponse.json({ error: msg, requestId }, { status: 500 });
	}
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
