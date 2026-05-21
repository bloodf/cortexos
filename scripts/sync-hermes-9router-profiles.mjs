#!/usr/bin/env node
import { readFileSync } from "node:fs";

const registryPath = process.env.HERMES_PROFILES_REGISTRY || "/opt/cortexos/hermes/profiles.json";
const baseUrl = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const apiKey = process.env.NINEROUTER_API_KEY || "";
const modelsUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

if (!apiKey) throw new Error("NINEROUTER_API_KEY is required");

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const required = new Set(profiles.map((profile) => profile.model));

const response = await fetch(modelsUrl, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
if (!response.ok) throw new Error(`9Router /v1/models returned HTTP ${response.status}`);

const payload = await response.json();
const available = new Set((payload.data || []).map((model) => model.id));
const missing = [...required].filter((model) => !available.has(model));
if (missing.length) {
  throw new Error(`9Router missing required models: ${missing.join(", ")}`);
}

console.log(JSON.stringify({ profiles: profiles.length, required: [...required].sort() }, null, 2));
