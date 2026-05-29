/**
 * V9 audit viewer.
 *
 * Server component. Lists hash-chained audit_log rows paginated by
 * `occurred_at DESC`. Renders a client-side chain-verify badge that calls
 * `/api/audit/verify` for the visible window.
 *
 * Auth note: this page sits under `[locale]` so it inherits the dashboard
 * locale middleware and admin layout's auth check. The verify API itself
 * also enforces `requireAdmin`, so a non-admin reaching the page sees an
 * empty result rather than tampered output.
 */
import Link from "next/link";
import { query } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollTextIcon } from "lucide-react";
import { AuditChainVerifyBadge } from "./chain-verify-badge";
import { AuditLogTable, type AuditTableRow } from "./audit-log-table";
import { auditViewerQuerySchema, parseInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 50;

type AuditRow = AuditTableRow;

interface PageProps {
	searchParams?: Promise<{ page?: string }>;
}

export default async function AuditViewerPage({ searchParams }: PageProps) {
	const sp = (await searchParams) ?? {};
	const parsedQuery = parseInput(auditViewerQuerySchema, sp, {
		action: "audit.viewer",
	});
	const page = parsedQuery.ok ? parsedQuery.data.page : 1;
	const offset = (page - 1) * PAGE_SIZE;

	let rows: AuditRow[] = [];
	let total = 0;
	let firstTs: string | null = null;
	let lastTs: string | null = null;

	try {
		const result = await query<AuditRow>(
			`SELECT id::text, occurred_at, event_id, event_type, source, subject,
                actor, chain_hash, rekor_log_index::text
           FROM audit_log
          ORDER BY occurred_at DESC, id DESC
          LIMIT $1 OFFSET $2`,
			[PAGE_SIZE, offset],
		);
		rows = result;
		const totals = await query<{ c: string }>(
			`SELECT COUNT(*)::text AS c FROM audit_log`,
		);
		total = parseInt(totals[0]?.c ?? "0", 10);
		if (rows.length > 0) {
			lastTs = rows[0].occurred_at;
			firstTs = rows[rows.length - 1].occurred_at;
		}
	} catch (e) {
		// Table may not exist yet (pre-migration). Render empty state.
		const msg = e instanceof Error ? e.message : "unknown";
		rows = [];
		total = 0;
		// Stash error in a hidden HTML comment for operator debug.
		console.error("[audit-viewer] query failed:", msg);
	}

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Audit Log"
				description="Hash-chained, tamper-evident record of audited operations across CortexOS."
				icon={<ScrollTextIcon />}
				actions={
					<div className="flex items-center gap-2">
						<Badge variant="secondary">{total} rows</Badge>
						<AuditChainVerifyBadge from={firstTs} to={lastTs} />
					</div>
				}
			/>

			<Card>
				<CardHeader>
					<CardTitle>
						Page {page} of {totalPages}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<AuditLogTable rows={rows} />
				</CardContent>
			</Card>

			<nav className="flex items-center gap-2">
				{page > 1 && (
					<Button variant="outline" size="sm" render={<Link href={`?page=${page - 1}`} />}>
						← Prev
					</Button>
				)}
				{page < totalPages && (
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						render={<Link href={`?page=${page + 1}`} />}
					>
						Next →
					</Button>
				)}
			</nav>
		</div>
	);
}
