import { NextResponse } from "next/server";
import { getUptimeStats, getIncidentTransitions } from "@/lib/db/health-log";
import { getAllServices } from "@/lib/db/service";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const serviceIdParam = searchParams.get("service_id");
	const periodParam = searchParams.get("period") as "24h" | "7d" | "30d" | null;
	const period = periodParam && ["24h", "7d", "30d"].includes(periodParam) ? periodParam : "24h";

	try {
		if (serviceIdParam) {
			const serviceId = parseInt(serviceIdParam, 10);
			if (isNaN(serviceId) || serviceId < 1) {
				return NextResponse.json({ error: "Invalid service_id" }, { status: 400 });
			}
			const stats = await getUptimeStats(serviceId, period);
			const incidents = await getIncidentTransitions(serviceId);
			return NextResponse.json({ service_id: serviceId, stats, incidents });
		}

		const services = await getAllServices();
		const results = await Promise.all(
			services.map(async (svc) => {
				const stats = await getUptimeStats(svc.id, period);
				const incidents = await getIncidentTransitions(svc.id);
				return {
					service_id: svc.id,
					slug: svc.slug,
					name: svc.name,
					stats,
					incidents,
				};
			}),
		);
		return NextResponse.json({ services: results, period });
	} catch {
		return NextResponse.json({ error: "Failed to fetch uptime stats" }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
