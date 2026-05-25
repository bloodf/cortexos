import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/agents/scanner", () => ({
  scanAgents: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

import { GET } from "../route";
import { scanAgents } from "@/lib/agents/scanner";
import { requireAuth } from "@/lib/auth";

const mockScanAgents = vi.mocked(scanAgents);
const mockRequireAuth = vi.mocked(requireAuth);

describe("GET /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      error: null,
      session: { user_id: 1, username: "admin", token: "token", is_admin: true },
    });
  });

  it("returns agent groups with timestamp", async () => {
    const mockGroups = [
      {
        project: "hermes-primary",
        agents: [
          {
            slug: "coder",
            name: "Coder",
            project: "hermes-primary",
            agentDir: "/opt/test/.agents/coder",
            model: "sonnet",
            workspace: "/opt/test/.agents/coder",
            files: [{ id: "YWdlbnQubWQ", name: "agent.md", path: "/opt/test/.agents/coder/agent.md" }],
          },
        ],
      },
    ];

    mockScanAgents.mockResolvedValue(mockGroups);

    const response = await GET(new Request("http://localhost/api/agents"));
    const body = await response.json();

    expect(body.groups).toEqual(mockGroups);
    expect(typeof body.timestamp).toBe("number");
  });

  it("returns empty groups when no agents found", async () => {
    mockScanAgents.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/agents"));
    const body = await response.json();

    expect(body.groups).toEqual([]);
  });

  it("returns 500 on scanner error", async () => {
    mockScanAgents.mockRejectedValue(new Error("Scan failed"));

    const response = await GET(new Request("http://localhost/api/agents"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Scan failed");
  });
});
