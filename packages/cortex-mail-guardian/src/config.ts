import { Buffer } from "node:buffer";

export interface MailAccountConfig {
	slug: string;
	address: string;
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password: string;
	inbox: string;
	reviewMailbox: string;
	trashMailbox?: string;
}

export interface GuardianConfig {
	accounts: MailAccountConfig[];
	model: string;
	confidenceThreshold: number;
	action: "trash";
	telegramBotToken?: string;
	telegramOwnerChatId?: string;
	nineRouterBaseUrl: string;
	nineRouterApiKey: string;
	databaseUrl?: string;
	maxMessagesPerSweep: number;
	modelTimeoutMs: number;
	db: {
		host: string;
		port: number;
		database: string;
		user: string;
		password?: string;
	};
	dryRun: boolean;
}

function env(name: string, source: NodeJS.ProcessEnv): string | undefined {
	const value = source[name];
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function requireEnv(name: string, source: NodeJS.ProcessEnv): string {
	const value = env(name, source);
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function parseIntEnv(name: string, source: NodeJS.ProcessEnv, fallback?: number): number {
	const raw = env(name, source);
	if (!raw) {
		if (fallback !== undefined) return fallback;
		throw new Error(`${name} is required`);
	}
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
	return parsed;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
	if (!raw) return fallback;
	if (/^(1|true|yes)$/i.test(raw)) return true;
	if (/^(0|false|no)$/i.test(raw)) return false;
	throw new Error(`invalid boolean value: ${raw}`);
}

export function decodeBase64Secret(name: string, value: string): string {
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
		throw new Error(`${name} must be valid padded base64`);
	}
	const decoded = Buffer.from(value, "base64").toString("utf8");
	if (!decoded) throw new Error(`${name} decoded to an empty value`);
	const normalized = Buffer.from(decoded, "utf8").toString("base64");
	if (normalized !== value) throw new Error(`${name} must be canonical base64`);
	return decoded;
}

function loadAccount(index: number, source: NodeJS.ProcessEnv): MailAccountConfig {
	const prefix = `MAIL_GUARDIAN_ACCOUNT_${index}_`;
	return {
		slug: requireEnv(`${prefix}SLUG`, source),
		address: requireEnv(`${prefix}ADDRESS`, source),
		host: requireEnv(`${prefix}HOST`, source),
		port: parseIntEnv(`${prefix}PORT`, source, 993),
		secure: parseBool(env(`${prefix}SECURE`, source), true),
		username: requireEnv(`${prefix}USERNAME`, source),
		password: decodeBase64Secret(`${prefix}PASSWORD_B64`, requireEnv(`${prefix}PASSWORD_B64`, source)),
		inbox: env(`${prefix}INBOX`, source) ?? "INBOX",
		reviewMailbox: env(`${prefix}REVIEW_MAILBOX`, source) ?? "INBOX.Cortex Mail Guardian Review",
		trashMailbox: env(`${prefix}TRASH_MAILBOX`, source),
	};
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): GuardianConfig {
	// Accounts can come from env (MAIL_GUARDIAN_ACCOUNT_N_*) and/or the
	// mail_guardian_accounts DB table (merged later in buildDeps). When the
	// count is absent or 0 we treat env accounts as empty and rely on the DB.
	const rawCount = env("MAIL_GUARDIAN_ACCOUNT_COUNT", source);
	const accountCount = rawCount ? parseIntEnv("MAIL_GUARDIAN_ACCOUNT_COUNT", source) : 0;
	const accounts = Array.from({ length: accountCount }, (_, idx) => loadAccount(idx + 1, source));
	const slugs = new Set(accounts.map((account) => account.slug));
	if (slugs.size !== accounts.length) throw new Error("mail account slugs must be unique");
	const confidenceThreshold = Number(env("MAIL_GUARDIAN_CONFIDENCE_THRESHOLD", source) ?? "0.95");
	if (!Number.isFinite(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
		throw new Error("MAIL_GUARDIAN_CONFIDENCE_THRESHOLD must be between 0 and 1");
	}
	const action = env("MAIL_GUARDIAN_ACTION", source) ?? "trash";
	if (action !== "trash") throw new Error("MAIL_GUARDIAN_ACTION must be trash");

	return {
		accounts,
		model: env("MAIL_GUARDIAN_MODEL", source) ?? "minimax/MiniMax-M2.7-highspeed",
		confidenceThreshold,
		action,
		telegramBotToken: env("TELEGRAM_BOT_TOKEN", source),
		telegramOwnerChatId: env("TELEGRAM_BOT_TOKEN", source) ? env("MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID", source) : undefined,
		nineRouterBaseUrl: normalizeOpenAiBaseUrl(env("NINEROUTER_BASE_URL", source) ?? "http://localhost:11434/v1"),
		nineRouterApiKey: requireEnv("NINEROUTER_API_KEY", source),
		databaseUrl: env("DATABASE_URL", source) ?? env("PG_DSN", source),
		maxMessagesPerSweep: parseIntEnv("MAIL_GUARDIAN_MAX_MESSAGES_PER_SWEEP", source, 20),
		modelTimeoutMs: parseIntEnv("MAIL_GUARDIAN_MODEL_TIMEOUT_MS", source, 30_000),
		db: {
			host: env("DB_HOST", source) ?? "localhost",
			port: parseIntEnv("DB_PORT", source, 5432),
			database: env("DB_NAME", source) ?? "cortex_dashboard",
			user: env("DB_USER", source) ?? "dashboard",
			password: env("DB_PASSWORD", source),
		},
		dryRun: parseBool(env("MAIL_GUARDIAN_DRY_RUN", source), false),
	};
}

function normalizeOpenAiBaseUrl(value: string): string {
	const trimmed = value.replace(/\/+$/, "");
	return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

/** Shape of a DB-backed account row (subset used to build MailAccountConfig). */
export interface AccountRowInput {
	slug: string;
	address: string;
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password_b64: string;
	inbox: string;
	trash_mailbox: string | null;
	review_mailbox: string;
}

/** Map a DB account row to the runtime MailAccountConfig, decoding the password. */
export function accountFromRow(row: AccountRowInput): MailAccountConfig {
	return {
		slug: row.slug,
		address: row.address,
		host: row.host,
		port: row.port,
		secure: row.secure,
		username: row.username,
		password: decodeBase64Secret(`account ${row.slug} password_b64`, row.password_b64),
		inbox: row.inbox || "INBOX",
		reviewMailbox: row.review_mailbox || "INBOX.Cortex Mail Guardian Review",
		trashMailbox: row.trash_mailbox ?? undefined,
	};
}

/**
 * Merge DB-backed accounts with env-configured accounts. DB rows take
 * precedence by slug; env accounts not present in the DB are preserved
 * (backward compatibility with MAIL_GUARDIAN_ACCOUNT_N_* config).
 */
export function mergeAccounts(envAccounts: MailAccountConfig[], dbAccounts: MailAccountConfig[]): MailAccountConfig[] {
	const bySlug = new Map<string, MailAccountConfig>();
	for (const account of envAccounts) bySlug.set(account.slug, account);
	for (const account of dbAccounts) bySlug.set(account.slug, account);
	return [...bySlug.values()];
}
