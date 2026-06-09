/**
 * Auth API client functions.
 *
 * These map to the /api/auth/* endpoints from 01-API-CONTRACT.md §Auth.
 * `me()` is the demo call for the WP-04 acceptance gate and the
 * Wave-2 `_authenticated` guard (WP-30).
 */
import { request } from "./http";
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

/**
 * POST /api/auth/login
 * Public endpoint — no auth required. Sets `cortexos_session` +
 * `cortexos_csrf` cookies on success. The body is sent as JSON;
 * CSRF is not required on login (first request bootstraps the cookie).
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  return request<LoginResult>("POST", "/api/auth/login", { body: input });
}

/**
 * POST /api/auth/logout
 * Clears the session cookie. Requires a valid session.
 */
export async function logout(): Promise<{ ok: true }> {
  return request<{ ok: true }>("POST", "/api/auth/logout");
}

/**
 * GET /api/auth/me
 * Returns the current user + session. Throws ApiClientError(code="auth",
 * status=401) when not authenticated. This is the demo acceptance-gate call
 * for WP-04 and the Wave-2 authenticated guard.
 */
export async function me(): Promise<AuthMeResult> {
  return request<AuthMeResult>("GET", "/api/auth/me");
}
