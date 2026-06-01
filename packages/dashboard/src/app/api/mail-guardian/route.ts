import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CountRow {
	action: string;
	count: string;
}

interface OpenReviewRow {
	open_reviews: string;
}

interface RecentReviewRow {
	id: string;
	account_slug: string;
	model_verdict: string;
	model_confidence: string;
	requested_at: string;
}

export async function GET(): Promise<Response> {
	try {
		const [actions, openReviewRow, recentReviews] = await Promise.all([
			query<CountRow>(
				`SELECT action, COUNT(*)::text AS count
				 FROM mail_guardian_processed
				 GROUP BY action
				 ORDER BY action`,
			),
			queryOne<OpenReviewRow>(
				`SELECT COUNT(*)::text AS open_reviews
				 FROM mail_guardian_reviews
				 WHERE resolved_at IS NULL`,
			),
			query<RecentReviewRow>(
				`SELECT id::text, account_slug, model_verdict, model_confidence::text, requested_at::text
				 FROM mail_guardian_reviews
				 ORDER BY requested_at DESC
				 LIMIT 5`,
			),
		]);
		const byAction = Object.fromEntries(actions.map((row) => [row.action, Number(row.count)]));
		return NextResponse.json({
			actions: byAction,
			openReviews: Number(openReviewRow?.open_reviews ?? 0),
			totalProcessed: Object.values(byAction).reduce((sum, count) => sum + count, 0),
			recentReviews,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load mail guardian stats";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
