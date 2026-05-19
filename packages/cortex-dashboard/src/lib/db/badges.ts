import { query, queryOne, execute } from "./client";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface Badge {
	id: number;
	slug: string;
	label: string;
	color: string;
	text_color: string;
	created_at: Date;
	updated_at: Date;
}

export type CreateBadge = {
	slug: string;
	label: string;
	color?: string;
	text_color?: string;
};

export type UpdateBadge = Partial<
	Pick<Badge, "label" | "color" | "text_color">
>;

function validateSlug(slug: string): void {
	if (!SLUG_RE.test(slug)) {
		throw new Error(`Invalid badge slug: ${slug}`);
	}
}

function validateColor(color: string, field: string): void {
	if (!COLOR_RE.test(color)) {
		throw new Error(`Invalid ${field} (expected #RRGGBB): ${color}`);
	}
}

function validateLabel(label: string): void {
	if (!label || label.length > 64) {
		throw new Error("Badge label must be 1..64 chars");
	}
}

export async function listBadges(): Promise<Badge[]> {
	return query<Badge>(
		"SELECT id, slug, label, color, text_color, created_at, updated_at FROM badges ORDER BY slug",
	);
}

export async function getBadgeBySlug(slug: string): Promise<Badge | null> {
	validateSlug(slug);
	return queryOne<Badge>(
		"SELECT id, slug, label, color, text_color, created_at, updated_at FROM badges WHERE slug = $1",
		[slug],
	);
}

export async function getBadgeById(id: number): Promise<Badge | null> {
	return queryOne<Badge>(
		"SELECT id, slug, label, color, text_color, created_at, updated_at FROM badges WHERE id = $1",
		[id],
	);
}

export async function createBadge(data: CreateBadge): Promise<Badge> {
	validateSlug(data.slug);
	validateLabel(data.label);
	const color = data.color ?? "#1f2937";
	const textColor = data.text_color ?? "#ffffff";
	validateColor(color, "color");
	validateColor(textColor, "text_color");
	const row = await queryOne<Badge>(
		`INSERT INTO badges (slug, label, color, text_color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, slug, label, color, text_color, created_at, updated_at`,
		[data.slug, data.label, color, textColor],
	);
	if (!row) throw new Error("Failed to create badge");
	return row;
}

export async function updateBadge(
	slug: string,
	data: UpdateBadge,
): Promise<Badge> {
	validateSlug(slug);
	const fields: string[] = [];
	const values: unknown[] = [];
	let i = 1;
	if (data.label !== undefined) {
		validateLabel(data.label);
		fields.push(`label = $${i++}`);
		values.push(data.label);
	}
	if (data.color !== undefined) {
		validateColor(data.color, "color");
		fields.push(`color = $${i++}`);
		values.push(data.color);
	}
	if (data.text_color !== undefined) {
		validateColor(data.text_color, "text_color");
		fields.push(`text_color = $${i++}`);
		values.push(data.text_color);
	}
	if (fields.length === 0) throw new Error("No valid fields to update");
	fields.push(`updated_at = NOW()`);
	values.push(slug);
	const row = await queryOne<Badge>(
		`UPDATE badges SET ${fields.join(", ")} WHERE slug = $${i} RETURNING id, slug, label, color, text_color, created_at, updated_at`,
		values,
	);
	if (!row) throw new Error(`Badge not found: ${slug}`);
	return row;
}

export async function deleteBadge(slug: string): Promise<void> {
	validateSlug(slug);
	await execute("DELETE FROM badges WHERE slug = $1", [slug]);
}
