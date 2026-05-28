#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { readFileSync, writeFileSync } from "node:fs";
import { TlsImapMailClient } from "./imap.js";
import { GuardianStore } from "./store.js";
import { assertTelegramReady, BotApiTelegramClient, discoverOwnerChatId } from "./telegram.js";
import { applyReviewDecision, handleTelegramUpdates, sweep } from "./processor.js";

async function buildDeps() {
	const config = loadConfig();
	const mail = new TlsImapMailClient();
	const store = new GuardianStore(config);
	await store.ensureSchema();
	const telegram = config.telegramBotToken ? new BotApiTelegramClient(config.telegramBotToken) : disabledTelegramClient();
	return { config, mail, store, telegram };
}

function disabledTelegramClient() {
	return {
		getMe: async () => { throw new Error("TELEGRAM_BOT_TOKEN is not configured"); },
		getChat: async () => { throw new Error("TELEGRAM_BOT_TOKEN is not configured"); },
		sendMessage: async () => undefined,
		getUpdates: async () => [],
		answerCallbackQuery: async () => undefined,
	};
}

async function smoke(): Promise<void> {
	const { config, telegram, store } = await buildDeps();
	try {
		if (!config.telegramOwnerChatId) throw new Error("MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID is required for smoke");
		await assertTelegramReady(telegram, config.telegramOwnerChatId);
		const modelsRes = await fetch(`${config.nineRouterBaseUrl.replace(/\/+$/, "")}/models`, {
			headers: { authorization: `Bearer ${config.nineRouterApiKey}` },
		});
		if (!modelsRes.ok) throw new Error(`9Router models check failed: ${modelsRes.status}`);
		const models = await modelsRes.json() as { data?: Array<{ id?: string }> };
		if (!models.data?.some((model) => model.id === config.model)) {
			throw new Error(`9Router model unavailable: ${config.model}`);
		}
		process.stdout.write("cortex-mail-guardian smoke ok\n");
	} finally {
		await store.close();
	}
}

async function runSweep(): Promise<void> {
	const deps = await buildDeps();
	try {
		if (!deps.config.telegramOwnerChatId) {
			process.stderr.write("[mail-guardian] Telegram owner chat missing; review notifications disabled.\n");
		} else {
			await assertTelegramReady(deps.telegram, deps.config.telegramOwnerChatId);
		}
		const result = await sweep(deps);
		process.stdout.write(`${JSON.stringify({ event: "mail_guardian_sweep", ...result })}\n`);
	} finally {
		await deps.mail.close();
		await deps.store.close();
	}
}

async function listen(): Promise<void> {
	const deps = await buildDeps();
	if (!deps.config.telegramOwnerChatId) {
		process.stderr.write("[mail-guardian] Telegram owner chat missing; Telegram polling disabled.\n");
	} else {
		await assertTelegramReady(deps.telegram, deps.config.telegramOwnerChatId);
	}
	await runSweep();
	const listeners = deps.config.accounts.map(async (account) => {
		for (;;) {
			try {
				await deps.mail.waitForNewMail(account);
				await runSweep();
			} catch (error) {
				process.stderr.write(`[mail-guardian] ${account.slug} listener error: ${error instanceof Error ? error.message : String(error)}\n`);
				await new Promise((resolve) => setTimeout(resolve, 30_000));
			}
		}
	});
	await Promise.all([
		pollTelegramReviews(deps),
		...listeners,
	]);
}

async function pollTelegramReviews(deps: Awaited<ReturnType<typeof buildDeps>>): Promise<void> {
	if (!deps.config.telegramOwnerChatId) return;
	let offset: number | undefined;
	for (;;) {
		try {
			const updates = await deps.telegram.getUpdates(offset);
			if (updates.length > 0) {
				offset = Math.max(...updates.map((update) => update.update_id)) + 1;
				const handled = await handleTelegramUpdates(deps, updates);
				if (handled > 0) {
					process.stdout.write(`${JSON.stringify({ event: "mail_guardian_telegram_decisions", handled })}\n`);
				}
			}
		} catch (error) {
			process.stderr.write(`[mail-guardian] telegram polling error: ${error instanceof Error ? error.message : String(error)}\n`);
			await new Promise((resolve) => setTimeout(resolve, 30_000));
		}
	}
}

async function telegramDiscoverOwner(): Promise<void> {
	const { telegram, store } = await buildDeps();
	try {
		const chatId = await discoverOwnerChatId(telegram);
		if (process.argv.includes("--write-env")) {
			upsertEnvLine(process.env.MAIL_GUARDIAN_ENV_PATH ?? "/opt/cortexos/.secrets/mail-guardian.env", "MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID", chatId);
		}
		process.stdout.write(`${chatId}\n`);
	} finally {
		await store.close();
	}
}

async function decide(): Promise<void> {
	const reviewId = Number(process.argv[3]);
	const decision = process.argv[4];
	if (!Number.isInteger(reviewId) || !decision) {
		throw new Error("usage: cortex-mail-guardian decide <review-id> <spam|keep|block_sender|allow_sender>");
	}
	const deps = await buildDeps();
	try {
		await applyReviewDecision(deps, reviewId, decision, "cortex-telegram");
		process.stdout.write(`${JSON.stringify({ ok: true, reviewId, decision })}\n`);
	} finally {
		await deps.mail.close();
		await deps.store.close();
	}
}

function upsertEnvLine(path: string, key: string, value: string): void {
	const raw = readFileSync(path, "utf8");
	const line = `${key}=${value}`;
	const pattern = new RegExp(`^#?\\s*${key}=.*$`, "m");
	const next = pattern.test(raw)
		? raw.replace(pattern, line)
		: `${raw.replace(/\n?$/, "\n")}${line}\n`;
	writeFileSync(path, next, { mode: 0o600 });
}

async function main(): Promise<void> {
	const command = process.argv[2] ?? "sweep";
	if (command === "smoke") await smoke();
	else if (command === "sweep") await runSweep();
	else if (command === "listen") await listen();
	else if (command === "telegram-discover-owner") await telegramDiscoverOwner();
	else if (command === "decide") await decide();
	else throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
	process.stderr.write(`cortex-mail-guardian: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
