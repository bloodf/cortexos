/**
 * OpenClaw gateway HTTP client.
 *
 * Wraps `http://127.0.0.1:18789` (overridable via `OPENCLAW_GATEWAY_URL`).
 * Adds: fetch + 10s AbortController timeout, exponential backoff (3 attempts),
 * circuit breaker (5 failures / 30s → open 60s → half-open via `health()`),
 * Bearer auth from `OPENCLAW_GATEWAY_TOKEN` when set, zod response validation.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CircuitOpenError extends Error {
	readonly code = "ECIRCUITOPEN";
	constructor(message = "OpenClaw circuit breaker open") {
		super(message);
		this.name = "CircuitOpenError";
	}
}

export class OpenClawTimeoutError extends Error {
	readonly code = "ETIMEOUT";
	constructor(message = "OpenClaw request timed out") {
		super(message);
		this.name = "OpenClawTimeoutError";
	}
}

export class OpenClawProtocolError extends Error {
	readonly code = "EPROTOCOL";
	readonly path?: string;
	constructor(message: string, path?: string) {
		super(message);
		this.name = "OpenClawProtocolError";
		this.path = path;
	}
}

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const installPluginSchema = z.object({
	ok: z.boolean(),
	pluginId: z.string().optional(),
});

const registerRouteSchema = z.object({ routeId: z.string() });

const channelSchema = z.object({
	platform: z.string(),
	accountRef: z.string(),
	active: z.boolean(),
});
const channelListSchema = z.array(channelSchema);

const sendMessageSchema = z.object({ messageId: z.string() });

const accountSchema = z.object({ name: z.string(), plugin: z.string() });
const accountListSchema = z.array(accountSchema);

const pluginStatusSchema = z.object({
	state: z.enum(["ok", "degraded", "down"]),
	latencyMs: z.number(),
});

const healthSchema = z.object({
	status: z.enum(["ok", "degraded", "down"]),
	version: z.string(),
});

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type InstallPluginResult = z.infer<typeof installPluginSchema>;
export type RegisterRouteResult = z.infer<typeof registerRouteSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type SendMessageResult = z.infer<typeof sendMessageSchema>;
export type Account = z.infer<typeof accountSchema>;
export type PluginStatus = z.infer<typeof pluginStatusSchema>;
export type Health = z.infer<typeof healthSchema>;

export interface RegisterRouteInput {
	factorySlug: string;
	stages: string[];
	channels: { platform: string; accountRef: string; target: string }[];
}

export interface SendMessageInput {
	accountRef: string;
	target: string;
	blocks: unknown;
	threadKey?: string;
	replyable?: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;
const RETRY_DELAYS_MS = [250, 1_000, 2_500];

const BREAKER_THRESHOLD = 5;
const BREAKER_WINDOW_MS = 30_000;
const BREAKER_OPEN_MS = 60_000;

function getBaseUrl(): string {
	return process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:18789";
}

function getAuthHeader(): Record<string, string> {
	const tok = process.env.OPENCLAW_GATEWAY_TOKEN;
	return tok ? { Authorization: `Bearer ${tok}` } : {};
}

// ---------------------------------------------------------------------------
// Circuit breaker (module-scoped)
// ---------------------------------------------------------------------------

interface BreakerState {
	failures: number[]; // timestamps
	openedAt: number | null;
	probeInFlight: boolean;
}

const breaker: BreakerState = {
	failures: [],
	openedAt: null,
	probeInFlight: false,
};

/**
 * Atomically reserve a request slot through the breaker. Returns true if the
 * caller may proceed. In half-open state only one probe is allowed in flight;
 * concurrent requests must wait for it to resolve.
 */
function breakerTryAcquire(now = Date.now()): boolean {
	if (breaker.openedAt === null) return true;
	if (now - breaker.openedAt >= BREAKER_OPEN_MS) {
		// half-open: serialize a single probe.
		if (breaker.probeInFlight) return false;
		breaker.probeInFlight = true;
		return true;
	}
	return false;
}

function breakerIsOpen(now = Date.now()): boolean {
	if (breaker.openedAt === null) return false;
	return now - breaker.openedAt < BREAKER_OPEN_MS;
}

function breakerOnSuccess(): void {
	breaker.failures = [];
	breaker.openedAt = null;
	breaker.probeInFlight = false;
}

function breakerOnFailure(now = Date.now()): void {
	breaker.probeInFlight = false;
	breaker.failures.push(now);
	// prune outside window
	breaker.failures = breaker.failures.filter(
		(t) => now - t <= BREAKER_WINDOW_MS,
	);
	if (breaker.failures.length >= BREAKER_THRESHOLD && breaker.openedAt === null) {
		breaker.openedAt = now;
	}
}

