// @vitest-environment node
/**
 * P1.3 — setAgentModel gate + REAL control bridge.
 *
 * Drives the REAL setAgentModel handler (with an injected fake systemctl
 * executor) through the defineApiRoute pipeline. Asserts:
 *   - admin + CSRF + approval + any model → 201, config.yaml rewritten,
 *     .env rewritten, registry updated, BOTH units restarted (profile first)
 *
 * Mirrors agents.functions.test.ts > agents.action gate.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  InMemorySessionStore,
  setSessionStore,
  resetSessionStore,
  generateSessionToken,
} from "@/server/auth/session-store";
import { SESSION_COOKIE, CSRF_COOKIE, setServerHmacKeyFromString } from "@/server/config";
import {
  defineApiRoute,
  resetRateLimitBuckets,
  type ApiRouteCore,
} from "@/server/server-fn-pipeline";
import { mintApproval, resetApprovalStore } from "@/server/approval";

let store: InMemorySessionStore;

beforeEach(() => {
  setServerHmacKeyFromString("set-agent-model-test-deterministic-key-0123456789");
  resetApprovalStore();
  resetSessionStore();
  resetRateLimitBuckets();
  store = new InMemorySessionStore();
  setSessionStore(store);
});

async function makeSession(opts: { isAdmin: boolean }): Promise<{ token: string; csrf: string }> {
  const csrf = generateSessionToken();
  const res = await store.createSession({
    username: opts.isAdmin ? "admin" : "alice",
    csrfToken: csrf,
    ip: "127.0.0.1",
    userAgent: "vitest",
    isAdmin: opts.isAdmin,
  });
  return { token: res.token, csrf };
}

function cookieHeader(parts: Record<string, string>): string {
  return Object.entries(parts)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
}

describe("agents.model gate (auth: admin, approval: true) + setAgentModel bridge", () => {
  let tmpDir: string;
  let slug: string;
  let registryPath: string;
  let core: ApiRouteCore;
  let calls: string[][];
  const originalRegistry = process.env.HERMES_PROFILES_REGISTRY;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "set-model-"));
    slug = "settest";
    const home = path.join(tmpDir, slug);
    fs.mkdirSync(home, { recursive: true });
    // Minimal config.yaml matching hermes-profile-create.mjs output.
    fs.writeFileSync(
      path.join(home, "config.yaml"),
      [
        "model:",
        "  default: cx/old-model",
        "  provider: openai",
        "providers:",
        "  openai:",
        "    api: x",
        "",
      ].join("\n"),
    );
    const secretPath = path.join(home, `${slug}.env`);
    fs.writeFileSync(
      secretPath,
      [`HERMES_MODEL=cx/old-model`, `HERMES_REASONING=medium`, ""].join("\n"),
    );
    registryPath = path.join(tmpDir, "profiles.json");
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        profiles: [
          {
            profile: slug,
            home,
            apiPort: 19000,
            model: "cx/old-model",
            reasoning: "medium",
            secretPath,
          },
        ],
      }),
    );
    process.env.HERMES_PROFILES_REGISTRY = registryPath;

    // Fake executor: record systemctl argv, never spawn.
    const control = await import("@/server/agents/control");
    calls = [];
    control.setExecutorForTests(async (argv) => {
      calls.push([...argv]);
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const { setAgentModelGateOptions } = await import("../agents.functions");
    core = defineApiRoute({
      methods: [setAgentModelGateOptions.method],
      auth: setAgentModelGateOptions.auth,
      input: setAgentModelGateOptions.input,
      rateLimit: setAgentModelGateOptions.rateLimit,
      surface: setAgentModelGateOptions.surface,
      action: setAgentModelGateOptions.action,
      target: setAgentModelGateOptions.target,
      approval: setAgentModelGateOptions.approval,
      handler: setAgentModelGateOptions.handler,
    });
  });

  afterEach(async () => {
    const control = await import("@/server/agents/control");
    control.setExecutorForTests(null);
    if (originalRegistry === undefined) delete process.env.HERMES_PROFILES_REGISTRY;
    else process.env.HERMES_PROFILES_REGISTRY = originalRegistry;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  });

  it("201 for any model → rewrites config + env + registry, restarts both units", async () => {
    const { token, csrf } = await makeSession({ isAdmin: true });
    const resolved = (await store.resolveByToken(token))!;
    const approval = mintApproval({
      action: "agents.model",
      payload: { slug, model: "cx/known-model", reasoning: "high" },
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });
    const res = await core(
      new Request("http://localhost/_serverFn/agents.model", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          "x-csrf-token": csrf,
          "x-cortex-approval-token": approval.token,
        },
        body: JSON.stringify({ slug, model: "cx/known-model", reasoning: "high" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ slug, model: "cx/known-model", reasoning: "high" });

    // Profile unit restarted BEFORE gateway.
    expect(calls).toEqual([
      ["restart", `hermes-profile@${slug}.service`],
      ["restart", `hermes-gateway@${slug}.service`],
    ]);

    // config.yaml model.default rewritten.
    const home = path.join(tmpDir, slug);
    const cfg = fs.readFileSync(path.join(home, "config.yaml"), "utf8");
    expect(cfg).toContain("default: cx/known-model");
    expect(cfg).not.toContain("cx/old-model");

    // .env rewritten.
    const env = fs.readFileSync(path.join(home, `${slug}.env`), "utf8");
    expect(env).toContain("HERMES_MODEL=cx/known-model");
    expect(env).toContain("HERMES_REASONING=high");

    // Registry updated.
    const reg = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    expect(reg.profiles[0].model).toBe("cx/known-model");
    expect(reg.profiles[0].reasoning).toBe("high");
  });

  it("412 for admin with valid CSRF but NO approval token", async () => {
    const { token, csrf } = await makeSession({ isAdmin: true });
    const res = await core(
      new Request("http://localhost/_serverFn/agents.model", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ slug, model: "cx/known-model", reasoning: "medium" }),
      }),
    );
    expect(res.status).toBe(412);
    expect((await res.json()).code).toBe("approval_required");
    expect(calls).toHaveLength(0);
  });
});
