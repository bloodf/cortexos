/**
 * 9Router model catalog reader (P1).
 *
 * 9Router is the OpenAI-compatible LLM gateway (`/v1/chat/completions`,
 * `/v1/models`) bound at `http://127.0.0.1:11434/v1`. Auth is a bearer token
 * stored in `/opt/cortexos/.secrets/9router.env` (`NINEROUTER_API_KEY`);
 * the base URL is `NINEROUTER_BASE_URL` (without the `/v1` suffix).
 *
 * Used by:
 *   - `setAgentModel` (P1.3) to validate a requested model id exists
 *   - `listModels` server fn (P1.4) to populate the UI model picker
 */

import { readEnvValue } from "@/server/agents/chat";

const NINEROUTER_ENV = "/opt/cortexos/.secrets/9router.env";

export function nineRouterBaseUrl(): string {
  const raw = readEnvValue(NINEROUTER_ENV, "NINEROUTER_BASE_URL");
  const base = raw && raw.length > 0 ? raw : "http://127.0.0.1:11434";
  // `NINEROUTER_BASE_URL` omits the `/v1`; the OpenAI surface is `/v1`.
  return base.replace(/\/+$/, "");
}

function nineRouterKey(): string {
  return readEnvValue(NINEROUTER_ENV, "NINEROUTER_API_KEY") ?? "";
}

interface ModelsListResponse {
  data?: Array<{ id?: string }>;
}

/**
 * Fetch the live model id list from 9Router. Returns an empty array on any
 * fetch/parse error so callers (UI picker) never 500 on a transient gateway
 * hiccup; callers that MUST validate (setAgentModel) treat an empty list as
 * "validation unavailable" and accept the model.
 */
export async function list9routerModels(): Promise<string[]> {
  const key = nineRouterKey();
  let res: Response;
  try {
    res = await fetch(`${nineRouterBaseUrl()}/v1/models`, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as ModelsListResponse | null;
  if (!data?.data) return [];
  return data.data
    .map((m) => (typeof m?.id === "string" ? m.id : ""))
    .filter((id) => id.length > 0);
}
