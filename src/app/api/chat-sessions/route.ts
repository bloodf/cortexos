import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getChatSession, upsertChatSession } from "@/lib/db/chat-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	try {
		const session = await getChatSession(auth.session!.user_id);
		if (!session) {
			// Return default state — no session row yet.
			return NextResponse.json({
				session: { panel_open: false, width: 360, messages: [] },
			});
		}
		return NextResponse.json({ session });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	let body: { panel_open?: unknown; width?: unknown; messages?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const patch: Parameters<typeof upsertChatSession>[1] = {};

	if (body.panel_open !== undefined) {
		if (typeof body.panel_open !== "boolean") {
			return NextResponse.json(
				{ error: "panel_open must be a boolean", code: "EVALIDATION" },
				{ status: 400 },
			);
		}
		patch.panel_open = body.panel_open;
	}

	if (body.width !== undefined) {
		if (typeof body.width !== "number") {
			return NextResponse.json(
				{ error: "width must be a number", code: "EVALIDATION" },
				{ status: 400 },
			);
		}
		patch.width = body.width;
	}

	if (body.messages !== undefined) {
		if (!Array.isArray(body.messages)) {
			return NextResponse.json(
				{ error: "messages must be an array", code: "EVALIDATION" },
				{ status: 400 },
			);
		}
		patch.messages = body.messages;
	}

	try {
		const session = await upsertChatSession(auth.session!.user_id, patch);
		return NextResponse.json({ session });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("must be") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}
