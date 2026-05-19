#!/usr/bin/env node
/**
 * Dynamic services-catalog seed.
 *
 * Runs AFTER scripts/migrate.js. Decides which catalog rows belong to the
 * spokes the operator actually installed and flips `is_active` /
 * `show_in_webui` accordingly. Idempotent — safe to re-run after enabling a
 * new spoke.
 *
 * Probe sources, in order:
 *   1. `.secrets/.setup-state.json` (operator-laptop bootstrap canonical file).
 *      We look at `completed_spokes: string[]`.
 *   2. Environment variables (`INSTALL_MONGODB`, etc.) — fallback when state
 *      file is missing.
 *   3. `docker ps --format '{{.Names}}'` — final fallback; only used when the
 *      `docker` binary is available and the prior sources said nothing about
 *      the spoke.
 *
 * All probes are READ-ONLY.
 *
 * Mapping: spoke-slug → catalog-slug[]. Catalog rows whose backing spoke is
 * NOT enabled are forced is_active=FALSE, show_in_webui=FALSE.
 *
 * To extend: add a row to SPOKE_TO_SERVICES below.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// ---------------------------------------------------------------------------
// Spoke → catalog row mapping. Keep slugs in sync with migrations/002_seed.sql
// and 010_services_catalog_extras.sql.
// ---------------------------------------------------------------------------
const SPOKE_TO_SERVICES = Object.freeze({
  "11-docker":              [],
  "12-tailscale":           ["tailscale"],
  "13-caddy":               ["caddy"],
  "14-postgresql":          ["postgresql", "pg-exporter"],
  "15-redis":               ["redis", "redis-exporter"],
  "16-mongodb":             ["mongodb", "mongo-exporter"],
  "17-dnsmasq":             ["dnsmasq"],
  "18-fail2ban":            ["fail2ban"],
  "20-prometheus":          ["prometheus"],
  "21-loki":                ["loki"],
  "22-grafana":             ["grafana"],
  "23-fluent-bit":          ["fluent-bit", "promtail"],
  "24-cadvisor":            ["cadvisor"],
  "25-node-exporter":       ["node-exporter"],
  "30-nats":                ["nats", "nats-monitor"],
  "31-9router":             ["9router"],
  "32-openviking":          ["openviking"],
  "33-leann":               ["leann"],
  "34-kernel-browser":      ["kernel-browser"],
  "40-openclaw":            ["openclaw"],
  "50-agentgateway":        ["agentgateway"],
  "55-langfuse":            ["langfuse"],
  "70-dashboard":           ["cortex-dashboard"],
});

// All catalog slugs we manage. Anything in the DB not in this set is left
// alone (operator may have added custom rows).
const MANAGED_SLUGS = new Set(
  Object.values(SPOKE_TO_SERVICES).flat().concat([
    // Always-on rows we never disable even if no probe finds them:
    "cortex-dashboard",
  ]),
);

// Env-var fallback. Maps env var → spoke key it implies.
const ENV_SPOKE_FLAGS = Object.freeze({
  INSTALL_MONGODB:   { value: "yes", spoke: "16-mongodb" },
  INSTALL_LANGFUSE:  { value: "yes", spoke: "55-langfuse" },
});

// Docker container name → spoke key. Used as the last-resort probe.
const CONTAINER_TO_SPOKE = Object.freeze({
  "cortex-postgres":        "14-postgresql",
  "cortex-redis":           "15-redis",
  "cortex-mongodb":         "16-mongodb",
  "cortex-prometheus":      "20-prometheus",
  "cortex-loki":            "21-loki",
  "cortex-grafana":         "22-grafana",
  "cortex-fluent-bit":      "23-fluent-bit",
  "cortex-cadvisor":        "24-cadvisor",
  "cortex-node-exporter":   "25-node-exporter",
  "cortex-nats":            "30-nats",
  "cortex-9router":         "31-9router",
  "cortex-openviking":      "32-openviking",
  "cortex-openclaw":        "40-openclaw",
  "cortex-agentgateway":    "50-agentgateway",
  "langfuse-web":           "55-langfuse",
  "cortex-dashboard":       "70-dashboard",
});

// ---------------------------------------------------------------------------
// Probes.
// ---------------------------------------------------------------------------

function readSetupState() {
  const candidates = [
    process.env.CORTEX_SETUP_STATE,
    "/opt/cortexos/.secrets/.setup-state.json",
    path.join(__dirname, "..", "..", ".secrets", ".setup-state.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.completed_spokes)) {
        return { path: p, spokes: parsed.completed_spokes };
      }
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function probeEnvFlags() {
  const spokes = [];
  for (const [key, cfg] of Object.entries(ENV_SPOKE_FLAGS)) {
    const v = (process.env[key] || "").toLowerCase();
    if (v === cfg.value) spokes.push(cfg.spoke);
  }
  return spokes;
}

function probeDockerNames() {
  try {
    const out = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    const names = out.split("\n").map((s) => s.trim()).filter(Boolean);
    const spokes = new Set();
    for (const name of names) {
      const spoke = CONTAINER_TO_SPOKE[name];
      if (spoke) spokes.add(spoke);
    }
    return Array.from(spokes);
  } catch {
    return [];
  }
}

function resolveEnabledSpokes() {
  const sources = { stateFile: null, envFlags: [], docker: [] };
  const state = readSetupState();
  if (state) {
    sources.stateFile = state.path;
    return {
      sources,
      spokes: new Set(state.spokes),
    };
  }
  sources.envFlags = probeEnvFlags();
  sources.docker = probeDockerNames();
  return {
    sources,
    spokes: new Set([...sources.envFlags, ...sources.docker]),
  };
}

function resolveEnabledSlugs(enabledSpokes) {
  const enabled = new Set();
  for (const spoke of enabledSpokes) {
    const slugs = SPOKE_TO_SERVICES[spoke];
    if (slugs) for (const s of slugs) enabled.add(s);
  }
  // Dashboard is always on — without it, this script never runs anyway.
  enabled.add("cortex-dashboard");
  return enabled;
}

// ---------------------------------------------------------------------------
// DB application.
// ---------------------------------------------------------------------------

async function applyToDatabase(enabledSlugs) {
  const pgPath = require.resolve("pg", {
    paths: [path.join(__dirname, "..", "node_modules")],
  });
  const pg = require(pgPath);

  if (!process.env.DB_PASSWORD) {
    throw new Error("DB_PASSWORD environment variable is required");
  }

  const client = new pg.Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "cortex_dashboard",
    user: process.env.DB_USER || "dashboard",
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    const slugs = Array.from(MANAGED_SLUGS);
    const enabled = slugs.filter((s) => enabledSlugs.has(s));
    const disabled = slugs.filter((s) => !enabledSlugs.has(s));

    if (enabled.length > 0) {
      await client.query(
        `UPDATE services
           SET is_active = TRUE,
               show_in_webui = CASE WHEN open_url <> '#' THEN TRUE ELSE show_in_webui END,
               updated_at = NOW()
         WHERE slug = ANY($1::text[])`,
        [enabled],
      );
    }
    if (disabled.length > 0) {
      await client.query(
        `UPDATE services
           SET is_active = FALSE,
               show_in_webui = FALSE,
               updated_at = NOW()
         WHERE slug = ANY($1::text[])`,
        [disabled],
      );
    }
    return { enabled, disabled };
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

async function main() {
  const { sources, spokes } = resolveEnabledSpokes();
  const enabledSlugs = resolveEnabledSlugs(spokes);

  console.log("=== Dynamic services-catalog seed ===");
  if (sources.stateFile) {
    console.log(`  probe: setup-state file = ${sources.stateFile}`);
  } else {
    console.log("  probe: setup-state file missing — falling back");
    console.log(`         env flags: ${sources.envFlags.join(",") || "(none)"}`);
    console.log(`         docker:    ${sources.docker.join(",") || "(none)"}`);
  }
  console.log(`  enabled spokes (${spokes.size}): ${Array.from(spokes).sort().join(",")}`);

  const { enabled, disabled } = await applyToDatabase(enabledSlugs);
  console.log(`  rows activated:   ${enabled.length} (${enabled.join(",")})`);
  console.log(`  rows deactivated: ${disabled.length} (${disabled.join(",")})`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Dynamic seed failed:", err);
    process.exit(1);
  });
}

module.exports = {
  SPOKE_TO_SERVICES,
  MANAGED_SLUGS,
  resolveEnabledSpokes,
  resolveEnabledSlugs,
};
