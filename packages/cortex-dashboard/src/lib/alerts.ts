export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertPayload {
  title: string;
  body?: string;
  severity: AlertSeverity;
  source: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

const VALID_SEVERITIES = new Set<AlertSeverity>(["info", "warning", "critical"]);

export function buildSubject(severity: AlertSeverity, source: string): string {
  if (!VALID_SEVERITIES.has(severity)) throw new Error(`invalid severity: ${severity}`);
  if (!source || !/^[a-zA-Z0-9._-]+$/.test(source)) throw new Error(`invalid source: ${source}`);
  return `dashboard.alerts.${severity}.${source}`;
}

export async function publishAlert(payload: AlertPayload): Promise<{
  published: boolean;
  subject: string;
  reason?: string;
}> {
  const subject = buildSubject(payload.severity, payload.source);
  const data = { ...payload, timestamp: payload.timestamp || new Date().toISOString() };
  process.stdout.write(`${JSON.stringify({ event: "alert", subject, ...data })}\n`);
  return { published: false, subject, reason: "alert logged locally" };
}
