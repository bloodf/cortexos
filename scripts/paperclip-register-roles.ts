#!/usr/bin/env tsx
/**
 * paperclip-register-roles
 *
 * Reads `templates/agent-roles/*.md`, parses paperclip frontmatter, and
 * registers each role with the Paperclip API:
 *
 *   1. POST /api/companies/:id/agent-hires   (idempotent — skips if role exists)
 *   2. If BOARD_TOKEN env present: POST /api/approvals/:id/approve
 *   3. POST /api/agents/:id/keys             (mint per-agent API key)
 *   4. Append minted keys to /opt/cortexos/.secrets/paperclip-keys.json (chmod 600)
 *
 * Env:
 *   PAPERCLIP_API_URL   (required)
 *   PAPERCLIP_API_KEY   (required) — operator/board key with hire scope
 *   PAPERCLIP_COMPANY_ID (required)
 *   BOARD_TOKEN         (optional) — when present, auto-approves hires
 *   PAPERCLIP_KEYS_FILE (optional) — override output path (default /opt/cortexos/.secrets/paperclip-keys.json)
 *   ROLES_DIR           (optional) — override frontmatter source dir
 */

import { readdir, readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface PaperclipFrontmatter {
	title: string;
	role: string;
	boss: string;
	monthlyBudgetUsd: number;
	adapterType: string;
	adapterPath: string;
	routine: string;
}

export interface ParsedRole {
	file: string;
	paperclip: PaperclipFrontmatter;
}

export interface MintedKey {
	role: string;
	agentId: string;
	apiKey: string;
	mintedAt: string;
}

const DEFAULT_KEYS_FILE = "/opt/cortexos/.secrets/paperclip-keys.json";
const DEFAULT_ROLES_DIR = resolve(__dirname, "..", "templates", "agent-roles");

/**
 * Minimal YAML frontmatter parser for the paperclip block.
 * We deliberately keep this hand-rolled to avoid an extra dep.
 */
export function parseFrontmatter(raw: string): PaperclipFrontmatter | null {
	const match = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const body = match[1];
	if (!/^paperclip\s*:/m.test(body)) return null;

	const lines = body.split("\n");
	const out: Record<string, string | number> = {};
	let inBlock = false;
	for (const line of lines) {
		if (/^paperclip\s*:\s*$/.test(line)) {
			inBlock = true;
			continue;
		}
		if (!inBlock) continue;
		if (/^\S/.test(line)) break; // de-dented — leaves the block
		const trimmed = line.trim();
		if (!trimmed) continue;
		const idx = trimmed.indexOf(":");
		if (idx <= 0) continue;
		const key = trimmed.slice(0, idx).trim();
		let value = trimmed.slice(idx + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		const asNumber = Number(value);
		out[key] = Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(value)
			? asNumber
			: value;
	}

	const required = [
		"title",
		"role",
		"boss",
		"monthlyBudgetUsd",
		"adapterType",
		"adapterPath",
		"routine",
	];
	for (const k of required) {
		if (!(k in out)) return null;
	}
	return out as unknown as PaperclipFrontmatter;
}

export async function loadRoles(dir: string): Promise<ParsedRole[]> {
	const entries = await readdir(dir);
	const roles: ParsedRole[] = [];
	for (const file of entries) {
		if (!file.endsWith(".md")) continue;
		const raw = await readFile(join(dir, file), "utf8");
		const fm = parseFrontmatter(raw);
		if (!fm) continue;
		roles.push({ file, paperclip: fm });
	}
	return roles;
}

export interface HttpClient {
	get(path: string): Promise<{ status: number; body: unknown }>;
	post(
		path: string,
		body: unknown,
		extraHeaders?: Record<string, string>,
	): Promise<{ status: number; body: unknown }>;
	patch(
		path: string,
		body: unknown,
		extraHeaders?: Record<string, string>,
	): Promise<{ status: number; body: unknown }>;
}

export function createHttpClient(
	baseUrl: string,
	apiKey: string,
): HttpClient {
	const headers = (extra?: Record<string, string>) => ({
		authorization: `Bearer ${apiKey}`,
		"content-type": "application/json",
		...(extra ?? {}),
	});

	async function readBody(res: Response): Promise<unknown> {
		const text = await res.text();
		if (!text) return null;
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	return {
		async get(path) {
			const res = await fetch(`${baseUrl}${path}`, { headers: headers() });
			return { status: res.status, body: await readBody(res) };
		},
		async post(path, body, extra) {
			const res = await fetch(`${baseUrl}${path}`, {
				method: "POST",
				headers: headers(extra),
				body: JSON.stringify(body ?? {}),
			});
			return { status: res.status, body: await readBody(res) };
		},
		async patch(path, body, extra) {
			const res = await fetch(`${baseUrl}${path}`, {
				method: "PATCH",
				headers: headers(extra),
				body: JSON.stringify(body ?? {}),
			});
			return { status: res.status, body: await readBody(res) };
		},
	};
}

export interface RegisterDeps {
	http: HttpClient;
	companyId: string;
	boardToken?: string;
}

function paperclipRoleToAgentRole(role: string): string {
	const normalized = role.toUpperCase();
	if (normalized === "CEO") return "ceo";
	if (normalized === "CTO") return "cto";
	if (normalized === "PM" || normalized === "PO") return "pm";
	if (normalized === "QA") return "qa";
	if (normalized === "UXUI") return "designer";
	if (normalized.includes("ENG") || normalized === "ENGINEER" || normalized === "STAFF-ENG") return "engineer";
	if (normalized.startsWith("BOOK-")) return "researcher";
	if (normalized === "CORTEX") return "general";
	throw new Error(`unmapped Paperclip role: ${role}`);
}

function buildAdapterConfig(role: ParsedRole): Record<string, unknown> {
	const headers: Record<string, string> = {};
	if (process.env.PAPERCLIP_WEBHOOK_SECRET) {
		headers.authorization = `Bearer ${process.env.PAPERCLIP_WEBHOOK_SECRET}`;
	}
	return {
		url: `${process.env.PAPERCLIP_BRIDGE_URL ?? "http://127.0.0.1:8089"}${role.paperclip.adapterPath}`,
		method: "POST",
		payloadTemplate: {
			cortexRole: role.paperclip.role,
		},
		...(Object.keys(headers).length > 0 ? { headers } : {}),
	};
}

export async function registerRole(
	role: ParsedRole,
	deps: RegisterDeps,
): Promise<MintedKey | null> {
	const { http, companyId, boardToken } = deps;
	const existing = await http.get(
		`/api/companies/${encodeURIComponent(companyId)}/agents`,
	);

	type AgentLike = { id?: string; metadata?: { cortexRole?: string } | null };
	type AgentListBody = { agents?: AgentLike[] } | AgentLike[] | null;
	const existingBody = existing.body as AgentListBody;
	const existingList: AgentLike[] = Array.isArray(existingBody)
		? existingBody
		: existingBody && Array.isArray(existingBody.agents)
			? existingBody.agents
			: [];

	const existingAgent = existing.status === 200
		? existingList.find((agent) => agent.metadata?.cortexRole === role.paperclip.role)
		: null;

	let agentId = existingAgent?.id;

	if (!agentId) {
		const hireRes = await http.post(
			`/api/companies/${encodeURIComponent(companyId)}/agent-hires`,
			{
				name: role.paperclip.title,
				role: paperclipRoleToAgentRole(role.paperclip.role),
				title: role.paperclip.title,
				budgetMonthlyCents: Math.round(role.paperclip.monthlyBudgetUsd * 100),
				adapterType: role.paperclip.adapterType,
				adapterConfig: buildAdapterConfig(role),
				metadata: {
					cortexRole: role.paperclip.role,
					boss: role.paperclip.boss,
					routine: role.paperclip.routine,
				},
			},
		);

		if (hireRes.status === 409) return null; // already exists upstream
		if (hireRes.status >= 400) {
			throw new Error(
				`hire failed for ${role.paperclip.role}: ${hireRes.status} ${JSON.stringify(hireRes.body)}`,
			);
		}

		const hireBody = (hireRes.body ?? {}) as {
			agent?: { id?: string };
			approvalId?: string;
			agentId?: string;
			id?: string;
		};
		const approvalId = hireBody.approvalId;
		agentId = hireBody.agentId ?? hireBody.agent?.id ?? hireBody.id;

		if (boardToken && approvalId) {
			const approveRes = await http.post(
				`/api/approvals/${encodeURIComponent(approvalId)}/approve`,
				{},
				{ "x-board-token": boardToken },
			);
			if (approveRes.status >= 400) {
				throw new Error(
					`approval failed for ${role.paperclip.role}: ${approveRes.status}`,
				);
			}
		}
	} else {
		if (!boardToken) {
			throw new Error(
				`BOARD_TOKEN required to update and mint a new key for existing role ${role.paperclip.role}`,
			);
		}
		const patchRes = await http.patch(
			`/api/agents/${encodeURIComponent(agentId)}`,
			{
				adapterConfig: buildAdapterConfig(role),
				replaceAdapterConfig: true,
				status: "idle",
			},
		);
		if (patchRes.status >= 400) {
			throw new Error(
				`agent patch failed for ${role.paperclip.role}: ${patchRes.status}`,
			);
		}
	}

	if (!agentId) {
		throw new Error(
			`hire response missing agentId for ${role.paperclip.role}`,
		);
	}

	const keyRes = await http.post(
		`/api/agents/${encodeURIComponent(agentId)}/keys`,
		{ name: `cortex-${role.paperclip.role}` },
	);
	if (keyRes.status >= 400) {
		throw new Error(
			`key mint failed for ${role.paperclip.role}: ${keyRes.status}`,
		);
	}
	const keyBody = (keyRes.body ?? {}) as { apiKey?: string; key?: string; token?: string };
	const apiKey = keyBody.apiKey ?? keyBody.key ?? keyBody.token;
	if (!apiKey) {
		throw new Error(`key mint response missing key for ${role.paperclip.role}`);
	}

	return {
		role: role.paperclip.role,
		agentId,
		apiKey,
		mintedAt: new Date().toISOString(),
	};
}

export async function writeKeyFile(
	path: string,
	keys: MintedKey[],
): Promise<void> {
	let existing: MintedKey[] = [];
	if (existsSync(path)) {
		try {
			const raw = await readFile(path, "utf8");
			const parsed = JSON.parse(raw) as { keys?: MintedKey[] };
			if (parsed && Array.isArray(parsed.keys)) existing = parsed.keys;
		} catch {
			existing = [];
		}
	}
	const byRole = new Map<string, MintedKey>();
	for (const k of existing) byRole.set(k.role, k);
	for (const k of keys) byRole.set(k.role, k);

	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		JSON.stringify({ keys: Array.from(byRole.values()) }, null, 2),
		"utf8",
	);
	try {
		await chmod(path, 0o600);
	} catch {
		// best-effort; non-fatal on dev machines.
	}
}

export async function run(opts: {
	apiUrl: string;
	apiKey: string;
	companyId: string;
	boardToken?: string;
	rolesDir: string;
	keysFile: string;
}): Promise<{ minted: MintedKey[]; skipped: string[] }> {
	const http = createHttpClient(opts.apiUrl, opts.apiKey);
	const roles = await loadRoles(opts.rolesDir);
	const minted: MintedKey[] = [];
	const skipped: string[] = [];
	for (const role of roles) {
		const result = await registerRole(role, {
			http,
			companyId: opts.companyId,
			boardToken: opts.boardToken,
		});
		if (result) minted.push(result);
		else skipped.push(role.paperclip.role);
	}
	if (minted.length > 0) await writeKeyFile(opts.keysFile, minted);
	return { minted, skipped };
}

async function main(): Promise<void> {
	const apiUrl = process.env.PAPERCLIP_API_URL;
	const apiKey = process.env.PAPERCLIP_API_KEY;
	const companyId = process.env.PAPERCLIP_COMPANY_ID;
	if (!apiUrl || !apiKey || !companyId) {
		throw new Error(
			"PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID required",
		);
	}
	const rolesDir = process.env.ROLES_DIR ?? DEFAULT_ROLES_DIR;
	const keysFile = process.env.PAPERCLIP_KEYS_FILE ?? DEFAULT_KEYS_FILE;
	const boardToken = process.env.BOARD_TOKEN;

	const { minted, skipped } = await run({
		apiUrl,
		apiKey,
		companyId,
		boardToken,
		rolesDir,
		keysFile,
	});
	process.stdout.write(
		`paperclip-register-roles: minted=${minted.length} skipped=${skipped.length}\n`,
	);
	if (skipped.length) {
		process.stdout.write(`  skipped roles: ${skipped.join(", ")}\n`);
	}
	if (minted.length) {
		process.stdout.write(`  keys file: ${keysFile}\n`);
	}
}

const isDirect =
	typeof require !== "undefined" &&
	typeof module !== "undefined" &&
	require.main === module;
if (isDirect) {
	main().catch((err) => {
		process.stderr.write(`paperclip-register-roles: ${err.message}\n`);
		process.exit(1);
	});
}
