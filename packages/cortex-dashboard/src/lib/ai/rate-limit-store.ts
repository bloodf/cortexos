interface WindowState {
	count: number;
	windowStart: number;
}

export interface RateLimitResult {
	allowed: boolean;
	retryAfterSec: number;
}

export interface RateLimitStore {
	check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
	reset?(): Promise<void> | void;
}

class MemoryRateLimitStore implements RateLimitStore {
	private buckets = new Map<string, WindowState>();

	async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
		const now = Date.now();
		let bucket = this.buckets.get(key);
		if (!bucket || now - bucket.windowStart > windowMs) {
			bucket = { count: 0, windowStart: now };
			this.buckets.set(key, bucket);
		}
		if (bucket.count >= limit) {
			const retry = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
			return { allowed: false, retryAfterSec: Math.max(retry, 1) };
		}
		bucket.count += 1;
		return { allowed: true, retryAfterSec: 0 };
	}

	reset(): void {
		this.buckets.clear();
	}
}

let store: RateLimitStore = new MemoryRateLimitStore();

export function setRateLimitStore(next: RateLimitStore): void {
	store = next;
}

export function getRateLimitStore(): RateLimitStore {
	return store;
}

export function resetRateLimitStore(): void {
	store = new MemoryRateLimitStore();
}
