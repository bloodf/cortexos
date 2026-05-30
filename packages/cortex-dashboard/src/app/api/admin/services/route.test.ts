// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PATCH, DELETE } from "./route";

vi.mock("@/lib/auth", () => {
  const handler = vi.fn().mockImplementation(async (req: Request) => {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
    }
    return { error: null, session: { user_id: 1, username: "admin", token, is_admin: true } };
  });
  return { requireAuth: handler, requireAdmin: handler };
});

vi.mock("@/lib/db/client", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/db/service", () => ({
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
}));

import { query } from "@/lib/db/client";
import { createService, updateService, deleteService } from "@/lib/db/service";

function authReq(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      ...((init?.headers as Record<string, string>) || {}),
      authorization: "Bearer test-token",
    },
  });
}

const baseService = {
  id: 1,
  slug: "test",
  name: "Test",
  url: "http://localhost",
  health_url: "http://localhost/health",
  health_type: "http" as const,
  category: "Infra",
  icon_type: "auto",
  icon_color: null,
  icon_image: null,
  sort_order: 0,
  is_active: true,
  has_webui: true,
  show_in_healthcheck: true,
  show_in_webui: true,
};

describe("admin/services route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns active services by default", async () => {
    (query as any).mockResolvedValue([baseService]);

    const res = await GET(authReq("http://localhost/api/admin/services"));
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect((query as any).mock.calls[0][0]).toContain("is_active = true");
  });

  it("GET returns all services with ?all=1", async () => {
    (query as any).mockResolvedValue([{ ...baseService, is_active: false }]);

    const res = await GET(authReq("http://localhost/api/admin/services?all=1"));
    const json = await res.json();
    expect(json.services[0].is_active).toBe(false);
    expect((query as any).mock.calls[0][0]).not.toContain("is_active = true");
  });

  it("POST creates service with new fields", async () => {
    (createService as any).mockResolvedValue(baseService);

    const res = await POST(
      authReq("http://localhost/api/admin/services", {
        method: "POST",
        body: JSON.stringify({
          slug: "test",
          name: "Test",
          url: "http://localhost",
          health_url: "http://localhost/health",
          health_type: "http",
          category: "Infra",
          has_webui: true,
          show_in_healthcheck: true,
          show_in_webui: true,
        }),
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.service).toEqual(baseService);
  });

  it("POST accepts check_type alias", async () => {
    (createService as any).mockResolvedValue({ ...baseService, health_type: "tcp" });

    const res = await POST(
      authReq("http://localhost/api/admin/services", {
        method: "POST",
        body: JSON.stringify({
          slug: "tcp-svc",
          name: "TCP",
          check_type: "tcp",
        }),
      }),
    );
    const json = await res.json();
    expect(json.service.health_type).toBe("tcp");
  });

  it("PATCH updates new fields", async () => {
    (updateService as any).mockResolvedValue({ ...baseService, has_webui: false });

    const res = await PATCH(
      authReq("http://localhost/api/admin/services", {
        method: "PATCH",
        body: JSON.stringify({ id: 1, has_webui: false }),
      }),
    );
    const json = await res.json();
    expect(json.service.has_webui).toBe(false);
  });

  it("DELETE removes service", async () => {
    (deleteService as any).mockResolvedValue(undefined);

    const res = await DELETE(authReq("http://localhost/api/admin/services?id=1"));
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 401 without auth", async () => {
    const res = await GET(new Request("http://localhost/api/admin/services"));
    expect(res.status).toBe(401);
  });
});
