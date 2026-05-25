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
		"Classify this email for a personal spam guardian that quarantines suspicious mail before owner review.",
		"Return only JSON with keys: verdict, confidence, reasons, riskSignals.",
		"verdict must be spam, not_spam, or uncertain. confidence is 0..1.",
		"Use spam for unsolicited marketing, scams, phishing, suspicious attachments, fake invoices, credential requests, investment pitches, and mass outreach.",
		"Use not_spam only when the message is clearly personal, expected, transactional, or account-related.",
		"Use uncertain for borderline cases that should leave the Inbox for owner review.",
		input.feedbackSummary ? `Prior owner feedback summary:\n${input.feedbackSummary}` : "",
		`From: ${input.from}`,
		`Subject: ${input.subject}`,
		`Body:\n${input.text.slice(0, 60000)}`,
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
				{ role: "system", content: "You are a fast email spam classifier. Be aggressive about quarantining unsolicited or risky mail, but keep clearly legitimate mail." },
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
