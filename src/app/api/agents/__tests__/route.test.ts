import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/agents/scanner", () => ({
  scanAgents: vi.fn(),
}));

import { GET } from "../route";
import { scanAgents } from "@/lib/agents/scanner";

const mockScanAgents = vi.mocked(scanAgents);

describe("GET /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns agent groups with timestamp", async () => {
    const mockGroups = [
      {
        project: "hermes-agents",
        agents: [
          {
            slug: "coder",
            name: "Coder",
            project: "hermes-agents",
            agentDir: "/opt/test/.agents/coder",
            model: "sonnet",
            workspace: "/opt/test/.agents/coder",
            files: [{ name: "agent.md", path: "/opt/test/.agents/coder/agent.md" }],
          },
        ],
      },
    ];

    mockScanAgents.mockResolvedValue(mockGroups);

    const response = await GET();
    const body = await response.json();

    expect(body.groups).toEqual(mockGroups);
    expect(typeof body.timestamp).toBe("number");
  });

  it("returns empty groups when no agents found", async () => {
    mockScanAgents.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(body.groups).toEqual([]);
  });

  it("returns 500 on scanner error", async () => {
    mockScanAgents.mockRejectedValue(new Error("Scan failed"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Scan failed");
  });
});
