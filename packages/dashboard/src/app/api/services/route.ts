import { NextResponse } from "next/server";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getAllServices, createService, updateService, deleteService } from "@/lib/db/service";
import type { Service } from "@/lib/db/service";
import { requireAuth } from "@/lib/auth";
import { hostExecFile } from "@/lib/host-exec";
import { VALID_HEALTH_TYPES, SLUG_RE, HEX_COLOR_RE, DATA_IMAGE_PREFIX, MAX_ICON_IMAGE_LENGTH } from "@/lib/validation";

interface ServiceCheck {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	category: string;
	status: "online" | "offline" | "unknown";
	responseTime: number;
	icon_color: string | null;
	icon_image: string | null;
}

const SAFE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

async function checkTcp(
	host: string,
	port: number,
	timeoutMs: number,
): Promise<boolean> {
	const net = await import("net");
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.setTimeout(timeoutMs);
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => {
			socket.destroy();
			resolve(false);
		});
		socket.once("timeout", () => {
			socket.destroy();
			resolve(false);
		});
		socket.connect(port, host);
	});
}

async function checkDocker(containerPattern: string): Promise<boolean> {
	if (!SAFE_NAME_RE.test(containerPattern)) return false;
	try {
		const { stdout } = await hostExecFile(
			"docker",
			["ps", "--filter", `name=${containerPattern}`, "--format", "{{.Status}}"],
			{ timeout: 5000 },
		);
		return stdout.includes("Up");
	} catch {
		return false;
	}
}

async function checkProcess(pattern: string): Promise<boolean> {
	if (!SAFE_NAME_RE.test(pattern)) return false;
	try {
		await hostExecFile("pgrep", ["-f", pattern], { timeout: 3000 });
		return true;
	} catch {
		return false;
	}
}

async function checkSystemd(unit: string): Promise<boolean> {
	if (!SAFE_NAME_RE.test(unit)) return false;
	try {
		const { stdout } = await hostExecFile("systemctl", ["is-active", unit], {
			timeout: 3000,
		});
		return stdout.trim() === "active";
	} catch {
		return false;
	}
}

function buildResult(svc: Service, status: ServiceCheck["status"], start: number): ServiceCheck {
	return {
		id: svc.id,
		slug: svc.slug,
		name: svc.name,
		open_url: svc.open_url,
		category: svc.category,
		status,
		responseTime: status === "offline" ? -1 : Date.now() - start,
		icon_color: svc.icon_color,
		icon_image: svc.icon_image,
	};
}

async function checkService(svc: Service): Promise<ServiceCheck> {
	const start = Date.now();

	if (svc.health_type === "tcp") {
		const [host, portStr] = svc.health_url.replace("tcp://", "").split(":");
		const ok = await checkTcp(host, parseInt(portStr, 10), 3000);
		return buildResult(svc, ok ? "online" : "offline", start);
	}

	if (svc.health_type === "docker") {
		const ok = await checkDocker(svc.health_url);
		return buildResult(svc, ok ? "online" : "offline", start);
	}

	if (svc.health_type === "process") {
		const ok = await checkProcess(svc.health_url);
		return buildResult(svc, ok ? "online" : "offline", start);
	}

	if (svc.health_type === "systemd") {
		const ok = await checkSystemd(svc.health_url);
		return buildResult(svc, ok ? "online" : "offline", start);
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const res = await fetch(svc.health_url, {
			method: "GET",
			signal: controller.signal,
			cache: "no-store",
		});
		clearTimeout(timeout);
		const ok = res.ok || res.status === 401 || res.status === 403;
		return buildResult(svc, ok ? "online" : "offline", start);
	} catch {
		return buildResult(svc, "offline", start);
	}
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const raw = searchParams.get("raw");
	const checkType = searchParams.get("check_type") || searchParams.get("health_type");
	const webui = searchParams.get("webui");
	const healthcheck = searchParams.get("healthcheck");

	let services = await getAllServices();

	if (checkType) {
		services = services.filter((s) => s.health_type === checkType);
	}
	if (webui === "true") {
		services = services.filter((s) => s.has_webui || s.show_in_webui);
	}
	if (healthcheck === "true") {
		services = services.filter((s) => s.show_in_healthcheck);
	}

	if (raw === "1") {
		return NextResponse.json({ services, timestamp: Date.now() });
	}

	const results = await Promise.all(services.map(checkService));
	return NextResponse.json({ services: results, timestamp: Date.now() });
}


