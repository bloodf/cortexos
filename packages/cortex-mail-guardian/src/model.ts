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

function parseJsonObject(text: string): unknown {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("model response did not contain JSON");
		return JSON.parse(match[0]);
	}
}

export function validateClassification(value: unknown): ClassificationResult {
	const input = value as Partial<ClassificationResult> | null;
	if (!input || typeof input !== "object") throw new Error("classification must be an object");
	if (input.verdict !== "spam" && input.verdict !== "not_spam" && input.verdict !== "uncertain") {
		throw new Error("classification verdict is invalid");
	}
	if (typeof input.confidence !== "number" || input.confidence < 0 || input.confidence > 1) {
		throw new Error("classification confidence must be between 0 and 1");
	}
	return {
		verdict: input.verdict,
		confidence: input.confidence,
		reasons: Array.isArray(input.reasons) ? input.reasons.map(String).slice(0, 6) : [],
		riskSignals: Array.isArray(input.riskSignals) ? input.riskSignals.map(String).slice(0, 6) : [],
	};
}

export async function classifyEmail(config: ModelClientConfig, input: {
	from: string;
	subject: string;
	text: string;
	feedbackSummary?: string;
}): Promise<ClassificationResult> {
	const prompt = [
		"Classify this email for a personal spam guardian.",
		"Return only JSON with keys: verdict, confidence, reasons, riskSignals.",
		"verdict must be spam, not_spam, or uncertain. confidence is 0..1.",
		"Prefer uncertain when personal, transactional, or relationship context may matter.",
		input.feedbackSummary ? `Prior owner feedback summary:\n${input.feedbackSummary}` : "",
		`From: ${input.from}`,
		`Subject: ${input.subject}`,
		`Body:\n${input.text.slice(0, 12000)}`,
	].filter(Boolean).join("\n\n");
	const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
		method: "POST",
		signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
		headers: {
			authorization: `Bearer ${config.apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: config.model,
			messages: [
				{ role: "system", content: "You are a fast, conservative email spam classifier." },
				{ role: "user", content: prompt },
			],
			temperature: 0,
		}),
	});
	if (!res.ok) throw new Error(`9Router classification failed: ${res.status}`);
	const body = parseChatCompletionBody(await res.text());
	const content = body.choices?.[0]?.message?.content;
	if (!content) throw new Error("9Router classification returned no content");
	return validateClassification(parseJsonObject(content));
}

function parseChatCompletionBody(raw: string): { choices?: Array<{ message?: { content?: string } }> } {
	const trimmed = raw.trim();
	if (trimmed.startsWith("data:")) {
		const lines = trimmed
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trim())
			.filter((line) => line && line !== "[DONE]");
		const merged = lines.map((line) => JSON.parse(line) as { choices?: Array<{ delta?: { content?: string }, message?: { content?: string } }> });
		const content = merged
			.map((chunk) => chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "")
			.join("");
		return { choices: [{ message: { content } }] };
	}
	return JSON.parse(trimmed) as { choices?: Array<{ message?: { content?: string } }> };
}

export function shouldAutoTrash(input: {
	classification: ClassificationResult;
	verification: ClassificationResult;
	threshold: number;
	hasAllowRule: boolean;
}): boolean {
	if (input.hasAllowRule) return false;
	return input.classification.verdict === "spam" &&
		input.verification.verdict === "spam" &&
		input.classification.confidence >= input.threshold &&
		input.verification.confidence >= input.threshold &&
		input.classification.riskSignals.length === 0 &&
		input.verification.riskSignals.length === 0;
}
