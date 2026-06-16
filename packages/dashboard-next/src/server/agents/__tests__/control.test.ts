// @vitest-environment node
/**
 * Agent control bridge tests (plan 0.5).
 *
 * Drives the REAL bridge with an injected fake executor (no spawning). Asserts:
 *   - unitsFor maps both systemd template units.
 *   - start/stop/restart issue systemctl for BOTH units; pause for the GATEWAY ONLY.
 *   - getAgentRuntime maps is-active outputs (active/inactive/failed) to the
 *     derived run-states per the operator rules.
 *   - unknown slug + the `../evil` traversal slug are rejected.
 *
 * The slug allowlist is the Hermes registry — pointed at a temp profiles.json
 * via HERMES_PROFILES_REGISTRY so only known slugs are controllable.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AGENT_ACTIONS,
  unitsFor,
  getAgentRuntime,
  getAgentRuntimes,
  controlAgent,
  setExecutorForTests,
  UnknownAgentError,
  type Executor,
} from "@/server/agents/control";

// ---------------------------------------------------------------------------
// Fake executor — records every argv, returns canned is-active text + exit code
// ---------------------------------------------------------------------------

interface Call {
  argv: string[];
}

function makeExecutor(opts?: {
  /** Map unit name → is-active stdout word. */
  isActive?: Record<string, string>;
  /** Verbs (start/stop/restart) that should fail (exit 1) for a given unit. */
  failVerbForUnit?: { verb: string; unit: string; stderr: string };
}): { exec: Executor; calls: Call[] } {
  const calls: Call[] = [];
  const exec: Executor = async (argv) => {
    calls.push({ argv: [...argv] });
    const [verb, unit] = argv;
    if (verb === "is-active") {
      const word = opts?.isActive?.[unit] ?? "inactive";
      // is-active exits non-zero for inactive/failed; stdout carries the word.
      return { stdout: `${word}\n`, stderr: "", exitCode: word === "active" ? 0 : 3 };
    }
    if (
      opts?.failVerbForUnit &&
      opts.failVerbForUnit.verb === verb &&
      opts.failVerbForUnit.unit === unit
    ) {
      return { stdout: "", stderr: opts.failVerbForUnit.stderr, exitCode: 1 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  return { exec, calls };
}

// ---------------------------------------------------------------------------
// Registry fixture
// ---------------------------------------------------------------------------

let tmpDir: string;
const originalEnv = process.env.HERMES_PROFILES_REGISTRY;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-agent-control-"));
  const registry = path.join(tmpDir, "profiles.json");
  fs.writeFileSync(
    registry,
    JSON.stringify({
      profiles: [
        { profile: "cleo", home: tmpDir, apiPort: 18700, model: "cx/gpt-5.5" },
        { profile: "default", home: tmpDir, apiPort: 18701, model: "cx/test" },
      ],
    }),
  );
  process.env.HERMES_PROFILES_REGISTRY = registry;
});

afterEach(() => {
  setExecutorForTests(null);
  if (originalEnv === undefined) delete process.env.HERMES_PROFILES_REGISTRY;
  else process.env.HERMES_PROFILES_REGISTRY = originalEnv;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

// ---------------------------------------------------------------------------
// unitsFor
// ---------------------------------------------------------------------------

describe("unitsFor", () => {
  it("maps a slug to both template units", () => {
    expect(unitsFor("cleo")).toEqual({
      gateway: "hermes-gateway@cleo.service",
      profile: "hermes-profile@cleo.service",
    });
  });
});

describe("AGENT_ACTIONS", () => {
  it("is exactly start/stop/restart/pause", () => {
    expect([...AGENT_ACTIONS]).toEqual(["start", "stop", "restart", "pause"]);
  });
});

// ---------------------------------------------------------------------------
// controlAgent — which units each action targets
// ---------------------------------------------------------------------------

describe("controlAgent verb → unit targeting", () => {
  it("start issues `systemctl start` for BOTH units", async () => {
    const { exec, calls } = makeExecutor({ isActive: { "hermes-gateway@cleo.service": "active" } });
    setExecutorForTests(exec);

    const res = await controlAgent("cleo", "start");

    const dispatched = calls.filter((c) => c.argv[0] !== "is-active").map((c) => c.argv);
    expect(dispatched).toEqual([
      ["start", "hermes-gateway@cleo.service"],
      ["start", "hermes-profile@cleo.service"],
    ]);
    expect(res.status).toBe("accepted");
    expect(res.state).toBe("running");
  });

  it("stop issues `systemctl stop` for BOTH units", async () => {
    const { exec, calls } = makeExecutor();
    setExecutorForTests(exec);

    await controlAgent("cleo", "stop");

    const dispatched = calls.filter((c) => c.argv[0] !== "is-active").map((c) => c.argv);
    expect(dispatched).toEqual([
      ["stop", "hermes-gateway@cleo.service"],
      ["stop", "hermes-profile@cleo.service"],
    ]);
  });

  it("restart issues `systemctl restart` for BOTH units", async () => {
    const { exec, calls } = makeExecutor({ isActive: { "hermes-gateway@cleo.service": "active" } });
    setExecutorForTests(exec);

    await controlAgent("cleo", "restart");

    const dispatched = calls.filter((c) => c.argv[0] !== "is-active").map((c) => c.argv);
    expect(dispatched).toEqual([
      ["restart", "hermes-gateway@cleo.service"],
      ["restart", "hermes-profile@cleo.service"],
    ]);
  });

  it("pause issues `systemctl stop` for the GATEWAY ONLY", async () => {
    const { exec, calls } = makeExecutor({
      isActive: { "hermes-profile@cleo.service": "active" },
    });
    setExecutorForTests(exec);

    const res = await controlAgent("cleo", "pause");

    const dispatched = calls.filter((c) => c.argv[0] !== "is-active").map((c) => c.argv);
    expect(dispatched).toEqual([["stop", "hermes-gateway@cleo.service"]]);
    // Gateway down, profile up → idle.
    expect(res.state).toBe("idle");
  });

  it("returns rejected with the stderr reason when a systemctl call fails", async () => {
    const { exec } = makeExecutor({
      failVerbForUnit: {
        verb: "start",
        unit: "hermes-gateway@cleo.service",
        stderr: "Failed to start hermes-gateway@cleo.service: unit not found",
      },
    });
    setExecutorForTests(exec);

    const res = await controlAgent("cleo", "start");
    expect(res.status).toBe("rejected");
    expect(res.reason).toContain("unit not found");
    const failing = res.units.find((u) => u.exitCode !== 0);
    expect(failing?.unit).toBe("hermes-gateway@cleo.service");
  });
});

// ---------------------------------------------------------------------------
// getAgentRuntime — is-active → state derivation
// ---------------------------------------------------------------------------

describe("getAgentRuntime state derivation", () => {
  it("gateway active → running", async () => {
    const { exec } = makeExecutor({ isActive: { "hermes-gateway@cleo.service": "active" } });
    setExecutorForTests(exec);
    expect((await getAgentRuntime("cleo")).state).toBe("running");
  });

  it("gateway failed → error", async () => {
    const { exec } = makeExecutor({ isActive: { "hermes-gateway@cleo.service": "failed" } });
    setExecutorForTests(exec);
    expect((await getAgentRuntime("cleo")).state).toBe("error");
  });

  it("gateway inactive but profile active → idle", async () => {
    const { exec } = makeExecutor({
      isActive: {
        "hermes-gateway@cleo.service": "inactive",
        "hermes-profile@cleo.service": "active",
      },
    });
    setExecutorForTests(exec);
    expect((await getAgentRuntime("cleo")).state).toBe("idle");
  });

  it("both inactive → stopped", async () => {
    const { exec } = makeExecutor({
      isActive: {
        "hermes-gateway@cleo.service": "inactive",
        "hermes-profile@cleo.service": "inactive",
      },
    });
    setExecutorForTests(exec);
    expect((await getAgentRuntime("cleo")).state).toBe("stopped");
  });

  it("does NOT shell out for a malformed slug — returns stopped (defense-in-depth)", async () => {
    const { exec, calls } = makeExecutor({});
    setExecutorForTests(exec);
    // agents.status is auth:'any' and takes caller slugs; a slug that fails the
    // SLUG_RE format guard must never reach systemctl.
    const bad = ["bad slug!@#", "../etc/passwd", "a;b", "A_UPPER"];
    const states = await Promise.all(bad.map((s) => getAgentRuntime(s)));
    states.forEach((res) => expect(res.state).toBe("stopped"));
    expect(calls.length).toBe(0);
  });

  it("getAgentRuntimes derives many slugs in parallel", async () => {
    const { exec } = makeExecutor({
      isActive: {
        "hermes-gateway@cleo.service": "active",
        "hermes-gateway@default.service": "failed",
      },
    });
    setExecutorForTests(exec);
    const states = await getAgentRuntimes(["cleo", "default"]);
    expect(states).toEqual({ cleo: "running", default: "error" });
  });
});

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

describe("slug validation", () => {
  it("rejects an unknown slug (not in the registry)", async () => {
    const { exec, calls } = makeExecutor();
    setExecutorForTests(exec);
    await expect(controlAgent("ghost", "start")).rejects.toBeInstanceOf(UnknownAgentError);
    // No systemctl call should have been issued for an unknown slug.
    expect(calls).toHaveLength(0);
  });

  it("rejects a path-traversal slug `../evil` on the regex (before registry)", async () => {
    const { exec, calls } = makeExecutor();
    setExecutorForTests(exec);
    await expect(controlAgent("../evil", "start")).rejects.toBeInstanceOf(UnknownAgentError);
    expect(calls).toHaveLength(0);
  });

  it("getAgentRuntime does not validate (status probe is read-only) but unitsFor is safe", async () => {
    // unitsFor never interpolates a shell; it only builds the unit string.
    expect(unitsFor("default").gateway).toBe("hermes-gateway@default.service");
  });
});
