import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { hostExecFile } from "@/lib/host-exec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_PATH = process.env.MAIL_GUARDIAN_ENV_PATH ?? "/opt/cortexos/.secrets/mail-guardian.env";
const ACCOUNT_KEY_RE = /^MAIL_GUARDIAN_ACCOUNT_(\d+)_(SLUG|ADDRESS|HOST|PORT|SECURE|USERNAME|PASSWORD_B64|INBOX|TRASH_MAILBOX)$/;
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

interface AccountInput {
	slug: string;
	address: string;
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password?: string;
	inbox: string;
	trashMailbox?: string;
}

interface AccountRecord extends AccountInput {
	passwordB64?: string;
	passwordSet: boolean;
}

function parseEnv(raw: string) {
	const values = new Map<string, string>();
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index <= 0) continue;
		values.set(trimmed.slice(0, index), trimmed.slice(index + 1));
	}
	return values;
}

function serializeValue(value: string | number | boolean) {
	return String(value).replace(/\n/g, "");
}

async function readAccounts() {
	const raw = await readFile(ENV_PATH, "utf8");
	const values = parseEnv(raw);
	const count = Number(values.get("MAIL_GUARDIAN_ACCOUNT_COUNT") ?? "0");
	const accounts: AccountRecord[] = [];
	for (let index = 1; index <= count; index++) {
		const prefix = `MAIL_GUARDIAN_ACCOUNT_${index}_`;
		const slug = values.get(`${prefix}SLUG`);
		if (!slug) continue;
		accounts.push({
			slug,
			address: values.get(`${prefix}ADDRESS`) ?? "",
			host: values.get(`${prefix}HOST`) ?? "",
			port: Number(values.get(`${prefix}PORT`) ?? "993"),
			secure: !/^(0|false|no)$/i.test(values.get(`${prefix}SECURE`) ?? "true"),
			username: values.get(`${prefix}USERNAME`) ?? "",
			passwordB64: values.get(`${prefix}PASSWORD_B64`),
			passwordSet: Boolean(values.get(`${prefix}PASSWORD_B64`)),
			inbox: values.get(`${prefix}INBOX`) ?? "INBOX",
			trashMailbox: values.get(`${prefix}TRASH_MAILBOX`) || undefined,
		});
	}
	return { raw, accounts };
}

function publicAccount(account: AccountRecord) {
	const { password, passwordB64, ...safe } = account;
	void password;
	void passwordB64;
	return safe;
}

function validateAccount(input: AccountInput, existingPasswordB64?: string): string | null {
	if (!SAFE_SLUG_RE.test(input.slug)) return "Slug must be 2-64 lowercase letters, numbers, dashes, or underscores";
	if (!input.address.includes("@")) return "Address must be an email address";
	if (!input.host || input.host.length > 255) return "Host is required";
	if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) return "Port must be between 1 and 65535";
	if (!input.username) return "Username is required";
	if (!input.inbox) return "Inbox is required";
	if (!input.password && !existingPasswordB64) return "Password is required";
	return null;
}

function normalizeInput(body: Record<string, unknown>, existing?: AccountRecord): AccountRecord {
	const password = typeof body.password === "string" && body.password.length > 0 ? body.password : undefined;
	return {
		slug: String(body.slug ?? existing?.slug ?? "").trim(),
		address: String(body.address ?? existing?.address ?? "").trim(),
		host: String(body.host ?? existing?.host ?? "").trim(),
		port: Number(body.port ?? existing?.port ?? 993),
		secure: typeof body.secure === "boolean" ? body.secure : existing?.secure ?? true,
		username: String(body.username ?? existing?.username ?? "").trim(),
		password,
		passwordB64: password ? Buffer.from(password, "utf8").toString("base64") : existing?.passwordB64,
		passwordSet: Boolean(password || existing?.passwordB64),
		inbox: String(body.inbox ?? existing?.inbox ?? "INBOX").trim(),
		trashMailbox: String(body.trashMailbox ?? existing?.trashMailbox ?? "").trim() || undefined,
	};
}

