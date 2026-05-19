import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listBadges, getBadgeBySlug, createBadge, updateBadge, deleteBadge } from "@/lib/db/badges";
import type { CreateBadge, UpdateBadge } from "@/lib/db/badges";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const slug = searchParams.get("slug");

	if (slug) {
		const badge = await getBadgeBySlug(slug);
		if (!badge) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		return NextResponse.json({ badge });
	}

	const badges = await listBadges();
	return NextResponse.json({ badges });
}

export async function POST(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const slug = String(body.slug || "").trim();
		const label = String(body.label || "").trim();
		const color: string | undefined = body.color ? String(body.color).trim() : undefined;
		const text_color: string | undefined = body.text_color ? String(body.text_color).trim() : undefined;

		if (!slug) {
			return NextResponse.json({ error: "slug required" }, { status: 400 });
		}
		if (!label || label.length > 64) {
			return NextResponse.json({ error: "label required (max 64 chars)" }, { status: 400 });
		}

		const data: CreateBadge = { slug, label, ...(color ? { color } : {}), ...(text_color ? { text_color } : {}) };
		const badge = await createBadge(data);
		return NextResponse.json({ badge }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to create badge";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function PUT(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	try {
		const { searchParams } = new URL(request.url);
		const slug = searchParams.get("slug") || "";
		if (!slug) {
			return NextResponse.json({ error: "slug query param required" }, { status: 400 });
		}

		const body = await request.json();
		const updates: UpdateBadge = {};
		if (body.label !== undefined) updates.label = String(body.label).trim();
		if (body.color !== undefined) updates.color = String(body.color).trim();
		if (body.text_color !== undefined) updates.text_color = String(body.text_color).trim();

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400 });
		}

		const badge = await updateBadge(slug, updates);
		return NextResponse.json({ badge });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to update badge";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	try {
		const { searchParams } = new URL(request.url);
		const slug = searchParams.get("slug") || "";
		if (!slug) {
			return NextResponse.json({ error: "slug query param required" }, { status: 400 });
		}
		await deleteBadge(slug);
		return NextResponse.json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to delete badge";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export const dynamic = "force-dynamic";
