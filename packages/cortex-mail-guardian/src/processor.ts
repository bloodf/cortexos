import type { GuardianConfig, MailAccountConfig } from "./config.js";
import type { MailClient, MailMessage } from "./imap.js";
import type { GuardianStore } from "./store.js";
import type { TelegramClient, TelegramUpdate } from "./telegram.js";
import { classifyEmail, shouldAutoTrash } from "./model.js";
import { redactEmail } from "./redact.js";

export interface ProcessDeps {
	config: GuardianConfig;
	mail: MailClient;
	store: GuardianStore;
	telegram: TelegramClient;
}

export async function processMessage(deps: ProcessDeps, account: MailAccountConfig, message: MailMessage): Promise<"trashed" | "review" | "skipped"> {
	if (await deps.store.hasProcessed(account.slug, message.uid)) return "skipped";
	const redacted = redactEmail({ from: message.from, subject: message.subject, text: message.text });
	const hasAllowRule = await deps.store.hasAllowRule(redacted.fromHash, redacted.domainHash);
	const modelConfig = {
		baseUrl: deps.config.nineRouterBaseUrl,
		apiKey: deps.config.nineRouterApiKey,
		model: deps.config.model,
		timeoutMs: deps.config.modelTimeoutMs,
	};
	const classification = await classifyEmail(modelConfig, {
		from: message.from,
		subject: message.subject,
		text: message.text,
	});
	const verification = await classifyEmail(modelConfig, {
		from: message.from,
		subject: message.subject,
		text: message.text,
		feedbackSummary: `Verify this action independently. Prior verdict: ${classification.verdict} at ${classification.confidence}.`,
	});

	if (shouldAutoTrash({
		classification,
		verification,
		threshold: deps.config.confidenceThreshold,
		hasAllowRule,
	})) {
		if (!deps.config.dryRun) await deps.mail.moveToTrash(account, message.uid);
		await deps.store.markProcessed(account.slug, message.uid, deps.config.dryRun ? "would_trash" : "trashed", message.messageId);
		return "trashed";
	}

	const reviewId = await deps.store.createPendingReview({
		accountSlug: account.slug,
		messageUid: message.uid,
		messageId: message.messageId,
		...redacted,
		modelVerdict: classification.verdict,
		modelConfidence: classification.confidence,
	});
	if (deps.config.telegramOwnerChatId) {
		await deps.telegram.sendMessage(
			deps.config.telegramOwnerChatId,
			[
				"Cortex mail guardian needs a decision.",
				`Account: ${account.address}`,
				`Summary: ${redacted.summary || "(empty)"}`,
				`Verdict: ${classification.verdict} (${classification.confidence})`,
				"",
				"Reply to Cortex with one of:",
				`mail guardian decide ${reviewId} spam`,
				`mail guardian decide ${reviewId} keep`,
				`mail guardian decide ${reviewId} block_sender`,
				`mail guardian decide ${reviewId} allow_sender`,
			].join("\n"),
			{
				inline_keyboard: [[
					{ text: "Spam -> Trash", callback_data: `mg:${reviewId}:spam` },
					{ text: "Not spam -> Keep", callback_data: `mg:${reviewId}:keep` },
				], [
					{ text: "Block sender", callback_data: `mg:${reviewId}:block_sender` },
					{ text: "Allow sender", callback_data: `mg:${reviewId}:allow_sender` },
				]],
			},
		);
	}
	await deps.store.markProcessed(account.slug, message.uid, "pending_review", message.messageId);
	return "review";
}

export async function sweep(deps: ProcessDeps): Promise<{ processed: number; trashed: number; review: number; skipped: number; failed: number }> {
	let processed = 0;
	let trashed = 0;
	let review = 0;
	let skipped = 0;
	let failed = 0;
	for (const account of deps.config.accounts) {
		const messages = await deps.mail.listInbox(account);
		for (const message of messages) {
			if (processed >= deps.config.maxMessagesPerSweep) return { processed, trashed, review, skipped, failed };
			let action: "trashed" | "review" | "skipped";
			try {
				action = await processMessage(deps, account, message);
			} catch (error) {
				failed += 1;
				process.stderr.write(`[mail-guardian] ${account.slug}:${message.uid} failed: ${error instanceof Error ? error.message : String(error)}\n`);
				continue;
			}
			processed += 1;
			if (action === "trashed") trashed += 1;
			else if (action === "review") review += 1;
			else skipped += 1;
		}
	}
	return { processed, trashed, review, skipped, failed };
}

export async function handleTelegramUpdates(deps: ProcessDeps, updates: TelegramUpdate[]): Promise<number> {
	let handled = 0;
	for (const update of updates) {
		const callback = update.callback_query;
		const data = callback?.data;
		if (!callback || !data?.startsWith("mg:")) continue;
		const [, reviewIdRaw, decision] = data.split(":");
		const reviewId = Number(reviewIdRaw);
		if (!Number.isInteger(reviewId)) continue;
		const review = await deps.store.getReview(reviewId);
		if (!review) {
			await deps.telegram.answerCallbackQuery(callback.id, "Review already resolved or missing.");
			continue;
		}
		const account = deps.config.accounts.find((item) => item.slug === review.account_slug);
		if (!account) {
			await deps.telegram.answerCallbackQuery(callback.id, "Account missing.");
			continue;
		}
		if (decision !== "spam" && decision !== "keep" && decision !== "block_sender" && decision !== "allow_sender") {
			await deps.telegram.answerCallbackQuery(callback.id, "Unknown decision.");
			continue;
		}
		await applyReviewDecision(deps, reviewId, decision, String(callback.message?.chat?.id ?? "telegram"));
		await deps.telegram.answerCallbackQuery(callback.id, "Recorded.");
		handled += 1;
	}
	return handled;
}

export async function applyReviewDecision(deps: ProcessDeps, reviewId: number, decision: string, approver: string): Promise<void> {
	const review = await deps.store.getReview(reviewId);
	if (!review) throw new Error(`review ${reviewId} is already resolved or missing`);
	const account = deps.config.accounts.find((item) => item.slug === review.account_slug);
	if (!account) throw new Error(`account missing for review ${reviewId}`);
	if (decision === "spam" || decision === "block_sender") {
		if (!deps.config.dryRun) await deps.mail.moveToTrash(account, review.message_uid);
		await deps.store.markProcessed(account.slug, review.message_uid, deps.config.dryRun ? "would_trash" : "trashed");
		if (decision === "block_sender") await deps.store.addRule("block", "sender", review.from_hash);
	} else if (decision === "keep" || decision === "allow_sender") {
		await deps.store.markProcessed(account.slug, review.message_uid, "kept");
		if (decision === "allow_sender") await deps.store.addRule("allow", "sender", review.from_hash);
	} else {
		throw new Error(`unknown decision: ${decision}`);
	}
	await deps.store.resolveReview(reviewId, decision, approver);
}
