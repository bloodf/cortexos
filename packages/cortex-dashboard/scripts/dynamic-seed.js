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
  "14-postgresql": ["postgresql", "pg-exporter"],
  "15-redis": ["redis", "redis-exporter"],
  "16-mongodb": ["mongodb", "mongo-exporter"],
  "17-dnsmasq": ["dnsmasq"],
  "18-fail2ban": ["fail2ban"],
  "20-prometheus": ["prometheus"],
  "21-loki": ["loki"],
  "22-grafana": ["grafana"],
  "23-fluent-bit": ["fluent-bit", "promtail"],
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
  "60-cortex-consumer": ["cortex-consumer"],
  "70-dashboard": ["cortex-dashboard"],
  "45a-cortex-graph": ["cortex-graph"],
  "47a-cortex-sandbox": ["cortex-sandbox-runner"],
};

function detectSetupState() {
  const path = process.env.SETUP_STATE_PATH || resolve(process.cwd(), ".secrets/.setup-state.json");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
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
    for (const slug of active) {
      await client.query("UPDATE services SET is_active = true WHERE slug = $1", [slug]);
    }
    await client.query("UPDATE services SET is_active = false WHERE slug <> ALL($1::text[])", [[...active]]);
    console.log(`dynamic-seed active count: ${active.size}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("dynamic-seed failed:", err);
  process.exit(1);
});
