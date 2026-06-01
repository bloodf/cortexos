#!/usr/bin/env node
import { readFileSync } from "node:fs";

const envPath = process.env.PAPERCLIP_ENV_FILE || "/opt/cortexos/.secrets/paperclip.env";
const apply = process.argv.includes("--apply");
const paperclipApiUrl = (process.env.PAPERCLIP_API_URL || readEnvFile(envPath).PAPERCLIP_API_URL || "http://127.0.0.1:3034").replace(/\/$/, "");
const paperclipApiKey = process.env.PAPERCLIP_API_KEY || readEnvFile(envPath).PAPERCLIP_API_KEY || "";

const NINEROUTER_BASE_URL = "http://127.0.0.1:11434/v1";
const HERMES_CLI_PROVIDER = "custom";
const DEFAULT_ROUTE = {
  key: "default",
  label: "Default operations",
  model: "cx/gpt-5.5",
  fallbackModel: "kimi/kimi-k2.6",
};

function routeForAgent(agent) {
  const role = String(agent.role || "").toLowerCase();
  const title = String(agent.title || "").toLowerCase();

  if (role === "ceo") return { key: "ceo", label: "CEO / executive decisions", model: "cx/gpt-5.5", fallbackModel: "kimi/kimi-k2.6" };
  if (role === "cto") return { key: "cto", label: "CTO / architecture", model: "cc/claude-opus-4-7", fallbackModel: "cx/gpt-5.5" };

  if (role === "pm" && title.includes("chief product")) {
    return { key: "cpo", label: "Chief Product Officer", model: "cc/claude-opus-4-7", fallbackModel: "cx/gpt-5.5" };
  }
  if (role === "pm" && title.includes("owner")) {
    return { key: "po", label: "Product Owner", model: "cx/gpt-5.5", fallbackModel: "kimi/kimi-k2.6" };
  }
  if (role === "pm") return { key: "pm", label: "Product Manager", model: "cx/gpt-5.5", fallbackModel: "kimi/kimi-k2.6" };

  if (role === "engineer" && title.includes("staff")) {
    return { key: "staff-engineer", label: "Staff engineering", model: "cc/claude-opus-4-7", fallbackModel: "cx/gpt-5.5" };
  }
  if (role === "engineer") return { key: "engineer", label: "Engineering implementation", model: "kimi/kimi-k2.6", fallbackModel: "cx/gpt-5.5" };

  if (role === "qa" && title.includes("unit")) {
    return { key: "qa-unit", label: "QA unit tests", model: "kimi/kimi-k2.6", fallbackModel: "cx/gpt-5.5" };
  }
  if (role === "qa" && title.includes("lead")) {
    return { key: "qa-lead", label: "QA Lead", model: "cc/claude-opus-4-7", fallbackModel: "cx/gpt-5.5" };
  }
  if (role === "qa" && title.includes("e2e")) {
    return { key: "qa-e2e", label: "QA E2E", model: "kimi/kimi-k2.6", fallbackModel: "cx/gpt-5.5" };
  }
  if (role === "qa") return { key: "qa", label: "QA", model: "cx/gpt-5.5", fallbackModel: "kimi/kimi-k2.6" };

  if (role === "designer" || title.includes("creative") || title.includes("marketing content")) {
    return { key: "creative", label: "Creative / marketing", model: "cx/gpt-5.5", fallbackModel: "kimi/kimi-k2.6" };
  }

  if (title.includes("code reviewer") || title.includes("bug bounty")) {
    return { key: "review-security", label: "Code review / security", model: "cx/gpt-5.5", fallbackModel: "kimi/kimi-k2.6" };
  }
  if (title.includes("revenue")) {
    return { key: "revenue", label: "Revenue / go-to-market", model: "cc/claude-opus-4-7", fallbackModel: "cx/gpt-5.5" };
  }

  return DEFAULT_ROUTE;
}

if (!paperclipApiKey) throw new Error(`PAPERCLIP_API_KEY missing; set it or provide ${envPath}`);

function readEnvFile(path) {
  const out = {};
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    return out;
  }
  return out;
}

async function api(path, options = {}) {
  const res = await fetch(`${paperclipApiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${paperclipApiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed HTTP ${res.status}: ${text}`);
  }
  return body;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function envValue(value) {
  const record = asObject(value);
  return typeof record.value === "string" ? record.value : value;
}

