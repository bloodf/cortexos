import crypto from "crypto";
import { execFile } from "node:child_process";
import { cookies } from "next/headers";
import {
  getSessionByToken,
  deleteSession,
  createSession,
  getOrCreatePamUser,
  type PamUser,
} from "./db/admin";
import { authenticatePam } from "./pam";

const SESSION_COOKIE = "session_token";
const SESSION_DAYS = 7;
const ADMIN_GROUPS = ["cortexos-admin", "sudo"] as const;
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.DASHBOARD_ORIGIN?.startsWith("https://"));

export interface AuthUser extends PamUser {
  is_admin: boolean;
}

export async function checkGroupMembership(
  username: string,
  groups: readonly string[] = ADMIN_GROUPS,
): Promise<boolean> {
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile("id", ["-Gn", username], { timeout: 2000 }, (error, output) => {
        if (error) reject(error);
        else resolve(String(output));
      });
    });
    const userGroups = new Set(stdout.trim().split(/\s+/).filter(Boolean));
    return groups.some((group) => userGroups.has(group));
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createUserSession(
  userId: number,
  isAdmin: boolean = false,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createSession(userId, token, expiresAt, isAdmin);
  return { token, expiresAt };
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSession(): Promise<
  | { user: { id: number; username: string; is_admin: boolean }; token: string }
  | null
> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getSessionByToken(token);
  if (!session) return null;
  return {
    user: { id: session.user_id, username: session.username, is_admin: session.is_admin },
    token: session.token,
  };
}

export async function logout(): Promise<void> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSession(token);
  }
  await clearSessionCookie();
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthUser | null> {
  const normalized = username.trim();
  if (!normalized || !password) return null;
  try {
    await authenticatePam(normalized, password);
    const user = await getOrCreatePamUser(normalized);
    const isAdmin = await checkGroupMembership(normalized);
    return { ...user, is_admin: isAdmin };
  } catch {
    return null;
  }
}

export interface AuthSession {
	user_id: number;
	username: string;
	token: string;
	is_admin: boolean;
}

export interface AuthResult {
	error: Response | null;
	session: AuthSession | null;
}

export async function requireAuth(request: Request): Promise<AuthResult> {
	const authHeader = request.headers.get("authorization");
	let token = "";
	if (authHeader?.startsWith("Bearer ")) {
		token = authHeader.slice(7).trim();
	} else {
		const cookie = request.headers.get("cookie") || "";
		const match = cookie.match(/(?:^|;)\s*session_token=([^;]+)/);
		token = match?.[1]?.trim() || "";
	}

	if (!token) {
		return {
			error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
			session: null,
		};
	}

	const session = await getSessionByToken(token);
	if (!session) {
		return {
			error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
			session: null,
		};
	}

	return {
		error: null,
		session: {
			user_id: session.user_id,
			username: session.username,
			token: session.token,
			is_admin: session.is_admin === true,
		},
	};
}

/**
 * H-1: Admin gate. Wraps requireAuth and returns 403 + audit row when the
 * authenticated user is NOT admin. Audit insertion is best-effort; the deny
 * response is always returned synchronously.
 */
export async function requireAdmin(
	request: Request,
	auditCtx?: { tool: string },
): Promise<AuthResult> {
	const auth = await requireAuth(request);
	if (auth.error) return auth;
	if (!auth.session?.is_admin) {
		// Best-effort audit. Lazy import to avoid a load-time cycle.
		try {
			const mod = await import("./db/dashboard-audit");
			await mod
				.insertAuditRow({
					actor_user_id: auth.session?.user_id ?? null,
					tool: auditCtx?.tool ?? "admin.gate",
					tool_class: "privileged",
					args_hash: "non_admin",
					decision: "deny",
					decision_reason: "is_admin=false",
					result: "denied",
				})
				.catch(() => {});
		} catch {
			/* audit best-effort */
		}
		return {
			error: new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
				status: 403,
			}),
			session: auth.session,
		};
	}
	return auth;
}
