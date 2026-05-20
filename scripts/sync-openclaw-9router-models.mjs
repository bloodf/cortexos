#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalogPath = process.env.OPENCLAW_MODELS_CATALOG
  || require.resolve("@earendil-works/pi-ai/dist/models.generated.js", {
    paths: [
      process.cwd(),
      "/usr/lib/node_modules/openclaw",
      "/usr/local/lib/node_modules/openclaw",
    ],
  });
const { MODELS } = await import(catalogPath);

const configPath = process.env.OPENCLAW_CONFIG || "/home/cortexos/.openclaw/openclaw.json";
const baseUrl = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const apiKey = process.env.NINEROUTER_API_KEY || "";

const providerPreference = {
  cc: ["anthropic", "opencode", "cloudflare-ai-gateway", "vercel-ai-gateway", "github-copilot"],
  cx: ["openai-codex", "openai", "azure-openai-responses", "opencode", "cloudflare-ai-gateway"],
  kimi: ["moonshotai", "moonshotai-cn", "opencode-go", "opencode", "fireworks", "together", "cloudflare-ai-gateway"],
  minimax: ["minimax", "minimax-cn", "fireworks", "huggingface", "together"],
  glm: ["zai", "opencode", "opencode-go", "huggingface", "together"],
  gc: ["google", "google-vertex", "vercel-ai-gateway"],
  gh: ["github-copilot"],
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function flattenCatalog() {
  const entries = [];
  for (const [provider, models] of Object.entries(MODELS)) {
    for (const [id, definition] of Object.entries(models)) {
      entries.push({ provider, id, ...definition });
    }
  }
  return entries;
}

const catalog = flattenCatalog();

async function fetchRouterModels() {
  const response = await fetch(`${baseUrl}/api/models`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
  });
  if (!response.ok) {
    throw new Error(`9Router /api/models returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  const models = Array.isArray(payload) ? payload : payload.models || payload.data || [];
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("9Router /api/models returned no models");
  }
  return models;
}

function scoreCandidate(routerModel, candidate) {
  const preferred = providerPreference[routerModel.provider] || [];
  let score = 0;
  if (candidate.id === routerModel.model) score += 100;
  if (candidate.id === routerModel.alias) score += 80;
  if (candidate.id.endsWith(`/${routerModel.model}`)) score += 70;
  if (normalize(candidate.name) === normalize(routerModel.name)) score += 55;
  if (normalize(candidate.id).includes(normalize(routerModel.model))) score += 20;
  const preferenceIndex = preferred.indexOf(candidate.provider);
  if (preferenceIndex >= 0) score += 50 - preferenceIndex;
  return score;
}

function findDefinition(routerModel) {
  const candidates = catalog
    .map((candidate) => ({ candidate, score: scoreCandidate(routerModel, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.candidate.contextWindow || 0) - (a.candidate.contextWindow || 0);
    });
  return candidates[0]?.candidate || null;
}

function routeApi(definition, routerModel) {
  const sourceApi = definition?.api || "";
  if (sourceApi.includes("responses")) return "openai-responses";
  if (/^gpt-5|codex/i.test(routerModel.model)) return "openai-responses";
  return "openai-completions";
}

function inferInput(definition, routerModel) {
  if (Array.isArray(definition?.input) && definition.input.length > 0) return definition.input;
  if (/image|vision|vl|multimodal/i.test(`${routerModel.model} ${routerModel.name}`)) return ["text", "image"];
  return ["text"];
}

function toOpenClawModel(routerModel) {
  const definition = findDefinition(routerModel);
  return {
    id: routerModel.fullModel,
    name: `${routerModel.name} via 9Router (${routerModel.provider})`,
    api: routeApi(definition, routerModel),
    reasoning: definition?.reasoning ?? /gpt-5|claude|kimi|glm|qwen|deepseek|minimax/i.test(routerModel.model),
    input: inferInput(definition, routerModel),
    contextWindow: definition?.contextWindow ?? 128000,
    maxTokens: definition?.maxTokens ?? 16384,
  };
}

function byId(a, b) {
  return a.id.localeCompare(b.id);
}

const routerModels = await fetchRouterModels();
const openclawModels = routerModels.map(toOpenClawModel).sort(byId);

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.models ||= {};
config.models.mode = "merge";
config.models.providers ||= {};
config.models.providers["9router"] = {
  baseUrl: `${baseUrl}/v1`,
  api: "openai-responses",
  apiKey: { source: "env", provider: "default", id: "NINEROUTER_API_KEY" },
  authHeader: true,
  models: openclawModels,
};

const tmpPath = `${configPath}.tmp-${process.pid}`;
fs.writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`);
fs.renameSync(tmpPath, configPath);

const matched = openclawModels.filter((model) => model.contextWindow !== 128000 || model.maxTokens !== 16384).length;
console.log(JSON.stringify({ configPath, models: openclawModels.length, matchedOrEnhanced: matched }, null, 2));