async function saveImage(base64Uri: string, slug: string): Promise<string> {
	if (!base64Uri.startsWith(DATA_IMAGE_PREFIX)) return base64Uri;
	const match = base64Uri.match(/^data:image\/(\w+);base64,/);
	if (!match) return base64Uri;
	const ext = match[1];
	const base64Data = base64Uri.replace(/^data:image\/\w+;base64,/, "");
	const uploadsDir = path.join(process.cwd(), "public", "uploads");
	if (!existsSync(uploadsDir)) {
		await fs.mkdir(uploadsDir, { recursive: true });
	}
	const filename = `${slug}-${Date.now()}.${ext}`;
	await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(base64Data, "base64"));
	return `/uploads/${filename}`;
}

export async function POST(request: Request) {
	const auth = await requireAuth(request);
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

		const healthType = String(body.check_type || "http");
		if (!VALID_HEALTH_TYPES.has(healthType)) {
			return NextResponse.json({ error: "Invalid health check type" }, { status: 400 });
		}

		const open_url = String(body.open_url || body.url || "#").slice(0, 2048);
		const healthUrl = String(body.check_target || body.health_url || body.url || "#").slice(0, 2048);
		const category = String(body.category || "Infrastructure").slice(0, 64);

		let iconColor: string | null = null;
		if (body.icon_color !== undefined && body.icon_color !== null) {
			const color = String(body.icon_color);
			if (color && !HEX_COLOR_RE.test(color)) {
				return NextResponse.json({ error: "Invalid icon_color format (must be #rrggbb)" }, { status: 400 });
			}
			iconColor = color || null;
		}

		let iconImage: string | null = null;
		if (body.icon_image !== undefined && body.icon_image !== null) {
			const img = String(body.icon_image);
			if (img) {
				if (!img.startsWith(DATA_IMAGE_PREFIX)) {
					return NextResponse.json({ error: "icon_image must be a data:image/ URI" }, { status: 400 });
				}
				if (img.length > MAX_ICON_IMAGE_LENGTH) {
					return NextResponse.json({ error: "icon_image too large (max 350KB)" }, { status: 400 });
				}
				iconImage = await saveImage(img, slug);
			}
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
			icon_type: "auto",
			icon_color: iconColor,
			icon_image: iconImage,
			sort_order: 0,
			is_active: body.enabled !== false,
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
	const auth = await requireAuth(request);
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
		if (body.health_url !== undefined) {
			updates.health_url = String(body.health_url).slice(0, 2048);
		}
		if (body.health_type !== undefined) {
			if (!VALID_HEALTH_TYPES.has(String(body.health_type))) {
				return NextResponse.json({ error: "Invalid health check type" }, { status: 400 });
			}
			updates.health_type = body.health_type;
		}
		if (body.is_active !== undefined) {
			updates.is_active = Boolean(body.is_active);
		}
		if (body.open_url !== undefined || body.url !== undefined) {
			updates.open_url = String(body.open_url ?? body.url).slice(0, 2048);
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
			if (body.icon_image === null) {
				updates.icon_image = null;
			} else {
				const img = String(body.icon_image);
				if (img) {
					if (!img.startsWith(DATA_IMAGE_PREFIX) && !img.startsWith("/uploads/")) {
						return NextResponse.json({ error: "icon_image must be a data:image/ URI or /uploads/" }, { status: 400 });
					}
					if (img.startsWith(DATA_IMAGE_PREFIX)) {
						if (img.length > MAX_ICON_IMAGE_LENGTH) {
							return NextResponse.json({ error: "icon_image too large (max 350KB)" }, { status: 400 });
						}
						const fileSlug = updates.slug ? String(updates.slug) : `service-${id}`;
						updates.icon_image = saveImage(img, fileSlug);
					} else {
						updates.icon_image = img;
					}
				} else {
					updates.icon_image = null;
				}
			}
		}

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400 });
		}

		const service = await updateService(id, updates);
		return NextResponse.json({ service });
	} catch {
		return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAuth(request);
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
