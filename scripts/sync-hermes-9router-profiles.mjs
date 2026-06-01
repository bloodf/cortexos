#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const registryPath = process.env.HERMES_PROFILES_REGISTRY || "/opt/cortexos/hermes/profiles.json";
const baseUrl = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const apiKey = process.env.NINEROUTER_API_KEY || "";
const modelsUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

if (!apiKey) throw new Error("NINEROUTER_API_KEY is required");

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const required = new Set(profiles.map((profile) => profile.model));

function renderModelsBlock(modelIds) {
  return modelIds.map((id) => `      ${JSON.stringify(id)}: {}`).join("\n");
}

function replaceProviderBlock(config, modelIds) {
  const lines = config.split("\n");
  const providersIdx = lines.findIndex((line) => line === "providers:");
  if (providersIdx < 0) return null;
  const routerIdx = lines.findIndex((line, idx) => idx > providersIdx && line === "  9router:");
  if (routerIdx < 0) return null;
  let end = routerIdx + 1;
  while (end < lines.length && (lines[end].startsWith("    ") || lines[end] === "")) end += 1;
  const block = [
    "  9router:",
    "    name: 9Router",
    "    api: ${NINEROUTER_BASE_URL}",
    "    key_env: NINEROUTER_API_KEY",
    "    transport: openai_chat",
    "    discover_models: true",
    "    models:",
    renderModelsBlock(modelIds),
  ];
  return [...lines.slice(0, routerIdx), ...block, ...lines.slice(end)].join("\n");
}

function syncProfileCatalogs(modelIds) {
  const profilesRoot = process.env.CORTEX_HERMES_PROFILES_ROOT || "/opt/cortexos/hermes/profiles";
  let updated = 0;
  try {
    for (const entry of readdirSync(profilesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const configPath = join(profilesRoot, entry.name, "config.yaml");
      let before;
      try {
        before = readFileSync(configPath, "utf8");
      } catch {
        continue;
      }
      const after = replaceProviderBlock(before, modelIds);
      if (!after || after === before) continue;
      writeFileSync(configPath, after, { mode: 0o644 });
      updated += 1;
    }
  } catch {
    return 0;
  }
  return updated;
}

const response = await fetch(modelsUrl, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
if (!response.ok) throw new Error(`9Router /v1/models returned HTTP ${response.status}`);

const payload = await response.json();
const available = new Set((payload.data || []).map((model) => String(model.id || "").trim()).filter(Boolean));
const missing = [...required].filter((model) => !available.has(model));
if (missing.length) {
  throw new Error(`9Router missing required models: ${missing.join(", ")}`);
}

const models = [...available].sort();
const profilesUpdated = syncProfileCatalogs(models);

console.log(JSON.stringify({ profiles: profiles.length, models: models.length, profilesUpdated, required: [...required].sort() }, null, 2));
