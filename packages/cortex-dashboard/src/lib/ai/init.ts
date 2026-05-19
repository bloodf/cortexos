import { connect, type KV, type NatsConnection } from "nats";
import { getRedisClient } from "@/lib/redis-client";
import { RedisRateLimitStore } from "./redis-rate-limit-store";
import { setRateLimitStore } from "./rate-limit-store";
import { NatsKvConsumedStore } from "./nats-kv-consumed-store";
import { setTokenConsumedStore } from "./confirmation-token";

const TOKEN_BUCKET = "cortex_approvals_seen";

let initialized = false;
let natsConnection: NatsConnection | null = null;

async function initNatsTokenStore(): Promise<void> {
	const url = process.env.NATS_URL;
	if (!url) return;
	natsConnection = await connect({
		servers: url,
		reconnect: true,
		maxReconnectAttempts: -1,
		reconnectTimeWait: 1_000,
		name: "cortex-dashboard-token-store",
	});
	const js = natsConnection.jetstream();
	let kv: KV;
	try {
		kv = await js.views.kv(TOKEN_BUCKET);
	} catch {
		kv = await js.views.kv(TOKEN_BUCKET, { history: 1, ttl: 30 * 24 * 60 * 60 * 1000 });
	}
	setTokenConsumedStore(new NatsKvConsumedStore(kv));
}

export function initAiStores(): void {
	if (initialized) return;
	initialized = true;

	const redis = getRedisClient();
	if (redis) setRateLimitStore(new RedisRateLimitStore(redis));

	void initNatsTokenStore().catch((err) => {
		process.stderr.write(`[ai-init] NATS KV token store unavailable: ${err instanceof Error ? err.message : String(err)}\n`);
	});
}

export async function closeAiStores(): Promise<void> {
	const nc = natsConnection;
	natsConnection = null;
	initialized = false;
	if (nc && !nc.isClosed()) await nc.drain();
}
