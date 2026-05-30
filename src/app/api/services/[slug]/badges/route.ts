import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getServiceBySlug } from "@/lib/db/service";
import { listBadgesForService, setServiceBadges } from "@/lib/db/service-badges";

interface RouteParams {
	params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
	const { slug } = await params;
	const service = await getServiceBySlug(slug);
	if (!service) {
		return NextResponse.json({ error: "Service not found" }, { status: 404 });
	}
	const badges = await listBadgesForService(service.id);
	return NextResponse.json({ badges });
}

export async function PUT(request: Request, { params }: RouteParams) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	const { slug } = await params;
	const service = await getServiceBySlug(slug);
	if (!service) {
		return NextResponse.json({ error: "Service not found" }, { status: 404 });
	}

	try {
		const body = await request.json();
		if (!Array.isArray(body.slugs)) {
			return NextResponse.json({ error: "slugs array required" }, { status: 400 });
		}
		const slugs: string[] = body.slugs.map((s: unknown) => String(s));
		await setServiceBadges(service.id, slugs);
		const badges = await listBadgesForService(service.id);
		return NextResponse.json({ badges });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to update badges";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export const dynamic = "force-dynamic";
