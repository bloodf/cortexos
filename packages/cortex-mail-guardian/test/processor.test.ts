import { describe, expect, it, vi } from "vitest";
import type { ProcessDeps } from "../src/processor.js";
import { buildReviewMessage, sweep } from "../src/processor.js";

vi.mock("../src/model.js", () => ({
	classifyEmail: async () => ({
		verdict: "uncertain",
		confidence: 0.5,
		reasons: [],
		riskSignals: [],
	}),
	shouldAutoTrash: () => false,
}));

function account(slug: string) {
	return {
		slug,
		address: `${slug}@example.test`,
		host: "mail.example.test",
		port: 993,
		secure: true,
		username: `${slug}@example.test`,
		password: "secret",
		inbox: "INBOX",
	};
}

describe("mail guardian sweep", () => {
	it("does not let skipped messages consume the per-account processing cap", async () => {
		const accounts = [account("one"), account("two"), account("three")];
		const listed: string[] = [];
		const deps = {
			config: {
				accounts,
				maxMessagesPerSweep: 1,
				nineRouterBaseUrl: "http://127.0.0.1:11434/v1",
				nineRouterApiKey: "test",
				model: "test",
				modelTimeoutMs: 30_000,
				confidenceThreshold: 0.95,
				dryRun: true,
			},
			store: {
				hasProcessed: async (_accountSlug: string, uid: number) => uid === 1,
				hasAllowRule: async () => false,
				createPendingReview: async () => 10,
				markProcessed: async () => undefined,
			},
			telegram: {
				sendMessage: async () => undefined,
			},
			mail: {
				listInbox: async (mailAccount: { slug: string }) => {
					listed.push(mailAccount.slug);
					return [
						{ uid: 1, from: "sender@example.test", subject: "first", text: "first" },
						{ uid: 2, from: "sender@example.test", subject: "second", text: "second" },
					];
				},
			},
		} as unknown as ProcessDeps;

		await expect(sweep(deps)).resolves.toMatchObject({ processed: 6, review: 3, skipped: 3 });
		expect(listed).toEqual(["one", "two", "three"]);
	});
});

describe("mail guardian Telegram review message", () => {
	it("shows only sender and subject, not body or generated summaries", () => {
		const message = buildReviewMessage({
			accountAddress: "inbox@example.test",
			from: "Sender <sender@example.test>",
			subject: "Quarterly invoice",
			verdict: "uncertain",
			confidence: 0.61,
			reviewId: 123,
		});

		expect(message).toContain("From: Sender <sender@example.test>");
		expect(message).toContain("Subject: Quarterly invoice");
		expect(message).not.toContain("Summary:");
		expect(message).not.toContain("Body:");
		expect(message).not.toContain("invoice body private details");
	});
});
