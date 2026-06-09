import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser { username: string; is_admin: boolean }
interface AuthCtx {
  user: AuthUser | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  /** @deprecated kept for backwards-compat; the app only has admin role. */
  switchUser: (admin: boolean) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "cortex.auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        // Single-role app: force admin always.
        setUser({ username: parsed.username ?? "admin", is_admin: true });
      }
    } catch { /* noop */ }
  }, []);

  const persist = (u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch { /* noop */ }
  };

  const login = async (username: string, password: string) => {
    await new Promise((r) => setTimeout(r, 400));
    if (!username || !password) throw new Error("Invalid credentials");
    // Onsite operator dashboard — only admin role exists.
    persist({ username, is_admin: true });
  };

  const logout = () => persist(null);
  const switchUser = (_admin: boolean) => { /* no-op: single admin role */ };

  return <Ctx.Provider value={{ user, login, logout, switchUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
