/**
 * Agent Generator — server functions (P2.4).
 *
 * RPC surface for the AI-driven profile-creation flow:
 *   - createGeneratorSession — open a new interview session
 *   - generatorSend         — append a user turn, run the model, persist the reply + spec
 *   - getGeneratorSession    — fetch session (transcript, spec, status, build logs)
 *   - buildGeneratorProfile  — drive buildProfileFromSpec; admin + approval-gated
 *
 * Transport is createServerFn RPC (ADR-001). All server-only logic is
 * imported DYNAMICALLY inside handlers to keep `@/server/**` out of the client
 * bundle (matches the import-protection convention used across lib/api/*).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { defineServerFn, serverFnNoop, type ServerFnOptions } from "@/lib/api/define-server-fn";
import { slugSchema } from "@/lib/api/agents.functions";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ReasoningEnum = z.enum(["low", "medium", "high"]);

const CreateGeneratorSessionInput = z
  .object({
    model: z.string().min(1).max(128),
    reasoning: ReasoningEnum.optional(),
  })
  .strict();

const GeneratorSendInput = z
  .object({
    sessionId: z.number().int().positive(),
    text: z.string().max(32000),
    attachments: z
      .array(
        z.object({
          filename: z.string().max(255),
          mime: z.string().max(128),
          dataBase64: z.string().max(35_000_000),
        }),
      )
      .max(8)
      .optional(),
  })
  .strict();

const GetGeneratorSessionInput = z.object({ sessionId: z.number().int().positive() }).strict();

const BuildGeneratorProfileInput = z
  .object({
    sessionId: z.number().int().positive(),
    slug: slugSchema(),
    spec: z.record(z.string(), z.unknown()),
    telegramBotToken: z.string().min(1).max(256).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratorSessionDto {
  id: number;
  slug: string | null;
  status: "draft" | "building" | "done" | "error";
  model: string;
  reasoning: "low" | "medium" | "high";
  transcript: Array<{ role: "user" | "assistant" | "system"; content: string; ts: string }>;
  spec: Record<string, unknown>;
  buildLogs: string;
  createdAt: string;
  updatedAt: string;
}

interface GeneratorSendOutput {
  reply: string;
  spec: Record<string, unknown>;
  status: "draft" | "done";
}

interface BuildGeneratorProfileOutput {
  slug: string;
  apiPort: number;
  status: "done" | "error";
}

// ---------------------------------------------------------------------------
// Spec projection + validation (the live RPC boundary).
//
// The model-authored spec is untrusted: it arrives as `Record<string, unknown>`
// and flows into files the build writes (config.yaml, the profile .env). This
// projection is the ONE place that decides what crosses into the builder, so it
// also closes the injection surface:
//   - model:           must match a strict charset (else fall back) — a value
//                      like "x\nadmin: true" would otherwise inject a YAML key.
//   - telegram token:  rejected if it carries CR/LF (\.env newline injection).
//   - mcp env key/val: each rejected individually if it carries CR/LF.
//   - mcp name:        strict charset, must not start with '-' (argv flag-spoof).
// Rejected items are dropped and a warning is pushed (surfaced to the operator),
// never silently written. Extracted as a pure function so it can be unit-tested
// directly without standing up the whole server-fn pipeline.
// ---------------------------------------------------------------------------

/** Model id charset — letters, digits, and the separators real model ids use. */
const MODEL_RE = /^[A-Za-z0-9._:/-]+$/;
/** MCP server name charset; '-' lead is rejected so a name can't spoof a flag. */
const MCP_NAME_RE = /^[A-Za-z0-9._-]+$/;
/** Any CR or LF makes a value unsafe to write into a line-oriented .env file. */
const hasNewline = (v: string): boolean => v.includes("\n") || v.includes("\r");

