import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { execute, query, queryOne } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS = new Set(["spam", "keep", "block_sender", "allow_sender"]);

interface ReviewRow {
	id: string;
	account_slug: string;
	message_uid: string;
	message_id: string | null;
	from_hash: string;
	domain_hash: string;
	subject_hash: string;
	body_hash: string;
	summary: string;
	model_verdict: string;
	model_confidence: string;
	owner_decision: string | null;
	approver: string | null;
	requested_at: string;
	resolved_at: string | null;
	processed_action: string | null;
}

async function listReviews(openOnly: boolean): Promise<ReviewRow[]> {
	return query<ReviewRow>(
		`SELECT r.id::text, r.account_slug, r.message_uid::text, r.message_id,
		        r.from_hash, r.domain_hash, r.subject_hash, r.body_hash, r.summary,
		        r.model_verdict, r.model_confidence::text, r.owner_decision, r.approver,
		        r.requested_at::text, r.resolved_at::text, p.action AS processed_action
		 FROM mail_guardian_reviews r
		 LEFT JOIN mail_guardian_processed p ON p.account_slug = r.account_slug AND p.message_uid = r.message_uid
		 WHERE ($1::boolean = false OR r.resolved_at IS NULL)
		 ORDER BY r.requested_at DESC, r.id DESC
		 LIMIT 200`,
		[openOnly],
	);
}

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "mail_guardian.reviews.list" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	try {
		const reviews = await listReviews(searchParams.get("open") !== "false");
		return NextResponse.json({ reviews });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "mail_guardian.review.decide" });
	if (auth.error) return auth.error;

	let body: { id?: unknown; decision?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const id = Number(body.id);
	const decision = typeof body.decision === "string" ? body.decision : "";
	if (!Number.isInteger(id) || id <= 0 || !DECISIONS.has(decision)) {
		return NextResponse.json({ error: "Valid id and decision required", code: "EVALIDATION" }, { status: 400 });
	}

	const review = await queryOne<{ id: number; account_slug: string; message_uid: string; from_hash: string }>(
		`SELECT id, account_slug, message_uid::text, from_hash
		 FROM mail_guardian_reviews
		 WHERE id = $1 AND resolved_at IS NULL`,
		[id],
	);
	if (!review) return NextResponse.json({ error: "Review already resolved or missing", code: "ENOTFOUND" }, { status: 404 });

	try {
		if (decision === "spam" || decision === "block_sender") {
			await execute(
				`INSERT INTO mail_guardian_processed (account_slug, message_uid, action)
				 VALUES ($1, $2, 'trashed')
				 ON CONFLICT (account_slug, message_uid) DO UPDATE SET action = EXCLUDED.action, processed_at = now()`,
				[review.account_slug, Number(review.message_uid)],
			);
			if (decision === "block_sender") {
				await execute(
					`INSERT INTO mail_guardian_rules (rule_type, scope, value_hash)
					 VALUES ('block', 'sender', $1)
					 ON CONFLICT (rule_type, scope, value_hash) DO NOTHING`,
					[review.from_hash],
				);
			}
		} else {
			await execute(
				`INSERT INTO mail_guardian_processed (account_slug, message_uid, action)
				 VALUES ($1, $2, 'kept')
				 ON CONFLICT (account_slug, message_uid) DO UPDATE SET action = EXCLUDED.action, processed_at = now()`,
				[review.account_slug, Number(review.message_uid)],
			);
			if (decision === "allow_sender") {
				await execute(
					`INSERT INTO mail_guardian_rules (rule_type, scope, value_hash)
					 VALUES ('allow', 'sender', $1)
					 ON CONFLICT (rule_type, scope, value_hash) DO NOTHING`,
					[review.from_hash],
				);
			}
		}

		await execute(
			`UPDATE mail_guardian_reviews
			 SET owner_decision = $2, approver = $3, resolved_at = now()
			 WHERE id = $1`,
			[id, decision, auth.session?.username ?? "dashboard"],
		);
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
	}
}
