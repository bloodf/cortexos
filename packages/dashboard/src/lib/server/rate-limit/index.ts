/**
 * In-memory sliding-window rate limiter.
 *
 * Per THREAT_MODEL SR-200 / T-200:
 *   - per-IP+route bucket for unauth endpoints
 *   - per-user+route bucket for authenticated endpoints (SR-091, v1.1 deferred to DB)
 *
 * M1 implementation: in-process `Map`. Single-worker is acceptable per the
 * M0 gate (D-02 in THREAT_MODEL §11). M3 swaps to DB/Redis (SR-102).
 *
 * The algorithm is a sliding-window counter: we store the timestamps of the
 * last N requests in a ring buffer and reject if there are >= `limit` events
 * in the last `windowSec` seconds. This is more accurate than a fixed-window
 * counter and simpler than a token bucket.
 *
 * Public API:
 *   - rateLimit({ key, limit, windowSec }) → check()
 *   - checkRateLimit(key) → returns { allowed, retryAfterSec, remaining }
 *   - resetRateLimit(key) → for tests
 *
 * The limiter is process-wide. Tests reset state between cases.
 */

export interface RateLimitConfig {
  /** Bucket key, e.g. `ip:1.2.3.4:/api/approvals/request`. */
  readonly key: string;
  /** Max events allowed in the window. */
  readonly limit: number;
  /** Window size in seconds. */
  readonly windowSec: number;
}

export interface RateLimitResult {
  /** True if the request is within the limit. */
  readonly allowed: boolean;
  /** If `!allowed`, seconds the client should wait. */
  readonly retryAfterSec: number;
  /** Remaining quota in the current window (0 when blocked). */
  readonly remaining: number;
  /** Current event count in the window (for observability). */
  readonly count: number;
  /** Effective limit. */
  readonly limit: number;
}

interface Bucket {
  /** Timestamps in ms, kept sorted ascending. */
  events: number[];
}

// ---------------------------------------------------------------------------
// Bucket store — single Map for the whole process.
// ---------------------------------------------------------------------------

const buckets = new Map<string, Bucket>();

/** Test helper: drop all buckets. */
export function _resetAllBuckets(): void {
  buckets.clear();
}

/** Test helper: number of buckets currently tracked. */
export function _bucketCount(): number {
  return buckets.size;
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

/**
 * Check (and record) a single event against the rate limit.
 *
 * Side effect: on `allowed = true`, the event is recorded in the bucket.
 * On `allowed = false`, no event is recorded (we don't want rejected
 * requests to count toward future limits; that creates starvation).
 */
export function checkRateLimit(cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = cfg.windowSec * 1000;
  const cutoff = now - windowMs;

  let bucket = buckets.get(cfg.key);
  if (!bucket) {
    bucket = { events: [] };
    buckets.set(cfg.key, bucket);
  }

  // Drop events outside the window. The array stays sorted by insertion
  // order (we always `push` and the input stream is monotonic), so we can
  // use `findIndex` / `splice` efficiently.
  while (bucket.events.length > 0 && bucket.events[0]! < cutoff) {
    bucket.events.shift();
  }

  if (bucket.events.length >= cfg.limit) {
    // Blocked. Compute `retryAfter` from the oldest event in the window:
    // when that event ages out, the client can retry.
    const oldest = bucket.events[0]!;
    const retryAfterMs = oldest + windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      retryAfterSec,
      remaining: 0,
      count: bucket.events.length,
      limit: cfg.limit,
    };
  }

  // Allowed — record the event.
  bucket.events.push(now);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: cfg.limit - bucket.events.length,
    count: bucket.events.length,
    limit: cfg.limit,
  };
}

// ---------------------------------------------------------------------------
// Convenience wrappers — build the key from IP / user + route.
// ---------------------------------------------------------------------------

/** Build a per-IP+route rate-limit key. */
export function ipKey(ip: string, route: string): string {
  return `ip:${ip}:${route}`;
}

/** Build a per-user+route rate-limit key. */
export function userKey(userId: string, route: string): string {
  return `user:${userId}:${route}`;
}

/** Convenience: rate-limit by IP, defaults from config. */
export function rateLimitByIp(
  ip: string,
  route: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  return checkRateLimit({ key: ipKey(ip, route), limit, windowSec });
}

/** Convenience: rate-limit by user. */
export function rateLimitByUser(
  userId: string,
  route: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  return checkRateLimit({ key: userKey(userId, route), limit, windowSec });
}