export interface ProjectedBuildSpec {
  slug: string;
  name: string;
  description: string;
  model: string;
  reasoning: "low" | "medium" | "high";
  channels: Array<"telegram" | "whatsapp" | "slack" | "discord" | "signal" | "email">;
  skills: string[];
  mcps: Array<{
    name: string;
    preset?: string;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  integrations: string[];
  roles: Array<{ role: string; focus?: string }>;
  soul?: string;
  telegramBotToken?: string;
}

/**
 * Project + validate the untrusted spec record (and an out-of-band telegram
 * token) into the shape `buildProfileFromSpec` consumes. Pushes a human-readable
 * warning for every value it drops. Pure — no I/O, no throws.
 */
export function projectBuildSpec(
  rawSpec: Record<string, unknown>,
  slug: string,
  telegramBotToken: string | undefined,
  warnings: string[],
): ProjectedBuildSpec {
  const validChannels = new Set<string>([
    "telegram",
    "whatsapp",
    "slack",
    "discord",
    "signal",
    "email",
  ]);
  const channels = (Array.isArray(rawSpec.channels) ? rawSpec.channels : []).filter(
    (c): c is "telegram" | "whatsapp" | "slack" | "discord" | "signal" | "email" =>
      typeof c === "string" && validChannels.has(c),
  );
  const skills = (Array.isArray(rawSpec.skills) ? rawSpec.skills : []).filter(
    (s): s is string => typeof s === "string",
  );

  const rawMcps = Array.isArray(rawSpec.mcps) ? rawSpec.mcps : [];
  const mcps: ProjectedBuildSpec["mcps"] = [];
  for (const m of rawMcps) {
    if (!m || typeof (m as { name?: unknown }).name !== "string") continue;
    const mm = m as {
      name: string;
      preset?: unknown;
      url?: unknown;
      command?: unknown;
      args?: unknown;
      env?: unknown;
    };
    // Reject names that fail the charset or could spoof a CLI flag.
    if (!MCP_NAME_RE.test(mm.name) || mm.name.startsWith("-")) {
      warnings.push(`mcp '${mm.name}' dropped: invalid name`);
      continue;
    }
    const out: ProjectedBuildSpec["mcps"][number] = { name: mm.name };
    if (typeof mm.preset === "string") out.preset = mm.preset;
    if (typeof mm.url === "string") out.url = mm.url;
    if (typeof mm.command === "string") out.command = mm.command;
    if (Array.isArray(mm.args)) {
      out.args = mm.args.filter((a): a is string => typeof a === "string");
    }
    if (mm.env && typeof mm.env === "object") {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(mm.env as Record<string, unknown>)) {
        if (typeof k !== "string" || k.length === 0 || typeof v !== "string") continue;
        if (hasNewline(k) || hasNewline(v)) {
          warnings.push(`mcp '${mm.name}' env '${k}' dropped: contains newline`);
          continue;
        }
        env[k] = v;
      }
      if (Object.keys(env).length > 0) out.env = env;
    }
    mcps.push(out);
  }

  const integrations = (Array.isArray(rawSpec.integrations) ? rawSpec.integrations : []).filter(
    (i): i is string => typeof i === "string",
  );

  const rawRoles = Array.isArray(rawSpec.roles) ? rawSpec.roles : [];
  const roles: ProjectedBuildSpec["roles"] = [];
  for (const r of rawRoles) {
    if (!r || typeof (r as { role?: unknown }).role !== "string") continue;
    const rr = r as { role: string; focus?: unknown };
    roles.push({
      role: rr.role,
      ...(typeof rr.focus === "string" ? { focus: rr.focus } : {}),
    });
  }

  // model: strict charset or fall back — closes YAML key injection via model.
  const rawModel = rawSpec.model;
  const model =
    typeof rawModel === "string" && MODEL_RE.test(rawModel) ? rawModel : "claude-fallback";
  if (typeof rawModel === "string" && !MODEL_RE.test(rawModel)) {
    warnings.push("model rejected (invalid characters); using fallback");
  }

  // telegram token: drop if it carries CR/LF — would inject extra .env lines.
  let token = telegramBotToken;
  if (typeof token === "string" && hasNewline(token)) {
    warnings.push("telegram token rejected: contains newline");
    token = undefined;
  }

  return {
    slug,
    name: typeof rawSpec.name === "string" ? rawSpec.name : slug,
    description: typeof rawSpec.description === "string" ? rawSpec.description : "",
    model,
    reasoning: (typeof rawSpec.reasoning === "string" &&
    ["low", "medium", "high"].includes(rawSpec.reasoning)
      ? rawSpec.reasoning
      : "medium") as "low" | "medium" | "high",
    channels,
    skills,
    mcps,
    integrations,
    roles,
    ...(typeof rawSpec.soul === "string" ? { soul: rawSpec.soul } : {}),
    ...(token !== undefined ? { telegramBotToken: token } : {}),
  };
}

// ---------------------------------------------------------------------------
// createGeneratorSession — POST, auth: admin.
// ---------------------------------------------------------------------------

