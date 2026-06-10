// @vitest-environment node
/**
 * WP-21 gate tests — agents server fn security gates + node-env gate.
 *
 * Exercises the gate via the underlying `defineApiRoute` core (the
 * `(Request) => Response` pipeline) — the createServerFn compiler transform
 * only runs in the Vite/Nitro build, so a bare `await listAgents()` under
 * vitest never invokes the extracted handler.
 *
 * Also covers:
 * - HERMES_PROFILES_REGISTRY env gate: reading from a temp file vs default path
 * - Path traversal rejection in validateFilePath
 *
 * Patterns copied from docker.functions.test.ts (WP-11 reference).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  InMemorySessionStore,
  setSessionStore,
  resetSessionStore,
  generateSessionToken,
} from "@/server/auth/session-store";
import { SESSION_COOKIE, CSRF_COOKIE } from "@/server/config";
import {
  defineApiRoute,
  _resetRateLimitBuckets,
  type ApiRouteCore,
} from "@/server/server-fn-pipeline";

let store: InMemorySessionStore;

beforeEach(() => {
  resetSessionStore();
  store = new InMemorySessionStore();
  setSessionStore(store);
  _resetRateLimitBuckets();
});

// ---------------------------------------------------------------------------
// Gate cores — mirror agents.functions.ts gates without real filesystem calls
// ---------------------------------------------------------------------------

// listAgents gate: auth 'any'
const listAgentsCore: ApiRouteCore = defineApiRoute({
  methods: ["GET"],
  auth: "any",
  input: z.object({}).strict(),
  surface: "agents",
  action: "agents.list",
  handler: () => ({ agents: [] }),
});

// uploadAgentFile gate: auth 'admin', POST mutation
const uploadAgentFileCore: ApiRouteCore = defineApiRoute({
  methods: ["POST"],
  auth: "admin",
  input: z
    .object({
      slug: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9_-]+$/),
      filename: z
        .string()
        .min(1)
        .max(255)
        .refine((f) => !f.includes("..") && !f.startsWith("/"), {
          message: "filename must not contain '..' or start with '/'",
        }),
      content: z.string().max(10 * 1024 * 1024),
    })
    .strict(),
  surface: "agents",
  action: "agents.file.upload",
  target: (i) => {
    const inp = i as { slug: string; filename: string };
    return `${inp.slug}:${inp.filename}`;
  },
  handler: () => ({ ok: true }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// agents.list gate (auth: any)
// ---------------------------------------------------------------------------

describe("agents.list gate (auth: any)", () => {
  it("200 with a valid session", async () => {
    const { token } = await makeSession({ isAdmin: false });
    const res = await listAgentsCore(
      new Request("http://localhost/_serverFn/agents.list", {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ agents: [] });
  });

  it("401 without a session", async () => {
    const res = await listAgentsCore(new Request("http://localhost/_serverFn/agents.list"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("auth");
  });
});

// ---------------------------------------------------------------------------
// agents.file.upload gate (auth: admin, POST mutation)
// ---------------------------------------------------------------------------

describe("agents.file.upload gate (auth: admin, mutation)", () => {
  it("403 for an authenticated non-admin (even with valid CSRF)", async () => {
    const { token, csrf } = await makeSession({ isAdmin: false });
    const res = await uploadAgentFileCore(
      new Request("http://localhost/_serverFn/agents.file.upload", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ slug: "default", filename: "test.txt", content: "hello" }),
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("permission");
  });

  it("403 for an admin without a CSRF header (stolen-cookie attack)", async () => {
    const { token, csrf } = await makeSession({ isAdmin: true });
    const res = await uploadAgentFileCore(
      new Request("http://localhost/_serverFn/agents.file.upload", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          // no x-csrf-token header
        },
        body: JSON.stringify({ slug: "default", filename: "test.txt", content: "hello" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("201 for an admin with a valid session-bound CSRF token", async () => {
    const { token, csrf } = await makeSession({ isAdmin: true });
    const res = await uploadAgentFileCore(
      new Request("http://localhost/_serverFn/agents.file.upload", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ slug: "default", filename: "test.txt", content: "hello" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("400 for a filename with path traversal attempt (..)", async () => {
    const { token, csrf } = await makeSession({ isAdmin: true });
    const res = await uploadAgentFileCore(
      new Request("http://localhost/_serverFn/agents.file.upload", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({
          slug: "default",
          filename: "../../etc/passwd",
          content: "evil",
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("validation");
  });

  it("400 for a filename starting with / (absolute path)", async () => {
    const { token, csrf } = await makeSession({ isAdmin: true });
    const res = await uploadAgentFileCore(
      new Request("http://localhost/_serverFn/agents.file.upload", {
        method: "POST",
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({
          slug: "default",
          filename: "/etc/passwd",
          content: "evil",
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("validation");
  });
});

// ---------------------------------------------------------------------------
// Node-env gate: HERMES_PROFILES_REGISTRY reads from the env-specified path
// ---------------------------------------------------------------------------

describe("HERMES_PROFILES_REGISTRY env gate", () => {
  let tmpDir: string;
  let tmpRegistry: string;
  const originalEnv = process.env.HERMES_PROFILES_REGISTRY;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-agents-test-"));
    tmpRegistry = path.join(tmpDir, "profiles.json");
  });

  afterEach(() => {
    // restore env
    if (originalEnv === undefined) {
      delete process.env.HERMES_PROFILES_REGISTRY;
    } else {
      process.env.HERMES_PROFILES_REGISTRY = originalEnv;
    }
    // clean up tmp
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  });

  it("reads profiles from HERMES_PROFILES_REGISTRY when set", async () => {
    const profiles = {
      profiles: [{ profile: "test-agent", home: tmpDir, apiPort: 19999, model: "test/model" }],
    };
    fs.writeFileSync(tmpRegistry, JSON.stringify(profiles));
    process.env.HERMES_PROFILES_REGISTRY = tmpRegistry;

    // Re-import to pick up the new env (module is stateless — reads env each call)
    const { readRegistry } = await import("@/server/agents/registry");
    const result = readRegistry();
    expect(result).toHaveLength(1);
    expect(result[0].profile).toBe("test-agent");
    expect(result[0].model).toBe("test/model");
  });

  it("returns empty array when HERMES_PROFILES_REGISTRY points to missing file", async () => {
    process.env.HERMES_PROFILES_REGISTRY = path.join(tmpDir, "nonexistent.json");

    const { readRegistry } = await import("@/server/agents/registry");
    const result = readRegistry();
    expect(result).toEqual([]);
  });

  it("findProfileBySlug returns the matching profile", async () => {
    const profiles = {
      profiles: [
        { profile: "my-agent", home: tmpDir, apiPort: 18700, model: "cx/test" },
        { profile: "other-agent", home: tmpDir, apiPort: 18701, model: "cx/other" },
      ],
    };
    fs.writeFileSync(tmpRegistry, JSON.stringify(profiles));
    process.env.HERMES_PROFILES_REGISTRY = tmpRegistry;

    const { findProfileBySlug } = await import("@/server/agents/registry");
    const found = findProfileBySlug("my-agent");
    expect(found).not.toBeNull();
    expect(found?.profile).toBe("my-agent");

    const notFound = findProfileBySlug("does-not-exist");
    expect(notFound).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateFilePath — path traversal guard unit tests
// ---------------------------------------------------------------------------

describe("validateFilePath — path traversal guard", () => {
  it("accepts a simple filename", async () => {
    const { validateFilePath } = await import("@/server/agents/files");
    const target = validateFilePath("/some/dir", "config.yaml");
    expect(target).toBe("/some/dir/config.yaml");
  });

  it("throws path_traversal for '..' in filename", async () => {
    const { validateFilePath } = await import("@/server/agents/files");
    expect(() => validateFilePath("/some/dir", "../../etc/passwd")).toThrow("path_traversal");
  });

  it("throws path_traversal for absolute path filename", async () => {
    const { validateFilePath } = await import("@/server/agents/files");
    expect(() => validateFilePath("/some/dir", "/etc/passwd")).toThrow("path_traversal");
  });

  it("throws path_traversal for encoded traversal that resolves outside dir", async () => {
    const { validateFilePath } = await import("@/server/agents/files");
    // After resolve, ../.. from /some/dir would escape: verify post-resolve check
    expect(() => validateFilePath("/some/dir", "../sibling/evil")).toThrow("path_traversal");
  });
});
