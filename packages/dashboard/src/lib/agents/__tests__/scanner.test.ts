import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent, Stats } from "node:fs";

// Mock fs/promises before importing scanner
vi.mock("node:fs/promises", () => {
  const fsMock = {
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
  return { ...fsMock, default: fsMock };
});

import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import {
  scanAgents,
  getAgentFiles,
  readAgentFile,
  writeAgentFile,
} from "../scanner";

const mockReaddir = vi.mocked(readdir);
const mockStat = vi.mocked(stat);
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "",
    path: "",
  } as Dirent;
}

describe("scanner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: AGENT_SCAN_PATHS points to test root
    process.env.AGENT_SCAN_PATHS = "/test/root";
  });

  describe("scanAgents", () => {
    it("finds agents in .agents directories", async () => {
      // /test/root -> readdir returns [hermes-agents]
      mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);

      // Walk: /test/root
      mockReaddir.mockImplementation(((path: string, _opts?: unknown) => {
        if (path === "/test/root") {
          return Promise.resolve([makeDirent("hermes-agents", true)]);
        }
        if (path === "/test/root/hermes-agents") {
          return Promise.resolve([makeDirent(".agents", true)]);
        }
        // .agents dir lists agent subdirs
        if (path === "/test/root/hermes-agents/.agents") {
          return Promise.resolve([
            makeDirent("coder", true),
            makeDirent("reviewer", true),
          ]);
        }
        // Agent dirs list .md files
        if (path === "/test/root/hermes-agents/.agents/coder") {
          return Promise.resolve([
            makeDirent("agent.md", false),
            makeDirent("soul.md", false),
          ]);
        }
        if (path === "/test/root/hermes-agents/.agents/reviewer") {
          return Promise.resolve([makeDirent("agent.md", false)]);
        }
        return Promise.resolve([]);
      }) as typeof readdir);

      const groups = await scanAgents();

      expect(groups).toHaveLength(1);
      expect(groups[0].project).toBe("hermes-agents");
      expect(groups[0].agents).toHaveLength(2);
      expect(groups[0].agents[0].slug).toBe("coder");
      expect(groups[0].agents[0].name).toBe("Coder");
      expect(groups[0].agents[0].files).toHaveLength(2);
      expect(groups[0].agents[1].slug).toBe("reviewer");
    });

    it("handles missing scan root gracefully", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT"));

      const groups = await scanAgents();
      expect(groups).toHaveLength(0);
    });

    it("handles multiple scan roots", async () => {
      process.env.AGENT_SCAN_PATHS = "/root1,/root2";

      // Both roots exist but only root1 has agents
      mockStat.mockImplementation(((path: string) => {
        if (path === "/root1") return Promise.resolve({ isDirectory: () => true } as Stats);
        if (path === "/root2") return Promise.resolve({ isDirectory: () => true } as Stats);
        return Promise.reject(new Error("ENOENT"));
      }) as typeof stat);

      mockReaddir.mockImplementation(((path: string, _opts?: unknown) => {
        if (path === "/root1") {
          return Promise.resolve([makeDirent("proj", true)]);
        }
        if (path === "/root1/proj") {
          return Promise.resolve([makeDirent(".agents", true)]);
        }
        if (path === "/root1/proj/.agents") {
          return Promise.resolve([makeDirent("writer", true)]);
        }
        if (path === "/root1/proj/.agents/writer") {
          return Promise.resolve([makeDirent("agent.md", false)]);
        }
        if (path === "/root2") {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }) as typeof readdir);

      const groups = await scanAgents();
      expect(groups).toHaveLength(1);
      expect(groups[0].agents[0].slug).toBe("writer");
    });

    it("reads Hermes registry string models and profile role files", async () => {
      process.env.AGENT_SCAN_PATHS = "/hermes/profiles";
      process.env.HERMES_BASE = "/hermes";
      mockReadFile.mockResolvedValue(JSON.stringify({
        agents: {
          list: [{
            id: "cortex-coder",
            name: "Coder",
            workspace: "/home/node/hermes/workspaces/cortex",
            model: "9router/cx/gpt-5.5",
            identity: { name: "Cortex Coder", emoji: "🤖" },
          }],
        },
      }) as never);
      mockReaddir.mockImplementation(((path: string, _opts?: unknown) => {
        if (path === "/hermes/profiles/cortex-coder") {
          return Promise.resolve([
            makeDirent("agent.md", false),
            makeDirent("tools.md", false),
          ]);
        }
        return Promise.resolve([]);
      }) as typeof readdir);

      const groups = await scanAgents();

      expect(groups).toHaveLength(1);
      expect(groups[0].agents[0].model).toBe("gpt-5.5");
      expect(groups[0].agents[0].workspace).toBe("/hermes/workspaces/cortex");
      expect(groups[0].agents[0].files).toHaveLength(2);
      expect(mockReaddir).toHaveBeenCalledWith(
        "/hermes/profiles/cortex-coder",
        { withFileTypes: true },
      );
      delete process.env.HERMES_BASE;
    });
  });

  describe("getAgentFiles", () => {
    it("returns only .md files sorted by name", async () => {
      (mockReaddir as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeDirent("soul.md", false),
        makeDirent("agent.md", false),
        makeDirent("config.json", false),
        makeDirent("subdir", true),
      ]);

      const files = await getAgentFiles("/some/agent/dir");

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe("agent.md");
      expect(files[1].name).toBe("soul.md");
    });

    it("returns empty array for missing dir", async () => {
      mockReaddir.mockRejectedValue(new Error("ENOENT"));
      const files = await getAgentFiles("/missing");
      expect(files).toHaveLength(0);
    });
  });

  describe("readAgentFile", () => {
    it("reads file within scan root", async () => {
      mockReadFile.mockResolvedValue("# Agent Content" as never);

      const content = await readAgentFile("/test/root/proj/.agents/coder/agent.md");
      expect(content).toBe("# Agent Content");
      expect(mockReadFile).toHaveBeenCalledWith(
        "/test/root/proj/.agents/coder/agent.md",
        "utf-8",
      );
    });

    it("rejects path traversal attempts", async () => {
      await expect(
        readAgentFile("/etc/passwd"),
      ).rejects.toThrow("Access denied: path outside scan roots");
    });

    it("rejects relative traversal within path", async () => {
      await expect(
        readAgentFile("/test/root/../../../etc/passwd"),
      ).rejects.toThrow("Access denied: path outside scan roots");
    });
  });

  describe("writeAgentFile", () => {
    it("writes file within scan root", async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await writeAgentFile("/test/root/proj/.agents/coder/agent.md", "new content");
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/test/root/proj/.agents/coder/agent.md",
        "new content",
        "utf-8",
      );
    });

    it("rejects path traversal attempts", async () => {
      await expect(
        writeAgentFile("/etc/shadow", "malicious"),
      ).rejects.toThrow("Access denied: path outside scan roots");
    });
  });
});
