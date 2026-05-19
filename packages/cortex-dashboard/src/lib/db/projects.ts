import { query, queryOne, execute } from "./client";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;
const MESSAGING_MODES: ReadonlySet<MessagingMode> = new Set([
	"single",
	"distributed",
]);

export type MessagingMode = "single" | "distributed";

export interface Project {
	id: number;
	slug: string;
	name: string;
	repo_url: string | null;
	primary_pm_account: string | null;
	messaging_mode: MessagingMode;
	settings: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
}

export interface CreateProjectInput {
	slug: string;
	name: string;
	repo_url?: string | null;
	primary_pm_account?: string | null;
	messaging_mode?: MessagingMode;
	settings?: Record<string, unknown>;
}

export type UpdateProjectInput = Partial<
	Omit<CreateProjectInput, "slug">
>;

const COLUMNS =
	"id, slug, name, repo_url, primary_pm_account, messaging_mode, settings, created_at, updated_at";

function validateSlug(slug: string): void {
	if (!SLUG_RE.test(slug)) {
		throw new Error(`Invalid project slug: ${slug}`);
	}
}

function validateMode(mode: string): asserts mode is MessagingMode {
	if (!MESSAGING_MODES.has(mode as MessagingMode)) {
		throw new Error(`Invalid messaging_mode: ${mode}`);
	}
}

function validateName(name: string): void {
	if (!name || name.length > 255) {
		throw new Error("Project name must be 1..255 chars");
	}
}

export async function getProject(slug: string): Promise<Project | null> {
	validateSlug(slug);
	return queryOne<Project>(
		`SELECT ${COLUMNS} FROM projects WHERE slug = $1`,
		[slug],
	);
}

export async function listProjects(): Promise<Project[]> {
	return query<Project>(`SELECT ${COLUMNS} FROM projects ORDER BY slug`);
}

export async function createProject(
	input: CreateProjectInput,
): Promise<Project> {
	validateSlug(input.slug);
	validateName(input.name);
	const mode = input.messaging_mode ?? "single";
	validateMode(mode);
	const row = await queryOne<Project>(
		`INSERT INTO projects (slug, name, repo_url, primary_pm_account, messaging_mode, settings)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING ${COLUMNS}`,
		[
			input.slug,
			input.name,
			input.repo_url ?? null,
			input.primary_pm_account ?? null,
			mode,
			JSON.stringify(input.settings ?? {}),
		],
	);
	if (!row) throw new Error("Failed to create project");
	return row;
}

export async function updateProject(
	slug: string,
	patch: UpdateProjectInput,
): Promise<Project> {
	validateSlug(slug);
	const fields: string[] = [];
	const values: unknown[] = [];
	let i = 1;
	if (patch.name !== undefined) {
		validateName(patch.name);
		fields.push(`name = $${i++}`);
		values.push(patch.name);
	}
	if (patch.repo_url !== undefined) {
		fields.push(`repo_url = $${i++}`);
		values.push(patch.repo_url);
	}
	if (patch.primary_pm_account !== undefined) {
		fields.push(`primary_pm_account = $${i++}`);
		values.push(patch.primary_pm_account);
	}
	if (patch.messaging_mode !== undefined) {
		validateMode(patch.messaging_mode);
		fields.push(`messaging_mode = $${i++}`);
		values.push(patch.messaging_mode);
	}
	if (patch.settings !== undefined) {
		fields.push(`settings = $${i++}::jsonb`);
		values.push(JSON.stringify(patch.settings));
	}
	if (fields.length === 0) throw new Error("No valid fields to update");
	fields.push(`updated_at = NOW()`);
	values.push(slug);
	const row = await queryOne<Project>(
		`UPDATE projects SET ${fields.join(", ")} WHERE slug = $${i} RETURNING ${COLUMNS}`,
		values,
	);
	if (!row) throw new Error(`Project not found: ${slug}`);
	return row;
}

export async function deleteProject(slug: string): Promise<void> {
	validateSlug(slug);
	await execute("DELETE FROM projects WHERE slug = $1", [slug]);
}
