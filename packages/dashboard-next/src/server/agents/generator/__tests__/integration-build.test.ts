// @vitest-environment node
/**
 * Build-time wiring of MCP servers + credentials: asserts the `hermes mcp add`
 * argv (preset / --env reference / --args) and that operator/integration
 * credentials land in the profile .env (written to a tmp dir, not real secrets).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    slug: "mtest",
    name: "MCP Test",
    description: "test",
    model: "", // skip the rich-config template step (needs a real template file)
    reasoning: "medium",
    channels: [],
    skills: [],
    mcps: [],
    ...overrides,
  };
}

describe("buildProfileFromSpec — MCP + credentials", () => {
  let calls: string[][];
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "gen-secrets-"));
    setBuildTestConfig({ hindsightBase: "http://127.0.0.1:1", secretsDir: dir });
    calls = [];
    setExecutorForTests(async (argv) => {
      const arr = [...argv];
      calls.push(arr);
      if (arr[0] === "node" && arr[1]?.endsWith("hermes-profile-create.mjs")) {
        return { stdout: JSON.stringify({ profile: "mtest", port: 18799 }), stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
  });

  afterEach(async () => {
    setExecutorForTests(null);
    setBuildTestConfig({ hindsightBase: "http://127.0.0.1:8888/v1", secretsDir: "/opt/cortexos/.secrets/hermes" });
    await rm(dir, { recursive: true, force: true });
  });

  it("adds preset / custom MCP with --env reference + --args, and writes creds to .env", async () => {
    const spec = makeSpec({
      integrations: ["github"], // expands to an npx server + GITHUB_PERSONAL_ACCESS_TOKEN
      mcps: [
        { name: "linear", preset: "linear" },
        { name: "custom", command: "npx", args: ["-y", "x-server"], env: { API_KEY: "secret123" } },
      ],
    });
    await buildProfileFromSpec(spec, () => {});

    const mcpAdds = calls.filter((c) => c.includes("mcp") && c.includes("add"));
    const byName = (n: string) => mcpAdds.find((c) => c[c.indexOf("add") + 1] === n);

    expect(byName("linear")).toEqual(expect.arrayContaining(["--preset", "linear"]));

    const custom = byName("custom")!;
    expect(custom).toEqual(expect.arrayContaining(["--command", "npx"]));
    expect(custom).toEqual(expect.arrayContaining(["--env", "API_KEY=${API_KEY}"]));
    // --args must be last and carry the command args.
    const argsIdx = custom.indexOf("--args");
    expect(argsIdx).toBeGreaterThan(-1);
    expect(custom.slice(argsIdx + 1)).toEqual(["-y", "x-server"]);

    const github = byName("github")!;
    expect(github).toEqual(expect.arrayContaining(["--env", "GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_PERSONAL_ACCESS_TOKEN}"]));

    // Credentials written to the (tmp) profile .env: operator value real, key present.
    const env = await readFile(join(dir, "mtest.env"), "utf8");
    expect(env).toContain("API_KEY=secret123");
    expect(env).toMatch(/GITHUB_PERSONAL_ACCESS_TOKEN=/);
  });
});
