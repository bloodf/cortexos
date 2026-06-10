import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User as ContractUser } from "@cortexos/contracts/entities";
import { login as loginFn, logout as logoutFn, me as meFn } from "@/lib/api/auth.functions";

export interface AuthUser {
  username: string;
  is_admin: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  /** True until the initial `me()` session probe resolves. */
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  /** @deprecated kept for backwards-compat; role now comes from real PAM groups. */
  switchUser: (admin: boolean) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Request header the server double-submits the CSRF cookie against. */
const CSRF_HEADER = "x-csrf-token";

/** Read the JS-readable CSRF cookie so mutations can echo it (double-submit). */
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cortexos_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Map a contract User → the shell's AuthUser shape. */
function toAuthUser(u: ContractUser): AuthUser {
  return { username: u.username, is_admin: u.isAdmin };
}

// The gate-middleware pattern (defineServerFn + serverFnNoop) makes TypeScript
// infer the server-fn return as `undefined`; the real payload is carried by the
// gate at runtime. Recover the typed call shapes at this single boundary.
type LoginResult = { user: ContractUser | null; session: unknown };
type MeResult = { user: ContractUser | null; session: unknown };
const callLogin = loginFn as unknown as (opts: {
  data: { username: string; password: string };
}) => Promise<LoginResult>;
const callLogout = logoutFn as unknown as (opts: {
  headers?: Record<string, string>;
}) => Promise<{ ok: true }>;
const callMe = meFn as unknown as (opts?: { data?: Record<string, never> }) => Promise<MeResult>;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from the live session on mount (handles reload without re-login).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await callMe({ data: {} });
        if (!cancelled) setUser(res.user ? toAuthUser(res.user) : null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // login is auth:'public' — the server skips CSRF (pre-session) and sets the
    // session + CSRF cookies on success. Cookie is authoritative; mirror the
    // returned user into React state for the shell.
    const res = await callLogin({ data: { username, password } });
    setUser(res.user ? toAuthUser(res.user) : null);
  }, []);

  const logout = useCallback(async () => {
    // logout is auth:'any' — a mutation; echo the session-bound CSRF cookie in
    // the x-csrf-token header (double-submit). Idempotent; clear state regardless.
    const csrf = readCsrfCookie();
    try {
      await callLogout(csrf ? { headers: { [CSRF_HEADER]: csrf } } : {});
    } catch {
      /* clear local state even if the network call fails */
    }
    setUser(null);
  }, []);

  const switchUser = useCallback((_admin: boolean) => {
    /* no-op: role comes from PAM groups */
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, logout, switchUser }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
