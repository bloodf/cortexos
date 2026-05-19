import { query, queryOne, execute } from "./client";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,126}[a-z0-9]$/;
const KINDS: ReadonlySet<AgentFactoryKind> = new Set([
	"role",
	"workflow",
	"pipeline",
	"project",
]);

export type AgentFactoryKind = "role" | "workflow" | "pipeline" | "project";

export interface AgentFactory {
	id: number;
	slug: string;
	name: string;
	kind: AgentFactoryKind;
	schema_version: number;
	definition: Record<string, unknown>;
	created_by: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface UpsertAgentFactoryInput {
	slug: string;
	name: string;
	kind: AgentFactoryKind;
	schema_version?: number;
	definition?: Record<string, unknown>;
	created_by?: string | null;
}

const COLUMNS =
	"id, slug, name, kind, schema_version, definition, created_by, created_at, updated_at";

function validateSlug(slug: string): void {
	if (!SLUG_RE.test(slug)) {
		throw new Error(`Invalid agent factory slug: ${slug}`);
	}
}

function validateKind(kind: string): asserts kind is AgentFactoryKind {
	if (!KINDS.has(kind as AgentFactoryKind)) {
		throw new Error(`Invalid agent factory kind: ${kind}`);
	}
}

export async function getAgentFactory(
	slug: string,
): Promise<AgentFactory | null> {
	validateSlug(slug);
	return queryOne<AgentFactory>(
		`SELECT ${COLUMNS} FROM agent_factories WHERE slug = $1`,
		[slug],
	);
}

export async function listAgentFactories(
	opts: { kind?: AgentFactoryKind } = {},
): Promise<AgentFactory[]> {
	if (opts.kind) {
		validateKind(opts.kind);
		return query<AgentFactory>(
			`SELECT ${COLUMNS} FROM agent_factories WHERE kind = $1 ORDER BY slug`,
			[opts.kind],
		);
	}
	return query<AgentFactory>(
		`SELECT ${COLUMNS} FROM agent_factories ORDER BY kind, slug`,
	);
}

export async function upsertAgentFactory(
	input: UpsertAgentFactoryInput,
): Promise<AgentFactory> {
	validateSlug(input.slug);
	validateKind(input.kind);
	if (!input.name || input.name.length > 255) {
		throw new Error("Agent factory name must be 1..255 chars");
	}
	const schemaVersion = input.schema_version ?? 1;
	if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
		throw new Error("schema_version must be a positive integer");
	}
	const definition = input.definition ?? {};
	const row = await queryOne<AgentFactory>(
		`INSERT INTO agent_factories (slug, name, kind, schema_version, definition, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       schema_version = EXCLUDED.schema_version,
       definition = EXCLUDED.definition,
       updated_at = NOW()
     RETURNING ${COLUMNS}`,
		[
			input.slug,
			input.name,
			input.kind,
			schemaVersion,
			JSON.stringify(definition),
			input.created_by ?? null,
		],
	);
	if (!row) throw new Error("Failed to upsert agent factory");
	return row;
}

export async function deleteAgentFactory(slug: string): Promise<void> {
	validateSlug(slug);
	await execute("DELETE FROM agent_factories WHERE slug = $1", [slug]);
}
