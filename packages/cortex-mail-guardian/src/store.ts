import pg from 'pg';
import type { GuardianConfig } from './config.js';
import type { RuleMatch } from './rules.js';

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
  message_id?: string | null;
  from_hash: string;
  domain_hash: string;
}

export interface QueuedReviewDecision {
  id: number;
  review_id: number;
  decision: 'spam' | 'keep' | 'block_sender' | 'allow_sender';
  approver: string;
}

export interface AccountRow {
  slug: string;
  address: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password_b64: string;
  inbox: string;
  trash_mailbox: string | null;
  review_mailbox: string;
  enabled: boolean;
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

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
			CREATE TABLE IF NOT EXISTS mail_guardian_actions (
			  id BIGSERIAL PRIMARY KEY,
			  review_id BIGINT NOT NULL REFERENCES mail_guardian_reviews(id) ON DELETE CASCADE,
			  decision TEXT NOT NULL CHECK (decision IN ('spam','keep','block_sender','allow_sender')),
			  approver TEXT NOT NULL DEFAULT 'dashboard',
			  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
			  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			  processed_at TIMESTAMPTZ,
			  error TEXT
			)
		`);
    await this.pool.query(`
			CREATE INDEX IF NOT EXISTS idx_mail_guardian_actions_pending
			  ON mail_guardian_actions (requested_at, id)
			  WHERE status = 'pending'
		`);
    await this.pool.query(`
			CREATE TABLE IF NOT EXISTS mail_guardian_accounts (
			  id BIGSERIAL PRIMARY KEY,
			  slug TEXT NOT NULL UNIQUE,
			  address TEXT NOT NULL,
			  host TEXT NOT NULL,
			  port INTEGER NOT NULL DEFAULT 993,
			  secure BOOLEAN NOT NULL DEFAULT true,
			  username TEXT NOT NULL,
			  password_b64 TEXT NOT NULL,
			  inbox TEXT NOT NULL DEFAULT 'INBOX',
			  trash_mailbox TEXT,
			  review_mailbox TEXT NOT NULL DEFAULT 'INBOX.Cortex Mail Guardian Review',
			  enabled BOOLEAN NOT NULL DEFAULT true,
			  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`);
  }

  async listAccounts(): Promise<AccountRow[]> {
    const result = await this.pool.query<AccountRow>(
      `SELECT slug, address, host, port, secure, username, password_b64,
			        inbox, trash_mailbox, review_mailbox, enabled
			 FROM mail_guardian_accounts
			 WHERE enabled = true
			 ORDER BY slug`,
    );
    return result.rows;
  }

  async hasProcessed(accountSlug: string, uid: number): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM mail_guardian_processed WHERE account_slug = $1 AND message_uid = $2 LIMIT 1',
      [accountSlug, uid],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markProcessed(
    accountSlug: string,
    uid: number,
    action: string,
    messageId?: string,
  ): Promise<void> {
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

  async findRules(fromHash: string, domainHash: string): Promise<RuleMatch[]> {
    const result = await this.pool.query<{
      rule_type: 'allow' | 'block';
      scope: 'sender' | 'domain';
    }>(
      `SELECT rule_type, scope FROM mail_guardian_rules
			 WHERE (scope = 'sender' AND value_hash = $1)
			    OR (scope = 'domain' AND value_hash = $2)`,
      [fromHash, domainHash],
    );
    return result.rows.map((row) => ({
      verdict: row.rule_type === 'block' ? 'spam' : 'ham',
      scope: row.scope,
      ruleType: row.rule_type,
    }));
  }

  async addRule(
    ruleType: 'allow' | 'block',
    scope: 'sender' | 'domain',
    valueHash: string,
  ): Promise<void> {
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
      `SELECT id, account_slug, message_uid, message_id, from_hash, domain_hash
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

  async enqueueReviewDecision(
    reviewId: number,
    decision: string,
    approver: string,
  ): Promise<number> {
    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO mail_guardian_actions (review_id, decision, approver)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
      [reviewId, decision, approver],
    );
    return result.rows[0].id;
  }

  async claimPendingActions(limit = 20): Promise<QueuedReviewDecision[]> {
    const result = await this.pool.query<QueuedReviewDecision>(
      `WITH next_actions AS (
			   SELECT id
			   FROM mail_guardian_actions
			   WHERE status = 'pending'
			   ORDER BY requested_at, id
			   LIMIT $1
			   FOR UPDATE SKIP LOCKED
			 )
			 UPDATE mail_guardian_actions a
			 SET status = 'processing'
			 FROM next_actions n
			 WHERE a.id = n.id
			 RETURNING a.id, a.review_id, a.decision, a.approver`,
      [limit],
    );
    return result.rows;
  }

  async completeAction(actionId: number): Promise<void> {
    await this.pool.query(
      `UPDATE mail_guardian_actions
			 SET status = 'done', processed_at = now(), error = NULL
			 WHERE id = $1`,
      [actionId],
    );
  }

  async failAction(actionId: number, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE mail_guardian_actions
			 SET status = 'failed', processed_at = now(), error = $2
			 WHERE id = $1`,
      [actionId, error.slice(0, 1000)],
    );
  }
}
