/**
 * Hermes agent control bridge (plan 0.5).
 *
 * Each Hermes agent <slug> is backed by TWO systemd template units:
 *   - hermes-gateway@<slug>.service — the worker.
 *   - hermes-profile@<slug>.service — the API/UI on the profile's apiPort.
 *
 * Start / Stop / Restart act on BOTH units together. Pause stops ONLY the
 * gateway (the profile/API stays up); Resume is just Start again.
 *
 * THIS IS A SEPARATE BRIDGE FROM `@/server/system/systemd`. The systemd bridge
 * allowlist (caddy/tailscaled/postgresql/… ) does NOT include hermes units, so
 * routing agent control through it would be rejected. Agent control validates
 * the slug against the Hermes profiles registry instead (only known profiles
 * are controllable) and issues a fixed `systemctl <verb> <unit>` argv.
 *
 * Executor injection (copied from `@/server/docker/bridge`): a module-level
 * `Executor` type + a default that shells out via `node:child_process execFile`
 * (no shell, no string interpolation), swappable in tests via
 * `setExecutorForTests`. The service runs as root (same as the systemd bridge,
 * which calls `/usr/bin/systemctl` directly — no sudo), so the default executor
 * invokes `/usr/bin/systemctl` with a fixed argv.
 *
 * Public surface:
 *   - AGENT_ACTIONS                         — readonly action tuple
 *   - unitsFor(slug)                        — { gateway, profile } unit names
 *   - getAgentRuntime(slug)                 — derived run-state of one agent
 *   - getAgentRuntimes(slugs)               — slug → state map (parallel)
 *   - controlAgent(slug, action, ctx?)      — dispatch start/stop/restart/pause
 *   - setExecutorForTests(fn | null)        — test helper
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

import { findProfileBySlug, updateProfileModel } from "@/server/agents/registry";
import { readEnvValue } from "@/server/agents/chat";
import { validationError, systemError } from "@/server/errors/types";
import { audit } from "@/server/audit";
import { runSequentially } from "@/lib/sequential";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Public constants + types
// ---------------------------------------------------------------------------

/** The four control verbs the UI can dispatch. */
export const AGENT_ACTIONS = ["start", "stop", "restart", "pause"] as const;

export type AgentAction = (typeof AGENT_ACTIONS)[number];

/** Derived agent run-state, surfaced to the UI. */
export type AgentRuntimeState = "running" | "idle" | "stopped" | "error";

/** Slug validation: lowercase letters, digits, underscores, hyphens only. */
const SLUG_RE = /^[a-z0-9_-]+$/;

/** A per-unit systemctl result captured during a control dispatch. */
export interface AgentUnitResult {
  unit: string;
  exitCode: number;
  stderr: string;
}

/** The structured result `controlAgent` returns. Never throws on systemctl. */
export interface AgentControlResult {
  slug: string;
  action: AgentAction;
  status: "accepted" | "rejected";
  units: AgentUnitResult[];
  state: AgentRuntimeState;
  /** Present only on `rejected` — the first non-zero unit's stderr reason. */
  reason?: string;
}

/** Caller context for granular audit records (optional). */
export interface AgentControlContext {
  userId?: string | number | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string;
}

/**
 * Executor — the seam tests swap. Signature kept tiny so the bridge is
 * trivially testable: it receives the systemctl argv (verb + unit, or
 * `is-active <unit>`) and returns the captured streams + exit code.
 */
export type Executor = (argv: readonly string[]) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;

// ---------------------------------------------------------------------------
// Default executor — `/usr/bin/systemctl <argv...>` via execFile (no shell).
// ---------------------------------------------------------------------------

const SYSTEMCTL = "/usr/bin/systemctl";

