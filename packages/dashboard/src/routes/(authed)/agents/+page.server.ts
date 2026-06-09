/**
 * /agents — list Hermes agent profiles found on the host.
 *
 * Scans the directories in `AGENT_SCAN_PATHS` (comma-separated) and
 * falls back to a default list. Each profile directory is inspected
 * for `cortexos-profile.json` and `config.yaml`; model, provider and
 * Hermes API port are extracted. A lightweight TCP probe decides
 * whether the agent is currently running.
 */
import type { PageServerLoad } from './$types';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createConnection } from 'node:net';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { getMessages } from '$lib/i18n';

import {
	type AgentRunState,
	type AgentHealth,
	type AgentFile,
	type AgentItem,
} from '$lib/components/agents/types';

export type { AgentRunState, AgentHealth, AgentFile, AgentItem };

const AGENT_SCAN_PATHS_ENV = process.env.AGENT_SCAN_PATHS;
const DEFAULT_SCAN_PATHS: string[] = [
	'/home/cortexos/.openclaw',
	'/opt/cortexos/hermes/profiles',
];

function getScanPaths(): string[] {
	if (AGENT_SCAN_PATHS_ENV && AGENT_SCAN_PATHS_ENV.trim().length > 0) {
		return AGENT_SCAN_PATHS_ENV.split(',').map((s) => s.trim()).filter(Boolean);
	}
	return DEFAULT_SCAN_PATHS;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function yamlBlockValue(text: string, section: string, key: string): string | undefined {
	const sectionRe = new RegExp(
		`^${escapeRegExp(section)}:\\s*$([\\s\\S]*?)(?=^[a-zA-Z_][\\w]*:|\\z)`,
		'm',
	);
	const sec = text.match(sectionRe);
	if (!sec?.[1]) return undefined;
	const re = new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+)$`, 'm');
	const m = sec[1].match(re);
	return m?.[1]?.trim();
}

function yamlValue(text: string, key: string): string | undefined {
	const re = new RegExp(`^${escapeRegExp(key)}:\\s*(.+)$`, 'm');
	const m = text.match(re);
	return m?.[1]?.trim();
}

function parseBaseUrl(urlLike: string): { host: string; port: number } | null {
	try {
		const u = new URL(urlLike);
		const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
		if (!Number.isFinite(port) || port <= 0) return null;
		return { host: u.hostname || '127.0.0.1', port };
	} catch {
		return null;
	}
}

function probeTcp(host: string, port: number, timeout = 1500): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = createConnection(port, host);
		socket.setTimeout(timeout);
		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('timeout', () => {
			socket.destroy();
			resolve(false);
		});
		socket.once('error', () => {
			socket.destroy();
			resolve(false);
		});
	});
}

function languageFromPath(path: string): string {
	if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
	if (path.endsWith('.json')) return 'json';
	if (path.endsWith('.md')) return 'markdown';
	if (path.endsWith('.ts')) return 'typescript';
	if (path.endsWith('.js')) return 'javascript';
	if (path.endsWith('.py')) return 'python';
	if (path.endsWith('.sh')) return 'bash';
	if (path.endsWith('.toml')) return 'toml';
	return 'text';
}

async function readProfileFiles(dir: string): Promise<AgentFile[]> {
	const files: AgentFile[] = [];
	let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
	try {
		entries = (await readdir(dir, { withFileTypes: true })) as typeof entries;
	} catch {
		return files;
	}
	const names = entries
		.filter((e) => !e.name.startsWith('.') && !e.name.endsWith('.lock'))
		.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of names.slice(0, 12)) {
		const filePath = join(dir, entry.name);
		try {
			const s = await stat(filePath);
			if (!s.isFile()) continue;
		} catch {
			continue;
		}
		try {
			const content = await readFile(filePath, 'utf-8');
			files.push({
				path: entry.name,
				language: languageFromPath(entry.name),
				content: content.length > 4000 ? content.slice(0, 4000) + '\n\n... truncated' : content,
			});
		} catch {
			// ignore unreadable files
		}
	}
	return files;
}

async function scanAgentProfile(dir: string): Promise<AgentItem | null> {
	const slug = basename(dir);
	let name = slug;
	let description = '';
	let model = 'unknown';
	let modelProvider = 'unknown';
	let hermesHost = '127.0.0.1';
	let hermesPort = 18695;
	let version = 'unknown';

	const jsonPath = join(dir, 'cortexos-profile.json');
	try {
		const raw = await readFile(jsonPath, 'utf-8');
		const json = JSON.parse(raw) as Record<string, unknown>;
		if (typeof json.profile === 'string') {
			name = json.profile;
		}
		if (
			typeof json.model === 'object' &&
			json.model !== null
		) {
			const m = json.model as Record<string, unknown>;
			if (typeof m.id === 'string') model = m.id;
			if (typeof m.provider === 'string') modelProvider = m.provider;
			if (typeof m.baseUrl === 'string') {
				const parsed = parseBaseUrl(m.baseUrl);
				if (parsed) {
					hermesHost = parsed.host;
					hermesPort = parsed.port;
				}
			}
		}
		if (
			typeof json.api === 'object' &&
			json.api !== null
		) {
			const a = json.api as Record<string, unknown>;
			if (typeof a.host === 'string') hermesHost = a.host;
			if (typeof a.port === 'number') hermesPort = a.port;
		}
	} catch {
		// fall through to YAML
	}

	const configPath = join(dir, 'config.yaml');
	let configText = '';
	try {
		configText = await readFile(configPath, 'utf-8');
		const yModel = yamlBlockValue(configText, 'model', 'default') ?? 'unknown';
		const yProvider = yamlBlockValue(configText, 'model', 'provider') ?? 'unknown';
		if (model === 'unknown' && yModel !== 'unknown') model = yModel;
		if (modelProvider === 'unknown' && yProvider !== 'unknown') modelProvider = yProvider;
		const yBaseUrl = yamlBlockValue(configText, 'model', 'base_url');
		if (yBaseUrl) {
			const parsed = parseBaseUrl(yBaseUrl);
			if (parsed) {
				hermesHost = parsed.host;
				hermesPort = parsed.port;
			}
		}
		const yVersion = yamlValue(configText, '_config_version');
		if (yVersion) version = yVersion;
	} catch {
		// config.yaml missing
	}

	const soulPath = join(dir, 'SOUL.md');
	try {
		const soul = await readFile(soulPath, 'utf-8');
		const first = soul
			.split('\n')
			.map((l) => l.trim())
			.find((l) => l.length > 0 && !l.startsWith('#'));
		if (first) description = first.slice(0, 240);
	} catch {
		// no SOUL.md
	}

	const updatePath = join(dir, '.update_check');
	try {
		const raw = await readFile(updatePath, 'utf-8');
		const line = raw.split('\n')[0]?.trim();
		if (line) version = line;
	} catch {
		// no update check
	}

	const hermesUrl = `http://${hermesHost}:${hermesPort}`;
	const isListening = await probeTcp(hermesHost, hermesPort);

	let state: AgentRunState = isListening ? 'running' : 'stopped';
	let health: AgentHealth = isListening ? 'healthy' : 'down';

	// If the directory has a recent crash marker or no config, mark error.
	if (!configText && model === 'unknown') {
		state = 'error';
		health = 'down';
	}

	let uptimeSec = 0;
	let lastActivity = '';
	const gatewayPath = join(dir, 'gateway_state.json');
	try {
		const s = await stat(gatewayPath);
		lastActivity = s.mtime.toISOString();
		if (isListening) {
			uptimeSec = Math.max(0, Math.floor((Date.now() - s.mtime.getTime()) / 1000));
		}
	} catch {
		try {
			const s = await stat(configPath);
			lastActivity = s.mtime.toISOString();
		} catch {
			lastActivity = new Date().toISOString();
		}
	}

	const files = await readProfileFiles(dir);

	return {
		slug,
		name,
		description,
		state,
		model,
		modelProvider,
		health,
		hermesUrl,
		version,
		uptimeSec,
		queueDepth: 0,
		requestsPerMin: 0,
		errorRatePct: 0,
		p95LatencyMs: 0,
		lastActivity,
		files,
	};
}

async function scanAgents(dirs: string[]): Promise<AgentItem[]> {
	const agents: AgentItem[] = [];
	const seen = new Set<string>();
	for (const dir of dirs) {
		let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
		try {
			entries = (await readdir(dir, { withFileTypes: true })) as typeof entries;
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const profileDir = join(dir, entry.name);
			if (seen.has(profileDir)) continue;
			seen.add(profileDir);
			const profile = await scanAgentProfile(profileDir);
			if (profile) agents.push(profile);
		}
	}
	return agents.sort((a, b) => a.name.localeCompare(b.name));
}

export const load: PageServerLoad = async ({ cookies, request, url, locals }) => {
	const paths = getScanPaths();
	const agents = await scanAgents(paths);

	const localeCookie = cookies.get('cortex-locale');
	const messages = getMessages((localeCookie as 'en' | 'es' | 'pt-br') ?? 'en');

	const resolved = await getCurrentSession({
		cookies,
		request,
		url,
		params: {},
		route: { id: null },
		locals,
		getClientAddress: () => '127.0.0.1',
	});
	const isAdminFlag = resolved ? isAdmin(resolved.user) : false;

	return { agents, messages, isAdmin: isAdminFlag };
};
