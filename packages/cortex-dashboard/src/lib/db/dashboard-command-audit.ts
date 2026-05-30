import { queryOne, execute } from "./client";

export interface DashboardCommandAuditInput {
	requestId: string;
	requestedBy?: string;
	sourceIp?: string | null;
	sourceUserAgent?: string | null;
	dashboardSessionId?: string | null;
	command: string;
	argv: string[];
	cwd?: string | null;
	envAllowlist?: string[];
	stdinSha256?: string | null;
	timeoutMs?: number;
	approvedPolicy?: string;
	mutationClass?: string;
	targetScope?: string;
	dryRun?: boolean;
	metadata?: Record<string, unknown>;
}

export interface DashboardCommandAuditCompletion {
	startedAt?: string | null;
	finishedAt?: string | null;
	stdoutSha256?: string | null;
	stderrSha256?: string | null;
	stdoutBytes?: number;
	stderrBytes?: number;
	exitCode?: number | null;
	signal?: string | null;
	status: string;
	error?: string | null;
	journaldCursor?: string | null;
	metadata?: Record<string, unknown>;
}

export async function createDashboardCommandAudit(
	input: DashboardCommandAuditInput,
): Promise<{ id: number; request_id: string }> {
	const row = await queryOne<{ id: number; request_id: string }>(
		`INSERT INTO dashboard_command_audit (
			request_id,
			requested_by,
			source_ip,
			source_user_agent,
			dashboard_session_id,
			command,
			argv,
			cwd,
			env_allowlist,
			stdin_sha256,
			timeout_ms,
			approved_policy,
			mutation_class,
			target_scope,
			dry_run,
			status,
			metadata
		)
		VALUES ($1, $2, $3::inet, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, 'created', $16::jsonb)
		RETURNING id, request_id`,
		[
			input.requestId,
			input.requestedBy ?? "trusted-dashboard",
			input.sourceIp ?? null,
			input.sourceUserAgent ?? null,
			input.dashboardSessionId ?? null,
			input.command,
			JSON.stringify(input.argv),
			input.cwd ?? null,
			JSON.stringify({ names: input.envAllowlist ?? [] }),
			input.stdinSha256 ?? null,
			input.timeoutMs ?? null,
			input.approvedPolicy ?? "trusted-lan-tailnet",
			input.mutationClass ?? "unknown",
			input.targetScope ?? "host",
			input.dryRun ?? false,
			JSON.stringify(input.metadata ?? {}),
		],
	);
	if (!row) throw new Error("Failed to create dashboard command audit row");
	return row;
}

export async function finishDashboardCommandAudit(
	requestId: string,
	completion: DashboardCommandAuditCompletion,
): Promise<void> {
	await execute(
		`UPDATE dashboard_command_audit
		 SET started_at = COALESCE($2::timestamptz, started_at),
		     finished_at = COALESCE($3::timestamptz, finished_at, NOW()),
		     stdout_sha256 = $4,
		     stderr_sha256 = $5,
		     stdout_bytes = $6,
		     stderr_bytes = $7,
		     exit_code = $8,
		     signal = $9,
		     status = $10,
		     error = $11,
		     journald_cursor = $12,
		     metadata = metadata || $13::jsonb
		 WHERE request_id = $1`,
		[
			requestId,
			completion.startedAt ?? null,
			completion.finishedAt ?? null,
			completion.stdoutSha256 ?? null,
			completion.stderrSha256 ?? null,
			completion.stdoutBytes ?? 0,
			completion.stderrBytes ?? 0,
			completion.exitCode ?? null,
			completion.signal ?? null,
			completion.status,
			completion.error ?? null,
			completion.journaldCursor ?? null,
			JSON.stringify(completion.metadata ?? {}),
		],
	);
}
