import crypto from "crypto";
import { randomUUID } from "crypto";
import {
	createDashboardCommandAudit,
	finishDashboardCommandAudit,
} from "@/lib/db/dashboard-command-audit";
import {
	sendRootHelperRequest,
	type RootHelperResponse,
} from "@/lib/root-helper/client";

export interface ExecuteRootCommandInput {
	command: string;
	argv?: string[];
	cwd?: string;
	stdin?: string;
	env?: Record<string, string>;
	timeoutMs?: number;
	dryRun?: boolean;
	requestedBy?: string;
	sourceIp?: string | null;
	sourceUserAgent?: string | null;
	dashboardSessionId?: string | null;
	mutationClass?: string;
	targetScope?: string;
	metadata?: Record<string, unknown>;
}

export interface ExecuteRootCommandResult {
	requestId: string;
	stdout: string;
	stderr: string;
	status: string;
	exitCode: number | null;
	signal: string | null;
}

function sha256Text(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function envNames(env: Record<string, string> | undefined): string[] {
	return Object.keys(env ?? {}).sort();
}

export async function executeRootCommand(
	input: ExecuteRootCommandInput,
): Promise<ExecuteRootCommandResult> {
	const requestId = randomUUID();
	const argv = input.argv ?? [];
	const timeoutMs = input.timeoutMs ?? 30000;
	await createDashboardCommandAudit({
		requestId,
		requestedBy: input.requestedBy,
		sourceIp: input.sourceIp,
		sourceUserAgent: input.sourceUserAgent,
		dashboardSessionId: input.dashboardSessionId,
		command: input.command,
		argv,
		cwd: input.cwd,
		envAllowlist: envNames(input.env),
		stdinSha256: input.stdin ? sha256Text(input.stdin) : null,
		timeoutMs,
		mutationClass: input.mutationClass,
		targetScope: input.targetScope,
		dryRun: input.dryRun,
		metadata: input.metadata,
	});

	let response: RootHelperResponse | null = null;
	try {
		response = await sendRootHelperRequest({
			request_id: requestId,
			command: input.command,
			argv,
			cwd: input.cwd,
			stdin: input.stdin,
			env: input.env,
			timeout_ms: timeoutMs,
			dry_run: input.dryRun,
			requested_by: input.requestedBy,
			target_scope: input.targetScope,
			mutation_class: input.mutationClass,
			metadata: input.metadata,
		});
		await finishDashboardCommandAudit(requestId, {
			startedAt: response.started_at,
			finishedAt: response.finished_at,
			stdoutSha256: response.stdout_sha256,
			stderrSha256: response.stderr_sha256,
			stdoutBytes: response.stdout_bytes,
			stderrBytes: response.stderr_bytes,
			exitCode: response.exit_code,
			signal: response.signal,
			status: response.status,
			error: response.error,
			journaldCursor: response.journald_cursor ?? null,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "root helper failed";
		await finishDashboardCommandAudit(requestId, {
			status: "error",
			error: message,
			metadata: { helper_error: true },
		}).catch(() => {});
		throw error;
	}

	if (response.error) {
		throw new Error(response.error);
	}
	if (response.exit_code !== 0 && response.status !== "dry_run") {
		throw new Error(response.stderr || `command exited with ${response.exit_code}`);
	}

	return {
		requestId,
		stdout: response.stdout,
		stderr: response.stderr,
		status: response.status,
		exitCode: response.exit_code,
		signal: response.signal,
	};
}
