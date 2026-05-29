import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionByToken } from "@/lib/db/admin";

// /api/audit/events is a machine ingest endpoint guarded by its own
// Bearer CORTEX_AUDIT_INGEST_TOKEN check (see the route handler) — it must
// bypass the session-cookie gate so producers (sandbox runner, etc.) can post.
const PUBLIC_PREFIXES = ["/api/auth", "/api/audit/events", "/_next", "/favicon"];
const INTERNAL_TOKEN = process.env.CORTEX_INTERNAL_TOKEN || process.env.CORTEX_MASTER_KEY;
const PUBLIC_PATHS = ["/", "/login", "/setup"];
const SESSION_CACHE = new Map<string, number>();
const SESSION_CACHE_MS = 5 * 60 * 1000;

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/)/, "");
}

function isPublicPath(pathname: string): boolean {
  const pathWithoutLocale = stripLocale(pathname);
  return (
    PUBLIC_PREFIXES.some((p) => pathWithoutLocale.startsWith(p)) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_PATHS.includes(pathWithoutLocale)
  );
}

async function isValidSession(token: string): Promise<boolean> {
  const cachedUntil = SESSION_CACHE.get(token);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  try {
    const session = await getSessionByToken(token);
    if (!session) return false;
    SESSION_CACHE.set(token, Date.now() + SESSION_CACHE_MS);
    return true;
  } catch {
    return false;
  }
}

function unauthorized(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locale = pathname.match(/^\/([a-z]{2}(-[a-z]{2})?)\//)?.[1] ?? "en";
  return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const internalToken = request.headers.get("x-cortex-internal-token");
  if (INTERNAL_TOKEN && internalToken === INTERNAL_TOKEN) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session_token")?.value;
  if (!token) return unauthorized(request);

  const valid = await isValidSession(token);
  if (!valid) return unauthorized(request);

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
