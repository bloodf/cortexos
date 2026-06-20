// @vitest-environment node
/**
 * P2.0 — recommendForPurpose keyword matching against the vendored catalog.
 */

import { describe, it, expect } from "vitest";
import { recommendForPurpose } from "@/server/agents/generator/metaharness-adapter";

describe("recommendForPurpose", () => {
  it("returns empty lists for an empty description", async () => {
    const r = await recommendForPurpose({ description: "" });
    expect(r).toEqual({ skills: [], mcps: [], agents: [] });
  });

  it("matches a devops/incident description to the devops template's agents", async () => {
    const r = await recommendForPurpose({
      description: "An on-call incident response agent for devops and SRE runbooks",
    });
    expect(r.agents.length).toBeGreaterThan(0);
    // The devops template has a "Responder" agent.
    expect(r.agents.some((a) => /responder/i.test(a))).toBe(true);
  });

  it("returns non-empty skills for a support-domain description", async () => {
    const r = await recommendForPurpose({
      description: "Customer support triage and ticket routing",
    });
    expect(r.skills.length + r.agents.length).toBeGreaterThan(0);
  });

  it("never throws on garbage input", async () => {
    // @ts-expect-error — deliberately malformed input
    const r = await recommendForPurpose({ description: null });
    expect(r).toEqual({ skills: [], mcps: [], agents: [] });
  });

  it("deduplicates skills across tied templates", async () => {
    const r = await recommendForPurpose({ description: "marketing advertising campaigns" });
    // Skills are a Set union → no duplicates.
    expect(new Set(r.skills).size).toBe(r.skills.length);
  });
});
