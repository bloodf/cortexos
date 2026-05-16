import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.CORTEX_INTERNAL_TOKEN = "secret-token";
});

vi.mock("@/lib/db/admin", () => ({
  getSessionByToken: vi.fn(),
}));

import { middleware } from "./middleware";
import { getSessionByToken } from "@/lib/db/admin";

const fetchSpy = vi.spyOn(global, "fetch");

function makeRequest(opts: {
  pathname: string;
  cookie?: string;
  headers?: Record<string, string>;
}) {
  const url = new URL(`http://test.local${opts.pathname}`);
  return {
    nextUrl: { pathname: url.pathname },
    url: url.toString(),
    cookies: {
      get: (name: string) =>
        opts.cookie && name === "session_token"
          ? { value: opts.cookie }
          : undefined,
    },
    headers: {
      get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null,
    },
  } as any;
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockReset();
  });

  it("never makes an HTTP fetch (regression: self-fetch caused TLS failure)", async () => {
    (getSessionByToken as any).mockResolvedValue({
      id: 1,
      user_id: 1,
      token: "valid",
    });
    await middleware(makeRequest({ pathname: "/en/overview", cookie: "valid" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows authenticated request with valid session", async () => {
    (getSessionByToken as any).mockResolvedValue({
      id: 1,
      user_id: 1,
      token: "valid",
    });
    const res = await middleware(
      makeRequest({ pathname: "/en/overview", cookie: "valid" }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 JSON for unauthenticated /api/* requests", async () => {
    (getSessionByToken as any).mockResolvedValue(null);
    const res = await middleware(
      makeRequest({ pathname: "/api/system", cookie: "bad" }),
    );
    expect(res.status).toBe(401);
  });

  it("redirects unauthenticated page requests to /<locale>/login", async () => {
    const res = await middleware(makeRequest({ pathname: "/en/overview" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/login");
  });

  it("allows public paths without DB lookup", async () => {
    const res = await middleware(makeRequest({ pathname: "/en/login" }));
    expect(res.status).toBe(200);
    expect(getSessionByToken).not.toHaveBeenCalled();
  });

  it("allows internal token bypass without DB lookup", async () => {
    const res = await middleware(
      makeRequest({
        pathname: "/api/system",
        headers: { "x-cortex-internal-token": "secret-token" },
      }),
    );
    expect(res.status).toBe(200);
    expect(getSessionByToken).not.toHaveBeenCalled();
  });
});
