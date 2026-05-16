/**
 * session-binding.ts
 *
 * Canonical, server-derived session identifier used as one of the inputs to
 * the confirmation-token HMAC. The value is derived from the authenticated
 * user_id + the session bearer token so the binding is both per-user and
 * per-login. Clients cannot influence this value, so a leaked chat sessionId
 * (or a copy of the audit row's `session_id` column) cannot be used to forge
 * a confirmation token under another user's identity.
 *
 * The exact value is opaque (sha256 hex digest). It is safe to store in
 * audit rows.
 */

import { createHash } from "node:crypto";

export function deriveCortexSessionId(userId: number, sessionToken: string): string {
	if (!Number.isInteger(userId) || userId <= 0) {
		throw new Error("deriveCortexSessionId: userId must be a positive integer");
	}
	if (typeof sessionToken !== "string" || sessionToken.length === 0) {
		throw new Error("deriveCortexSessionId: sessionToken must be a non-empty string");
	}
	return createHash("sha256")
		.update(`${userId}:${sessionToken}`)
		.digest("hex");
}
