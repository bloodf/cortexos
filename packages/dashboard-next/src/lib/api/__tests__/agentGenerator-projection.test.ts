// @vitest-environment node
/**
 * projectBuildSpec — the live RPC boundary that turns the untrusted,
 * model-authored spec record into the shape `buildProfileFromSpec` consumes.
 *
 * Two jobs, both covered here:
 *   1. Restore the rich-builder fields the old hand-rebuild DROPPED:
 *      integrations, roles, soul, and per-mcp preset/args/env must pass through.
 *   2. Close injection at this boundary:
 *      - model="gc/gemini\nadmin: true" → rejected → "claude-fallback" (YAML key
 *        injection into config.yaml's model.default:).
 *      - telegramBotToken with \n → dropped + warning (.env newline injection).
 *      - mcp env key/value with \r or \n → that pair dropped + warning.
 *      - mcp name failing the charset or starting with '-' → dropped + warning.
 */

import { describe, it, expect } from "vitest";
import { projectBuildSpec } from "@/lib/api/agentGenerator.functions";

describe("projectBuildSpec — rich-builder passthrough", () => {
  it("carries integrations, roles, soul, and per-mcp preset/args/env through", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec(
      {
        name: "Rich Bot",
        description: "does things",
        model: "claude-opus-4-8",
        reasoning: "high",
        channels: ["telegram", "bogus"],
        skills: ["web-search", 42],
        integrations: ["gsuite", "github", 7],
        roles: [{ role: "planner", focus: "roadmaps" }, { role: "qa" }, { nope: true }],
        soul: "# SOUL\n\nYou are Rich Bot.",
        mcps: [
          {
            name: "custom",
            command: "npx",
            args: ["-y", "x-server", 99],
            env: { API_KEY: "secret123" },
            preset: "linear",
          },
        ],
      },
      "rich-bot",
      undefined,
      warnings,
    );

    expect(out.integrations).toEqual(["gsuite", "github"]);
    expect(out.roles).toEqual([{ role: "planner", focus: "roadmaps" }, { role: "qa" }]);
    expect(out.soul).toBe("# SOUL\n\nYou are Rich Bot.");
    expect(out.channels).toEqual(["telegram"]);
    expect(out.skills).toEqual(["web-search"]);
    expect(out.model).toBe("claude-opus-4-8");
    expect(out.reasoning).toBe("high");

    const mcp = out.mcps[0];
    expect(mcp.name).toBe("custom");
    expect(mcp.preset).toBe("linear");
    expect(mcp.command).toBe("npx");
    expect(mcp.args).toEqual(["-y", "x-server"]); // non-string arg dropped
    expect(mcp.env).toEqual({ API_KEY: "secret123" });
    expect(warnings).toEqual([]);
  });

  it("falls back name→slug, description→'', and defaults reasoning", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec({}, "slugonly", undefined, warnings);
    expect(out.name).toBe("slugonly");
    expect(out.description).toBe("");
    expect(out.reasoning).toBe("medium");
    expect(out.model).toBe("claude-fallback"); // no model string → fallback (no warning)
    expect(out.integrations).toEqual([]);
    expect(out.roles).toEqual([]);
    expect(out.soul).toBeUndefined();
    expect(warnings).toEqual([]);
  });
});

describe("projectBuildSpec — injection closed", () => {
  it("rejects a model carrying a newline (YAML key injection) → fallback", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec({ model: "gc/gemini\nadmin: true" }, "x", undefined, warnings);
    expect(out.model).toBe("claude-fallback");
    expect(warnings).toContain("model rejected (invalid characters); using fallback");
  });

  it("rejects a telegram token carrying a newline (.env injection)", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec({}, "x", "abc\nNINEROUTER_API_KEY=evil", warnings);
    expect(out.telegramBotToken).toBeUndefined();
    expect(warnings).toContain("telegram token rejected: contains newline");
  });

  it("keeps a clean telegram token", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec({}, "x", "123456:ABC-DEF", warnings);
    expect(out.telegramBotToken).toBe("123456:ABC-DEF");
    expect(warnings).toEqual([]);
  });

  it("drops only the mcp env pair carrying a newline, keeps the rest", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec(
      {
        mcps: [
          {
            name: "srv",
            command: "npx",
            env: { GOOD: "ok", BAD: "v\nINJECTED=1", "K\nEY": "x" },
          },
        ],
      },
      "x",
      undefined,
      warnings,
    );
    expect(out.mcps[0].env).toEqual({ GOOD: "ok" });
    expect(warnings).toContain("mcp 'srv' env 'BAD' dropped: contains newline");
    expect(warnings).toContain("mcp 'srv' env 'K\nEY' dropped: contains newline");
  });

  it("drops an mcp whose name fails the charset or starts with '-'", () => {
    const warnings: string[] = [];
    const out = projectBuildSpec(
      {
        mcps: [
          { name: "-rf", command: "npx" },
          { name: "bad name!", command: "npx" },
          { name: "ok-server", command: "npx" },
        ],
      },
      "x",
      undefined,
      warnings,
    );
    expect(out.mcps.map((m) => m.name)).toEqual(["ok-server"]);
    expect(warnings).toContain("mcp '-rf' dropped: invalid name");
    expect(warnings).toContain("mcp 'bad name!' dropped: invalid name");
  });
});
