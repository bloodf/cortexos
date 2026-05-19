import { query, queryOne, execute } from "./client";

export interface AlertRule {
  id: number;
  service_id: number;
  name: string;
  condition: "offline" | "online" | "response_time";
  threshold_ms: number | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertHistory {
  id: number;
  rule_id: number;
  service_id: number;
  status: string;
  message: string;
  created_at: Date;
}

export type CreateAlertRule = Omit<
  AlertRule,
  "id" | "created_at" | "updated_at"
>;

export type UpdateAlertRule = Partial<
  Omit<AlertRule, "id" | "created_at" | "updated_at">
>;

export async function getAlertRules(
  serviceId?: number,
): Promise<AlertRule[]> {
  if (serviceId !== undefined) {
    return query<AlertRule>(
      "SELECT id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at FROM alert_rules WHERE service_id = $1 ORDER BY created_at DESC",
      [serviceId],
    );
  }
  return query<AlertRule>(
    "SELECT id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at FROM alert_rules ORDER BY created_at DESC",
  );
}

export async function getAlertRuleById(id: number): Promise<AlertRule | null> {
  return queryOne<AlertRule>(
    "SELECT id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at FROM alert_rules WHERE id = $1",
    [id],
  );
}

export async function getEnabledAlertRules(): Promise<AlertRule[]> {
  return query<AlertRule>(
    "SELECT id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at FROM alert_rules WHERE enabled = true ORDER BY created_at DESC",
  );
}

export async function createAlertRule(
  data: CreateAlertRule,
): Promise<AlertRule> {
  const row = await queryOne<AlertRule>(
    `INSERT INTO alert_rules (service_id, name, condition, threshold_ms, enabled)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at`,
    [data.service_id, data.name, data.condition, data.threshold_ms, data.enabled],
  );
  if (!row) throw new Error("Failed to create alert rule");
  return row;
}

export async function updateAlertRule(
  id: number,
  data: UpdateAlertRule,
): Promise<AlertRule | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.service_id !== undefined) {
    sets.push(`service_id = $${idx++}`);
    values.push(data.service_id);
  }
  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.condition !== undefined) {
    sets.push(`condition = $${idx++}`);
    values.push(data.condition);
  }
  if (data.threshold_ms !== undefined) {
    sets.push(`threshold_ms = $${idx++}`);
    values.push(data.threshold_ms);
  }
  if (data.enabled !== undefined) {
    sets.push(`enabled = $${idx++}`);
    values.push(data.enabled);
  }
  if (sets.length === 0) return getAlertRuleById(id);

  sets.push(`updated_at = NOW()`);
  values.push(id);

  return queryOne<AlertRule>(
    `UPDATE alert_rules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at`,
    values,
  );
}

export async function deleteAlertRule(id: number): Promise<void> {
  await execute("DELETE FROM alert_rules WHERE id = $1", [id]);
}

export async function getAlertHistory(
  ruleId?: number,
  serviceId?: number,
  limit = 50,
): Promise<AlertHistory[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (ruleId !== undefined) {
    conditions.push(`rule_id = $${idx++}`);
    values.push(ruleId);
  }
  if (serviceId !== undefined) {
    conditions.push(`service_id = $${idx++}`);
    values.push(serviceId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit);

  return query<AlertHistory>(
    `SELECT id, rule_id, service_id, status, message, created_at FROM alert_history ${where} ORDER BY created_at DESC LIMIT $${idx}`,
    values,
  );
}

export async function insertAlertHistory(
  ruleId: number,
  serviceId: number,
  status: string,
  message: string,
): Promise<AlertHistory> {
  const row = await queryOne<AlertHistory>(
    `INSERT INTO alert_history (rule_id, service_id, status, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, rule_id, service_id, status, message, created_at`,
    [ruleId, serviceId, status, message],
  );
  if (!row) throw new Error("Failed to insert alert history");
  return row;
}

// =====================================================================
// Operational alerts (alerts table — distinct from rule-based history)
// =====================================================================

export type AlertSeverity = "info" | "warn" | "error" | "critical";

export interface OperationalAlert {
  id: number;
  kind: string;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  source: string | null;
  acknowledged_at: Date | null;
  created_at: Date;
}

export interface CreateOperationalAlert {
  kind: string;
  severity: AlertSeverity;
  title: string;
  body?: string | null;
  source?: string | null;
}

const SEVERITIES: ReadonlySet<AlertSeverity> = new Set([
  "info",
  "warn",
  "error",
  "critical",
]);

function validateSeverity(s: string): asserts s is AlertSeverity {
  if (!SEVERITIES.has(s as AlertSeverity)) {
    throw new Error(`Invalid alert severity: ${s}`);
  }
}

const ALERT_COLS =
  "id, kind, severity, title, body, source, acknowledged_at, created_at";

export async function listAlerts(
  opts: { severity?: AlertSeverity; unacknowledged?: boolean; limit?: number } = {},
): Promise<OperationalAlert[]> {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (opts.severity) {
    validateSeverity(opts.severity);
    conds.push(`severity = $${i++}`);
    vals.push(opts.severity);
  }
  if (opts.unacknowledged) {
    conds.push("acknowledged_at IS NULL");
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  vals.push(limit);
  return query<OperationalAlert>(
    `SELECT ${ALERT_COLS} FROM alerts ${where} ORDER BY created_at DESC LIMIT $${i}`,
    vals,
  );
}

export async function getAlertById(id: number): Promise<OperationalAlert | null> {
  return queryOne<OperationalAlert>(
    `SELECT ${ALERT_COLS} FROM alerts WHERE id = $1`,
    [id],
  );
}

export async function createAlert(
  data: CreateOperationalAlert,
): Promise<OperationalAlert> {
  validateSeverity(data.severity);
  if (!data.kind || data.kind.length > 64) {
    throw new Error("Alert kind must be 1..64 chars");
  }
  if (!data.title || data.title.length > 255) {
    throw new Error("Alert title must be 1..255 chars");
  }
  const row = await queryOne<OperationalAlert>(
    `INSERT INTO alerts (kind, severity, title, body, source)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${ALERT_COLS}`,
    [data.kind, data.severity, data.title, data.body ?? null, data.source ?? null],
  );
  if (!row) throw new Error("Failed to create alert");
  return row;
}

export async function acknowledgeAlert(
  id: number,
): Promise<OperationalAlert | null> {
  return queryOne<OperationalAlert>(
    `UPDATE alerts SET acknowledged_at = NOW() WHERE id = $1 AND acknowledged_at IS NULL RETURNING ${ALERT_COLS}`,
    [id],
  );
}

export async function deleteAlert(id: number): Promise<void> {
  await execute("DELETE FROM alerts WHERE id = $1", [id]);
}
