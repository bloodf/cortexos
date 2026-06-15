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
  /** Plaintext subject for the dashboard review detail (display only). */
  subject?: string;
  /** Decoded, human-readable body for the dashboard review detail. */
  body?: string;
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

export interface DecisionInput {
  accountSlug: string;
  messageUid: number;
  fromHash: string;
  domainHash: string;
  summary: string;
  model: string | null;
  verdict: string | null;
  confidence: number | null;
  reasons: string[];
  riskSignals: string[];
  verifyModel: string | null;
  verifyVerdict: string | null;
  verifyConfidence: number | null;
  outcome: string;
}

export interface DecisionRow {
  account_slug: string;
  message_uid: number;
  from_hash: string;
  domain_hash: string;
  summary: string;
  verdict: string | null;
  outcome: string;
  created_at: Date;
}

export interface KnowledgeBriefRow {
  id: number;
  brief: string;
  source_decisions: number;
  generated_at: Date;
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
    // Display columns for the dashboard's review detail: a plaintext subject
    // and a decoded, human-readable body. Added idempotently so the existing
    // reviews table (created by the dashboard migrations) gains them.
    await this.pool.query(`
			ALTER TABLE mail_guardian_reviews
			  ADD COLUMN IF NOT EXISTS subject TEXT,
			  ADD COLUMN IF NOT EXISTS body_text TEXT
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
			   subject_hash, body_hash, summary, model_verdict, model_confidence,
			   subject, body_text
			 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
			 ON CONFLICT (account_slug, message_uid) DO UPDATE
			   SET summary = EXCLUDED.summary,
			       subject = EXCLUDED.subject,
			       body_text = EXCLUDED.body_text,
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
        input.subject ?? null,
        input.body ?? null,
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

  async recordDecision(input: DecisionInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO mail_guardian_decisions (
         account_slug, message_uid, from_hash, domain_hash, summary,
         model, verdict, confidence, reasons, risk_signals,
         verify_model, verify_verdict, verify_confidence, outcome
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14)
       ON CONFLICT (account_slug, message_uid) DO UPDATE SET
         model = EXCLUDED.model, verdict = EXCLUDED.verdict,
         confidence = EXCLUDED.confidence, reasons = EXCLUDED.reasons,
         risk_signals = EXCLUDED.risk_signals,
         verify_model = EXCLUDED.verify_model, verify_verdict = EXCLUDED.verify_verdict,
         verify_confidence = EXCLUDED.verify_confidence, outcome = EXCLUDED.outcome`,
      [
        input.accountSlug,
        input.messageUid,
        input.fromHash,
        input.domainHash,
        input.summary,
        input.model,
        input.verdict,
        input.confidence,
        JSON.stringify(input.reasons),
        JSON.stringify(input.riskSignals),
        input.verifyModel,
        input.verifyVerdict,
        input.verifyConfidence,
        input.outcome,
      ],
    );
  }

  async updateDecisionOutcome(accountSlug: string, uid: number, outcome: string): Promise<void> {
    await this.pool.query(
      `UPDATE mail_guardian_decisions
       SET outcome = $3, decided_at = now()
       WHERE account_slug = $1 AND message_uid = $2`,
      [accountSlug, uid, outcome],
    );
  }

  async listRecentDecisions(limit: number): Promise<DecisionRow[]> {
    const result = await this.pool.query<DecisionRow>(
      `SELECT account_slug, message_uid, from_hash, domain_hash, summary,
              verdict, outcome, created_at
       FROM mail_guardian_decisions
       WHERE outcome IN ('owner_spam','owner_keep','owner_block','owner_allow')
       ORDER BY CASE
         WHEN (verdict = 'spam' AND outcome IN ('owner_keep','owner_allow'))
           OR (verdict = 'not_spam' AND outcome IN ('owner_spam','owner_block'))
         THEN 0 ELSE 1
       END, created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async insertBrief(brief: string, sourceDecisions: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO mail_guardian_knowledge (brief, source_decisions) VALUES ($1, $2)`,
      [brief, sourceDecisions],
    );
  }

  async getLatestBrief(): Promise<KnowledgeBriefRow | null> {
    const result = await this.pool.query<KnowledgeBriefRow>(
      `SELECT id, brief, source_decisions, generated_at
       FROM mail_guardian_knowledge
       ORDER BY generated_at DESC, id DESC
       LIMIT 1`,
    );
    return result.rows[0] ?? null;
  }

  async countDomainOutcomes(domainHash: string): Promise<{ spam: number; allow: number }> {
    const result = await this.pool.query<{ spam: string; allow: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE outcome IN ('owner_spam','owner_block')) AS spam,
         COUNT(*) FILTER (WHERE outcome IN ('owner_keep','owner_allow')) AS allow
       FROM mail_guardian_decisions
       WHERE domain_hash = $1`,
      [domainHash],
    );
    const row = result.rows[0];
    return { spam: Number(row?.spam ?? 0), allow: Number(row?.allow ?? 0) };
  }

  async hasRule(
    ruleType: 'allow' | 'block',
    scope: 'sender' | 'domain',
    valueHash: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM mail_guardian_rules
       WHERE rule_type = $1 AND scope = $2 AND value_hash = $3 LIMIT 1`,
      [ruleType, scope, valueHash],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getReviewDomainHash(reviewId: number): Promise<string | null> {
    const result = await this.pool.query<{ domain_hash: string }>(
      `SELECT domain_hash FROM mail_guardian_reviews WHERE id = $1`,
      [reviewId],
    );
    return result.rows[0]?.domain_hash ?? null;
  }
}