const realSystemctlExecutor: Executor = async (argv) => {
  try {
    const { stdout, stderr } = await execFileAsync(SYSTEMCTL, [...argv], {
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (err) {
    // `systemctl is-active` exits non-zero for inactive/failed units — that is
    // NOT an error for our purposes; the captured stdout text is authoritative.
    const e = err as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "systemctl exec failed",
      exitCode: typeof e.code === "number" ? e.code : 1,
    };
  }
};

let executor: Executor = realSystemctlExecutor;

/** Test helper: swap the executor. Pass `null` to reset to the real one. */
export function setExecutorForTests(fn: Executor | null): void {
  executor = fn ?? realSystemctlExecutor;
}

// ---------------------------------------------------------------------------
// Unit naming + slug validation
// ---------------------------------------------------------------------------

/** The two systemd template units backing a Hermes agent slug. */
export function unitsFor(slug: string): { gateway: string; profile: string } {
  return {
    gateway: `hermes-gateway@${slug}.service`,
    profile: `hermes-profile@${slug}.service`,
  };
}

/** Thrown by `assertKnownSlug` when a slug is malformed or not in the registry. */
export class UnknownAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownAgentError";
  }
}

/**
 * Validate a slug against the regex AND the Hermes registry. Only known
 * profiles are controllable. Throws `UnknownAgentError` otherwise.
 */
function assertKnownSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new UnknownAgentError(`agent slug '${slug}' does not match ${SLUG_RE.source}`);
  }
  if (!findProfileBySlug(slug)) {
    throw new UnknownAgentError(`agent '${slug}' is not a known Hermes profile`);
  }
}

// ---------------------------------------------------------------------------
// is-active → state derivation
// ---------------------------------------------------------------------------

/** Run `systemctl is-active <unit>`; return the trimmed status word. */
async function isActive(unit: string): Promise<string> {
  const res = await executor(["is-active", unit]);
  // is-active prints the state on stdout ('active'/'inactive'/'failed'/…) and
  // exits 3 for inactive — the stdout text is the source of truth, never throw.
  const text = (res.stdout || res.stderr || "").trim();
  return text || "inactive";
}

/**
 * Map a (gateway, profile) is-active pair to a derived run-state:
 *   - gateway "active"   → running
 *   - gateway "failed"   → error
 *   - gateway inactive but profile active → idle
 *   - both inactive      → stopped
 */
function deriveState(gatewayActive: string, profileActive: string): AgentRuntimeState {
  if (gatewayActive === "active") return "running";
  if (gatewayActive === "failed") return "error";
  if (profileActive === "active") return "idle";
  return "stopped";
}

/**
 * Derive the run-state of one agent from `systemctl is-active` on its two
 * units. Never throws on inactive units (is-active exit 3 is captured text).
 */
export async function getAgentRuntime(slug: string): Promise<{
  state: AgentRuntimeState;
  gateway: string;
  profile: string;
}> {
  const { gateway, profile } = unitsFor(slug);
  // Defense-in-depth: the read path takes caller-supplied slugs (agents.status
  // is auth:'any'). `isActive` already shells out via execFile with an argv
  // array — no shell injection is possible — but validate the slug format here
  // so an arbitrary string is never interpolated into a unit name and probed.
  if (!SLUG_RE.test(slug)) {
    return { state: "stopped", gateway, profile };
  }
  const [gatewayActive, profileActive] = await Promise.all([isActive(gateway), isActive(profile)]);
  return { state: deriveState(gatewayActive, profileActive), gateway, profile };
}

