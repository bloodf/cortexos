import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db/client";

const DEFAULT_LAYOUT = {
	rows: [
		{ items: ["cpu-gauge", "cpu-temperature", "memory-gauge", "storage-gauge"] },
		{ items: ["machine-sensors"] },
		{ items: ["service-online", "service-offline", "service-idle", "alerts"] },
		{ items: ["mail-guardian", "mail-guardian-reviews"] },
		{ items: ["database-ops", "monitoring-ops", "container-ops", "docker-status"] },
		{
			items: [
				{
					type: "container",
					id: "overview-performance",
					direction: "row",
					items: [
						"live-performance",
						{ type: "container", id: "overview-side", direction: "column", items: ["top-processes", "network-graph"] },
					],
				},
			],
		},
		{ items: ["total-download", "total-upload", "uptime"] },
	],
};

export async function GET() {
	try {
		const row = await queryOne<{ layout: unknown }>(
			"SELECT layout FROM dashboard_layouts WHERE user_id = 1",
		);
		return NextResponse.json({
			layout: row?.layout ?? DEFAULT_LAYOUT,
			timestamp: Date.now(),
		});
	} catch {
		return NextResponse.json({ layout: DEFAULT_LAYOUT });
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		if (!body.layout || typeof body.layout !== "object") {
			return NextResponse.json({ error: "Invalid layout" }, { status: 400 });
		}
		const serialized = JSON.stringify(body.layout);
		if (serialized.length > 65536) {
			return NextResponse.json({ error: "Layout too large" }, { status: 400 });
		}
		await execute(
			`INSERT INTO dashboard_layouts (user_id, layout, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET layout = $1, updated_at = NOW()`,
			[serialized],
		);
		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json({ error: "Failed to save layout" }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
