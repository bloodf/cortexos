import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getAlertRules,
  getAlertHistory,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getEnabledAlertRules,
} from "@/lib/db/alerts";

const VALID_CONDITIONS = new Set(["offline", "online", "response_time"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const history = searchParams.get("history");
  const ruleId = searchParams.get("ruleId");
  const serviceId = searchParams.get("serviceId");
  const enabledOnly = searchParams.get("enabled");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (history === "1") {
    const historyRows = await getAlertHistory(
      ruleId ? parseInt(ruleId, 10) : undefined,
      serviceId ? parseInt(serviceId, 10) : undefined,
      Number.isNaN(limit) ? 50 : limit,
    );
    return NextResponse.json({ history: historyRows });
  }

  if (enabledOnly === "1") {
    const rules = await getEnabledAlertRules();
    return NextResponse.json({ rules });
  }

  const rules = await getAlertRules(
    serviceId ? parseInt(serviceId, 10) : undefined,
  );
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { service_id, name, condition, threshold_ms, enabled } = body;

  if (
    typeof service_id !== "number" ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof condition !== "string" ||
    !VALID_CONDITIONS.has(condition)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields" },
      { status: 400 },
    );
  }

  const rule = await createAlertRule({
    service_id,
    name: name.trim(),
    condition: condition as "offline" | "online" | "response_time",
    threshold_ms:
      typeof threshold_ms === "number" ? threshold_ms : null,
    enabled: typeof enabled === "boolean" ? enabled : true,
  });

  return NextResponse.json({ rule }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, ...data } = body;
  if (typeof id !== "number") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updateData: Parameters<typeof updateAlertRule>[1] = {};
  if (data.service_id !== undefined) updateData.service_id = data.service_id;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.condition !== undefined) {
    if (!VALID_CONDITIONS.has(data.condition)) {
      return NextResponse.json(
        { error: "Invalid condition" },
        { status: 400 },
      );
    }
    updateData.condition = data.condition;
  }
  if (data.threshold_ms !== undefined) updateData.threshold_ms = data.threshold_ms;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;

  const rule = await updateAlertRule(id, updateData);
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await deleteAlertRule(parseInt(id, 10));
  return NextResponse.json({ success: true });
}

export const dynamic = "force-dynamic";
