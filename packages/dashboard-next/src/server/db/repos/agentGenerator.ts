/**
 * Agent Generator sessions repository (P2.1).
 *
 * Persists AI-driven profile-creation conversations: transcript turns, the
 * collected ProfileSpec, lifecycle status, and captured build logs. RBAC is
 * enforced at the server-fn layer; this repo does no auth.
 */

import { desc, eq, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { agentGeneratorSessions } from "../schema";
import type { AgentGeneratorSession, NewAgentGeneratorSession } from "../schema";

export type GeneratorStatus = "draft" | "building" | "done" | "error";

export interface GeneratorTurn {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}

export async function createSession(
  db: DbClient,
  input: Pick<NewAgentGeneratorSession, "model" | "reasoning"> &
    Partial<Pick<NewAgentGeneratorSession, "createdBy" | "slug">>,
): Promise<AgentGeneratorSession> {
  const inserted = await db
    .insert(agentGeneratorSessions)
    .values({
      model: input.model,
      reasoning: input.reasoning,
      createdBy: input.createdBy,
      slug: input.slug,
    })
    .returning();
  // Bug #7 fix: .returning() can yield an empty array (e.g. on a DB constraint
  // violation that drizzle surfaces as an empty result rather than a throw).
  // Guard explicitly so callers see a clear error rather than a runtime
  // "Cannot read properties of undefined" when accessing inserted[0].id.
  if (!inserted[0]) {
    throw new Error("createSession: DB insert returned no rows");
  }
  return inserted[0];
}

export async function getSession(db: DbClient, id: number): Promise<AgentGeneratorSession | null> {
  const rows = await db
    .select()
    .from(agentGeneratorSessions)
    .where(eq(agentGeneratorSessions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSessions(db: DbClient, limit = 50): Promise<AgentGeneratorSession[]> {
  return db
    .select()
    .from(agentGeneratorSessions)
    .orderBy(desc(agentGeneratorSessions.createdAt))
    .limit(limit);
}

/** Append a transcript turn (does NOT clobber existing turns). */
export async function appendTurn(
  db: DbClient,
  id: number,
  turn: GeneratorTurn,
): Promise<AgentGeneratorSession | null> {
  const existing = await getSession(db, id);
  if (!existing) return null;
  const transcript = [...((existing.transcript as GeneratorTurn[]) ?? []), turn];
  const res = await db
    .update(agentGeneratorSessions)
    .set({ transcript, updatedAt: new Date() })
    .where(eq(agentGeneratorSessions.id, id))
    .returning();
  return res[0] ?? null;
}

/** Merge a partial spec patch into the session's `spec` JSONB. */
export async function updateSpec(
  db: DbClient,
  id: number,
  patch: Record<string, unknown>,
): Promise<AgentGeneratorSession | null> {
  const existing = await getSession(db, id);
  if (!existing) return null;
  const spec = { ...((existing.spec as Record<string, unknown>) ?? {}), ...patch };
  const res = await db
    .update(agentGeneratorSessions)
    .set({ spec, updatedAt: new Date() })
    .where(eq(agentGeneratorSessions.id, id))
    .returning();
  return res[0] ?? null;
}

export async function setStatus(
  db: DbClient,
  id: number,
  status: GeneratorStatus,
  extra?: { slug?: string; buildLogs?: string },
): Promise<AgentGeneratorSession | null> {
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (extra?.slug !== undefined) update.slug = extra.slug;
  if (extra?.buildLogs !== undefined) update.buildLogs = extra.buildLogs;
  const res = await db
    .update(agentGeneratorSessions)
    .set(update)
    .where(eq(agentGeneratorSessions.id, id))
    .returning();
  return res[0] ?? null;
}

/**
 * Append build-log lines atomically (SQL-side concatenation).
 *
 * Bug #8 fix: the previous implementation did a read-modify-write cycle, which
 * races when multiple streaming callbacks fire concurrently and can silently
 * drop log lines. Using `build_logs = build_logs || $1` (via drizzle's `sql`
 * template) makes the append atomic at the DB level, eliminating the race
 * without requiring an application-level lock or queue.
 */
export async function appendBuildLogs(
  db: DbClient,
  id: number,
  lines: string,
): Promise<AgentGeneratorSession | null> {
  const res = await db
    .update(agentGeneratorSessions)
    .set({
      buildLogs: sql`${agentGeneratorSessions.buildLogs} || ${lines}`,
      updatedAt: new Date(),
    })
    .where(eq(agentGeneratorSessions.id, id))
    .returning();
  return res[0] ?? null;
}
