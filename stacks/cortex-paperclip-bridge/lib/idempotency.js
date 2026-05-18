import { getPool } from "./db.js";

const INSERT_LINK = `
  INSERT INTO paperclip_ticket_link
    (paperclip_issue_id, paperclip_run_id, paperclip_agent_id, cortex_role, nats_subject, status)
  VALUES ($1, $2, $3, $4, $5, 'open')
  ON CONFLICT (paperclip_run_id) DO NOTHING
  RETURNING id
`;

export async function recordLink({ issueId, runId, agentId, role, subject }, pool = getPool()) {
  const res = await pool.query(INSERT_LINK, [issueId, runId, agentId, role, subject]);
  return { inserted: res.rowCount === 1, id: res.rows[0]?.id || null };
}

const UPDATE_STATUS = `
  UPDATE paperclip_ticket_link
     SET status = $2,
         cost_usd_cents = COALESCE($3, cost_usd_cents),
         updated_at = now()
   WHERE paperclip_run_id = $1
  RETURNING id
`;

export async function updateStatus(runId, status, costUsdCents = null, pool = getPool()) {
  const res = await pool.query(UPDATE_STATUS, [runId, status, costUsdCents]);
  return res.rowCount === 1;
}
