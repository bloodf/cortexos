#!/usr/bin/env node
const { readFileSync } = require("fs");
const { resolve } = require("path");

function getClientCtor(pg) {
  return pg.Client || pg.default?.Client;
}

const SPOKE_TO_SERVICES = {
  "11-docker": ["docker"],
  "12-tailscale": ["tailscale"],
  "13-caddy": ["caddy"],
  "14-postgresql": ["postgresql", "pg-exporter", "pgadmin"],
  "15-redis": ["redis", "redis-exporter", "redisinsight"],
  "16-mongodb": ["mongodb", "mongo-express", "mongo-exporter"],
  "16a-mysql": ["mysql", "phpmyadmin"],
  "18-fail2ban": ["fail2ban"],
  "20-prometheus": ["prometheus"],
  "21-loki": ["loki"],
  "22-grafana": ["grafana"],
  "23-fluent-bit": ["fluent-bit"],
  "24-cadvisor": ["cadvisor"],
  "25-node-exporter": ["node-exporter"],
  "30-nats": ["nats", "nats-monitor"],
  "31-9router": ["9router"],
  "32-openviking": ["openviking"],
  "33-leann": ["leann"],
  "34-kernel-browser": ["kernel-browser"],
  "40-openclaw": ["openclaw"],
  "50-agentgateway": ["agentgateway"],
  "55-langfuse": ["langfuse"],
  "56-pgadmin": ["pgadmin"],
  "57-redisinsight": ["redisinsight"],
  "58-mongo-express": ["mongo-express"],
  "59-phpmyadmin": ["phpmyadmin"],
  "60-cortex-consumer": ["cortex-consumer"],
  "70-dashboard": ["cortex-dashboard"],
  "45a-cortex-graph": ["cortex-graph"],
  "47a-cortex-sandbox": ["cortex-sandbox-runner"],
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function detectSetupState() {
  const candidates = [
    process.env.SETUP_STATE_PATH,
    "/run/cortexos/setup-state.json",
    "/opt/cortexos/.secrets/.setup-state.json",
    resolve(process.cwd(), ".secrets/.setup-state.json"),
  ].filter(Boolean);

  for (const path of candidates) {
    const state = readJson(path);
    if (state) return state;
  }
  return null;
}

function normalizeBaseUrl(value) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/\.+$/, "").replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function inferPublicBaseUrl(state) {
  const explicit = normalizeBaseUrl(
    process.env.CORTEX_PUBLIC_BASE_URL ||
      process.env.CORTEX_DASHBOARD_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      process.env.CORTEX_DOMAIN,
  );
  if (explicit) return explicit;

  const checkpoints = Array.isArray(state?.checkpoints) ? state.checkpoints : [];
  for (let i = checkpoints.length - 1; i >= 0; i -= 1) {
    const evidence = checkpoints[i]?.evidence || {};
    for (const value of Object.values(evidence)) {
      const match = String(value).match(/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net)\.?/i);
      if (match) return `https://${match[1]}`;
    }
  }
  return null;
}

async function main() {
  const pgPath = require.resolve("pg", { paths: [resolve(__dirname, "..", "node_modules")] });
  const pg = require(pgPath);
  const ClientCtor = getClientCtor(pg);
  if (!ClientCtor) throw new TypeError("pg.Client constructor unavailable");
  const client = new ClientCtor({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "cortex_dashboard",
    user: process.env.DB_USER || "dashboard",
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    const state = detectSetupState();
    const completed = new Set(state?.completed_spokes || []);
    const active = new Set();
    for (const spoke of completed) {
      for (const slug of SPOKE_TO_SERVICES[spoke] || []) active.add(slug);
    }
    if (active.size === 0) active.add("cortex-dashboard");

    const baseUrl = inferPublicBaseUrl(state);
    if (baseUrl) {
      await client.query("SELECT cortex_set_service_urls($1)", [baseUrl]);
    }

    await client.query("UPDATE services SET is_active = slug = ANY($1::text[])", [[...active]]);
    await client.query(`
      UPDATE services
         SET has_webui = open_url <> '#',
             show_in_webui = is_active AND open_url <> '#',
             show_in_healthcheck = is_active,
             updated_at = NOW()
    `);
    console.log(
      `dynamic-seed active count: ${active.size}` +
        (baseUrl ? `, public base: ${baseUrl}` : ", public base: unset"),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("dynamic-seed failed:", err);
  process.exit(1);
});
