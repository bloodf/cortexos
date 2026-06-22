import { describe, it, expect } from "vitest";
import {
  INTEGRATION_CATALOG,
  expandIntegrations,
  getIntegration,
} from "@/server/agents/generator/integration-catalog";
import { ARCHETYPE_CATALOG } from "@/server/agents/generator/archetype-catalog";

describe("integration catalog", () => {
  it("every integration MCP is actionable (preset OR command OR url)", () => {
    for (const t of INTEGRATION_CATALOG) {
      for (const m of t.mcps) {
        expect(Boolean(m.preset || m.command || m.url), `${t.id}/${m.name}`).toBe(true);
      }
    }
  });

  it("expandIntegrations resolves known ids and flags unknown ones", () => {
    const out = expandIntegrations(["github", "notion", "bogus"]);
    expect(out.unknown).toEqual(["bogus"]);
    expect(out.mcps.map((m) => m.name)).toEqual(expect.arrayContaining(["github", "notion"]));
    expect(out.credentialEnvKeys).toEqual(
      expect.arrayContaining(["GITHUB_PERSONAL_ACCESS_TOKEN", "NOTION_API_KEY"]),
    );
  });

  it("dedupes credential keys and handles empty/undefined", () => {
    expect(expandIntegrations(undefined).mcps).toEqual([]);
    const out = expandIntegrations(["github", "github"]);
    expect(out.credentialEnvKeys.filter((k) => k === "GITHUB_PERSONAL_ACCESS_TOKEN")).toHaveLength(1);
  });

  it("preset-based integrations carry a preset", () => {
    expect(getIntegration("linear")?.mcps[0]?.preset).toBe("linear");
    expect(getIntegration("n8n")?.mcps[0]?.preset).toBe("n8n");
  });
});

describe("archetype ↔ integration consistency", () => {
  it("every archetype's suggested integration ids exist in the integration catalog", () => {
    const ids = new Set(INTEGRATION_CATALOG.map((t) => t.id));
    for (const a of ARCHETYPE_CATALOG) {
      for (const integ of a.integrations) {
        expect(ids.has(integ), `${a.id} -> ${integ}`).toBe(true);
      }
    }
  });
});
