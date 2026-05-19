/**
 * Dashboard alerts → NATS publisher.
 *
 * Subject taxonomy: `cortex.alerts.<severity>.<source>`.
 * Envelope: `{ data, sig }` where sig = HMAC-SHA256(CORTEX_NATS_HMAC, JCS(data)).
 *
 * Backward-compat: still logs structured payload; NATS publish is best-effort
 * and only attempted when NATS_URL is configured. Failures never throw.
 */
import { createHmac } from "node:crypto";
import { envelope as buildCloudEvent, validate as validateCloudEvent } from "@cortexos/events";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertPayload {
  title: string;
  body?: string;
  severity: AlertSeverity;
  source: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertEnvelope {
  data: AlertPayload & { timestamp: string };
  sig: string;
}

const VALID_SEVERITIES = new Set<AlertSeverity>([
  "info",
  "warning",
  "critical",
]);

function jcs(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${jcs((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}

export function signEnvelope(
  data: AlertPayload & { timestamp: string },
  secret = process.env.CORTEX_NATS_HMAC || "",
): AlertEnvelope {
  if (!secret) throw new Error("CORTEX_NATS_HMAC not configured");
  const sig = createHmac("sha256", secret).update(jcs(data)).digest("hex");
  return { data, sig };
}

export function buildSubject(severity: AlertSeverity, source: string): string {
  if (!VALID_SEVERITIES.has(severity)) {
    throw new Error(`invalid severity: ${severity}`);
  }
  if (!source || !/^[a-zA-Z0-9._-]+$/.test(source)) {
    throw new Error(`invalid source: ${source}`);
  }
  return `cortex.alerts.${severity}.${source}`;
}

// Minimal NATS client surface so tests can mock it.
export interface NatsClientLike {
  publish(subject: string, data: Uint8Array): void;
  drain?(): Promise<void>;
  close?(): Promise<void>;
  isClosed?(): boolean;
}

let cachedClient: NatsClientLike | null = null;
let connecting: Promise<NatsClientLike> | null = null;

/**
 * Connect lazily. Test entry-point: callers may inject a client via setNatsClientForTesting.
 */
async function getNatsClient(): Promise<NatsClientLike | null> {
  if (cachedClient && (!cachedClient.isClosed || !cachedClient.isClosed())) {
    return cachedClient;
  }
  if (connecting) return connecting;
  const url = process.env.NATS_URL;
  if (!url) return null;
  connecting = (async () => {
    const mod = (await import("nats")) as unknown as {
      connect: (opts: Record<string, unknown>) => Promise<NatsClientLike>;
    };
    const nc = await mod.connect({
      servers: url,
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1_000,
      name: "cortex-dashboard",
    });
    cachedClient = nc;
    connecting = null;
    return nc;
  })().catch((e) => {
    connecting = null;
    throw e;
  });
  return connecting;
}

export function setNatsClientForTesting(client: NatsClientLike | null): void {
  cachedClient = client;
  connecting = null;
}

/**
 * Publish an alert to NATS. Backward-compat: also writes a structured log line.
 * Never throws — NATS publish failure is logged and swallowed.
 */
export async function publishAlert(payload: AlertPayload): Promise<{
  published: boolean;
  subject: string;
  reason?: string;
}> {
  if (!VALID_SEVERITIES.has(payload.severity)) {
    throw new Error(`invalid severity: ${payload.severity}`);
  }
  const data = {
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
  const subject = buildSubject(payload.severity, payload.source);

  // Backward-compat structured log (one line, JSON).
  process.stdout.write(
    `${JSON.stringify({ event: "alert", subject, ...data })}\n`,
  );

  if (!process.env.NATS_URL) {
    return { published: false, subject, reason: "NATS_URL not set" };
  }
  if (!process.env.CORTEX_NATS_HMAC) {
    return {
      published: false,
      subject,
      reason: "CORTEX_NATS_HMAC not set",
    };
  }

  try {
    const nc = await getNatsClient();
    if (!nc) return { published: false, subject, reason: "no NATS client" };
    // Wrap the alert payload in a CloudEvents 1.0 envelope per @cortexos/events schemas,
    // then sign the CloudEvents object via the legacy HMAC envelope { data, sig }.
    const ce = buildCloudEvent({
      type: `cortex.alerts.${payload.severity}.${payload.source}.v1`,
      source: "cortex-dashboard",
      subject: payload.source,
      data: {
        severity: data.severity,
        source: data.source,
        message: data.title + (data.body ? `: ${data.body}` : ""),
        metadata: data.metadata,
      },
    });
    validateCloudEvent(ce);
    const envelope = signEnvelope(ce as unknown as AlertPayload & { timestamp: string });
    const encoded = new TextEncoder().encode(JSON.stringify(envelope));
    nc.publish(subject, encoded);
    return { published: true, subject };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(
      `[alerts] publish failed subject=${subject}: ${message}\n`,
    );
    return { published: false, subject, reason: message };
  }
}

export { jcs as _jcs };
