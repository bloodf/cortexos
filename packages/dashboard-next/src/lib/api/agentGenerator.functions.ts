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

const GetGeneratorSessionInput = z
  .object({ sessionId: z.number().int().positive() })
  .strict();

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
      createdBy: user ? String(user.id) : ctx.session?.id ?? null,
    });
    return { id: session.id, status: session.status, model: session.model, reasoning: session.reasoning };
  },
});
export const createGeneratorSession = createServerFn({ method: "POST" })
  .middleware([createGeneratorSessionGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// generatorSend — POST, auth: admin, rate-limit 30/min.
// ---------------------------------------------------------------------------

const generatorSendGateOptions: ServerFnOptions<z.infer<typeof GeneratorSendInput>, GeneratorSendOutput> = {
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
      ...((session.transcript as Array<{ role: "user" | "assistant" | "system"; content: string }>) ?? []),
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

    const validChannels = new Set<string>([
      "telegram", "whatsapp", "slack", "discord", "signal", "email",
    ]);
    const channels = (Array.isArray(input.spec.channels) ? input.spec.channels : [])
      .filter((c): c is "telegram" | "whatsapp" | "slack" | "discord" | "signal" | "email" =>
        typeof c === "string" && validChannels.has(c),
      );
    const skills = (Array.isArray(input.spec.skills) ? input.spec.skills : [])
      .filter((s): s is string => typeof s === "string");
    const rawMcps = Array.isArray(input.spec.mcps) ? input.spec.mcps : [];
    const mcps = rawMcps
      .filter(
        (m): m is { name: string; url?: string; command?: string } =>
          !!m && typeof (m as { name?: unknown }).name === "string",
      )
      .map((m) => ({
        name: m.name,
        ...(typeof m.url === "string" ? { url: m.url } : {}),
        ...(typeof m.command === "string" ? { command: m.command } : {}),
      }));
    const spec = {
      slug: input.slug,
      name: typeof input.spec.name === "string" ? input.spec.name : input.slug,
      description: typeof input.spec.description === "string" ? input.spec.description : "",
      model: typeof input.spec.model === "string" ? input.spec.model : "claude-fallback",
      reasoning: (typeof input.spec.reasoning === "string" && ["low","medium","high"].includes(input.spec.reasoning)
        ? input.spec.reasoning
        : "medium") as "low" | "medium" | "high",
      channels,
      skills,
      mcps,
      telegramBotToken: input.telegramBotToken,
    };

    let lastLogs = "";
    try {
      const result = await buildProfileFromSpec(spec, (line) => {
        lastLogs += line + "\n";
        // Best-effort periodic flush so the UI sees progress.
        repo.appendBuildLogs(db, input.sessionId, line + "\n").catch(() => {});
      });
      await repo.setStatus(db, input.sessionId, "done", { slug: input.slug, buildLogs: lastLogs });
      return { slug: result.slug, apiPort: result.apiPort, status: "done" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await repo.setStatus(db, input.sessionId, "error", { buildLogs: lastLogs + `\n[error] ${msg}\n` });
      throw systemError(`build failed: ${msg}`);
    }
  },
};
const buildGeneratorProfileGate = defineServerFn(buildGeneratorProfileGateOptions);
export const buildGeneratorProfile = createServerFn({ method: "POST" })
  .middleware([buildGeneratorProfileGate])
  .handler(serverFnNoop);
