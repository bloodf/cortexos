/**
 * Agent Generator — 9Router LLM client (P2.2).
 *
 * One request/response turn of the generator interview. The model is prompted
 * to ask clarifying questions one at a time and, once the ProfileSpec is
 * complete, emit a fenced ```json block containing it. We parse that block out
 * of the text reply (best-effort) so callers can persist the evolving spec.
 *
 * Provider = 9Router (OpenAI-compatible) via `@ai-sdk/openai`, the same proven
 * path as `packages/cortex-mail-guardian/src/model.ts`. Flue was the planned
 * loop driver but is unverified under the dashboard's Node; the decision note
 * allows this drop-in at the model-call layer.
 *
 * Multimodal: images are passed as OpenAI image content parts; non-image
 * attachments are listed by filename in the prompt (9Router audio/video
 * support is unverified — see plan Assumptions).
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import { readEnvValue } from "@/server/agents/chat";
import { nineRouterBaseUrl } from "@/server/agents/nineRouter";
import type {
  GeneratorTurnInput,
  GeneratorTurnResult,
  ProfileSpec,
} from "@/server/agents/generator/types";

const NINEROUTER_ENV = "/opt/cortexos/.secrets/9router.env";
const TURN_TIMEOUT_MS = 120_000;

function nineRouterKey(): string {
  return readEnvValue(NINEROUTER_ENV, "NINEROUTER_API_KEY") ?? "";
}

// The OpenAI client is cheap to build and stateless; one per turn keeps config
// changes (e.g. a rotated key) effective without a restart.
function openaiClient() {
  const apiKey = nineRouterKey();
  if (!apiKey) {
    throw new Error("NINEROUTER_API_KEY missing in /opt/cortexos/.secrets/9router.env");
  }
  return createOpenAI({
    baseURL: `${nineRouterBaseUrl()}/v1`,
    apiKey,
  });
}

const SYSTEM_PROMPT = `You are the CortexOS Agent Generator. Your job is to interview the operator to design a Hermes agent profile, then produce a complete spec.

Interview rules:
- Ask ONE focused clarifying question at a time. Never list multiple questions.
- Cover, in order: the agent's purpose/domain, a slug (lowercase, [a-z0-9-]), a display name, the model to use, the reasoning level (low|medium|high), which channels to connect (telegram|whatsapp|slack|discord|signal|email), and any skills or MCP tools it needs.
- Be concise. Suggest concrete defaults drawn from the purpose (e.g. recommend skills), and let the operator accept or adjust.
- When you have enough to build a working agent, STOP asking questions and emit your final answer as a single fenced JSON block matching the ProfileSpec schema, preceded by a one-line summary.

ProfileSpec JSON schema:
{
  "slug": "lowercase-slug",
  "name": "Display Name",
  "description": "one-line purpose",
  "model": "<9router model id>",
  "reasoning": "low" | "medium" | "high",
  "channels": ["telegram", ...],
  "skills": ["skill-id", ...],
  "mcps": [{"name": "...", "url": "..."}],
  "telegramBotToken": "optional, only if the operator provided one"
}

Only emit the JSON block when the interview is complete. Until then, ask your next question as plain text.`;

interface AiTextPart {
  type: "text";
  text: string;
}
interface AiImagePart {
  type: "image";
  image: string;
}
type AiPart = AiTextPart | AiImagePart;

/** Convert a user turn + attachments into AI SDK content parts. */
function buildUserContent(
  text: string,
  attachments: GeneratorTurnInput["attachments"],
): string | AiPart[] {
  if (!attachments || attachments.length === 0) return text;
  const parts: AiPart[] = [];
  if (text.trim()) parts.push({ type: "text", text });
  const stagedNames: string[] = [];
  for (const att of attachments) {
    if (att.mime.startsWith("image/")) {
      parts.push({ type: "image", image: att.dataBase64 });
    } else {
      // Non-image files cannot be sent as model content over an unverified
      // audio/video path; surface their names so the model acknowledges them.
      stagedNames.push(att.filename);
    }
  }
  if (stagedNames.length > 0) {
    parts.push({
      type: "text",
      text: `[non-image attachments provided by operator: ${stagedNames.join(", ")}]`,
    });
  }
  return parts;
}

/**
 * Extract the last fenced ```json block from a model reply and parse it as a
 * partial ProfileSpec. Returns null when no block is present or it fails to
 * parse (the interview is still in progress).
 */
export function parseSpecFromText(text: string): Partial<ProfileSpec> | null {
  const blocks = text.match(/```json\s*([\s\S]*?)```/g);
  if (!blocks || blocks.length === 0) return null;
  const last = blocks[blocks.length - 1].replace(/```json\s*/, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(last);
    if (parsed && typeof parsed === "object") return parsed as Partial<ProfileSpec>;
  } catch {
    // Malformed JSON block — ignore; the model may retry next turn.
  }
  return null;
}

/**
 * Run one generator turn. Returns the model's text reply, an optional parsed
 * spec patch, and a `done` flag set when a complete spec block was emitted.
 */
export async function generatorTurn(input: GeneratorTurnInput): Promise<GeneratorTurnResult> {
  const openai = openaiClient();
  // Build ModelMessage[] with the correct content shape per role.
  // narrows content by role: user accepts string | Part[], system/assistant
  // require string. We construct each entry via a small per-role function so
  // the array type is exactly ModelMessage[] with no loose unions.
  const sys: ModelMessage = { role: "system", content: SYSTEM_PROMPT };
  const specHint: ModelMessage | null =
    input.specSoFar && Object.keys(input.specSoFar).length > 0
      ? {
          role: "system",
          content: `Current partial spec (refine, do not lose fields): ${JSON.stringify(input.specSoFar)}`,
        }
      : null;
  const history: ModelMessage[] = input.messages.map((m) => {
    if (m.role === "user") {
      return { role: "user", content: buildUserContent(m.content, input.attachments) };
    }
    if (m.role === "assistant") {
      return { role: "assistant", content: m.content };
    }
    return { role: "system", content: m.content };
  });
  const messages: ModelMessage[] = specHint ? [sys, specHint, ...history] : [sys, ...history];

  const result = await generateText({
    model: openai(input.model),
    messages,
    providerOptions: { openai: { reasoningEffort: input.reasoning } },
    abortSignal: AbortSignal.timeout(TURN_TIMEOUT_MS),
  });

  const text = result.text.trim();
  const spec = parseSpecFromText(text);
  const done = !!(spec && typeof spec.slug === "string" && spec.slug.length > 0);
  return { text, spec: spec ?? undefined, done };
}
