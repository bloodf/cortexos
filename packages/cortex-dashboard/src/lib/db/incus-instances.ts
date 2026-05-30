/**
 * CRUD for the `incus_instances` table — saved wizard configs + lifecycle.
 *
 * Mirrors the shape/conventions of `src/lib/db/projects.ts`. The `config`
 * column is stored as opaque JSONB here (the typed IncusInstanceConfig shape
 * lives in `src/lib/incus/instance-config.ts`); this module stays storage-only.
 */
import { query, queryOne, execute } from "./client";

// Same instance-name rule used by the incus API routes and the wizard.
export const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;

export type IncusInstanceStatus =
	| "draft"
	| "validated"
	| "provisioning"
	| "active"
	| "failed";

const STATUSES: ReadonlySet<IncusInstanceStatus> = new Set([
	"draft",
	"validated",
	"provisioning",
	"active",
	"failed",
]);

export interface IncusInstanceRow {
	id: number;
	name: string;
	slug: string | null;
	status: IncusInstanceStatus;
	config: Record<string, unknown>;
	last_validation: Record<string, unknown> | null;
	last_request_id: string | null;
	created_by: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface CreateIncusInstanceInput {
	name: string;
	slug?: string | null;
	config: Record<string, unknown>;
	created_by?: string | null;
	status?: IncusInstanceStatus;
}

const COLUMNS =
	"id, name, slug, status, config, last_validation, last_request_id, created_by, created_at, updated_at";

function validateName(name: string): void {
	if (!SAFE_NAME_RE.test(name)) {
		throw new Error(`Invalid instance name: ${name}`);
	}
}

function validateStatus(status: string): asserts status is IncusInstanceStatus {
	if (!STATUSES.has(status as IncusInstanceStatus)) {
		throw new Error(`Invalid status: ${status}`);
	}
}

export async function getIncusInstance(
	name: string,
): Promise<IncusInstanceRow | null> {
	validateName(name);
	return queryOne<IncusInstanceRow>(
		`SELECT ${COLUMNS} FROM incus_instances WHERE name = $1`,
		[name],
	);
}

export async function listIncusInstances(): Promise<IncusInstanceRow[]> {
	return query<IncusInstanceRow>(
		`SELECT ${COLUMNS} FROM incus_instances ORDER BY created_at DESC, id DESC`,
	);
}

export async function createIncusInstance(
	input: CreateIncusInstanceInput,
): Promise<IncusInstanceRow> {
	validateName(input.name);
	const status = input.status ?? "draft";
	validateStatus(status);
	const row = await queryOne<IncusInstanceRow>(
		`INSERT INTO incus_instances (name, slug, status, config, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING ${COLUMNS}`,
		[
			input.name,
			input.slug ?? null,
			status,
			JSON.stringify(input.config ?? {}),
			input.created_by ?? null,
		],
	);
	if (!row) throw new Error("Failed to create incus instance");
	return row;
}

export async function updateIncusInstanceStatus(
	name: string,
	status: IncusInstanceStatus,
	patch: { lastRequestId?: string | null } = {},
): Promise<IncusInstanceRow> {
	validateName(name);
	validateStatus(status);
	const fields = ["status = $2", "updated_at = NOW()"];
	const values: unknown[] = [name, status];
	if (patch.lastRequestId !== undefined) {
		fields.push(`last_request_id = $${values.length + 1}`);
		values.push(patch.lastRequestId);
	}
	const row = await queryOne<IncusInstanceRow>(
		`UPDATE incus_instances SET ${fields.join(", ")} WHERE name = $1 RETURNING ${COLUMNS}`,
		values,
	);
	if (!row) throw new Error(`Incus instance not found: ${name}`);
	return row;
}

export async function setLastValidation(
	name: string,
	result: Record<string, unknown>,
): Promise<void> {
	validateName(name);
	await execute(
		`UPDATE incus_instances SET last_validation = $2::jsonb, updated_at = NOW() WHERE name = $1`,
		[name, JSON.stringify(result)],
	);
}

export async function deleteIncusInstance(name: string): Promise<void> {
	validateName(name);
	await execute("DELETE FROM incus_instances WHERE name = $1", [name]);
}
