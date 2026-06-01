/**
 * transcript-parser — converts OMC artifact JSON to Paperclip rich-comment blocks.
 *
 * Input contract: { taskId, runId, steps: [{role, action, content, timestamp}], result }
 * Output: ordered array of RichCommentBlock entries suitable for posting as a
 * Paperclip issue comment body.
 */

import type { OmcArtifact, RichCommentBlock, TranscriptStep } from "./types.js";

/**
 * Parse an OMC artifact into a list of rich-comment blocks.
 *
 * @throws TypeError when the artifact shape is invalid.
 */
export function parseTranscript(artifact: OmcArtifact): RichCommentBlock[] {
  assertArtifact(artifact);

  const blocks: RichCommentBlock[] = [];

  blocks.push({
    type: "heading",
    content: `Task ${artifact.taskId} — Run ${artifact.runId}`,
  });

  if (artifact.steps.length === 0) {
    blocks.push({ type: "paragraph", content: "_No steps recorded._" });
  } else {
    blocks.push({
      type: "list",
      content: artifact.steps.map(formatStepListItem),
    });

    for (const step of artifact.steps) {
      blocks.push({
        type: "heading",
        content: `[${step.timestamp}] ${step.role} — ${step.action}`,
      });
      if (looksLikeCode(step.content)) {
        blocks.push({ type: "code", content: step.content });
      } else {
        blocks.push({ type: "paragraph", content: step.content });
      }
    }
  }

  if (artifact.result !== undefined && artifact.result !== null) {
    blocks.push({ type: "heading", content: "Result" });
    blocks.push(formatResult(artifact.result));
  }

  return blocks;
}

function formatStepListItem(step: TranscriptStep): string {
  return `${step.timestamp} · ${step.role} — ${step.action}`;
}

function formatResult(result: string | Record<string, unknown>): RichCommentBlock {
  if (typeof result === "string") {
    return looksLikeCode(result)
      ? { type: "code", content: result }
      : { type: "paragraph", content: result };
  }
  return { type: "code", content: JSON.stringify(result, null, 2) };
}

function looksLikeCode(s: string): boolean {
  if (!s) return false;
  if (s.includes("\n")) return true;
  return /^[{\[]/.test(s.trim());
}

function assertArtifact(a: unknown): asserts a is OmcArtifact {
  if (!a || typeof a !== "object") {
    throw new TypeError("parseTranscript: artifact must be an object");
  }
  const o = a as Record<string, unknown>;
  if (typeof o.taskId !== "string" || !o.taskId) {
    throw new TypeError("parseTranscript: artifact.taskId must be a non-empty string");
  }
  if (typeof o.runId !== "string" || !o.runId) {
    throw new TypeError("parseTranscript: artifact.runId must be a non-empty string");
  }
  if (!Array.isArray(o.steps)) {
    throw new TypeError("parseTranscript: artifact.steps must be an array");
  }
  for (const [i, step] of (o.steps as unknown[]).entries()) {
    if (!step || typeof step !== "object") {
      throw new TypeError(`parseTranscript: artifact.steps[${i}] must be an object`);
    }
    const s = step as Record<string, unknown>;
    for (const key of ["role", "action", "content", "timestamp"] as const) {
      if (typeof s[key] !== "string") {
        throw new TypeError(`parseTranscript: artifact.steps[${i}].${key} must be a string`);
      }
    }
  }
}
