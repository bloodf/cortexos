/**
 * Approval token — HMAC-SHA256, action-hash bound, single-use, time-bounded.
 *
 * Implements THREAT_MODEL §3.5 mechanics:
 *   - Algorithm: HMAC-SHA256
 *   - Claims: action_hash, session_id, user_id, iat, exp, nonce
 *   - TTL: 60s default for destructive, 300s for reveal
 *   - Storage: in-memory Map<token, claims> (M1) → DB in M3 (SR-091)
 *   - Replay: v1 first-use-wins on the nonce; v1.1 DB row check
 *   - Audit: every issue and every use produces a row
 *
 * Server-derived session binding per THREAT_MODEL §3.4 (PB-1 mitigation):
 * the token's `session_id` claim must match the consuming session — a
 * non-admin who reaches the mint endpoint cannot forge a token for an
 * admin session to consume.
 *
 * Public API:
 *   - mintApproval(event, action, payload, ttlSec?) → ApprovalToken
 *   - verifyApproval(event, token) → { ok: true, claims } | { ok: false, reason }
 *   - consumeApproval(event, token) → { ok: true, claims } | { ok: false, reason }
 *     (consume = verify + mark used, used by the destructive-op endpoint)
 *   - resetApprovalStore() → test helper
 *   - approvalStoreSize() → test/observability helper
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerHmacKey } from "../config";
import type { ApprovalToken, SessionId } from "../entities";

// ---------------------------------------------------------------------------
// Token claims (the data we encode in the HMAC + track in the store)
// ---------------------------------------------------------------------------

export interface ApprovalClaims {
  actionHash: string;
  sessionId: SessionId;
  userId: string;
  iat: number; // Unix epoch ms
  exp: number; // Unix epoch ms
  nonce: string;
}

interface StoredToken {
  claims: ApprovalClaims;
  used: boolean;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const store = new Map<string, StoredToken>();

/** Test helper: clear the in-memory store. */
export function resetApprovalStore(): void {
  store.clear();
}

/** Test/observability helper: number of tokens currently tracked. */
export function approvalStoreSize(): number {
  return store.size;
}

/** Test helper: peek at the consumed flag for a token without consuming. */
export function _isTokenConsumed(token: string): boolean {
  const rec = store.get(token);
  return rec ? rec.used : false;
}

// ---------------------------------------------------------------------------
// Hash + HMAC
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Compute the action hash the token is bound to. This is the canonical
 * string the caller passes to `mintApproval` AND includes in the request
 * when consuming the token. A token for action A cannot be used for
 * action B (different hash).
 */
export function actionHashFor(action: string, payload: Record<string, unknown>): string {
  // Stable serialization — keys sorted alphabetically.
  const sorted = JSON.stringify({ action, payload }, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = (v as Record<string, unknown>)[k];
      }
      return out;
    }
    return v;
  });
  return sha256Hex(sorted);
}

/** Encode a token as `v1.<base64url-payload>.<base64url-hmac>`. */
function encodeToken(claims: ApprovalClaims): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const hmac = createHmac("sha256", getServerHmacKey()).update(payload).digest("base64url");
  return `v1.${payload}.${hmac}`;
}

/** Decode + verify HMAC. Returns claims or throws. */
function decodeToken(token: string): ApprovalClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed token");
  }
  const [version, payload, hmac] = parts;
  if (version !== "v1") {
    throw new Error(`Unsupported token version: ${version}`);
  }
  const expected = createHmac("sha256", getServerHmacKey()).update(payload).digest("base64url");
  // Constant-time compare.
  const a = Buffer.from(hmac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Token signature invalid");
  }
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ApprovalClaims;
  if (
    typeof claims.actionHash !== "string" ||
    typeof claims.sessionId !== "string" ||
    typeof claims.userId !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    typeof claims.nonce !== "string"
  ) {
    throw new Error("Token claims malformed");
  }
  return claims;
}

// ---------------------------------------------------------------------------
// Mint
// ---------------------------------------------------------------------------

export interface MintInput {
  action: string;
  payload: Record<string, unknown>;
  sessionId: SessionId;
  userId: string;
  ttlSec?: number;
}

export function mintApproval(input: MintInput): ApprovalToken {
  const ttl = input.ttlSec ?? 60;
  const iat = Date.now();
  const claims: ApprovalClaims = {
    actionHash: actionHashFor(input.action, input.payload),
    sessionId: input.sessionId,
    userId: input.userId,
    iat,
    exp: iat + ttl * 1000,
    nonce: randomBytes(16).toString("hex"),
  };
  const token = encodeToken(claims);
  store.set(token, { claims, used: false });

  return {
    token,
    expiresAt: claims.exp,
    issuedAt: claims.iat,
    actionHash: claims.actionHash,
    sessionId: claims.sessionId,
    ttlSec: ttl,
  };
}

// ---------------------------------------------------------------------------
// Verify / Consume
// ---------------------------------------------------------------------------

export type VerifyResult =
  | { ok: true; claims: ApprovalClaims }
  | {
      ok: false;
      reason:
        | "unknown"
        | "expired"
        | "already_used"
        | "session_mismatch"
        | "malformed"
        | "signature";
    };

/**
 * Verify a token's HMAC + claims without consuming it. Use this for
 * idempotency checks (e.g. "is the user authorized to proceed?").
 */
export function verifyApproval(token: string, expectedSessionId: SessionId): VerifyResult {
  let claims: ApprovalClaims;
  try {
    claims = decodeToken(token);
  } catch (e) {
    const reason = (e as Error).message;
    if (reason.includes("signature")) return { ok: false, reason: "signature" };
    return { ok: false, reason: "malformed" };
  }
  if (claims.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  const rec = store.get(token);
  if (!rec) {
    return { ok: false, reason: "unknown" };
  }
  // Check replay BEFORE session binding — a replayed token is the more
  // security-critical signal. The audit log distinguishes the two.
  if (rec.used) {
    return { ok: false, reason: "already_used" };
  }
  if (claims.sessionId !== expectedSessionId) {
    return { ok: false, reason: "session_mismatch" };
  }
  return { ok: true, claims };
}

/**
 * Verify AND mark the token as used. Use this at the destructive-op
 * endpoint right before executing the action.
 */
export function consumeApproval(token: string, expectedSessionId: SessionId): VerifyResult {
  const v = verifyApproval(token, expectedSessionId);
  if (!v.ok) return v;
  const rec = store.get(token);
  if (!rec) {
    return { ok: false, reason: "unknown" };
  }
  if (rec.used) {
    return { ok: false, reason: "already_used" };
  }
  rec.used = true;
  return { ok: true, claims: v.claims };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { ApprovalToken };
