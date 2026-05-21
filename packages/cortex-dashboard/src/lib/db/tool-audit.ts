// Append-only. Updates/deletes intentionally not exported.
// DB role lacks UPDATE/DELETE grant on this table.

import { query, queryOne } from "./client";

export type ToolClass = "safe" | "privileged" | "destructive";
export type Decision = "allow" | "deny" | "prompt";
export type AuditResult = "ok" | "err" | "timeout" | "denied";

const TOOL_CLASSES: ReadonlySet<ToolClass> = new Set([
	"safe",
	"privileged",
	"destructive",
]);
const DECISIONS: ReadonlySet<Decision> = new Set(["allow", "deny", "prompt"]);
const RESULTS: ReadonlySet<AuditResult> = new Set([
	"ok",
	"err",
	"timeout",
	"denied",
]);

export interface ToolAuditRow {
	id: number;
	ts: Date;
	actor_user_id: number | null;
	session_id: string | null;
	request_id: string | null;
	role: string | null;
	account: string | null;
	tool: string | null;
	tool_class: ToolClass;
	args_hash: string;
	approval_id: string | null;
	nonce: string | null;
	policy_version: number | null;
	decision: Decision;
	decision_reason: string | null;
	before_state_hash: string | null;
	after_state_hash: string | null;
	latency_ms: number | null;
	result: AuditResult;
}

export interface InsertAuditInput {
	actor_user_id?: number | null;
	session_id?: string | null;
	request_id?: string | null;
	role?: string | null;
	account?: string | null;
	tool?: string | null;
	tool_class: ToolClass;
	args_hash: string;
	approval_id?: string | null;
	nonce?: string | null;
	policy_version?: number | null;
	decision: Decision;
	decision_reason?: string | null;
	before_state_hash?: string | null;
	after_state_hash?: string | null;
	latency_ms?: number | null;
	result: AuditResult;
}

export interface ListAuditFilters {
	actor_user_id?: number;
	role?: string;
	account?: string;
	tool?: string;
	tool_class?: ToolClass;
	decision?: Decision;
	result?: AuditResult;
	since?: Date;
	until?: Date;
	limit?: number;
	offset?: number;
}

const COLUMNS =
	"id, ts, actor_user_id, session_id, request_id, role, account, tool, tool_class, args_hash, approval_id, nonce, policy_version, decision, decision_reason, before_state_hash, after_state_hash, latency_ms, result";

function validateEnum<T extends string>(
	value: string,
	allowed: ReadonlySet<T>,
	field: string,
): asserts value is T {
	if (!allowed.has(value as T)) {
		throw new Error(`Invalid ${field}: ${value}`);
	}
}

export async function insertAuditRow(
	input: InsertAuditInput,
): Promise<ToolAuditRow> {
	validateEnum(input.tool_class, TOOL_CLASSES, "tool_class");
	validateEnum(input.decision, DECISIONS, "decision");
	validateEnum(input.result, RESULTS, "result");
	if (!input.args_hash) {
		throw new Error("args_hash is required");
	}
	const row = await queryOne<ToolAuditRow>(
		`INSERT INTO tool_audit (
       actor_user_id, session_id, request_id, role, account, tool, tool_class,
       args_hash, approval_id, nonce, policy_version, decision, decision_reason,
       before_state_hash, after_state_hash, latency_ms, result
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
     ) RETURNING ${COLUMNS}`,
		[
			input.actor_user_id ?? null,
			input.session_id ?? null,
			input.request_id ?? null,
			input.role ?? null,
			input.account ?? null,
			input.tool ?? null,
			input.tool_class,
			input.args_hash,
			input.approval_id ?? null,
			input.nonce ?? null,
			input.policy_version ?? null,
			input.decision,
			input.decision_reason ?? null,
			input.before_state_hash ?? null,
			input.after_state_hash ?? null,
			input.latency_ms ?? null,
			input.result,
		],
	);
	if (!row) throw new Error("Failed to insert audit row");
	return row;
}

export async function listAudit(
	filters: ListAuditFilters = {},
): Promise<ToolAuditRow[]> {
	const conds: string[] = [];
	const vals: unknown[] = [];
	let i = 1;
	if (filters.actor_user_id !== undefined) {
		conds.push(`actor_user_id = $${i++}`);
		vals.push(filters.actor_user_id);
	}
	if (filters.role !== undefined) {
		conds.push(`role = $${i++}`);
		vals.push(filters.role);
	}
	if (filters.account !== undefined) {
		conds.push(`account = $${i++}`);
		vals.push(filters.account);
	}
	if (filters.tool_class !== undefined) {
		validateEnum(filters.tool_class, TOOL_CLASSES, "tool_class");
		conds.push(`tool_class = $${i++}`);
		vals.push(filters.tool_class);
	}
	if (filters.decision !== undefined) {
		validateEnum(filters.decision, DECISIONS, "decision");
		conds.push(`decision = $${i++}`);
		vals.push(filters.decision);
	}
	if (filters.result !== undefined) {
		validateEnum(filters.result, RESULTS, "result");
		conds.push(`result = $${i++}`);
		vals.push(filters.result);
	}
	if (filters.since) {
		conds.push(`ts >= $${i++}`);
		vals.push(filters.since);
	}
	if (filters.until) {
		conds.push(`ts <= $${i++}`);
		vals.push(filters.until);
	}
	const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
	const limit = Math.max(1, Math.min(filters.limit ?? 100, 1000));
	const offset = Math.max(0, filters.offset ?? 0);
	vals.push(limit);
	const limitParam = i++;
	vals.push(offset);
	const offsetParam = i;
	return query<ToolAuditRow>(
		`SELECT ${COLUMNS} FROM tool_audit ${where} ORDER BY ts DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
		vals,
	);
}

export async function countAudit(
	filters: Omit<ListAuditFilters, "limit" | "offset"> = {},
): Promise<number> {
	const conds: string[] = [];
	const vals: unknown[] = [];
	let i = 1;
	if (filters.actor_user_id !== undefined) {
		conds.push(`actor_user_id = $${i++}`);
		vals.push(filters.actor_user_id);
	}
	if (filters.role !== undefined) {
		conds.push(`role = $${i++}`);
		vals.push(filters.role);
	}
	if (filters.account !== undefined) {
		conds.push(`account = $${i++}`);
		vals.push(filters.account);
	}
	if (filters.tool_class !== undefined) {
		validateEnum(filters.tool_class, TOOL_CLASSES, "tool_class");
		conds.push(`tool_class = $${i++}`);
		vals.push(filters.tool_class);
	}
	if (filters.decision !== undefined) {
		validateEnum(filters.decision, DECISIONS, "decision");
		conds.push(`decision = $${i++}`);
		vals.push(filters.decision);
	}
	if (filters.result !== undefined) {
		validateEnum(filters.result, RESULTS, "result");
		conds.push(`result = $${i++}`);
		vals.push(filters.result);
	}
	if (filters.since) {
		conds.push(`ts >= $${i++}`);
		vals.push(filters.since);
	}
	if (filters.until) {
		conds.push(`ts <= $${i++}`);
		vals.push(filters.until);
	}
	const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
	const row = await queryOne<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM tool_audit ${where}`,
		vals,
	);
	return row ? parseInt(row.count, 10) : 0;
}
