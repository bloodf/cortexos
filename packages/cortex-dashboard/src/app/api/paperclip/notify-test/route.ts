import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { publishAlert } from "@/lib/alerts";
import { notifyTestInputSchema, parseInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Admin-only synthetic alert publisher.
 *
 * Auth: session role `is_admin=true` OR header `X-Admin-Token` matching `ADMIN_TOKEN`.
 * Body (optional): `{ title?, body?, source? }`.
 * Publishes `cortex.alerts.critical.test` to NATS via lib/alerts.publishAlert.
 */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.NATS_URL) {
    return NextResponse.json(
      { error: "NATS_URL not configured" },
      { status: 503 },
    );
  }

  const adminToken = process.env.ADMIN_TOKEN || "";
  const headerToken = request.headers.get("x-admin-token") || "";
  const headerAuthorized =
    adminToken !== "" && constantTimeEqual(headerToken, adminToken);

  if (!headerAuthorized) {
    const auth = await requireAdmin(request, { tool: "paperclip.notify-test" });
    if (auth.error) return auth.error;
  }

  const rawBody = (await request.json().catch(() => null)) as unknown;

  // Zod parse at the boundary. On failure we still proceed with safe
  // defaults — notify-test is a synthetic alert and historically tolerates
  // partial garbage in the body (drops bad fields rather than 400).
  const parsed = parseInput(notifyTestInputSchema, rawBody ?? {}, {
    action: "paperclip.notify-test",
  });
  const validated = parsed.ok ? parsed.data : {};

  const title =
    validated.title && validated.title.trim()
      ? validated.title.trim()
      : "Synthetic notification";
  const text =
    typeof validated.body === "string" ? validated.body : "Triggered via notify-test";
  const source =
    typeof validated.source === "string" && validated.source.length > 0
      ? validated.source
      : "test";

  const timestamp = new Date().toISOString();
  try {
    const result = await publishAlert({
      title,
      body: text,
      severity: "critical",
      source,
      timestamp,
    });
    return NextResponse.json({
      ok: result.published,
      subject: result.subject,
      timestamp,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
