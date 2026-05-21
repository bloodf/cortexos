import { getRedisClient } from "@/lib/redis-client";
import { RedisRateLimitStore } from "./redis-rate-limit-store";
import { setRateLimitStore } from "./rate-limit-store";

let initialized = false;

export function initAiStores(): void {
	if (initialized) return;
	initialized = true;

	const redis = getRedisClient();
	if (redis) setRateLimitStore(new RedisRateLimitStore(redis));
}

export async function closeAiStores(): Promise<void> {
	initialized = false;
}
