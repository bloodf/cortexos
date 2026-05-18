import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export interface PaperclipLinkRow {
	id: number;
	paperclip_issue_id: string;
	paperclip_run_id: string;
	paperclip_agent_id: string;
	cortex_role: string;
	nats_subject: string;
	status: string;
	cost_usd_cents: number;
	created_at: string;
	updated_at: string;
}

const SQL = `
  SELECT
    id,
    paperclip_issue_id,
    paperclip_run_id,
    paperclip_agent_id,
    cortex_role,
    nats_subject,
    status,
    cost_usd_cents,
    created_at,
    updated_at
  FROM paperclip_ticket_link
  ORDER BY updated_at DESC
  LIMIT 100
`;

function isMissingTable(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const code = (err as { code?: string }).code;
	// PostgreSQL undefined_table.
	return code === "42P01";
}

export async function GET() {
	try {
		const rows = await query<PaperclipLinkRow>(SQL);
		return NextResponse.json({ rows, timestamp: Date.now() });
	} catch (err) {
		if (isMissingTable(err)) {
			return NextResponse.json(
				{ rows: [], timestamp: Date.now(), warning: "paperclip_ticket_link table not present" },
				{ status: 200 },
			);
		}
		const message = err instanceof Error ? err.message : "Failed to load paperclip links";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
