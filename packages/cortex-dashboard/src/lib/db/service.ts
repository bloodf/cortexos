import { query, queryOne, execute } from "./client";

export type ServiceKind = "app" | "service" | "docker" | "process";
export type HealthType = "http" | "tcp" | "docker" | "process" | "systemd";

export interface Service {
	id: number;
	slug: string;
	name: string;
	kind: ServiceKind;
	category: string;
	description: string | null;
	health_url: string;
	health_type: HealthType;
	open_url: string;
	env_source: string | null;
	status: string;
	last_check_at: Date | null;
	response_ms: number | null;
	uptime_24h: number | null;
	icon_type: string;
	icon_color: string | null;
	icon_image: string | null;
	sort_order: number;
	is_active: boolean;
	has_webui: boolean;
	show_in_healthcheck: boolean;
	show_in_webui: boolean;
	badges?: { id: number; slug: string; label: string; color: string; text_color: string }[];
}

const COLUMNS =
	"id, slug, name, kind, category, description, health_url, health_type, open_url, env_source, status, last_check_at, response_ms, uptime_24h, icon_type, icon_color, icon_image, sort_order, is_active, has_webui, show_in_healthcheck, show_in_webui";

export async function getAllServices(): Promise<Service[]> {
	return query<Service>(
		`SELECT ${COLUMNS} FROM services WHERE is_active = true ORDER BY category, sort_order, name`,
	);
}

export async function getAllServicesForAdmin(): Promise<Service[]> {
	return query<Service>(
		`SELECT ${COLUMNS} FROM services ORDER BY category, sort_order, name`,
	);
}

export async function getServicesByCategory(
	category: string,
): Promise<Service[]> {
	return query<Service>(
		`SELECT ${COLUMNS} FROM services WHERE is_active = true AND category = $1 ORDER BY sort_order, name`,
		[category],
	);
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
	return queryOne<Service>(
		`SELECT ${COLUMNS} FROM services WHERE slug = $1`,
		[slug],
	);
}

export async function getCategories(): Promise<string[]> {
	const rows = await query<{ category: string }>(
		"SELECT DISTINCT category FROM services WHERE is_active = true ORDER BY category",
	);
	return rows.map((r) => r.category);
}

export type CreateServiceInput = Omit<
	Service,
	"id" | "created_at" | "updated_at" | "badges" | "last_check_at" | "response_ms" | "uptime_24h" | "status"
> & {
	status?: string;
};

export async function createService(
	data: CreateServiceInput,
): Promise<Service> {
	const row = await queryOne<Service>(
		`INSERT INTO services (slug, name, kind, category, description, health_url, health_type, open_url, env_source, status, icon_type, icon_color, icon_image, sort_order, is_active, has_webui, show_in_healthcheck, show_in_webui)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING ${COLUMNS}`,
		[
			data.slug,
			data.name,
			data.kind,
			data.category,
			data.description ?? null,
			data.health_url,
			data.health_type,
			data.open_url,
			data.env_source ?? null,
			data.status ?? "unknown",
			data.icon_type,
			data.icon_color,
			data.icon_image,
			data.sort_order,
			data.is_active,
			data.has_webui ?? true,
			data.show_in_healthcheck ?? true,
			data.show_in_webui ?? true,
		],
	);
	if (!row) {
		throw new Error("Failed to create service: database returned no row");
	}
	return row;
}

const ALLOWED_COLUMNS = new Set<string>([
	"slug",
	"name",
	"kind",
	"category",
	"description",
	"health_url",
	"health_type",
	"open_url",
	"env_source",
	"status",
	"last_check_at",
	"response_ms",
	"uptime_24h",
	"icon_type",
	"icon_color",
	"icon_image",
	"sort_order",
	"is_active",
	"has_webui",
	"show_in_healthcheck",
	"show_in_webui",
]);

export async function updateService(
	id: number,
	data: Partial<Omit<Service, "id" | "created_at" | "updated_at" | "badges">>,
): Promise<Service> {
	const fields: string[] = [];
	const values: unknown[] = [];
	let i = 1;

	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
			fields.push(`${key} = $${i}`);
			values.push(value);
			i++;
		}
	}

	if (fields.length === 0) throw new Error("No valid fields to update");

	fields.push(`updated_at = NOW()`);
	values.push(id);

	const row = await queryOne<Service>(
		`UPDATE services SET ${fields.join(", ")} WHERE id = $${i} RETURNING ${COLUMNS}`,
		values,
	);
	if (!row) {
		throw new Error(`Service not found for update with id: ${id}`);
	}
	return row;
}

export async function deleteService(id: number): Promise<void> {
	await execute("DELETE FROM services WHERE id = $1", [id]);
}
