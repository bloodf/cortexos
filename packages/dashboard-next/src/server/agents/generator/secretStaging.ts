/**
 * Out-of-band secret staging for the Agent Generator.
 *
 * Problem: the interview spec must NEVER carry real secret values (they would
 * land in the LLM transcript, the persisted spec, and the approval-mint
 * payload). But the build step needs the values to write the profile `.env`.
 *
 * Solution: secret VALUES are entered through a dedicated server-fn
 * (`setGeneratorSecret`) and staged on disk, keyed by session id, separate from
 * the spec. The build reads the staged values, merges them into the profile
 * `.env`, then deletes the staging file. Values never touch chat / spec / mint.
 *
 * Staging file: `${SECRETS_DIR}/.staging/<sessionId>.env` — dir mode 0700,
 * file mode 0600, simple `KEY=VALUE` lines (same shape the build already reads).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type { ProfileSpec } from "@/server/agents/generator/types";

// Mirrors build.ts SECRETS_DIR; overridable for tests via setSecretStagingDir.
let SECRETS_DIR = "/opt/cortexos/.secrets/hermes";

export function setSecretStagingDir(dir: string): void {
  SECRETS_DIR = dir;
}

function stagingDir(): string {
  return path.join(SECRETS_DIR, ".staging");
}

function stagingPath(sessionId: number): string {
  return path.join(stagingDir(), `${sessionId}.env`);
}

/**
 * Env-var key allowlist. A staged key must (a) be a syntactically valid env
 * name and (b) be a slot the approved spec actually declares — so the client
 * can never inject an arbitrary env var into the generated profile.
 */
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * Derive the set of secret KEY NAMES the spec legitimately needs filled:
 *   - every key in each `mcps[].env` (the interview records the NAME with an
 *     empty value when it needs a secret), and
 *   - `TELEGRAM_BOT_TOKEN` when the spec opts into a telegram channel and flags
 *     a token requirement (`telegramBotToken` present, even as empty string).
 */
export function requiredSecretKeys(spec: Partial<ProfileSpec>): string[] {
  const keys = new Set<string>();
  const mcps = Array.isArray(spec.mcps) ? spec.mcps : [];
  for (const mcp of mcps) {
    if (mcp && mcp.env && typeof mcp.env === "object") {
      for (const k of Object.keys(mcp.env)) {
        if (ENV_NAME.test(k)) keys.add(k);
      }
    }
  }
  // telegramBotToken present (any value, incl. "") => the token slot is needed.
  if (typeof spec.telegramBotToken === "string") keys.add("TELEGRAM_BOT_TOKEN");
  return [...keys];
}

/** True when `key` is a valid env name AND a slot the spec declares. */
export function isAllowedSecretKey(spec: Partial<ProfileSpec>, key: string): boolean {
  return ENV_NAME.test(key) && requiredSecretKeys(spec).includes(key);
}

function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split("\n")) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    if (ENV_NAME.test(k)) out.set(k, line.slice(eq + 1));
  }
  return out;
}

function serializeEnv(map: Map<string, string>): string {
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n");
}

/**
 * Upsert one staged secret for a session. Rejects CR/LF in the value (env-line
 * injection) and any key not on the spec-derived allowlist. Returns the list of
 * keys currently staged (NEVER the values).
 */
export async function stageSecret(
  sessionId: number,
  key: string,
  value: string,
): Promise<string[]> {
  if (!ENV_NAME.test(key)) throw new Error(`invalid secret key: ${key}`);
  if (/[\r\n]/.test(value)) throw new Error("secret value contains newline");
  await fs.mkdir(stagingDir(), { recursive: true, mode: 0o700 });
  // Defense-in-depth on a pre-existing dir.
  await fs.chmod(stagingDir(), 0o700).catch(() => {});
  const p = stagingPath(sessionId);
  const existing = await fs.readFile(p, "utf8").catch(() => "");
  const map = parseEnv(existing);
  map.set(key, value);
  await fs.writeFile(p, serializeEnv(map), { mode: 0o600 });
  await fs.chmod(p, 0o600).catch(() => {});
  return [...map.keys()];
}

/** List the KEY NAMES currently staged for a session (never values). */
export async function listStagedSecretKeys(sessionId: number): Promise<string[]> {
  const text = await fs.readFile(stagingPath(sessionId), "utf8").catch(() => "");
  return [...parseEnv(text).keys()];
}

/** Read the staged KEY=VALUE map for a session (build-side only). */
export async function readStagedSecrets(sessionId: number): Promise<Map<string, string>> {
  const text = await fs.readFile(stagingPath(sessionId), "utf8").catch(() => "");
  return parseEnv(text);
}

/** Delete the staging file for a session (after a successful build). */
export async function clearStagedSecrets(sessionId: number): Promise<void> {
  await fs.rm(stagingPath(sessionId), { force: true });
}
