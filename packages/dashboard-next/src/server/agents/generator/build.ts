/**
 * Agent Generator — build a real Hermes profile from a collected ProfileSpec (P2.3).
 *
 * Drives the EXISTING host pipeline (no new scaffold path):
 *   1. `scripts/hermes-profile-create.mjs` — scaffolds home + secrets + wrapper + registry
 *   2. `templates/hermes/profile-config.template.yaml` — rich config (best-effort)
 *   3. Hindsight bank — `PUT /v1/default/banks/hermes-<slug>` (best-effort)
 *   4. `hermes-<slug> skills install` — per spec skill (best-effort)
 *   5. `hermes-<slug> mcp add` — per spec mcp (best-effort)
 *   6. Telegram token → profile .env (best-effort)
 *   7. `scripts/ops/cortex-render-units.sh` — render unit templates (critical)
 *   8. `systemctl enable --now hermes-gateway@<slug> hermes-profile@<slug>` (critical)
 *
 * `onLog` receives one line per step. The function never throws on best-effort
 * steps; only critical-step failures (create, render, enable) throw so the
 * caller can set the session status to "error" and surface the reason.
 */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import type { ProfileSpec } from "@/server/agents/generator/types";
import { expandIntegrations } from "@/server/agents/generator/integration-catalog";
import { systemError } from "@/server/errors/types";

const execFileAsync = promisify(execFileCb);

