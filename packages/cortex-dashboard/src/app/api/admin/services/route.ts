import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { requireAuth, requireAdmin } from "@/lib/auth";
import {
	createService,
	updateService,
	deleteService,
} from "@/lib/db/service";
import type { Service } from "@/lib/db/service";
import { hostExecFile } from "@/lib/host-exec";
import { VALID_HEALTH_TYPES, SLUG_RE, HEX_COLOR_RE } from "@/lib/validation";

const SAFE_NAME_RE = /^[a-zA-Z0-9._@:-]+$/;

async function startRuntimeService(service: Service): Promise<string | null> {
	const target = service.health_url || service.slug;
	if (!SAFE_NAME_RE.test(target)) return `Skipped runtime start: unsafe target ${target}`;
	try {
		if (service.health_type === "docker" || service.kind === "docker") {
			await hostExecFile("docker", ["start", target], { timeout: 10000 });
			return null;
		}
		if (service.health_type === "systemd") {
			await hostExecFile("systemctl", ["start", target], { timeout: 10000 });
			return null;
		}
		return null;
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return `Runtime start failed for ${target}: ${message}`;
	}
}

export async function GET(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const includeInactive = searchParams.get("all") === "1";

	const sql = includeInactive
		? `SELECT id, slug, name, open_url, health_url, health_type, category, icon_type, icon_color, icon_image, sort_order, is_active, has_webui, show_in_healthcheck, show_in_webui FROM services ORDER BY category, sort_order, name`
		: `SELECT id, slug, name, open_url, health_url, health_type, category, icon_type, icon_color, icon_image, sort_order, is_active, has_webui, show_in_healthcheck, show_in_webui FROM services WHERE is_active = true ORDER BY category, sort_order, name`;

	const services = await query<Service>(sql);
	return NextResponse.json({ services });
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "service.create" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const slug = String(body.slug || "").trim();
		const name = String(body.name || "").trim();

		if (!slug || !SLUG_RE.test(slug)) {
			return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
		}
		if (!name || name.length > 128) {
			return NextResponse.json({ error: "Name required (max 128 chars)" }, { status: 400 });
		}

		const healthType = String(body.health_type || body.check_type || "http");
		if (!VALID_HEALTH_TYPES.has(healthType)) {
			return NextResponse.json({ error: "Invalid health check type" }, { status: 400 });
		}

		const open_url = String(body.open_url || body.url || "#").slice(0, 2048);
		const healthUrl = String(body.health_url || body.check_target || body.url || "#").slice(0, 2048);
		const category = String(body.category || "Infrastructure").slice(0, 64);

		let iconColor: string | null = null;
		if (body.icon_color !== undefined && body.icon_color !== null) {
			const color = String(body.icon_color);
			if (color && !HEX_COLOR_RE.test(color)) {
				return NextResponse.json({ error: "Invalid icon_color format (must be #rrggbb)" }, { status: 400 });
			}
			iconColor = color || null;
		}

		const service = await createService({
			slug,
			name: name.slice(0, 128),
			kind: String(body.kind || "service") as Service["kind"],
			open_url,
			health_url: healthUrl,
			health_type: healthType as Service["health_type"],
			category,
			description: body.description ? String(body.description).slice(0, 512) : null,
			env_source: body.env_source ? String(body.env_source).slice(0, 512) : null,
			icon_type: String(body.icon_type || "auto").slice(0, 32),
			icon_color: iconColor,
			icon_image: body.icon_image === undefined ? null : String(body.icon_image || "").slice(0, 2048) || null,
			sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
			is_active: body.is_active !== false,
			has_webui: body.has_webui !== false,
			show_in_healthcheck: body.show_in_healthcheck !== false,
			show_in_webui: body.show_in_webui !== false,
		});
		return NextResponse.json({ service }, { status: 201 });
	} catch {
		return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireAdmin(request, { tool: "service.update" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const id = parseInt(String(body.id || ""), 10);
		if (!id || isNaN(id) || id < 1) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400 });
		}

		const updates: Record<string, unknown> = {};
		if (body.name !== undefined) {
			const name = String(body.name).trim();
			if (!name || name.length > 128) {
				return NextResponse.json({ error: "Name required (max 128 chars)" }, { status: 400 });
			}
			updates.name = name;
		}
		if (body.slug !== undefined) {
			const slug = String(body.slug).trim();
			if (!SLUG_RE.test(slug)) {
				return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
			}
			updates.slug = slug;
		}
		if (body.category !== undefined) {
			updates.category = String(body.category).slice(0, 64);
		}
		if (body.url !== undefined) {
			updates.open_url = String(body.url).slice(0, 2048);
		}
		if (body.health_url !== undefined) {
			updates.health_url = String(body.health_url).slice(0, 2048);
		}
		if (body.health_type !== undefined || body.check_type !== undefined) {
			const ht = String(body.health_type || body.check_type);
			if (!VALID_HEALTH_TYPES.has(ht)) {
				return NextResponse.json({ error: "Invalid health check type" }, { status: 400 });
			}
			updates.health_type = ht;
		}
		if (body.icon_type !== undefined) {
			updates.icon_type = String(body.icon_type).slice(0, 32);
		}
		if (body.icon_color !== undefined) {
			if (body.icon_color === null) {
				updates.icon_color = null;
			} else {
				const color = String(body.icon_color);
				if (color && !HEX_COLOR_RE.test(color)) {
					return NextResponse.json({ error: "Invalid icon_color format (must be #rrggbb)" }, { status: 400 });
				}
				updates.icon_color = color || null;
			}
		}
		if (body.icon_image !== undefined) {
			updates.icon_image = body.icon_image === null ? null : String(body.icon_image).slice(0, 2048) || null;
		}
		if (body.sort_order !== undefined) {
			updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : parseInt(String(body.sort_order), 10);
		}
		if (body.is_active !== undefined) {
			updates.is_active = Boolean(body.is_active);
		}
		if (body.has_webui !== undefined) {
			updates.has_webui = Boolean(body.has_webui);
		}
		if (body.show_in_healthcheck !== undefined) {
			updates.show_in_healthcheck = Boolean(body.show_in_healthcheck);
		}
		if (body.show_in_webui !== undefined) {
			updates.show_in_webui = Boolean(body.show_in_webui);
		}

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400 });
		}

			const service = await updateService(id, updates);
			const warning = updates.is_active === true ? await startRuntimeService(service) : null;
			return NextResponse.json(warning ? { service, warning } : { service });
	} catch {
		return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "service.delete" });
	if (auth.error) return auth.error;

	try {
		const { searchParams } = new URL(request.url);
		const id = parseInt(searchParams.get("id") || "", 10);
		if (!id || isNaN(id) || id < 1) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400 });
		}
		await deleteService(id);
		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