function normalizeAgent(agent) {
  const route = routeForAgent(agent);
  const adapterConfig = { ...asObject(agent.adapterConfig) };
  const env = { ...asObject(adapterConfig.env) };
  const runtimeConfig = { ...asObject(agent.runtimeConfig) };
  const modelProfiles = { ...asObject(runtimeConfig.modelProfiles) };

  adapterConfig.model = route.model;
  adapterConfig.provider = HERMES_CLI_PROVIDER;
  adapterConfig.extraArgs = [];
  adapterConfig.baseUrl = NINEROUTER_BASE_URL;
  adapterConfig.persistSession = false;
  env.HERMES_MODEL = route.model;
  env.HERMES_FALLBACK_MODEL = route.fallbackModel;
  env.HERMES_FALLBACK_BASE_URL = NINEROUTER_BASE_URL;
  env.OPENAI_BASE_URL = NINEROUTER_BASE_URL;
  adapterConfig.env = env;

  modelProfiles.cheap = {
    ...asObject(modelProfiles.cheap),
    enabled: true,
    label: `${route.label} fallback lane`,
    adapterConfig: {
      ...asObject(asObject(modelProfiles.cheap).adapterConfig),
      model: route.fallbackModel,
      provider: HERMES_CLI_PROVIDER,
      extraArgs: [],
      baseUrl: NINEROUTER_BASE_URL,
      env: {
        ...asObject(asObject(asObject(modelProfiles.cheap).adapterConfig).env),
        HERMES_MODEL: route.fallbackModel,
        HERMES_FALLBACK_MODEL: route.model,
        HERMES_FALLBACK_BASE_URL: NINEROUTER_BASE_URL,
        OPENAI_BASE_URL: NINEROUTER_BASE_URL,
      },
    },
  };
  runtimeConfig.modelProfiles = modelProfiles;

  return { adapterConfig, runtimeConfig };
}

function needsUpdate(agent) {
  const route = routeForAgent(agent);
  const cfg = asObject(agent.adapterConfig);
  const env = asObject(cfg.env);
  const runtime = asObject(agent.runtimeConfig);
  const cheap = asObject(asObject(runtime.modelProfiles).cheap);
  const cheapCfg = asObject(cheap.adapterConfig);
  return cfg.model !== route.model ||
    cfg.provider !== HERMES_CLI_PROVIDER ||
    JSON.stringify(cfg.extraArgs || []) !== "[]" ||
    cfg.baseUrl !== NINEROUTER_BASE_URL ||
    cfg.persistSession !== false ||
    envValue(env.HERMES_MODEL) !== route.model ||
    envValue(env.HERMES_FALLBACK_MODEL) !== route.fallbackModel ||
    envValue(env.HERMES_FALLBACK_BASE_URL) !== NINEROUTER_BASE_URL ||
    envValue(env.OPENAI_BASE_URL) !== NINEROUTER_BASE_URL ||
    cheap.enabled !== true ||
    cheapCfg.model !== route.fallbackModel ||
    cheapCfg.provider !== HERMES_CLI_PROVIDER ||
    JSON.stringify(cheapCfg.extraArgs || []) !== "[]";
}

const me = await api("/api/cli-auth/me");
const companies = (me.memberships || [])
  .map((m) => ({ id: m.companyId, name: m.company?.name || m.companyId }))
  .filter((company) => company.id);
const summary = [];

for (const company of companies) {
  const agents = await api(`/api/companies/${company.id}/agents`);
  let seen = 0;
  let changed = 0;
  const routes = {};
  for (const agent of agents) {
    if (agent.adapterType !== "hermes_local") continue;
    seen += 1;
    const route = routeForAgent(agent);
    const routeKey = `${route.key}:${route.model}->${route.fallbackModel}`;
    routes[routeKey] = (routes[routeKey] || 0) + 1;
    const next = normalizeAgent(agent);
    if (!needsUpdate(agent)) continue;
    changed += 1;
    if (apply) {
      await api(`/api/agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
    }
  }
  summary.push({ company: company.name, companyId: company.id, hermesAgents: seen, changed, routes });
}

console.log(JSON.stringify({ apply, fallbackProvider: "9router", hermesCliProvider: HERMES_CLI_PROVIDER, baseUrl: NINEROUTER_BASE_URL, companies: summary }, null, 2));
