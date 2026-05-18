import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { publishAlert } from "@/lib/alerts";

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

  const body = (await request.json().catch(() => null)) as
    | { title?: string; body?: string; source?: string }
    | null;

  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Synthetic notification";
  const text =
    typeof body?.body === "string" ? body.body : "Triggered via notify-test";
  const source =
    typeof body?.source === "string" && /^[a-zA-Z0-9._-]+$/.test(body.source)
      ? body.source
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
