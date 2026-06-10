/**
 * Agents (Hermes profiles) — server functions (WP-21).
 *
 * Transport is createServerFn RPC, NOT REST (see docs/rebuild/ADR-001). Each
 * function is a top-level `createServerFn(...).middleware([gate]).handler(
 * serverFnNoop)` literal; the gate (`defineServerFn`) carries auth/RBAC/CSRF/
 * rate-limit/audit + the business handler. All server-only logic is imported
 * DYNAMICALLY inside each handler so import-protection never sees `@/server/**`
 * in the client bundle.
 *
 * Ported behavior from the legacy SvelteKit handlers:
 *   packages/dashboard/src/routes/(authed)/agents/+page.server.ts  (list scan)
 *   packages/dashboard/src/routes/api/agents/[slug]/files/+server.ts (file ops)
 *
 * Registry source: HERMES_PROFILES_REGISTRY env (default
 * /opt/cortexos/hermes/profiles.json) + profile dirs under
 * /opt/cortexos/hermes/profiles.
 *
 * Frontend (Wave 2) calls these typed:
 *   await listAgents({ data: {} })
 *   await uploadAgentFile({ data: { slug, filename, content } })
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { defineServerFn, serverFnNoop } from "@/lib/api/define-server-fn";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const AgentListInput = z.object({}).strict();

const UploadAgentFileInput = z
  .object({
    /** Profile slug — must match a registry entry. */
    slug: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9_-]+$/, "slug must be lowercase letters, numbers, underscores and hyphens"),
    /** Destination filename within the profile directory (no path separators, no `..`). */
    filename: z
      .string()
      .min(1)
      .max(255)
      .refine((f) => !f.includes("..") && !f.startsWith("/"), {
        message: "filename must not contain '..' or start with '/'",
      }),
    /** UTF-8 file content (≤ 10 MB). Clients that need binary should base64-encode. */
    content: z.string().max(10 * 1024 * 1024),
  })
  .strict();

// ---------------------------------------------------------------------------
// listAgents — GET, auth: any → { agents: HermesProfile[] }
// ---------------------------------------------------------------------------

const listAgentsGate = defineServerFn({
  method: "GET",
  auth: "any",
  input: AgentListInput,
  surface: "agents",
  action: "agents.list",
  handler: async () => {
    const { readRegistry } = await import("@/server/agents/registry");
    const agents = readRegistry();
    return { agents };
  },
});
export const listAgents = createServerFn({ method: "GET" })
  .middleware([listAgentsGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// uploadAgentFile — POST, auth: admin → { ok: true, filename } | 400/404
// Path-traversal safe: scoped to the profile's home directory.
// ---------------------------------------------------------------------------

const uploadAgentFileGate = defineServerFn({
  method: "POST",
  auth: "admin",
  input: UploadAgentFileInput,
  surface: "agents",
  action: "agents.file.upload",
  target: (input) => `${input.slug}:${input.filename}`,
  handler: async ({ input }) => {
    const { findProfileBySlug } = await import("@/server/agents/registry");
    const { writeAgentFile } = await import("@/server/agents/files");
    const { notFoundError, validationError } = await import("@/server/errors/types");

    const profile = findProfileBySlug(input.slug);
    if (!profile) throw notFoundError(`Agent profile '${input.slug}' not found`, "agent");

    try {
      writeAgentFile(profile.home, input.filename, Buffer.from(input.content, "utf8"));
    } catch (err) {
      if (err instanceof Error && err.message === "path_traversal") {
        throw validationError("path traversal blocked", [
          { field: "filename", message: "path traversal blocked" },
        ]);
      }
      throw err;
    }

    return { ok: true as const, filename: input.filename };
  },
});
export const uploadAgentFile = createServerFn({ method: "POST" })
  .middleware([uploadAgentFileGate])
  .handler(serverFnNoop);
