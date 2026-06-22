// @vitest-environment node
/**
 * Defense-in-depth at the build layer (the RPC boundary is primary, but a future
 * caller could reach buildProfileFromSpec directly):
 *   - a spec carrying integrations + soul + roles + a mcp with env is reflected
 *     through to the real build steps (SOUL.md authored, mcp add issued, creds
 *     written to the profile .env);
 *   - a model with a newline is rejected and never written to config.yaml;
 *   - a telegram token / mcp env value with a newline is skipped;
 *   - build logs NEVER contain env VALUE strings (only key NAMES).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProfileFromSpec,
  setExecutorForTests,
  setBuildTestConfig,
} from "@/server/agents/generator/build";
import type { ProfileSpec } from "@/server/agents/generator/types";

function makeSpec(overrides: Partial<ProfileSpec> = {}): ProfileSpec {
  return {
    slug: "htest",
    name: "Hardening Test",
    description: "test",
    model: "",
    reasoning: "medium",
    channels: [],
    skills: [],
    mcps: [],
    ...overrides,
  };
}

describe("buildProfileFromSpec — rich passthrough + injection defense", () => {
  let calls: string[][];
  let dir: string;
  let pdir: string;
  let tmplPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "harden-secrets-"));
    pdir = await mkdtemp(join(tmpdir(), "harden-profiles-"));
    await mkdir(join(pdir, "htest"), { recursive: true });
    // A real rich-config template with a model.default: line so the model-rewrite
    // path runs and we can assert the rejected model never lands there.
    tmplPath = join(dir, "config.template.yaml");
    await writeFile(
      tmplPath,
      ["profile: <<PROFILE_NAME>>", "model:", "  default: PLACEHOLDER", ""].join("\n"),
    );
    setBuildTestConfig({
      hindsightBase: "http://127.0.0.1:1",
      secretsDir: dir,
      profilesDir: pdir,
      richConfigTemplate: tmplPath,
    });
    calls = [];
    setExecutorForTests(async (argv) => {
      const arr = [...argv];
      calls.push(arr);
      if (arr[0] === "node" && arr[1]?.endsWith("hermes-profile-create.mjs")) {
        return {
          stdout: JSON.stringify({ profile: "htest", port: 18800 }),
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
  });

  afterEach(async () => {
    setExecutorForTests(null);
    setBuildTestConfig({
      hindsightBase: "http://127.0.0.1:8888/v1",
      secretsDir: "/opt/cortexos/.secrets/hermes",
      profilesDir: "/opt/cortexos/hermes/profiles",
      richConfigTemplate: "/opt/cortexos/templates/hermes/profile-config.template.yaml",
    });
    await rm(dir, { recursive: true, force: true });
    await rm(pdir, { recursive: true, force: true });
  });

  it("reflects integrations + soul + roles + a mcp env through to the build", async () => {
    const logs: string[] = [];
    await buildProfileFromSpec(
      makeSpec({
        soul: "# SOUL\n\nYou are the Hardening Test bot.",
        roles: [{ role: "security", focus: "audits" }],
        integrations: ["github"], // expands to mtest-style per-profile mcp + GH token key
        mcps: [{ name: "custom", command: "npx", env: { API_KEY: "topsecretvalue" } }],
      }),
      (l) => logs.push(l),
    );

    // soul authored verbatim
    const soul = await readFile(join(pdir, "htest", "SOUL.md"), "utf8");
    expect(soul).toContain("You are the Hardening Test bot.");

    // mcp add issued for the custom server and the integration server
    const mcpAdds = calls.filter((c) => c.includes("mcp") && c.includes("add"));
    const names = mcpAdds.map((c) => c[c.indexOf("add") + 1]);
    expect(names).toContain("custom");
    expect(names).toContain("htest-github"); // integration mcp, per-profile name

    // operator-provided mcp credential value landed in the (tmp) .env
    const env = await readFile(join(dir, "htest.env"), "utf8");
    expect(env).toContain("API_KEY=topsecretvalue");

    // and the integration's placeholder credential key is present
    expect(env).toMatch(/GITHUB_PERSONAL_ACCESS_TOKEN=/);

    // CRITICAL: build logs must never contain a secret VALUE, only key NAMES.
    const allLogs = logs.join("\n");
    expect(allLogs).not.toContain("topsecretvalue");
    expect(allLogs).toContain("API_KEY"); // the key name IS logged for traceability
  });

  it("rejects a model carrying a newline and never writes it to config.yaml", async () => {
    const logs: string[] = [];
    await buildProfileFromSpec(makeSpec({ model: "gc/gemini\nadmin: true" }), (l) => logs.push(l));
    // safeModel is "" → the rich-config template step is skipped entirely, so no
    // config.yaml is written and the injected YAML key never reaches disk.
    await expect(readFile(join(pdir, "htest", "config.yaml"), "utf8")).rejects.toThrow();
    const createCall = calls.find((c) => c[1]?.endsWith("hermes-profile-create.mjs"))!;
    expect(createCall).toContain("claude-fallback");
    expect(createCall).not.toContain("gc/gemini\nadmin: true");
    expect(logs.join("\n")).toContain("model: rejected");
  });

  it("skips a telegram token and a mcp env value carrying a newline", async () => {
    const logs: string[] = [];
    await buildProfileFromSpec(
      makeSpec({
        telegramBotToken: "abc\nNINEROUTER_API_KEY=evil",
        mcps: [{ name: "srv", command: "npx", env: { BAD: "v\nINJECTED=1", GOOD: "fine" } }],
      }),
      (l) => logs.push(l),
    );
    const env = await readFile(join(dir, "htest.env"), "utf8").catch(() => "");
    expect(env).not.toContain("INJECTED=1");
    expect(env).not.toContain("NINEROUTER_API_KEY=evil");
    expect(env).toContain("GOOD=fine");
    const allLogs = logs.join("\n");
    expect(allLogs).toContain("telegram: skipped (newline)");
    expect(allLogs).toContain("mcp env BAD: skipped (newline)");
  });
});
