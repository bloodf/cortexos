import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readEnvFile, readEnvFileRaw } from "@/lib/secrets/vps-reader";
import { writeEnvFile } from "@/lib/secrets/vps-writer";
import { insertAuditRow } from "@/lib/db/tool-audit";
import { deriveCortexSessionId } from "@/lib/ai/session-binding";
import type { PathDeniedError } from "@/lib/secrets/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256hex(s: string): string {
	return createHash("sha256").update(s).digest("hex");
}

function isPathDenied(err: unknown): err is PathDeniedError {
	return err instanceof Error && (err as PathDeniedError).code === "EPATHDENIED";
}

function isEnvKeyError(err: unknown): boolean {
	return err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === "EENVKEY";
}

function isEnvParseError(err: unknown): boolean {
	return err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === "EENVPARSE";
}

function isNotFound(err: unknown): boolean {
	return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}

// Never include cleartext values in error messages.
function safeErrorMessage(err: unknown): string {
	if (err instanceof Error) {
		// Strip anything that looks like a value (after '=') from the message.
		return err.message.replace(/=.*/g, "=(redacted)");
	}
	return "Internal server error";
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "env.read" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const absPath = searchParams.get("path") ?? "";
	const reveal = searchParams.get("reveal") === "true";
	const keysParam = searchParams.get("keys") ?? "";

	if (!absPath) {
		return NextResponse.json({ error: "path query param required", code: "EVALIDATION" }, { status: 400 });
	}

	// Reveal mode: return specific keys' cleartext values.
	if (reveal) {
		if (!keysParam) {
			return NextResponse.json(
				{ error: "keys param required when reveal=true", code: "EVALIDATION" },
				{ status: 400 },
			);
		}
		const requestedKeys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
		const sortedKeys = [...requestedKeys].sort();
		const argsHash = sha256hex(`${absPath}|${sortedKeys.join(",")}`);
		const userId = auth.session?.user_id;
		const sessionToken = auth.session?.token;
		if (!userId || !sessionToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const cortexSessionId = deriveCortexSessionId(userId, sessionToken);

		// Audit BEFORE reading cleartext.
		await insertAuditRow({
			actor_user_id: userId,
			session_id: cortexSessionId,
			tool: "env_reveal",
			tool_class: "privileged",
			args_hash: argsHash,
			decision: "allow",
			result: "ok",
			before_state_hash: null,
			after_state_hash: null,
		}).catch(() => {});

		try {
			const lines = await readEnvFileRaw(absPath, { reveal: true });
			const result: Record<string, string | null> = {};
			for (const key of requestedKeys) {
				const line = lines.find((l) => l.type === "kv" && l.key === key);
				result[key] = line?.value ?? null;
			}
			return NextResponse.json({ path: absPath, keys: result });
		} catch (err) {
			if (isPathDenied(err)) return NextResponse.json({ error: "Path not permitted", code: "EPATHDENIED" }, { status: 403 });
			if (isNotFound(err)) return NextResponse.json({ error: "File not found", code: "ENOTFOUND" }, { status: 404 });
			if (isEnvParseError(err)) return NextResponse.json({ error: safeErrorMessage(err), code: "EENVPARSE" }, { status: 422 });
			return NextResponse.json({ error: "Internal server error" }, { status: 500 });
		}
	}

	// Normal masked read.
	const argsHash = sha256hex(absPath);

	// Audit BEFORE reading.
	await insertAuditRow({
		actor_user_id: auth.session?.user_id ?? null,
		tool: "env.read",
		tool_class: "privileged",
		args_hash: argsHash,
		decision: "allow",
		result: "ok",
		before_state_hash: null,
		after_state_hash: null,
	}).catch(() => {});

	try {
		const lines = await readEnvFile(absPath);
		return NextResponse.json({ path: absPath, lines });
	} catch (err) {
		if (isPathDenied(err)) return NextResponse.json({ error: "Path not permitted", code: "EPATHDENIED" }, { status: 403 });
		if (isNotFound(err)) return NextResponse.json({ error: "File not found", code: "ENOTFOUND" }, { status: 404 });
		if (isEnvParseError(err)) return NextResponse.json({ error: safeErrorMessage(err), code: "EENVPARSE" }, { status: 422 });
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// POST — write updates
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "env.write" });
	if (auth.error) return auth.error;

	let body: { path?: unknown; updates?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const absPath = typeof body.path === "string" ? body.path.trim() : "";
	if (!absPath) {
		return NextResponse.json({ error: "path is required", code: "EVALIDATION" }, { status: 400 });
	}

	if (!Array.isArray(body.updates) || body.updates.length === 0) {
		return NextResponse.json({ error: "updates must be a non-empty array", code: "EVALIDATION" }, { status: 400 });
	}

	const updates = body.updates as Array<{ key?: unknown; value?: unknown }>;
	for (const u of updates) {
		if (typeof u.key !== "string" || !u.key) {
			return NextResponse.json({ error: "Each update must have a string key", code: "EVALIDATION" }, { status: 400 });
		}
		if (u.value !== null && typeof u.value !== "string") {
			return NextResponse.json({ error: "Each update value must be a string or null", code: "EVALIDATION" }, { status: 400 });
		}
	}

	const userId = auth.session?.user_id;
	const sessionToken = auth.session?.token;
	if (!userId || !sessionToken) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const cortexSessionId = deriveCortexSessionId(userId, sessionToken);
	const argsHash = sha256hex(absPath);

	try {
		const result = await writeEnvFile(
			absPath,
			updates.map((u) => ({ key: u.key as string, value: u.value as string | null })),
		);

		// Audit after successful write with before/after hashes.
		await insertAuditRow({
			actor_user_id: userId,
			session_id: cortexSessionId,
			tool: "env.write",
			tool_class: "privileged",
			args_hash: argsHash,
			decision: "allow",
			result: "ok",
			before_state_hash: result.beforeSha256,
			after_state_hash: result.afterSha256,
		}).catch(() => {});

		return NextResponse.json({
			beforeSha256: result.beforeSha256,
			afterSha256: result.afterSha256,
		});
	} catch (err) {
		// Never surface cleartext in error.
		if (isPathDenied(err)) return NextResponse.json({ error: "Path not permitted", code: "EPATHDENIED" }, { status: 403 });
		if (isEnvKeyError(err)) return NextResponse.json({ error: safeErrorMessage(err), code: "EENVKEY" }, { status: 400 });
		if (isEnvParseError(err)) return NextResponse.json({ error: safeErrorMessage(err), code: "EENVPARSE" }, { status: 422 });
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
