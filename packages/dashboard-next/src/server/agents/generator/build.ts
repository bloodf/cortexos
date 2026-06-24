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
import { readStagedSecrets, clearStagedSecrets } from "@/server/agents/generator/secretStaging";
import { systemError } from "@/server/errors/types";

const execFileAsync = promisify(execFileCb);

// Defense-in-depth guards (the RPC handler in agentGenerator.functions.ts is the
// primary gate, but a future caller could reach buildProfileFromSpec directly).
/** Model id charset — must match the RPC boundary's MODEL_RE. */
const MODEL_RE = /^[A-Za-z0-9._:/-]+$/;
/** Any CR/LF makes a value unsafe to write into a line-oriented .env file. */
const hasNewline = (v: string): boolean => v.includes("\n") || v.includes("\r");

// -------------------------------------------------------------------
// Test seams
export type BuildExecutor = (
  argv: readonly string[],
  opts?: {
    timeout?: number;
    maxBuffer?: number;
    cwd?: string;
    /** Extra env vars merged over process.env (e.g. HERMES_COMMAND). */
    env?: Record<string, string>;
  },
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const defaultExecutor: BuildExecutor = async (argv, opts) => {
  try {
    const { stdout, stderr } = await execFileAsync(argv[0]!, argv.slice(1), {
      timeout: opts?.timeout,
      maxBuffer: opts?.maxBuffer,
      cwd: opts?.cwd,
      env: opts?.env ? { ...process.env, ...opts.env } : undefined,
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
const REPO_ROOT = "/opt/cortexos";
// The per-profile wrapper (`hermes-<slug>`) execs `${HERMES_COMMAND:-hermes}`.
// The dashboard service has no PATH to /home/cortexos/.local/bin and no
// HERMES_COMMAND, so bare `hermes` is unresolvable → skills/mcp steps silently
// fail in prod. Point the wrapper at the absolute launcher for those calls.
const HERMES_BIN = "/home/cortexos/.local/bin/hermes";
const CREATE_SCRIPT = "/opt/cortexos/scripts/hermes-profile-create.mjs";
let RICH_CONFIG_TEMPLATE = "/opt/cortexos/templates/hermes/profile-config.template.yaml";
const RENDER_SCRIPT = "/opt/cortexos/scripts/ops/cortex-render-units.sh";
let HINDSIGHT_BASE = "http://127.0.0.1:8888/v1";
let SECRETS_DIR = "/opt/cortexos/.secrets/hermes";
let PROFILES_DIR = "/opt/cortexos/hermes/profiles";

export function setBuildTestConfig(overrides: {
  richConfigTemplate?: string;
  hindsightBase?: string;
  secretsDir?: string;
  profilesDir?: string;
}): void {
  if (overrides.richConfigTemplate !== undefined)
    RICH_CONFIG_TEMPLATE = overrides.richConfigTemplate;
  if (overrides.hindsightBase !== undefined) HINDSIGHT_BASE = overrides.hindsightBase;
  if (overrides.secretsDir !== undefined) SECRETS_DIR = overrides.secretsDir;
  if (overrides.profilesDir !== undefined) PROFILES_DIR = overrides.profilesDir;
}

/** Build the agent persona (SOUL.md) from the spec when the model didn't author one. */
function generateSoul(spec: ProfileSpec): string {
  const name = spec.name || spec.slug;
  const roles = (spec.roles ?? [])
    .filter((r) => r && typeof r.role === "string" && r.role.length > 0)
    .map((r) => `- ${r.role}${r.focus ? `: ${r.focus}` : ""}`)
    .join("\n");
  const out = [
    `# SOUL`,
    ``,
    `You are **${name}**.`,
    spec.description ? `\n${spec.description}` : ``,
    `\n## Identity`,
    `- Name: ${name}`,
    spec.channels.length > 0 ? `- Channels: ${spec.channels.join(", ")}` : ``,
    `\nWhen asked who you are, say you are ${name}.`,
    roles ? `\n## Roles you cover\n${roles}` : ``,
    `\n## Principles`,
    `- Be accurate. Never invent facts, numbers, dates, or sources; if unsure, say so plainly.`,
    `- Stay within your role and scope. Be concise and clear.`,
    ``,
  ];
  return out.filter((l) => l !== "").join("\n");
}

/** Minimal operating-rules doc that defers to SOUL.md. */
function generateAgentsMd(spec: ProfileSpec): string {
  const name = spec.name || spec.slug;
  return [
    `# AGENTS.md`,
    ``,
    `You are **${name}**. Always follow SOUL.md.`,
    ``,
    `## Output`,
    `Reply with the final answer only. Never expose tool calls, logs, MCP/RAG internals,`,
    `execution IDs, or shell commands to the user.`,
    ``,
  ].join("\n");
}

export interface BuildResult {
  slug: string;
  apiPort: number;
  warnings: string[];
  /** "deployed" when build succeeded and status.json was written; "error" is
   *  never returned (the function throws on critical failure), so callers can
   *  treat a returned BuildResult as always "deployed". */
  status: "deployed";
}

// -------------------------------------------------------------------
// buildProfileFromSpec
// -------------------------------------------------------------------

export async function buildProfileFromSpec(
  spec: ProfileSpec,
  onLog: (line: string) => void,
  /** When set, staged out-of-band secrets for this session are merged into the
   *  profile .env and the staging file is deleted after a successful build. */
  sessionId?: number,
): Promise<BuildResult> {
  if (!spec.slug || !/^[a-z0-9][a-z0-9-]*$/.test(spec.slug)) {
    throw systemError(`invalid slug '${spec.slug}'`);
  }
  const warnings: string[] = [];
  const log = (line: string) => onLog(line);

  // Sanitize the model defensively (the RPC boundary already validates it, but
  // a direct caller could pass anything). A bad model would otherwise be written
  // verbatim into config.yaml's `model.default:` and could inject a YAML key.
  const safeModel = typeof spec.model === "string" && MODEL_RE.test(spec.model) ? spec.model : "";
  if (spec.model && !safeModel) {
    warnings.push("model rejected (invalid characters); using create-script default");
    log("model: rejected (invalid characters)");
  }

  // 1. Create the profile (CRITICAL).
  log(`create: ${spec.slug} model=${safeModel || "claude-fallback"} reasoning=${spec.reasoning}`);
  let port = 0;
  try {
    const { stdout } = await executor(
      ["node", CREATE_SCRIPT, spec.slug, "", safeModel || "claude-fallback", spec.reasoning],
      // The create script resolves its template paths relative to cwd
      // (`resolve("templates/hermes/...")`). The dashboard runs with
      // WorkingDirectory=.../packages/dashboard-next, so without pinning cwd to
      // the repo root the templates resolve under the package dir and the
      // CRITICAL create step fails with ENOENT.
      { timeout: 60_000, maxBuffer: 4 * 1024 * 1024, cwd: REPO_ROOT },
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

  // 1b. Write the agent persona (SOUL.md) + operating rules (AGENTS.md) — the
  // agent's actual identity. Without this the profile runs with a default
  // persona and the whole interview is wasted. Prefer the model-authored soul;
  // otherwise generate one from the spec.
  try {
    const home = `${PROFILES_DIR}/${spec.slug}`;
    const soul =
      typeof spec.soul === "string" && spec.soul.trim().length > 0
        ? spec.soul.trim()
        : generateSoul(spec);
    await fs.writeFile(`${home}/SOUL.md`, `${soul}\n`, { mode: 0o644 });
    await fs.writeFile(`${home}/AGENTS.md`, generateAgentsMd(spec), { mode: 0o644 });
    log("persona: wrote SOUL.md + AGENTS.md");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`persona write skipped: ${msg}`);
    log(`persona: skipped (${msg})`);
  }

  // 1c. Persist per-account metadata to accounts.yaml (BEST-EFFORT).
  try {
    const home = `${PROFILES_DIR}/${spec.slug}`;
    const hasMcpLabels =
      Array.isArray(spec.mcps) && spec.mcps.some((m) => m.accountLabel || m.credentialClass);
    let accountsYaml: string;
    if (!hasMcpLabels) {
      accountsYaml =
        "# Per-profile account metadata. Generated by the Agent Generator build.\n" +
        "# Source of truth for which MCP server belongs to which real-world account.\n" +
        "mcp_accounts: []\n";
    } else {
      const entries = spec.mcps
        .map((m) => {
          // JSON.stringify produces a valid YAML double-quoted scalar for any
          // string, handling embedded `"`, `\`, and control characters.
          const lines: string[] = [`  - name: ${JSON.stringify(String(m.name))}`];
          if (m.accountLabel)
            lines.push(`    account_label: ${JSON.stringify(String(m.accountLabel))}`);
          if (m.credentialClass)
            lines.push(`    credential_class: ${JSON.stringify(String(m.credentialClass))}`);
          return lines.join("\n");
        })
        .join("\n");
      accountsYaml =
        "# Per-profile account metadata. Generated by the Agent Generator build.\n" +
        "# Source of truth for which MCP server belongs to which real-world account.\n" +
        "mcp_accounts:\n" +
        entries +
        "\n";
    }
    await fs.writeFile(`${home}/accounts.yaml`, accountsYaml, { mode: 0o644 });
    log("accounts: wrote accounts.yaml");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`accounts.yaml write skipped: ${msg}`);
    log(`accounts: skipped (${msg})`);
  }

  // 1d. Persist EOD / output routing to outputs.yaml (BEST-EFFORT).
  try {
    const home = `${PROFILES_DIR}/${spec.slug}`;
    let outputsYaml: string;
    if (!Array.isArray(spec.outputs) || spec.outputs.length === 0) {
      outputsYaml =
        "# Per-profile output routing. Generated by the Agent Generator build.\n" +
        "# Consumed by the downstream EOD/status generator (operator's local cron).\n" +
        "outputs: []\n";
    } else {
      const entries = spec.outputs
        .map((o) => {
          // JSON.stringify for all scalars that can contain arbitrary user text:
          // name/format/channel go unquoted only if they were plain identifiers,
          // but since they are free-form strings from the spec, quote them all.
          const lines: string[] = [
            `  - name: ${JSON.stringify(String(o.name))}`,
            `    trigger: ${JSON.stringify(String(o.trigger))}`,
            `    format: ${JSON.stringify(String(o.format))}`,
            `    channel: ${JSON.stringify(String(o.channel))}`,
          ];
          if (o.template) {
            // Block literal (|): content is literal; only risk is CR in lines.
            // Strip \r so \r\n input doesn't leave trailing garbage.
            lines.push(`    template: |`);
            for (const tl of o.template.split("\n")) {
              lines.push(`      ${tl.replace(/\r$/, "")}`);
            }
          }
          return lines.join("\n");
        })
        .join("\n");
      outputsYaml =
        "# Per-profile output routing. Generated by the Agent Generator build.\n" +
        "# Consumed by the downstream EOD/status generator (operator's local cron).\n" +
        "outputs:\n" +
        entries +
        "\n";
    }
    await fs.writeFile(`${home}/outputs.yaml`, outputsYaml, { mode: 0o644 });
    log("outputs: wrote outputs.yaml");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`outputs.yaml write skipped: ${msg}`);
    log(`outputs: skipped (${msg})`);
  }

  // 1e. Append deployment + operator context to SOUL.md (BEST-EFFORT).
  // This is a markdown footer, not YAML. Values are serialized as single-line
  // strings: newlines replaced with ↵ so one meta key never bleeds into the
  // next markdown list item.
  if (spec.meta && Object.keys(spec.meta).length > 0) {
    try {
      const home = `${PROFILES_DIR}/${spec.slug}`;
      const metaLines = Object.entries(spec.meta)
        .map(([k, v]) => `- **${k}**: ${String(v).replace(/[\r\n]+/g, " ↵ ")}`)
        .join("\n");
      const footer =
        "\n\n---\n\n## Deployment & Operator Context\n\n" +
        "> Generated from spec.meta by the Agent Generator build. Edit `accounts.yaml` / `outputs.yaml` to change; the SOUL.md copy is regenerated on every build.\n\n" +
        metaLines +
        "\n";
      await fs.appendFile(`${home}/SOUL.md`, footer, { encoding: "utf8" });
      log("meta: appended deployment context to SOUL.md");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`meta append to SOUL.md skipped: ${msg}`);
      log(`meta: skipped (${msg})`);
    }
  }

  // 2. Apply the rich config template (BEST-EFFORT).
  // The real template uses `<<PROFILE_NAME>>` / `<<HINDSIGHT_*>>` placeholders.
  // Substitute those and rewrite `model.default:` to the spec's model.
  if (safeModel) {
    try {
      const home = `${PROFILES_DIR}/${spec.slug}`;
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
            `$1${safeModel}`,
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
  // Name integration MCP servers per-profile (e.g. "<slug>-gsuite"), matching
  // the host's existing pattern (e.g. "cieucpb-calendar"). Combined with the
  // per-profile .env (each profile's OAuth/API creds live only in its own
  // secured .env), this keeps multiple Google/Microsoft accounts on different
  // profiles fully isolated — they never share a server name, config, or token.
  const integMcps = integ.mcps.map((m) => ({ ...m, name: `${spec.slug}-${m.name}` }));
  const allMcps = [...spec.mcps, ...integMcps];

  // 4. Install skills (BEST-EFFORT, sequential).
  const wrapper = `/opt/cortexos/bin/hermes-${spec.slug}`;
  for (const skill of allSkills) {
    if (typeof skill !== "string" || skill.length === 0) continue;
    try {
      await executor([wrapper, "skills", "install", skill], {
        timeout: 120_000,
        maxBuffer: 1 * 1024 * 1024,
        env: { HERMES_COMMAND: HERMES_BIN },
      });
      log(`skill ${skill}: OK`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`skill ${skill} failed: ${msg}`);
      log(`skill ${skill}: FAIL (${msg})`);
    }
  }

  // 5. Add MCPs (BEST-EFFORT, sequential). `hermes mcp add <name>` accepts
  // --preset (Hermes catalog), --url/--command, --env KEY=VALUE…, and --args …
  // (which must come last). Credentials live in the profile .env (step 5b); we
  // reference them as ${KEY} so the secret never lands in config.yaml or argv.
  for (const mcp of allMcps) {
    if (!mcp || typeof mcp.name !== "string" || mcp.name.length === 0) continue;
    const argv: string[] = [wrapper, "mcp", "add", mcp.name];
    if (mcp.preset) {
      argv.push("--preset", mcp.preset);
    } else if (mcp.url) {
      argv.push("--url", mcp.url);
    } else if (mcp.command) {
      argv.push("--command", mcp.command);
    } else {
      continue; // nothing actionable to add
    }
    const envKeys = mcp.env ? Object.keys(mcp.env).filter((k) => k.length > 0) : [];
    if (envKeys.length > 0) {
      argv.push("--env", ...envKeys.map((k) => `${k}=\${${k}}`));
    }
    if (Array.isArray(mcp.args) && mcp.args.length > 0) {
      argv.push("--args", ...mcp.args.filter((a): a is string => typeof a === "string"));
    }
    try {
      await executor(argv, {
        timeout: 60_000,
        maxBuffer: 1 * 1024 * 1024,
        env: { HERMES_COMMAND: HERMES_BIN },
      });
      log(`mcp ${mcp.name}: OK`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`mcp ${mcp.name} failed: ${msg}`);
      log(`mcp ${mcp.name}: FAIL (${msg})`);
    }
  }

  // 5b. Write credentials to the profile .env (mode 0600, BEST-EFFORT):
  //   - operator-provided MCP env vars (API keys) → written with their values;
  //   - integration credential keys not otherwise provided → empty placeholders.
  // Key NAMES are logged for traceability; values are never logged or echoed.
  const mcpEnv: Record<string, string> = {};
  for (const mcp of allMcps) {
    if (mcp && mcp.env && typeof mcp.env === "object") {
      for (const [k, v] of Object.entries(mcp.env)) {
        if (typeof k !== "string" || k.length === 0 || typeof v !== "string") continue;
        // Defense-in-depth: a key/value with CR/LF would inject extra .env lines.
        if (hasNewline(k) || hasNewline(v)) {
          warnings.push(`mcp env '${k}' skipped: contains newline`);
          log(`mcp env ${k}: skipped (newline)`);
          continue;
        }
        mcpEnv[k] = v;
      }
    }
  }
  const placeholderKeys = integ.credentialEnvKeys.filter((k) => !(k in mcpEnv));
  if (Object.keys(mcpEnv).length > 0 || placeholderKeys.length > 0) {
    try {
      const envPath = `${SECRETS_DIR}/${spec.slug}.env`;
      const envText = await fs.readFile(envPath, "utf8").catch(() => "");
      const lines = envText.length > 0 ? envText.split("\n") : [];
      const keyOf = (l: string) => l.split("=")[0]?.trim();
      // Upsert real MCP credential values (replace if present, else append).
      const setKeys: string[] = [];
      for (const [k, v] of Object.entries(mcpEnv)) {
        const idx = lines.findIndex((l) => keyOf(l) === k);
        if (idx >= 0) lines[idx] = `${k}=${v}`;
        else lines.push(`${k}=${v}`);
        setKeys.push(k);
      }
      // Add empty placeholders only when the key is absent.
      const present = new Set(lines.map(keyOf).filter((k): k is string => !!k));
      const added: string[] = [];
      for (const key of placeholderKeys) {
        if (!present.has(key)) {
          lines.push(`${key}=`);
          added.push(key);
        }
      }
      await fs.writeFile(envPath, lines.join("\n"), { mode: 0o600 });
      if (setKeys.length > 0) log(`mcp creds: wrote ${setKeys.join(", ")}`);
      if (added.length > 0) {
        log(`integration creds: added placeholders ${added.join(", ")}`);
        warnings.push(`fill integration credentials in ${envPath}: ${added.join(", ")}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`mcp/integration credentials skipped: ${msg}`);
      log(`mcp/integration creds: skipped (${msg})`);
    }
  }

  // 6. Telegram token → profile .env (BEST-EFFORT, replace or append).
  if (spec.telegramBotToken && hasNewline(spec.telegramBotToken)) {
    // Defense-in-depth: a token with CR/LF would inject extra .env lines.
    warnings.push("telegram token skipped: contains newline");
    log("telegram: skipped (newline)");
  } else if (spec.telegramBotToken) {
    try {
      const envPath = `${SECRETS_DIR}/${spec.slug}.env`;
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

  // 6.5 Merge out-of-band staged secrets into the profile .env (BEST-EFFORT
  //      write; the staging file is cleared only AFTER the whole build succeeds,
  //      so a render/enable failure below does not lose the operator's values on
  //      retry). Values are entered via setGeneratorSecret, never via chat/spec.
  if (typeof sessionId === "number") {
    try {
      const staged = await readStagedSecrets(sessionId);
      if (staged.size > 0) {
        const envPath = `${SECRETS_DIR}/${spec.slug}.env`;
        const envText = await fs.readFile(envPath, "utf8").catch(() => "");
        const lines = envText.length > 0 ? envText.split("\n") : [];
        const keyOf = (l: string) => l.split("=")[0]?.trim();
        const wrote: string[] = [];
        for (const [k, v] of staged) {
          if (hasNewline(k) || hasNewline(v)) {
            warnings.push(`staged secret '${k}' skipped: contains newline`);
            continue;
          }
          const idx = lines.findIndex((l) => keyOf(l) === k);
          if (idx >= 0) lines[idx] = `${k}=${v}`;
          else lines.push(`${k}=${v}`);
          wrote.push(k);
        }
        await fs.writeFile(envPath, lines.join("\n"), { mode: 0o600 });
        if (wrote.length > 0) log(`staged secrets: wrote ${wrote.join(", ")}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`staged secrets skipped: ${msg}`);
      log(`staged secrets: skipped (${msg})`);
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

  // 9. Write status.json — build-time record that the profile is deployed (BEST-EFFORT).
  try {
    const statusPath = `${PROFILES_DIR}/${spec.slug}/status.json`;
    const statusData = {
      slug: spec.slug,
      status: "deployed",
      deployedAt: new Date().toISOString(),
      port,
      version: 1,
    };
    await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2) + "\n", { mode: 0o644 });
    log(`status: wrote status.json (deployed)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`status.json write skipped: ${msg}`);
    log(`status: skipped (${msg})`);
  }

  // Build succeeded through all critical steps — clear the staged secrets so the
  // plaintext staging file does not linger on disk. Best-effort: a failure here
  // does not fail the build (the file is 0600 and re-cleared on next build).
  if (typeof sessionId === "number") {
    await clearStagedSecrets(sessionId).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      log(`staged secrets: cleanup skipped (${msg})`);
    });
  }

  log(`done: ${spec.slug} ready (port ${port})`);
  return { slug: spec.slug, apiPort: port, warnings, status: "deployed" };
}
