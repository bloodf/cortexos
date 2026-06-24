// @vitest-environment node
/**
 * P2.3 — accounts.yaml, outputs.yaml, and SOUL.md meta-section generation.
 *
 * Asserts the new best-effort steps (1c, 1d, 1e) write the correct files
 * when spec fields are populated, and produce empty stubs when they are absent.
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
    slug: "artest",
    name: "Account Routing Test",
    description: "test",
    model: "",
    reasoning: "medium",
    channels: [],
    skills: [],
    mcps: [],
    ...overrides,
  };
}

describe("buildProfileFromSpec — accounts.yaml / outputs.yaml / SOUL.md meta", () => {
  let dir: string;
  let pdir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ar-secrets-"));
    pdir = await mkdtemp(join(tmpdir(), "ar-profiles-"));
    await mkdir(join(pdir, "artest"), { recursive: true });
    setBuildTestConfig({ hindsightBase: "http://127.0.0.1:1", secretsDir: dir, profilesDir: pdir });
    setExecutorForTests(async (argv) => {
      const arr = [...argv];
      if (arr[0] === "node" && arr[1]?.endsWith("hermes-profile-create.mjs")) {
        return {
          stdout: JSON.stringify({ profile: "artest", port: 19000 }),
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
    });
    await rm(dir, { recursive: true, force: true });
    await rm(pdir, { recursive: true, force: true });
  });

  it("writes accounts.yaml with accountLabel + credentialClass when spec.mcps have them", async () => {
    await buildProfileFromSpec(
      makeSpec({
        mcps: [
          {
            name: "jira-sd",
            accountLabel: "Space Dinosaurs JIRA",
            credentialClass: "employer-issued",
            env: {},
          },
        ],
      }),
      () => {},
    );
    const accounts = await readFile(join(pdir, "artest", "accounts.yaml"), "utf8");
    expect(accounts).toContain("mcp_accounts:");
    // All scalars are JSON.stringify-quoted in the output.
    expect(accounts).toContain('name: "jira-sd"');
    expect(accounts).toContain('account_label: "Space Dinosaurs JIRA"');
    expect(accounts).toContain('credential_class: "employer-issued"');
  });

  it("writes outputs.yaml with the spec.outputs entries", async () => {
    await buildProfileFromSpec(
      makeSpec({
        outputs: [
          {
            name: "angel-eod",
            trigger: "every-weekday-1800-local",
            format: "slack-block",
            channel: "slack",
            template: "**Yesterday**: {yesterday}\n**Today**: {today}",
          },
        ],
      }),
      () => {},
    );
    const outputs = await readFile(join(pdir, "artest", "outputs.yaml"), "utf8");
    expect(outputs).toContain("outputs:");
    // Scalars are JSON.stringify-quoted.
    expect(outputs).toContain('name: "angel-eod"');
    expect(outputs).toContain('trigger: "every-weekday-1800-local"');
    expect(outputs).toContain('format: "slack-block"');
    expect(outputs).toContain('channel: "slack"');
    expect(outputs).toContain("template: |");
    expect(outputs).toContain("Yesterday");
  });

  it("appends ## Deployment & Operator Context section to SOUL.md when spec.meta is non-empty", async () => {
    await buildProfileFromSpec(
      makeSpec({
        soul: "# SOUL\n\nYou are the Account Routing test bot.",
        meta: {
          deploymentModel: "local-hermes-profile",
          oauthHandoff: "operator-local-machine",
          perProfileIsolation: true,
        },
      }),
      () => {},
    );
    const soul = await readFile(join(pdir, "artest", "SOUL.md"), "utf8");
    expect(soul).toContain("You are the Account Routing test bot.");
    expect(soul).toContain("## Deployment & Operator Context");
    expect(soul).toContain("deploymentModel");
    expect(soul).toContain("local-hermes-profile");
    expect(soul).toContain("oauthHandoff");
    expect(soul).toContain("perProfileIsolation");
  });

  it("writes empty stub accounts.yaml + outputs.yaml and no meta section when new fields absent", async () => {
    await buildProfileFromSpec(
      makeSpec({
        soul: "# SOUL\n\nMinimal bot.",
      }),
      () => {},
    );
    const accounts = await readFile(join(pdir, "artest", "accounts.yaml"), "utf8");
    expect(accounts).toContain("mcp_accounts: []");

    const outputs = await readFile(join(pdir, "artest", "outputs.yaml"), "utf8");
    expect(outputs).toContain("outputs: []");

    const soul = await readFile(join(pdir, "artest", "SOUL.md"), "utf8");
    expect(soul).not.toContain("## Deployment & Operator Context");
  });
});
