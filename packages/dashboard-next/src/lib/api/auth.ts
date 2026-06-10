/**
 * Auth API client functions — RPC facade (WP-04, reworked per ADR-001).
 *
 * Transport = typed `createServerFn` RPC, NOT fetch("/api/auth/...").
 *
 * WP-20 (api auth) is not yet implemented. These stubs match the call shapes
 * Wave-2 expects so `import { auth } from "@/lib/api/client"` compiles and
 * Wave-2 WPs can be scaffolded. Each will throw "not yet wired" at runtime
 * until WP-20 provides the server functions.
 *
 * When WP-20 lands:
 *   1. Add `import { loginFn, logoutFn, meFn } from "./auth.functions"` here.
 *   2. Replace each stub body with the corresponding server fn call.
 *   3. Remove this TODO block.
 */
import type { User, Session } from "@cortexos/contracts/entities";

export interface AuthMeResult {
  user: User;
  session: Session;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResult {
  user: User;
  session: Session;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function notYetWired(fn: string): never {
  throw new Error(`[WP-04 TODO] auth.${fn} — server function not yet wired (WP-20 pending)`);
}

// ---------------------------------------------------------------------------
// Auth facade — TODO WP-20
// ---------------------------------------------------------------------------

/**
 * Login with username + password.
 * TODO WP-20: replace with `loginFn({ data: input })` call.
 */
export async function login(_input: LoginInput): Promise<LoginResult> {
  return notYetWired("login");
}

/**
 * Logout the current session.
 * TODO WP-20: replace with `logoutFn({ data: {} })` call.
 */
export async function logout(): Promise<{ ok: true }> {
  return notYetWired("logout");
}

/**
 * GET current user + session.
 * Throws a "not yet wired" error until WP-20 provides the server function.
 * TODO WP-20: replace with `meFn({ data: {} })` call.
 */
export async function me(): Promise<AuthMeResult> {
  return notYetWired("me");
}