async function writeAccounts(raw: string, accounts: AccountRecord[]) {
	const kept = raw
		.split("\n")
		.filter((line) => {
			const key = line.trim().split("=")[0] ?? "";
			return key !== "MAIL_GUARDIAN_ACCOUNT_COUNT" && !ACCOUNT_KEY_RE.test(key);
		})
		.join("\n")
		.replace(/\n*$/, "\n");
	const accountLines = [`MAIL_GUARDIAN_ACCOUNT_COUNT=${accounts.length}`];
	accounts.forEach((account, idx) => {
		const prefix = `MAIL_GUARDIAN_ACCOUNT_${idx + 1}_`;
		accountLines.push(`${prefix}SLUG=${serializeValue(account.slug)}`);
		accountLines.push(`${prefix}ADDRESS=${serializeValue(account.address)}`);
		accountLines.push(`${prefix}HOST=${serializeValue(account.host)}`);
		accountLines.push(`${prefix}PORT=${serializeValue(account.port)}`);
		accountLines.push(`${prefix}SECURE=${account.secure ? "true" : "false"}`);
		accountLines.push(`${prefix}USERNAME=${serializeValue(account.username)}`);
		accountLines.push(`${prefix}PASSWORD_B64=${serializeValue(account.passwordB64 ?? "")}`);
		accountLines.push(`${prefix}INBOX=${serializeValue(account.inbox)}`);
		if (account.trashMailbox) accountLines.push(`${prefix}TRASH_MAILBOX=${serializeValue(account.trashMailbox)}`);
	});
	await writeFile(ENV_PATH, `${kept}${accountLines.join("\n")}\n`, { mode: 0o600 });
}

async function restartGuardian() {
	return hostExecFile("sudo", ["-n", "systemctl", "restart", "cortex-mail-guardian.service"], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
}

async function logAction(auth: Awaited<ReturnType<typeof requireAdmin>>, action: string, slug: string, status: "success" | "failure", message?: string | null) {
	await createActionLog({
		user_id: auth.session?.user_id ?? null,
		username: auth.session?.username ?? null,
		target_type: "mail-guardian",
		target_name: slug,
		action,
		status,
		message: message ?? null,
	}).catch(() => {});
}

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "mail_guardian.accounts.list" });
	if (auth.error) return auth.error;
	try {
		const { accounts } = await readAccounts();
		return NextResponse.json({ accounts: accounts.map(publicAccount) });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to read Mail Guardian accounts";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "mail_guardian.accounts.create" });
	if (auth.error) return auth.error;
	const [body, { raw, accounts }] = await Promise.all([
		request.json().catch(() => ({} as Record<string, unknown>)),
		readAccounts(),
	]);
	const next = normalizeInput(body);
	const validation = validateAccount(next);
	if (validation) return NextResponse.json({ error: validation }, { status: 400 });
	if (accounts.some((account) => account.slug === next.slug)) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
	try {
		await writeAccounts(raw, [...accounts, next]);
		const restart = await restartGuardian();
		await logAction(auth, "account.create", next.slug, "success", restart.stderr || restart.stdout || null);
		return NextResponse.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to create account";
		await logAction(auth, "account.create", next.slug, "failure", message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	const auth = await requireAdmin(request, { tool: "mail_guardian.accounts.update" });
	if (auth.error) return auth.error;
	const [body, { raw, accounts }] = await Promise.all([
		request.json().catch(() => ({} as Record<string, unknown>)),
		readAccounts(),
	]);
	const slug = String(body.slug ?? "").trim();
	const existing = accounts.find((account) => account.slug === slug);
	if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });
	const next = normalizeInput(body, existing);
	const validation = validateAccount(next, existing.passwordB64);
	if (validation) return NextResponse.json({ error: validation }, { status: 400 });
	try {
		await writeAccounts(raw, accounts.map((account) => account.slug === slug ? next : account));
		const restart = await restartGuardian();
		await logAction(auth, "account.update", slug, "success", restart.stderr || restart.stdout || null);
		return NextResponse.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update account";
		await logAction(auth, "account.update", slug, "failure", message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "mail_guardian.accounts.delete" });
	if (auth.error) return auth.error;
	const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
	if (!SAFE_SLUG_RE.test(slug)) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
	const { raw, accounts } = await readAccounts();
	if (!accounts.some((account) => account.slug === slug)) return NextResponse.json({ error: "Account not found" }, { status: 404 });
	if (accounts.length <= 1) return NextResponse.json({ error: "At least one account is required" }, { status: 400 });
	try {
		await writeAccounts(raw, accounts.filter((account) => account.slug !== slug));
		const restart = await restartGuardian();
		await logAction(auth, "account.delete", slug, "success", restart.stderr || restart.stdout || null);
		return NextResponse.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to delete account";
		await logAction(auth, "account.delete", slug, "failure", message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
