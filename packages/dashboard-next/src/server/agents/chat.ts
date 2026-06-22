/**
 * Hermes agent chat bridge (P1.2).
 *
 * Bridges the dashboard to a Hermes profile's local HTTP API
 * (`scripts/hermes-profile-api.mjs`, unit `hermes-profile@<slug>`). The profile
 * API speaks OpenAI-style `/v1/chat/completions` and accepts:
 *   - `messages`            — OpenAI chat messages
 *   - `attachments`         — P1.1: `{filename, mime, dataBase64}[]` staged
 *                              to a per-request tmp dir on the host
 *   - `model` / `reasoning` — P1.1: per-request override
 *
 * The dashboard transport (ADR-001) is createServerFn RPC and cannot stream,
 * so this bridge is request/response: it returns the full assistant reply.
 * Streaming lives in the P3 WS sidecar.
 *
 * Auth: the profile API validates `Authorization: Bearer <HERMES_API_KEY>`,
 * sourced from the profile's secret env file (`secretPath` in the registry).
 */

import fs from "node:fs";
import { findProfileBySlug } from "@/server/agents/registry";
import { notFoundError, systemError } from "@/server/errors/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

export interface ChatWithAgentInput {
  text: string;
  attachments?: AgentAttachment[];
  model?: string;
  reasoning?: "low" | "medium" | "high";
}

export interface ChatWithAgentResult {
  reply: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

// ---------------------------------------------------------------------------
// Env-file reader (shared by chat + model swap)
// ---------------------------------------------------------------------------

/**
 * Read a single `KEY=value` from a dotenv-style env file. Returns `null` if
 * the file is missing or the key is absent. Honors `#` comments and strips a
 * leading `export `. Surrounding matched quotes are removed.
 *
 * Exported so P1.3 (`setAgentModel`) can reuse it for HERMES_MODEL/REASONING.
 * Never logs values — these files hold secrets.
 */
export function readEnvValue(filePath: string, key: string): string | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const deexported = trimmed.replace(/^export\s+/, "");
    const eq = deexported.indexOf("=");
    if (eq <= 0) continue;
    const k = deexported.slice(0, eq).trim();
    if (k !== key) continue;
    let v = deexported.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// chatWithAgent — POST /v1/chat/completions to the profile API
// ---------------------------------------------------------------------------

/**
 * Send a chat turn (text + optional attachments + optional model override) to
 * a Hermes profile's local API and return the assistant reply.
 *
 * Throws:
 *   - `notFoundError` if the slug is not in the registry
 *   - `systemError`   if the profile has no port/secret, the API returns
 *                      non-200 / is unreachable, or attachments are rejected
 */
export async function chatWithAgent(
  slug: string,
  input: ChatWithAgentInput,
): Promise<ChatWithAgentResult> {
  const profile = findProfileBySlug(slug);
  if (!profile) {
    throw notFoundError(`agent '${slug}' is not a known Hermes profile`, "agent");
  }
  if (!profile.apiPort) {
    throw systemError(`profile '${slug}' has no apiPort`);
  }
  if (!profile.secretPath) {
    throw systemError(`profile '${slug}' has no secretPath`);
  }
  const key = readEnvValue(profile.secretPath, "HERMES_API_KEY");
  if (!key) {
    throw systemError(`HERMES_API_KEY missing in ${profile.secretPath}`);
  }

  const body = {
    messages: [{ role: "user", content: input.text }],
    attachments: input.attachments,
    model: input.model,
    reasoning: input.reasoning,
  };

  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${profile.apiPort}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });
  } catch {
    throw systemError(`profile API for '${slug}' unreachable`);
  }

  if (res.status === 413) {
    throw systemError(`profile API for '${slug}': attachments_too_large`);
  }
  if (res.status === 400) {
    const err = await safeJson(res);
    throw systemError(
      `profile API for '${slug}': ${err?.error === "bad_attachment" ? "bad_attachment" : "bad_request"}`,
    );
  }
  if (!res.ok) {
    throw systemError(`profile API for '${slug}' returned ${res.status}`);
  }

  const data = (await safeJson(res)) as ChatCompletionResponse | null;
  const reply = data?.choices?.[0]?.message?.content?.trim() ?? "";
  return { reply };
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