// -------------------------------------------------------------------
// Test seams
export type BuildExecutor = (argv: readonly string[], opts?: {
  timeout?: number;
  maxBuffer?: number;
}) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const defaultExecutor: BuildExecutor = async (argv, opts) => {
  try {
    const { stdout, stderr } = await execFileAsync(argv[0]!, argv.slice(1), {
      timeout: opts?.timeout,
      maxBuffer: opts?.maxBuffer,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (err) {
    // Real execFile rejects on nonzero exit. The build's try/catch around
    // critical steps depends on that: a silent return would mask render or
    // enable failures as success. Re-throw with a structured shape that the
    // test seam can also satisfy.
    const e = err as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const execErr = new Error(e.message ?? "exec failed") as Error & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    execErr.code = typeof e.code === "number" ? e.code : 1;
    execErr.stdout = e.stdout ?? "";
    execErr.stderr = e.stderr ?? "";
    throw execErr;
  }
};
let executor: BuildExecutor = defaultExecutor;
export function setExecutorForTests(fn: BuildExecutor | null): void {
  executor = fn ?? defaultExecutor;
}

// Host paths (gitignored but live on the host; mutable for test overrides).
const CREATE_SCRIPT = "/opt/cortexos/scripts/hermes-profile-create.mjs";
let RICH_CONFIG_TEMPLATE = "/opt/cortexos/templates/hermes/profile-config.template.yaml";
const RENDER_SCRIPT = "/opt/cortexos/scripts/ops/cortex-render-units.sh";
let HINDSIGHT_BASE = "http://127.0.0.1:8888/v1";

export function setBuildTestConfig(overrides: {
  richConfigTemplate?: string;
  hindsightBase?: string;
}): void {
  if (overrides.richConfigTemplate !== undefined) RICH_CONFIG_TEMPLATE = overrides.richConfigTemplate;
  if (overrides.hindsightBase !== undefined) HINDSIGHT_BASE = overrides.hindsightBase;
}

export interface BuildResult {
  slug: string;
  apiPort: number;
  warnings: string[];
}

// -------------------------------------------------------------------
// buildProfileFromSpec
// -------------------------------------------------------------------

export async function buildProfileFromSpec(
  spec: ProfileSpec,
  onLog: (line: string) => void,
): Promise<BuildResult> {
  if (!spec.slug || !/^[a-z0-9][a-z0-9-]*$/.test(spec.slug)) {
    throw systemError(`invalid slug '${spec.slug}'`);
  }
  const warnings: string[] = [];
  const log = (line: string) => onLog(line);

  // 1. Create the profile (CRITICAL).
  log(`create: ${spec.slug} model=${spec.model || "claude-fallback"} reasoning=${spec.reasoning}`);
  let port = 0;
  try {
    const { stdout } = await executor(
      ["node", CREATE_SCRIPT, spec.slug, "", spec.model || "claude-fallback", spec.reasoning],
      { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as { profile?: string; port?: number };
    port = Number(parsed?.port ?? 0);
    if (!port) throw new Error("create script returned no port");
    log(`create: OK (port ${port})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`create: FAIL (${msg})`);
    throw systemError(`hermes-profile-create failed: ${msg}`);
  }

  // 2. Apply the rich config template (BEST-EFFORT).
  // The real template uses `<<PROFILE_NAME>>` / `<<HINDSIGHT_*>>` placeholders.
  // Substitute those and rewrite `model.default:` to the spec's model.
  if (spec.model) {
    try {
      const home = `/opt/cortexos/hermes/profiles/${spec.slug}`;
      const tmpl = await fs.readFile(RICH_CONFIG_TEMPLATE, "utf8");
      const subbed = tmpl
        .replaceAll("<<PROFILE_NAME>>", spec.slug)
        .replaceAll("<<HINDSIGHT_BANK_ID>>", `hermes-${spec.slug}`)
        .replaceAll("<<HINDSIGHT_PEER>>", `hermes-${spec.slug}`)
        .replaceAll("<<HINDSIGHT_CONFIG_PATH>>", `${home}/hindsight.yaml`);
      const lines = subbed.split("\n");
      const modelKeyIdx = lines.findIndex((l) => /^model:\s*$/.test(l));
      if (modelKeyIdx >= 0) {
        let defaultLineRel = -1;
        for (let i = modelKeyIdx + 1; i < lines.length; i += 1) {
          const line = lines[i];
          if (/^\S/.test(line)) break;
          if (/^[ \t]+default:\s*/.test(line)) {
            defaultLineRel = i;
            break;
          }
        }
        if (defaultLineRel >= 0) {
          lines[defaultLineRel] = lines[defaultLineRel].replace(
            /^([ \t]+default:\s*).*/,
            `$1${spec.model}`,
          );
        }
      }
      await fs.writeFile(`${home}/config.yaml`, lines.join("\n"), { mode: 0o644 });
      log("config: applied rich template");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`config template skipped: ${msg}`);
      log(`config: skipped (${msg})`);
    }
  }

  // 3. Hindsight bank (BEST-EFFORT).
  try {
    const res = await fetch(`${HINDSIGHT_BASE}/default/banks/hermes-${spec.slug}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      log(`hindsight: created bank hermes-${spec.slug}`);
    } else {
      warnings.push(`hindsight bank returned ${res.status}`);
      log(`hindsight: non-OK (${res.status})`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`hindsight bank unreachable: ${msg}`);
    log(`hindsight: skipped (${msg})`);
  }

  // Expand selected integrations (gsuite, ms365, …) into the concrete MCP
  // servers, skills, and credential placeholders they require, merged with any
  // the spec already lists. Best-effort, like the steps below.
  const integ = expandIntegrations(spec.integrations);
  for (const id of integ.unknown) {
    warnings.push(`unknown integration '${id}' skipped`);
    log(`integration ${id}: UNKNOWN (skipped)`);
  }
  const allSkills = [...new Set([...spec.skills, ...integ.skills])];
  const allMcps = [...spec.mcps, ...integ.mcps];

  // 4. Install skills (BEST-EFFORT, sequential).
  const wrapper = `/opt/cortexos/bin/hermes-${spec.slug}`;
  for (const skill of allSkills) {
    if (typeof skill !== "string" || skill.length === 0) continue;
    try {
      await executor([wrapper, "skills", "install", skill], {
        timeout: 120_000,
        maxBuffer: 1 * 1024 * 1024,
      });
      log(`skill ${skill}: OK`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`skill ${skill} failed: ${msg}`);
      log(`skill ${skill}: FAIL (${msg})`);
    }
  }

  // 5. Add MCPs (BEST-EFFORT, sequential).
  for (const mcp of allMcps) {
    if (!mcp || typeof mcp.name !== "string" || mcp.name.length === 0) continue;
    const flag = mcp.url ? "--url" : "--command";
    const value = mcp.url ?? mcp.command ?? "";
    if (!value) continue;
    try {
      await executor([wrapper, "mcp", "add", mcp.name, flag, value], {
        timeout: 60_000,
        maxBuffer: 1 * 1024 * 1024,
      });
      log(`mcp ${mcp.name}: OK`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`mcp ${mcp.name} failed: ${msg}`);
      log(`mcp ${mcp.name}: FAIL (${msg})`);
    }
  }

  // 5b. Integration credential placeholders → profile .env (BEST-EFFORT).
  // Append empty `KEY=` lines for any credential the selected integrations need
  // so the operator knows exactly what to fill in. Never overwrites a value.
  if (integ.credentialEnvKeys.length > 0) {
    try {
      const envPath = `/opt/cortexos/.secrets/hermes/${spec.slug}.env`;
      const envText = await fs.readFile(envPath, "utf8").catch(() => "");
      const lines = envText.length > 0 ? envText.split("\n") : [];
      const present = new Set(
        lines.map((l) => l.split("=")[0]?.trim()).filter((k): k is string => !!k),
      );
      const added: string[] = [];
      for (const key of integ.credentialEnvKeys) {
        if (!present.has(key)) {
          lines.push(`${key}=`);
          added.push(key);
        }
      }
      if (added.length > 0) {
        await fs.writeFile(envPath, lines.join("\n"), { mode: 0o600 });
        log(`integration creds: added placeholders ${added.join(", ")}`);
        warnings.push(`fill integration credentials in ${envPath}: ${added.join(", ")}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`integration credential placeholders skipped: ${msg}`);
      log(`integration creds: skipped (${msg})`);
    }
  }

  // 6. Telegram token → profile .env (BEST-EFFORT, replace or append).
  if (spec.telegramBotToken) {
    try {
      const envPath = `/opt/cortexos/.secrets/hermes/${spec.slug}.env`;
      const envText = await fs.readFile(envPath, "utf8");
      const lines = envText.split("\n");
      const existing = lines.findIndex((l) => /^TELEGRAM_BOT_TOKEN=/.test(l));
      const insert = `TELEGRAM_BOT_TOKEN=${spec.telegramBotToken}`;
      if (existing >= 0) lines[existing] = insert;
      else lines.push(insert);
      await fs.writeFile(envPath, lines.join("\n"), { mode: 0o600 });
      log("telegram: token written to .env");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`telegram token skipped: ${msg}`);
      log(`telegram: skipped (${msg})`);
    }
  }

  // 7. Render unit templates (CRITICAL).
  try {
    await executor(
      ["sudo", "bash", RENDER_SCRIPT, "hermes-gateway@.service", "hermes-profile@.service"],
      { timeout: 60_000, maxBuffer: 1 * 1024 * 1024 },
    );
    log("render: unit templates rendered");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`render: FAIL (${msg})`);
    throw systemError(`cortex-render-units failed: ${msg}`);
  }

  // 8. Enable + start both units (CRITICAL).
  for (const unit of [
    `hermes-gateway@${spec.slug}.service`,
    `hermes-profile@${spec.slug}.service`,
  ]) {
    try {
      await executor(["/usr/bin/systemctl", "enable", "--now", unit], {
        timeout: 30_000,
        maxBuffer: 1 * 1024 * 1024,
      });
      log(`unit ${unit}: enabled + started`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`unit ${unit}: FAIL (${msg})`);
      throw systemError(`systemctl enable ${unit} failed: ${msg}`);
    }
  }

  log(`done: ${spec.slug} ready (port ${port})`);
  return { slug: spec.slug, apiPort: port, warnings };
}