/** Derive run-state for many agents in parallel → slug → state map. */
export async function getAgentRuntimes(
  slugs: readonly string[],
): Promise<Record<string, AgentRuntimeState>> {
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const { state } = await getAgentRuntime(slug);
      return [slug, state] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// controlAgent — dispatch a control verb to the agent's units
// ---------------------------------------------------------------------------

/** The systemctl verb + the units it targets for each action. */
function plan(
  action: AgentAction,
  units: { gateway: string; profile: string },
): {
  verb: string;
  targets: string[];
} {
  switch (action) {
    case "start":
      return { verb: "start", targets: [units.gateway, units.profile] };
    case "stop":
      return { verb: "stop", targets: [units.gateway, units.profile] };
    case "restart":
      return { verb: "restart", targets: [units.gateway, units.profile] };
    case "pause":
      // Pause stops ONLY the gateway; the profile (API/UI) stays up.
      return { verb: "stop", targets: [units.gateway] };
    default:
      return { verb: "stop", targets: [] };
  }
}

function emitUnitAudit(
  ctx: AgentControlContext | undefined,
  action: AgentAction,
  unit: string,
  outcome: "success" | "failure",
  errorCode: string | null,
): void {
  audit({
    actorUserId: (ctx?.userId ?? null) as never,
    actorSessionId: (ctx?.sessionId ?? null) as never,
    actorIp: ctx?.ip ?? null,
    actorUserAgent: ctx?.userAgent ?? null,
    surface: "agents",
    action: "agents.control.dispatch",
    target: unit,
    result: outcome,
    errorCode,
    requestId: ctx?.requestId,
    payload: { action, unit },
  });
}

/**
 * Dispatch a control verb to an agent's systemd units.
 *
 *   start   → start gateway + profile
 *   stop    → stop  gateway + profile
 *   restart → restart gateway + profile
 *   pause   → stop  gateway only
 *
 * Validates the slug first (regex + registry). On any non-zero systemctl exit
 * the overall status is `rejected` with the first failing unit's stderr.
 * Returns the freshly-derived run-state. Never throws on systemctl failure.
 */
export async function controlAgent(
  slug: string,
  action: AgentAction,
  ctx?: AgentControlContext,
): Promise<AgentControlResult> {
  assertKnownSlug(slug);
  if (!AGENT_ACTIONS.includes(action)) {
    throw new UnknownAgentError(`unknown agent action '${action}'`);
  }

  const units = unitsFor(slug);
  const { verb, targets } = plan(action, units);

  // Issue the systemctl calls in order (gateway before profile) — sequential
  // via the reduce-chain helper so the body stays lint-clean (no await-in-loop).
  const results: AgentUnitResult[] = await runSequentially(targets, async (unit) => {
    // Fixed argv — no shell, no interpolation (verb + validated unit name).
    const res = await executor([verb, unit]);
    emitUnitAudit(
      ctx,
      action,
      unit,
      res.exitCode === 0 ? "success" : "failure",
      res.exitCode === 0 ? null : "systemctl_nonzero",
    );
    return { unit, exitCode: res.exitCode, stderr: res.stderr };
  });

  const failed = results.find((r) => r.exitCode !== 0);
  const { state } = await getAgentRuntime(slug);

  if (failed) {
    return {
      slug,
      action,
      status: "rejected",
      units: results,
      state,
      reason: failed.stderr.trim() || `systemctl ${verb} ${failed.unit} failed`,
    };
  }

  return { slug, action, status: "accepted", units: results, state };
}

// ---------------------------------------------------------------------------
// setAgentModel — change a profile's model + reasoning (P1.3)
// ---------------------------------------------------------------------------

export const AGENT_REASONING_LEVELS = ["low", "medium", "high"] as const;
export type AgentReasoning = (typeof AGENT_REASONING_LEVELS)[number];

export interface SetAgentModelInput {
  model: string;
  reasoning: AgentReasoning;
}
export interface SetAgentModelResult {
  slug: string;
  model: string;
  reasoning: AgentReasoning;
  restarted: { unit: string; exitCode: number }[];
}

// `^  default: <id>$` — the indented line under the top-level `model:` key in
// the profile's config.yaml (see scripts/hermes-profile-create.mjs
// `renderHermesConfig`). Captures the current value to detect a no-op swap.
const CONFIG_MODEL_LINE = /^([ \t]*default:[ \t]*)(.*?)([ \t]*#.*)?$/;

/**
 * Validate + persist a model/reasoning change for a Hermes profile, then
 * restart its two units so the running service picks up the new value.
 *
 * Side effects (all under `<profile.home>` / `<profile.secretPath>`):
 *   - rewrites `config.yaml`'s `model.default:` line
 *   - rewrites the `.env` `HERMES_MODEL` / `HERMES_REASONING` values
 *   - updates the registry entry (`profiles.json`) so the UI list is fresh
 *   - `systemctl restart hermes-gateway@<slug>` + `hermes-profile@<slug>`
 *
 * Throws:
 *   - `UnknownAgentError`  malformed/unknown slug
 *   - `validationError`    unknown reasoning level, unknown model id, or a
 *                          config.yaml without a `model.default:` line
 */
export async function setAgentModel(
  slug: string,
  input: SetAgentModelInput,
  ctx?: AgentControlContext,
): Promise<SetAgentModelResult> {
  assertKnownSlug(slug);
  if (!AGENT_REASONING_LEVELS.includes(input.reasoning)) {
    throw validationError(`unknown reasoning '${input.reasoning}'`, [
      { field: "reasoning", message: "must be one of low, medium, high" },
    ]);
  }

  const profile = findProfileBySlug(slug);
  if (!profile) {
    // assertKnownSlug already covered this; narrow for TS.
    throw new UnknownAgentError(`agent '${slug}' is not a known Hermes profile`);
  }

  const configPath = `${profile.home}/config.yaml`;
  const configText = (() => {
    try {
      return fs.readFileSync(configPath, "utf8");
    } catch {
      throw validationError("profile_config_missing");
    }
  })();
  const lines = configText.split("\n");
  // The `default:` line lives directly under the top-level `model:` key.
  const modelKeyIdx = lines.findIndex((l) => /^model:\s*$/.test(l));
  if (modelKeyIdx === -1) {
    throw validationError("profile_config_malformed", [
      { field: "model", message: "config.yaml has no top-level 'model:' key" },
    ]);
  }
  // Scan only the `model:` block — stop at the next top-level (column-0) key
  // so a nested `default:` under `providers:` etc. is never matched.
  let defaultIdx = -1;
  for (let i = modelKeyIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // next top-level key → end of model block
    if (CONFIG_MODEL_LINE.test(line) && /^[ \t]+/.test(line)) {
      defaultIdx = i;
      break;
    }
  }
  if (defaultIdx === -1) {
    throw validationError("profile_config_malformed", [
      { field: "model", message: "config.yaml has no 'model.default:' line" },
    ]);
  }
  const replaced = lines[defaultIdx].replace(
    CONFIG_MODEL_LINE,
    (_m, prefix: string, _old: string, comment: string | undefined) =>
      `${prefix}${input.model}${comment ?? ""}`,
  );
  lines[defaultIdx] = replaced;
  fs.writeFileSync(configPath, lines.join("\n"), { mode: 0o644 });

  // Rewrite the .env HERMES_MODEL / HERMES_REASONING lines in place.
  if (profile.secretPath) {
    const envText = (() => {
      try {
        return fs.readFileSync(profile.secretPath, "utf8");
      } catch {
        return "";
      }
    })();
    const nextEnv = rewriteEnvLines(envText, {
      HERMES_MODEL: input.model,
      HERMES_REASONING: input.reasoning,
    });
    fs.writeFileSync(profile.secretPath, nextEnv, { mode: 0o600 });
  }

  // Keep the registry fresh so the UI list reflects the swap immediately.
  updateProfileModel(slug, { model: input.model, reasoning: input.reasoning });

  const units = unitsFor(slug);
  // Restart profile first so the new env/config is live before the gateway
  // reconnects to it.
  const restarted = await runSequentially([units.profile, units.gateway], async (unit) => {
    const res = await executor(["restart", unit]);
    emitUnitAudit(
      ctx,
      "restart",
      unit,
      res.exitCode === 0 ? "success" : "failure",
      res.exitCode === 0 ? null : "systemctl_nonzero",
    );
    return { unit, exitCode: res.exitCode };
  });

  const failed = restarted.find((r) => r.exitCode !== 0);
  if (failed) {
    throw systemError(`restart ${failed.unit} failed (exit ${failed.exitCode})`);
  }

  return { slug, model: input.model, reasoning: input.reasoning, restarted };
}

/**
 * Rewrite `KEY=...` lines in a dotenv string. Preserves comments, ordering,
 * and quote style. Lines for keys in `updates` are replaced in place; keys
 * absent from the file are APPENDED. Used by setAgentModel for HERMES_MODEL /
 * HERMES_REASONING.
 */
function rewriteEnvLines(envText: string, updates: Record<string, string>): string {
  const remaining = new Set(Object.keys(updates));
  const out = envText.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const deexported = trimmed.replace(/^export\s+/, "");
    const eq = deexported.indexOf("=");
    if (eq <= 0) return line;
    const key = deexported.slice(0, eq).trim();
    if (!(key in updates)) return line;
    remaining.delete(key);
    const prefix = line.slice(0, line.indexOf("=") + 1);
    return `${prefix}${updates[key]}`;
  });
  for (const key of Object.keys(updates)) {
    if (remaining.has(key)) out.push(`${key}=${updates[key]}`);
  }
  return out.join("\n");
}
