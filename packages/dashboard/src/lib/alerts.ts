/**
 * Dashboard-local alert recording.
 *
 * The rebuilt CortexOS architecture intentionally removes the external event bus.
 * Alerts are dashboard-visible only for now: callers get a stable alert id and
 * the helper writes one structured line to stdout for journald/Loki ingestion.
 */
import { createHash } from "node:crypto";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertPayload {
  title: string;
  body?: string;
  severity: AlertSeverity;
  source: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardAlertRecord extends AlertPayload {
  id: string;
  timestamp: string;
}

const VALID_SEVERITIES = new Set<AlertSeverity>([
  "info",
  "warning",
  "critical",
]);

export function buildSubject(severity: AlertSeverity, source: string): string {
  if (!VALID_SEVERITIES.has(severity)) {
    throw new Error(`invalid severity: ${severity}`);
  }
  if (!source || !/^[a-zA-Z0-9._-]+$/.test(source)) {
    throw new Error(`invalid source: ${source}`);
  }
  return `dashboard.alerts.${severity}.${source}`;
}

export function buildAlertRecord(payload: AlertPayload): DashboardAlertRecord {
  if (!VALID_SEVERITIES.has(payload.severity)) {
    throw new Error(`invalid severity: ${payload.severity}`);
  }
  const timestamp = payload.timestamp || new Date().toISOString();
  const id = createHash("sha256")
    .update(JSON.stringify([payload.severity, payload.source, payload.title, timestamp]))
    .digest("hex")
    .slice(0, 24);
  return { ...payload, timestamp, id };
}

export async function publishAlert(payload: AlertPayload): Promise<{
  published: boolean;
  subject: string;
  id: string;
  reason?: string;
}> {
  const record = buildAlertRecord(payload);
  const subject = buildSubject(record.severity, record.source);
  process.stdout.write(
    `${JSON.stringify({ event: "dashboard.alert", subject, ...record })}\n`,
  );
  return { published: true, subject, id: record.id };
}
