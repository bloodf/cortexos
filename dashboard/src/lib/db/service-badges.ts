import { query, execute } from "./client";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;

export interface ServiceBadgeRow {
	id: number;
	slug: string;
	label: string;
	color: string;
	text_color: string;
}

export interface ServiceForBadgeRow {
	id: number;
	slug: string;
	name: string;
}

function validateSlug(slug: string): void {
	if (!SLUG_RE.test(slug)) {
		throw new Error(`Invalid badge slug: ${slug}`);
	}
}

function validateServiceId(id: number): void {
	if (!Number.isInteger(id) || id <= 0) {
		throw new Error("serviceId must be a positive integer");
	}
}

export async function listBadgesForService(
	serviceId: number,
): Promise<ServiceBadgeRow[]> {
	validateServiceId(serviceId);
	return query<ServiceBadgeRow>(
		`SELECT b.id, b.slug, b.label, b.color, b.text_color
     FROM service_badges sb
     JOIN badges b ON b.id = sb.badge_id
     WHERE sb.service_id = $1
     ORDER BY b.slug`,
		[serviceId],
	);
}

export async function listServicesForBadge(
	badgeSlug: string,
): Promise<ServiceForBadgeRow[]> {
	validateSlug(badgeSlug);
	return query<ServiceForBadgeRow>(
		`SELECT s.id, s.slug, s.name
     FROM service_badges sb
     JOIN badges b ON b.id = sb.badge_id
     JOIN services s ON s.id = sb.service_id
     WHERE b.slug = $1
     ORDER BY s.slug`,
		[badgeSlug],
	);
}

export async function addBadge(
	serviceId: number,
	badgeSlug: string,
): Promise<void> {
	validateServiceId(serviceId);
	validateSlug(badgeSlug);
	await execute(
		`INSERT INTO service_badges (service_id, badge_id)
     SELECT $1, id FROM badges WHERE slug = $2
     ON CONFLICT (service_id, badge_id) DO NOTHING`,
		[serviceId, badgeSlug],
	);
}

export async function removeBadge(
	serviceId: number,
	badgeSlug: string,
): Promise<void> {
	validateServiceId(serviceId);
	validateSlug(badgeSlug);
	await execute(
		`DELETE FROM service_badges
     WHERE service_id = $1
       AND badge_id = (SELECT id FROM badges WHERE slug = $2)`,
		[serviceId, badgeSlug],
	);
}

export async function setServiceBadges(
	serviceId: number,
	badgeSlugs: string[],
): Promise<void> {
	validateServiceId(serviceId);
	if (!Array.isArray(badgeSlugs)) {
		throw new Error("badgeSlugs must be an array");
	}
	const unique = Array.from(new Set(badgeSlugs));
	for (const s of unique) validateSlug(s);
	await execute("DELETE FROM service_badges WHERE service_id = $1", [serviceId]);
	if (unique.length === 0) return;
	await execute(
		`INSERT INTO service_badges (service_id, badge_id)
     SELECT $1, id FROM badges WHERE slug = ANY($2::text[])
     ON CONFLICT (service_id, badge_id) DO NOTHING`,
		[serviceId, unique],
	);
}