/** Test-only: reset internal breaker state. */
export function _resetBreaker(): void {
	breaker.failures = [];
	breaker.openedAt = null;
	breaker.probeInFlight = false;
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

interface RequestOptions {
	method?: "GET" | "POST" | "PUT" | "DELETE";
	body?: unknown;
	timeoutMs?: number;
	retries?: number;
}

async function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function rawRequest(path: string, options: RequestOptions): Promise<unknown> {
	const url = `${getBaseUrl()}${path}`;
	const method = options.method ?? "GET";
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	let res: Response;
	try {
		res = await fetch(url, {
			method,
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				...getAuthHeader(),
			},
			body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
			signal: controller.signal,
		});
	} catch (err) {
		clearTimeout(timeoutId);
		if (err instanceof Error && err.name === "AbortError") {
			throw new OpenClawTimeoutError();
		}
		throw err;
	}
	clearTimeout(timeoutId);

	if (res.status >= 500) {
		const text = await res.text().catch(() => "");
		const e = new Error(
			`OpenClaw ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`,
		);
		(e as Error & { status?: number }).status = res.status;
		throw e;
	}

	if (res.status >= 400) {
		const text = await res.text().catch(() => "");
		const e = new Error(
			`OpenClaw ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`,
		) as Error & { status?: number; noRetry?: boolean };
		e.status = res.status;
		e.noRetry = true;
		throw e;
	}

	if (res.status === 204) return null;
	const ct = res.headers.get("content-type") ?? "";
	if (!ct.includes("application/json")) return null;
	return res.json();
}

/** Apply ±20% jitter to a base delay to spread reconnect storms. */
function jitter(delayMs: number): number {
	const span = delayMs * 0.4;
	return Math.max(0, delayMs - span / 2 + Math.random() * span);
}

async function request<T>(
	path: string,
	options: RequestOptions,
	schema?: z.ZodType<T>,
): Promise<T> {
	if (!breakerTryAcquire()) throw new CircuitOpenError();

	const maxAttempts = options.retries ?? DEFAULT_RETRIES;
	let lastError: unknown;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const data = await rawRequest(path, options);
			breakerOnSuccess();
			if (!schema) return data as T;
			const parsed = schema.safeParse(data);
			if (!parsed.success) {
				const first = parsed.error.issues[0];
				// L-3: schema mismatch indicates upstream regression; count as breaker failure.
				breakerOnFailure();
				throw new OpenClawProtocolError(
					`Response schema mismatch at ${path}: ${first?.message}`,
					first?.path.join("."),
				);
			}
			return parsed.data;
		} catch (err) {
			lastError = err;
			if (err instanceof OpenClawProtocolError) throw err;
			const noRetry =
				err instanceof Error &&
				(err as Error & { noRetry?: boolean }).noRetry === true;
			if (noRetry) throw err;
			breakerOnFailure();
			if (breakerIsOpen()) throw new CircuitOpenError();
			if (attempt < maxAttempts - 1) {
				const base =
					RETRY_DELAYS_MS[attempt] ??
					RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
				await sleep(jitter(base));
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("OpenClaw request failed");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const openclaw = {
	async installPlugin(
		name: string,
		options?: Record<string, unknown>,
	): Promise<InstallPluginResult> {
		return request(
			"/plugins/install",
			{ method: "POST", body: { name, options: options ?? {} } },
			installPluginSchema,
		);
	},

	async configurePlugin(
		pluginId: string,
		config: Record<string, unknown>,
	): Promise<void> {
		await request(`/plugins/${encodeURIComponent(pluginId)}/configure`, {
			method: "POST",
			body: { config },
		});
	},

	async setupOpenViking(
		config: { agentPrefix: string } & Record<string, unknown>,
	): Promise<void> {
		await request("/openviking/setup", { method: "POST", body: config });
	},

	async setConfig(path: string, value: unknown): Promise<void> {
		await request("/config", { method: "PUT", body: { path, value } });
	},

	async registerRoute(
		route: RegisterRouteInput,
	): Promise<RegisterRouteResult> {
		return request(
			"/routes",
			{ method: "POST", body: route },
			registerRouteSchema,
		);
	},

	async listChannels(): Promise<Channel[]> {
		return request("/channels", { method: "GET" }, channelListSchema);
	},

	async sendMessage(params: SendMessageInput): Promise<SendMessageResult> {
		return request(
			"/messages",
			{ method: "POST", body: params },
			sendMessageSchema,
		);
	},

	async listAccounts(): Promise<Account[]> {
		return request("/accounts", { method: "GET" }, accountListSchema);
	},

	async pluginStatus(pluginId: string): Promise<PluginStatus> {
		return request(
			`/plugins/${encodeURIComponent(pluginId)}/status`,
			{ method: "GET" },
			pluginStatusSchema,
		);
	},

	async health(): Promise<Health> {
		return request("/health", { method: "GET", retries: 1 }, healthSchema);
	},
};

export type OpenClawClient = typeof openclaw;