const createGeneratorSessionGate = defineServerFn({
  method: "POST",
  auth: "admin",
  input: CreateGeneratorSessionInput,
  surface: "agents.generator",
  action: "agents.generator.create",
  handler: async ({ input, user, ctx }) => {
    const { getDb } = await import("@/server/db/client");
    const { createSession } = await import("@/server/db/repos/agentGenerator");
    const db = getDb();
    const session = await createSession(db, {
      model: input.model,
      reasoning: input.reasoning ?? "medium",
      createdBy: user ? String(user.id) : (ctx.session?.id ?? null),
    });
    return {
      id: session.id,
      status: session.status,
      model: session.model,
      reasoning: session.reasoning,
    };
  },
});
export const createGeneratorSession = createServerFn({ method: "POST" })
  .middleware([createGeneratorSessionGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// generatorSend — POST, auth: admin, rate-limit 30/min.
// ---------------------------------------------------------------------------

const generatorSendGateOptions: ServerFnOptions<
  z.infer<typeof GeneratorSendInput>,
  GeneratorSendOutput
> = {
  method: "POST",
  auth: "admin",
  input: GeneratorSendInput,
  rateLimit: { limit: 30, windowSec: 60, bucket: "user" },
  surface: "agents.generator",
  action: "agents.generator.send",
  handler: async ({ input }) => {
    const { getDb } = await import("@/server/db/client");
    const repo = await import("@/server/db/repos/agentGenerator");
    const { generatorTurn } = await import("@/server/agents/generator/llm");
    const { systemError, notFoundError } = await import("@/server/errors/types");
    const db = getDb();
    const session = await repo.getSession(db, input.sessionId);
    if (!session) throw notFoundError(`generator session ${input.sessionId} not found`);
    if (session.status === "building" || session.status === "done" || session.status === "error") {
      throw systemError(`generator session is ${session.status}; cannot send`);
    }

    const userTs = new Date().toISOString();
    await repo.appendTurn(db, input.sessionId, { role: "user", content: input.text, ts: userTs });

    const messages = [
      ...((session.transcript as Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }>) ?? []),
      { role: "user" as const, content: input.text },
    ];
    const specSoFar = (session.spec as Record<string, unknown>) ?? {};
    const turn = await generatorTurn({
      model: session.model,
      reasoning: session.reasoning as "low" | "medium" | "high",
      messages,
      attachments: input.attachments,
      specSoFar,
    });

    const assistantTs = new Date().toISOString();
    await repo.appendTurn(db, input.sessionId, {
      role: "assistant",
      content: turn.text,
      ts: assistantTs,
    });
    if (turn.spec) {
      await repo.updateSpec(db, input.sessionId, turn.spec as Record<string, unknown>);
    }

    const updated = await repo.getSession(db, input.sessionId);
    return {
      reply: turn.text,
      spec: (updated?.spec as Record<string, unknown>) ?? {},
      status: turn.done ? "done" : "draft",
    };
  },
};
const generatorSendGate = defineServerFn(generatorSendGateOptions);
export const generatorSend = createServerFn({ method: "POST" })
  .middleware([generatorSendGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// getGeneratorSession — GET, auth: admin (sessions are admin-only).
// ---------------------------------------------------------------------------

const getGeneratorSessionGate = defineServerFn({
  method: "GET",
  auth: "admin",
  input: GetGeneratorSessionInput,
  surface: "agents.generator",
  action: "agents.generator.get",
  handler: async ({ input }) => {
    const { getDb } = await import("@/server/db/client");
    const { getSession } = await import("@/server/db/repos/agentGenerator");
    const { notFoundError } = await import("@/server/errors/types");
    const db = getDb();
    const s = await getSession(db, input.sessionId);
    if (!s) throw notFoundError(`generator session ${input.sessionId} not found`);
    return {
      id: s.id,
      slug: s.slug,
      status: s.status as GeneratorSessionDto["status"],
      model: s.model,
      reasoning: s.reasoning as GeneratorSessionDto["reasoning"],
      transcript: (s.transcript as GeneratorSessionDto["transcript"]) ?? [],
      spec: (s.spec as Record<string, unknown>) ?? {},
      buildLogs: s.buildLogs ?? "",
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  },
});
export const getGeneratorSession = createServerFn({ method: "GET" })
  .middleware([getGeneratorSessionGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// listGeneratorPresets — GET, auth: admin. Archetype + integration catalogs for
// the UI preset chips (static data; the AI also offers them conversationally).
// ---------------------------------------------------------------------------

const listGeneratorPresetsGate = defineServerFn({
  method: "GET",
  auth: "admin",
  input: z.object({}),
  surface: "agents.generator",
  action: "agents.generator.presets",
  handler: async () => {
    const { ARCHETYPE_CATALOG } = await import("@/server/agents/generator/archetype-catalog");
    const { INTEGRATION_CATALOG } = await import("@/server/agents/generator/integration-catalog");
    return {
      archetypes: ARCHETYPE_CATALOG.map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category,
        desc: a.desc,
        integrations: a.integrations,
      })),
      integrations: INTEGRATION_CATALOG.map((t) => ({ id: t.id, name: t.name, desc: t.desc })),
    };
  },
});
export const listGeneratorPresets = createServerFn({ method: "GET" })
  .middleware([listGeneratorPresetsGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// buildGeneratorProfile — POST, auth: admin, approval: true.
// Drives buildProfileFromSpec, persists build logs, sets status done/error.
// ---------------------------------------------------------------------------

const buildGeneratorProfileGateOptions: ServerFnOptions<
  z.infer<typeof BuildGeneratorProfileInput>,
  BuildGeneratorProfileOutput
> = {
  method: "POST",
  auth: "admin",
  input: BuildGeneratorProfileInput,
  rateLimit: { limit: 5, windowSec: 60, bucket: "user" },
  surface: "agents.generator",
  action: "agents.generator.build",
  target: (i) => `generator:${i.sessionId}:${i.slug}`,
  approval: true,
  handler: async ({ input }) => {
    const { getDb } = await import("@/server/db/client");
    const repo = await import("@/server/db/repos/agentGenerator");
    const { buildProfileFromSpec } = await import("@/server/agents/generator/build");
    const { systemError, notFoundError } = await import("@/server/errors/types");
    const db = getDb();
    const session = await repo.getSession(db, input.sessionId);
    if (!session) throw notFoundError(`generator session ${input.sessionId} not found`);
    await repo.setStatus(db, input.sessionId, "building", { slug: input.slug });

    // Project + validate the untrusted model-authored spec at THIS boundary —
    // the rich builder consumes integrations/roles/soul + per-mcp preset/args/env
    // (which the old hand-rebuild dropped), and this is where injection is closed
    // before any value reaches config.yaml or the profile .env. See projectBuildSpec.
    const projectionWarnings: string[] = [];
    const spec = projectBuildSpec(
      input.spec,
      input.slug,
      input.telegramBotToken,
      projectionWarnings,
    );

    let lastLogs = "";
    for (const w of projectionWarnings) {
      const line = `spec: ${w}`;
      lastLogs += line + "\n";
      // Bug #8 fix: await the log flush so warning lines are not lost if the
      // build completes before the unawaited promise resolves. appendBuildLogs
      // is now SQL-side atomic so awaiting here is safe under concurrency.
      await repo.appendBuildLogs(db, input.sessionId, line + "\n");
    }
    try {
      // Bug #8 fix: collect log lines from the streaming callback into a local
      // queue and flush them with awaited appendBuildLogs calls. Unawaited
      // fire-and-forget calls raced against each other (and against setStatus at
      // the end), losing lines. We flush each line individually so the UI sees
      // progress without batching complexity; the SQL-side append is atomic.
      const pendingLogs: Array<Promise<unknown>> = [];
      const result = await buildProfileFromSpec(spec, (line) => {
        lastLogs += line + "\n";
        pendingLogs.push(repo.appendBuildLogs(db, input.sessionId, line + "\n").catch(() => {}));
      });
      // Wait for all in-flight log appends before setting the final status so
      // the DB row is consistent when the client next polls.
      await Promise.all(pendingLogs);
      await repo.setStatus(db, input.sessionId, "done", { slug: input.slug, buildLogs: lastLogs });
      return { slug: result.slug, apiPort: result.apiPort, status: "done" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await repo.setStatus(db, input.sessionId, "error", {
        buildLogs: lastLogs + `\n[error] ${msg}\n`,
      });
      throw systemError(`build failed: ${msg}`);
    }
  },
};
const buildGeneratorProfileGate = defineServerFn(buildGeneratorProfileGateOptions);
export const buildGeneratorProfile = createServerFn({ method: "POST" })
  .middleware([buildGeneratorProfileGate])
  .handler(serverFnNoop);
