-- Queue dashboard mail decisions for the guardian service to execute via IMAP.

CREATE TABLE IF NOT EXISTS mail_guardian_actions (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES mail_guardian_reviews(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('spam','keep','block_sender','allow_sender')),
  approver TEXT NOT NULL DEFAULT 'dashboard',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_mail_guardian_actions_pending
  ON mail_guardian_actions (requested_at, id)
  WHERE status = 'pending';

INSERT INTO migrations (name) VALUES ('012_mail_guardian_actions')
ON CONFLICT (name) DO NOTHING;
