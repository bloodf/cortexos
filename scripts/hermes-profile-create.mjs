#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const [profile, portArg, model = "cx/gpt-5.5", reasoning = "medium"] = process.argv.slice(2);

if (!profile || !/^[a-z0-9][a-z0-9-]*$/.test(profile)) {
  throw new Error("usage: hermes-profile-create.mjs <profile-slug> [port] [model] [reasoning]");
}

const root = "/opt/cortexos/hermes";
const registryPath = `${root}/profiles.json`;
const profileHome = `${root}/profiles/${profile}`;
const secretsDir = "/opt/cortexos/.secrets/hermes";
const secretPath = `${secretsDir}/${profile}.env`;
const templatePath = resolve("templates/hermes/profile-template.json");
const mcpTemplatePath = resolve("templates/hermes/filesystem-mcp.yaml");
const binDir = "/opt/cortexos/bin";
const userBinDir = process.env.CORTEX_USER_BIN_DIR || (process.env.HOME ? `${process.env.HOME}/.local/bin` : "");

let registry = { profiles: [] };
if (existsSync(registryPath)) {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry.profiles)) registry.profiles = [];
}

function defaultPortFor(slug) {
  if (slug === "primary") return 18691;
  if (slug === "secondary") return 18692;
  const used = new Set(registry.profiles.map((item) => Number(item.apiPort)).filter(Number.isInteger));
  for (let candidate = 18693; candidate <= 18749; candidate += 1) {
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("no Hermes profile ports available in 18693-18749");
}

const port = portArg ? Number(portArg) : defaultPortFor(profile);
if (!Number.isInteger(port) || port < 18691 || port > 18749) {
  throw new Error("port must be an integer in 18691-18749");
}

mkdirSync(profileHome, { recursive: true, mode: 0o755 });
mkdirSync(dirname(registryPath), { recursive: true, mode: 0o755 });
mkdirSync(secretsDir, { recursive: true, mode: 0o700 });

const template = readFileSync(templatePath, "utf8")
  .replaceAll("{{profile}}", profile)
  .replaceAll("{{port}}", String(port))
  .replaceAll("{{model}}", model)
  .replaceAll("{{reasoning}}", reasoning);

const profileConfig = JSON.parse(template);
writeFileSync(`${profileHome}/cortexos-profile.json`, JSON.stringify(profileConfig, null, 2) + "\n", { mode: 0o644 });

function renderHermesConfig() {
  const mcpConfig = readFileSync(mcpTemplatePath, "utf8");
  return [
    "model:",
    `  default: ${model}`,
    "  provider: 9router",
    "  base_url: http://127.0.0.1:11434/v1",
    "  api_mode: chat_completions",
    "providers:",
    "  9router:",
    "    name: 9Router",
    "    api: http://127.0.0.1:11434/v1",
    "    key_env: NINEROUTER_API_KEY",
    "    transport: openai_chat",
    "    discover_models: true",
    "    models:",
    `      ${model}: {}`,
    "agent:",
    "  max_turns: 120",
    mcpConfig.trimEnd(),
    "",
  ].join("\n");
}

writeFileSync(`${profileHome}/config.yaml`, renderHermesConfig(), { mode: 0o644 });

if (!existsSync(secretPath)) {
  const apiKey = randomBytes(32).toString("hex");
  writeFileSync(
    secretPath,
    [
      `HERMES_PROFILE=${profile}`,
      `HERMES_HOME=${profileHome}`,
      `HERMES_API_HOST=127.0.0.1`,
      `HERMES_API_PORT=${port}`,
      `HERMES_API_KEY=${apiKey}`,
      `HERMES_MODEL=${model}`,
      `HERMES_REASONING=${reasoning}`,
      "HERMES_PROVIDER_BASE_URL=http://127.0.0.1:11434/v1",
      "HERMES_CHAT_ARGS=chat -q",
      "HONCHO_BASE_URL=http://127.0.0.1:18690",
      `HONCHO_WORKSPACE=${profile}`,
      `HONCHO_AI_PEER=hermes-${profile}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
}

mkdirSync(binDir, { recursive: true, mode: 0o755 });
if (userBinDir) mkdirSync(userBinDir, { recursive: true, mode: 0o755 });
const wrapperPath = `${binDir}/hermes-${profile}`;
writeFileSync(
  wrapperPath,
  [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `export HERMES_PROFILE=${JSON.stringify(profile)}`,
    `export HERMES_HOME=${JSON.stringify(profileHome)}`,
    'exec "${HERMES_COMMAND:-hermes}" "$@"',
    "",
  ].join("\n"),
  { mode: 0o755 },
);
chmodSync(wrapperPath, 0o755);
try {
  if (userBinDir) symlinkSync(wrapperPath, `${userBinDir}/hermes-${profile}`);
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
}

registry.profiles = registry.profiles.filter((item) => item.profile !== profile);
registry.profiles.push({
  profile,
  home: profileHome,
  apiPort: port,
  model,
  reasoning,
  honchoWorkspace: profile,
  secretPath,
  apps: [],
});
registry.profiles.sort((a, b) => a.profile.localeCompare(b.profile));

writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", { mode: 0o644 });
console.log(JSON.stringify({ profile, port, model, reasoning, secretPath }, null, 2));
