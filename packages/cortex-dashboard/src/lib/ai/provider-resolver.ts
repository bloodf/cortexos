/**
 * 9Router provider resolver — Vercel AI SDK + @ai-sdk/openai-compatible.
 *
 * Reads `NINEROUTER_BASE_URL` + `NINEROUTER_API_KEY` from env (no DB lookups).
 * Caches the createOpenAICompatible provider per (baseUrl, apiKey) pair.
 */

import {
	createOpenAICompatible,
	type OpenAICompatibleProvider,
} from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { z } from "zod";

// 9Router /models response shape (OpenAI-compatible).
const modelsResponseSchema = z.object({
	data: z.array(z.object({ id: z.string() })),
});

export class AIProviderConfigError extends Error {
	readonly code = "EAICONFIG";
	constructor(message: string) {
		super(message);
		this.name = "AIProviderConfigError";
	}
}

interface CachedProvider {
	key: string;
	provider: OpenAICompatibleProvider;
}

const providerCache = new Map<string, CachedProvider>();

interface EnvSnapshot {
	baseUrl: string;
	apiKey: string;
}

function normalizeOpenAiBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/+$/, "");
	if (!trimmed) return trimmed;
	if (/\/v\d+(?:\/.*)?$/i.test(trimmed)) return trimmed;
	return `${trimmed}/v1`;
}

function readEnv(): EnvSnapshot {
	const baseUrl = process.env.NINEROUTER_BASE_URL;
	const apiKey = process.env.NINEROUTER_API_KEY;
	if (!baseUrl) {
		throw new AIProviderConfigError(
			"NINEROUTER_BASE_URL is not set; cannot resolve AI provider.",
		);
	}
	if (!apiKey) {
		throw new AIProviderConfigError(
			"NINEROUTER_API_KEY is not set; cannot resolve AI provider.",
		);
	}
	return { baseUrl: normalizeOpenAiBaseUrl(baseUrl), apiKey };
}

function getOrCreateProvider(env: EnvSnapshot): OpenAICompatibleProvider {
	const key = `${env.baseUrl}::${env.apiKey}`;
	const hit = providerCache.get(key);
	if (hit) return hit.provider;
	const provider = createOpenAICompatible({
		name: "9router",
		baseURL: env.baseUrl,
		apiKey: env.apiKey,
	});
	providerCache.set(key, { key, provider });
	return provider;
}

export function getNineRouterModel(modelId?: string): LanguageModel {
	const env = readEnv();
	const provider = getOrCreateProvider(env);
	const id = modelId ?? process.env.NINEROUTER_DEFAULT_MODEL ?? "gpt-5";
	return provider(id);
}

// ---------------------------------------------------------------------------
// discoverModels — cached for 60s.
// ---------------------------------------------------------------------------

interface ModelsCacheEntry {
	at: number;
	ids: string[];
}

const DISCOVER_TTL_MS = 60_000;
const modelsCache = new Map<string, ModelsCacheEntry>();

export async function discoverModels(): Promise<string[]> {
	const env = readEnv();
	const key = `${env.baseUrl}::${env.apiKey}`;
	const now = Date.now();
	const hit = modelsCache.get(key);
	if (hit && now - hit.at < DISCOVER_TTL_MS) {
		return hit.ids;
	}
	const url = `${env.baseUrl.replace(/\/$/, "")}/models`;
	const res = await fetch(url, {
		headers: {
			authorization: `Bearer ${env.apiKey}`,
			accept: "application/json",
		},
	});
	if (!res.ok) {
		throw new AIProviderConfigError(
			`Failed to discover models from 9Router: ${res.status}`,
		);
	}
	const raw = await res.json().catch(() => null);
	const parsed = modelsResponseSchema.safeParse(raw);
	if (!parsed.success) {
		throw new AIProviderConfigError(
			"9Router /models response did not match expected schema",
		);
	}
	const ids = parsed.data.data.map((d) => d.id);
	modelsCache.set(key, { at: now, ids });
	return ids;
}

/** Test-only: clear cached providers and model discovery results. */
export function _resetProviderCache(): void {
	providerCache.clear();
	modelsCache.clear();
}
