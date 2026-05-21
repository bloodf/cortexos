import pg from "pg";
import type { GuardianConfig } from "./config.js";

export interface PendingReviewInput {
	accountSlug: string;
	messageUid: number;
	messageId?: string;
	fromHash: string;
	domainHash: string;
	subjectHash: string;
	bodyHash: string;
	summary: string;
	modelVerdict: string;
	modelConfidence: number;
}

export interface ReviewRecord {
	id: number;
	account_slug: string;
	message_uid: number;
	from_hash: string;
	domain_hash: string;
}

export class GuardianStore {
	private readonly pool: pg.Pool;

	constructor(config: GuardianConfig) {
		this.pool = config.databaseUrl
			? new pg.Pool({ connectionString: config.databaseUrl })
			: new pg.Pool({
				host: config.db.host,
				port: config.db.port,
				database: config.db.database,
				user: config.db.user,
				password: config.db.password,
			});
	}

	async close(): Promise<void> {
		await this.pool.end();
	}

	async hasProcessed(accountSlug: string, uid: number): Promise<boolean> {
		const result = await this.pool.query(
			"SELECT 1 FROM mail_guardian_processed WHERE account_slug = $1 AND message_uid = $2 LIMIT 1",
			[accountSlug, uid],
		);
		return (result.rowCount ?? 0) > 0;
	}

	async markProcessed(accountSlug: string, uid: number, action: string, messageId?: string): Promise<void> {
		await this.pool.query(
			`INSERT INTO mail_guardian_processed (account_slug, message_uid, message_id, action)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (account_slug, message_uid) DO UPDATE
			   SET action = EXCLUDED.action, processed_at = now()`,
			[accountSlug, uid, messageId ?? null, action],
		);
	}

	async hasAllowRule(fromHash: string, domainHash: string): Promise<boolean> {
		const result = await this.pool.query(
			`SELECT 1 FROM mail_guardian_rules
			 WHERE rule_type = 'allow' AND value_hash = ANY($1::text[]) LIMIT 1`,
			[[fromHash, domainHash]],
		);
		return (result.rowCount ?? 0) > 0;
	}

	async addRule(ruleType: "allow" | "block", scope: "sender" | "domain", valueHash: string): Promise<void> {
		await this.pool.query(
			`INSERT INTO mail_guardian_rules (rule_type, scope, value_hash)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (rule_type, scope, value_hash) DO NOTHING`,
			[ruleType, scope, valueHash],
		);
	}

	async createPendingReview(input: PendingReviewInput): Promise<number> {
		const result = await this.pool.query<{ id: number }>(
			`INSERT INTO mail_guardian_reviews (
			   account_slug, message_uid, message_id, from_hash, domain_hash,
			   subject_hash, body_hash, summary, model_verdict, model_confidence
			 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			 ON CONFLICT (account_slug, message_uid) DO UPDATE
			   SET summary = EXCLUDED.summary,
			       model_verdict = EXCLUDED.model_verdict,
			       model_confidence = EXCLUDED.model_confidence
			 RETURNING id`,
			[
				input.accountSlug,
				input.messageUid,
				input.messageId ?? null,
				input.fromHash,
				input.domainHash,
				input.subjectHash,
				input.bodyHash,
				input.summary,
				input.modelVerdict,
				input.modelConfidence,
			],
		);
		return result.rows[0].id;
	}

	async getReview(reviewId: number): Promise<ReviewRecord | null> {
		const result = await this.pool.query<ReviewRecord>(
			`SELECT id, account_slug, message_uid, from_hash, domain_hash
			 FROM mail_guardian_reviews
			 WHERE id = $1 AND resolved_at IS NULL`,
			[reviewId],
		);
		return result.rows[0] ?? null;
	}

	async resolveReview(reviewId: number, decision: string, approver: string): Promise<void> {
		await this.pool.query(
			`UPDATE mail_guardian_reviews
			 SET owner_decision = $2, approver = $3, resolved_at = now()
			 WHERE id = $1`,
			[reviewId, decision, approver],
		);
	}
}
