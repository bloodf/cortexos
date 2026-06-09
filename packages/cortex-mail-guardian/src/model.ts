import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export type SpamVerdict = "spam" | "not_spam" | "uncertain";

export interface ClassificationResult {
	verdict: SpamVerdict;
	confidence: number;
	reasons: string[];
	riskSignals: string[];
}

export interface ModelClientConfig {
	baseUrl: string;
	apiKey: string;
	model: string;
	timeoutMs?: number;
}

/**
 * Structured-output schema sent to the model. We accept `ham` (the natural
 * label) and normalize it to the internal `not_spam` verdict so the rest of
 * the pipeline (processor.ts, decision helpers) keeps a single vocabulary.
 */
export const classificationSchema = z.object({
	verdict: z.enum(["spam", "ham", "uncertain"]),
	confidence: z.number().min(0).max(1),
	reasons: z.array(z.string()).default([]),
	riskSignals: z.array(z.string()).default([]),
});

export type RawClassification = z.infer<typeof classificationSchema>;

function normalizeVerdict(verdict: RawClassification["verdict"]): SpamVerdict {
	return verdict === "ham" ? "not_spam" : verdict;
}

export function validateClassification(value: unknown): ClassificationResult {
	const input = value as { verdict?: string; confidence?: unknown; reasons?: unknown; riskSignals?: unknown } | null;
	if (!input || typeof input !== "object") throw new Error("classification must be an object");
	const verdict: string | undefined = input.verdict === "ham" ? "not_spam" : input.verdict;
	if (verdict !== "spam" && verdict !== "not_spam" && verdict !== "uncertain") {
		throw new Error("classification verdict is invalid");
	}
	if (typeof input.confidence !== "number" || input.confidence < 0 || input.confidence > 1) {
		throw new Error("classification confidence must be between 0 and 1");
	}
	return {
		verdict,
		confidence: input.confidence,
		reasons: Array.isArray(input.reasons) ? input.reasons.map(String).slice(0, 6) : [],
		riskSignals: Array.isArray(input.riskSignals) ? input.riskSignals.map(String).slice(0, 6) : [],
	};
}

function buildPrompt(input: { from: string; subject: string; text: string; feedbackSummary?: string }): string {
	return [
		"Classify this email for a personal spam guardian that quarantines suspicious mail before owner review.",
		"verdict must be spam, ham, or uncertain. confidence is 0..1. Be strict: only emit a confidence above 0.95 when the evidence is overwhelming.",
		"Use spam for unsolicited marketing, scams, phishing, suspicious attachments, fake invoices, credential requests, investment pitches, and mass outreach.",
		"Use ham only when the message is clearly personal, expected, transactional, or account-related.",
		"Use uncertain for borderline cases that should leave the Inbox for owner review.",
		"reasons: short justifications. riskSignals: concrete red flags you observed.",
		input.feedbackSummary ? `Prior owner feedback summary:\n${input.feedbackSummary}` : "",
		`From: ${input.from}`,
		`Subject: ${input.subject}`,
		`Body:\n${input.text.slice(0, 60000)}`,
	].filter(Boolean).join("\n\n");
}

export async function classifyEmail(config: ModelClientConfig, input: {
	from: string;
	subject: string;
	text: string;
	feedbackSummary?: string;
}): Promise<ClassificationResult> {
	const openai = createOpenAI({
		baseURL: config.baseUrl.replace(/\/+$/, ""),
		apiKey: config.apiKey,
	});
	const { object } = await generateObject({
		model: openai(config.model),
		schema: classificationSchema,
		system:
			"You are a fast, strict email spam classifier. Be aggressive about quarantining unsolicited or risky mail, but keep clearly legitimate mail. Reserve high confidence (>0.95) for unambiguous cases.",
		prompt: buildPrompt(input),
		temperature: 0,
		abortSignal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
	});
	return {
		verdict: normalizeVerdict(object.verdict),
		confidence: object.confidence,
		reasons: object.reasons.map(String).slice(0, 6),
		riskSignals: object.riskSignals.map(String).slice(0, 6),
	};
}

export function heuristicSpamScore(input: { from: string; subject: string; text: string }): number {
	const haystack = `${input.from}\n${input.subject}\n${input.text.slice(0, 20000)}`.toLowerCase();
	const patterns = [
		/\burgent action required\b/,
		/\bverify (your )?(account|password|wallet)\b/,
		/\b(password|account) (expires|suspended|locked)\b/,
		/\bcrypto(currency)?\b/,
		/\bforex\b/,
		/\bcasino\b/,
		/\bwinner\b/,
		/\bprize\b/,
		/\bgift card\b/,
		/\bloans? approved\b/,
		/\bseo\b/,
		/\bleads? generation\b/,
		/\bwhatsapp marketing\b/,
		/\bexclusive offer\b/,
		/\blimited time\b/,
		/\bact now\b/,
		/\bunsubscribe\b/,
		/\bclick here\b/,
		/\bbit\.ly\//,
		/\btinyurl\.com\//,
	];
	return patterns.reduce((score, pattern) => score + (pattern.test(haystack) ? 1 : 0), 0);
}

export function shouldAutoQuarantine(input: {
	classification: ClassificationResult;
	verification: ClassificationResult;
	threshold: number;
	hasAllowRule: boolean;
	heuristicScore?: number;
}): boolean {
	if (input.hasAllowRule) return false;
	const classifierSpam =
		input.classification.verdict === "spam" &&
		input.verification.verdict === "spam" &&
		input.classification.confidence >= input.threshold &&
		input.verification.confidence >= input.threshold;
	const strongSinglePass =
		(input.classification.verdict === "spam" && input.classification.confidence >= 0.9) ||
		(input.verification.verdict === "spam" && input.verification.confidence >= 0.9);
	return classifierSpam || (strongSinglePass && (input.heuristicScore ?? 0) >= 1) || (input.heuristicScore ?? 0) >= 3;
}

export function shouldKeepInInbox(input: {
	classification: ClassificationResult;
	verification: ClassificationResult;
	hasAllowRule: boolean;
	heuristicScore?: number;
}): boolean {
	if (input.hasAllowRule) return true;
	return input.classification.verdict === "not_spam" &&
		input.verification.verdict === "not_spam" &&
		input.classification.confidence >= 0.8 &&
		input.verification.confidence >= 0.8 &&
		input.classification.riskSignals.length === 0 &&
		input.verification.riskSignals.length === 0 &&
		(input.heuristicScore ?? 0) === 0;
}

export function shouldAutoTrash(input: Parameters<typeof shouldAutoQuarantine>[0]): boolean {
	return shouldAutoQuarantine(input);
}
