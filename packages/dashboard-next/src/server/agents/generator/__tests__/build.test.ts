// @vitest-environment node
/**
 * P2.3 — buildProfileFromSpec command-sequence + failure semantics.
 *
 * Asserts the EXACT argv the build function issues for a minimal spec (no
 * skills/mcps/model → no template/hindsight/skills/mcp commands), and that a
 * mid-sequence failure (render) throws and the function stops.
 *
 * The build reads a real rich-template file when spec.model is set. To keep
 * the test hermetic, the minimal-spec case omits spec.model and we use
 * `setBuildTestConfig` to set HINDSIGHT_BASE to an unreachable address (fetch
 * fails, captured as a warning, build continues).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
    slug: "btest",
    name: "Build Test",
    description: "test agent",
    model: "",
    reasoning: "medium",
    channels: [],
    skills: [],
    mcps: [],
    ...overrides,
  };
}

describe("buildProfileFromSpec — command sequence", () => {
  let calls: string[][];
  let dir: string;
  let pdir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "btest-secrets-"));
    pdir = await mkdtemp(join(tmpdir(), "btest-profiles-"));
    await mkdir(join(pdir, "btest"), { recursive: true });
    setBuildTestConfig({ hindsightBase: "http://127.0.0.1:1", secretsDir: dir, profilesDir: pdir });
    calls = [];
    setExecutorForTests(async (argv) => {
      const arr = [...argv];
      calls.push(arr);
      if (arr[0] === "node" && arr[1]?.endsWith("hermes-profile-create.mjs")) {
        return {
          stdout: JSON.stringify({
            profile: "btest",
            port: 18720,
            model: "x",
            reasoning: "medium",
            secretPath: "/x",
          }),
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

  it("issues create → render → enable for a minimal spec", async () => {
    const logs: string[] = [];
    const res = await buildProfileFromSpec(makeSpec(), (l) => logs.push(l));
    expect(res.slug).toBe("btest");
    expect(res.apiPort).toBe(18720);

    // Critical-step argv (ignore the hindsight fetch).
    const execCalls = calls;
    expect(execCalls[0]).toEqual([
      "node",
      "/opt/cortexos/scripts/hermes-profile-create.mjs",
      "btest",
      "",
      "claude-fallback",
      "medium",
    ]);
    // Render step.
    const render = execCalls.find((c) => c[0] === "sudo" && c[1] === "bash");
    expect(render).toEqual([
      "sudo",
      "bash",
      "/opt/cortexos/scripts/ops/cortex-render-units.sh",
      "hermes-gateway@.service",
      "hermes-profile@.service",
    ]);
    // Enable + start both units.
    const systemctl = execCalls.filter((c) => c[0] === "/usr/bin/systemctl");
    expect(systemctl).toEqual([
      ["/usr/bin/systemctl", "enable", "--now", "hermes-gateway@btest.service"],
      ["/usr/bin/systemctl", "enable", "--now", "hermes-profile@btest.service"],
    ]);

    // Steps 1c + 1d: stub files always written even with no mcps/outputs.
    const accounts = await readFile(join(pdir, "btest", "accounts.yaml"), "utf8");
    expect(accounts).toContain("mcp_accounts: []");
    const outputs = await readFile(join(pdir, "btest", "outputs.yaml"), "utf8");
    expect(outputs).toContain("outputs: []");
  });

  it("throws and stops when render fails", async () => {
    setExecutorForTests(async (argv) => {
      const arr = [...argv];
      calls.push(arr);
      if (arr[0] === "node" && arr[1]?.endsWith("hermes-profile-create.mjs")) {
        return {
          stdout: JSON.stringify({ port: 18721 }),
          stderr: "",
          exitCode: 0,
        };
      }
      if (arr[0] === "sudo") {
        throw new Error("render exploded");
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    await expect(buildProfileFromSpec(makeSpec({ slug: "fail" }), () => {})).rejects.toThrow(
      /cortex-render-units/,
    );
    // The enable step was never reached.
    const systemctl = calls.filter((c) => c[0] === "/usr/bin/systemctl");
    expect(systemctl).toHaveLength(0);
  });
});
