#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const profilesRoot = process.env.CORTEX_HERMES_PROFILES_ROOT || "/opt/cortexos/hermes/profiles";
const baseUrl = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const apiKey = process.env.NINEROUTER_API_KEY || "";
const modelsUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

if (!apiKey) throw new Error("NINEROUTER_API_KEY is required");

const response = await fetch(modelsUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
if (!response.ok) throw new Error(`9Router models endpoint returned HTTP ${response.status}`);
const payload = await response.json();
const modelIds = [...new Set((payload.data || []).map((model) => String(model.id || "").trim()).filter(Boolean))].sort();
if (!modelIds.length) throw new Error("9Router returned no models");

function renderModelsBlock(indent) {
  return modelIds.map((id) => `${indent}${JSON.stringify(id)}: {}`).join("\n");
}

function replaceProviderBlock(config) {
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
    "    api: http://127.0.0.1:11434/v1",
    "    key_env: NINEROUTER_API_KEY",
    "    transport: openai_chat",
    "    discover_models: true",
    "    models:",
    renderModelsBlock("      "),
  ];

  return [...lines.slice(0, routerIdx), ...block, ...lines.slice(end)].join("\n");
}

let updated = 0;
for (const entry of readdirSync(profilesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const configPath = join(profilesRoot, entry.name, "config.yaml");
  let before;
  try {
    before = readFileSync(configPath, "utf8");
  } catch {
    continue;
  }
  const after = replaceProviderBlock(before);
  if (!after || after === before) continue;
  writeFileSync(configPath, after, { mode: 0o644 });
  updated += 1;
}

console.log(JSON.stringify({ models: modelIds.length, profilesUpdated: updated, modelsUrl }, null, 2));
