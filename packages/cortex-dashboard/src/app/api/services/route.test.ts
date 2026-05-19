// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db/service", () => ({
  getAllServices: vi.fn(),
}));

import { getAllServices } from "@/lib/db/service";

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

describe("services route GET filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("raw=1 returns all active services", async () => {
    (getAllServices as any).mockResolvedValue([baseService]);

    const res = await GET(new Request("http://localhost/api/services?raw=1"));
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].slug).toBe("test");
  });

  it("filters by check_type", async () => {
    (getAllServices as any).mockResolvedValue([
      baseService,
      { ...baseService, id: 2, slug: "tcp", health_type: "tcp" },
    ]);

    const res = await GET(new Request("http://localhost/api/services?raw=1&check_type=tcp"));
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].health_type).toBe("tcp");
  });

  it("filters by health_type alias", async () => {
    (getAllServices as any).mockResolvedValue([
      baseService,
      { ...baseService, id: 2, slug: "tcp", health_type: "tcp" },
    ]);

    const res = await GET(new Request("http://localhost/api/services?raw=1&health_type=tcp"));
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].health_type).toBe("tcp");
  });

  it("filters by webui=true", async () => {
    (getAllServices as any).mockResolvedValue([
      baseService,
      { ...baseService, id: 2, slug: "noweb", has_webui: false, show_in_webui: false },
    ]);

    const res = await GET(new Request("http://localhost/api/services?raw=1&webui=true"));
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].slug).toBe("test");
  });

  it("filters by healthcheck=true", async () => {
    (getAllServices as any).mockResolvedValue([
      baseService,
      { ...baseService, id: 2, slug: "nohc", show_in_healthcheck: false },
    ]);

    const res = await GET(new Request("http://localhost/api/services?raw=1&healthcheck=true"));
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].slug).toBe("test");
  });
});
