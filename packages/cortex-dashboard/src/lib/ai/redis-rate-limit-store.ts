import type Redis from "ioredis";
import type { RateLimitResult, RateLimitStore } from "./rate-limit-store";

export class RedisRateLimitStore implements RateLimitStore {
	constructor(private readonly redis: Redis, private readonly prefix = "dashboard:rate") {}

	async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
		const redisKey = `${this.prefix}:${key}`;
		const count = await this.redis.incr(redisKey);
		if (count === 1) {
			await this.redis.pexpire(redisKey, windowMs);
		}
		if (count <= limit) {
			return { allowed: true, retryAfterSec: 0 };
		}
		const ttlMs = await this.redis.pttl(redisKey);
		return {
			allowed: false,
			retryAfterSec: Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000)),
		};
	}

	async reset(): Promise<void> {
		let cursor = "0";
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${this.prefix}:*`, "COUNT", 100);
			cursor = nextCursor;
			if (keys.length > 0) await this.redis.del(...keys);
		} while (cursor !== "0");
	}
}
