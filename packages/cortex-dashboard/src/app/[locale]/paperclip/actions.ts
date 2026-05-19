/**
 * V11 — Paperclip server actions.
 *
 * Replaces the `fetch('/api/paperclip/links')` round-trip from the old
 * client component implementation. Direct DB read; zod-validated input
 * even when empty for future-proofing.
 */
"use server";

import { query } from "@/lib/db/client";
import {
	parseInput,
	paperclipRefreshInputSchema,
	type ValidationResult,
} from "@/lib/validation";
import type { PaperclipLinkRow } from "@/components/paperclip/link-table";

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
	return code === "42P01";
}

export interface LoadLinksResult {
	rows: PaperclipLinkRow[];
	warning?: string;
	error?: string;
}

/**
 * Server-action-friendly link loader. Safe to call from RSC and from
 * client-invoked server actions (e.g. a manual refresh button).
 */
export async function loadPaperclipLinks(
	input: unknown = {},
): Promise<LoadLinksResult & { validation?: ValidationResult<unknown> }> {
	const parsed = parseInput(paperclipRefreshInputSchema, input, {
		action: "paperclip.loadLinks",
	});
	if (!parsed.ok) {
		return {
			rows: [],
			error: parsed.error,
			validation: parsed,
		};
	}

	try {
		const rows = await query<PaperclipLinkRow>(SQL);
		return { rows };
	} catch (err) {
		if (isMissingTable(err)) {
			return {
				rows: [],
				warning: "paperclip_ticket_link table not present",
			};
		}
		const message =
			err instanceof Error ? err.message : "Failed to load paperclip links";
		return { rows: [], error: message };
	}
}
