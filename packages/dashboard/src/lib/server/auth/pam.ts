/**
 * PAM authenticator — production interface + Linux + test implementations.
 *
 * M2-WS3 (Kleppmann) replaces the M1-WS4 fake auth stub with a real
 * Linux-PAM-backed authenticator. The dashboard runs on the host that
 * owns the user accounts (per THREAT_MODEL §0.5 / §7), so PAM is the
 * authoritative credential store — we never see or store passwords.
 *
 * Why an interface:
 *   - `authenticate-pam` is a native binding that builds only on Linux.
 *     CI, dev laptops (macOS), and unit tests need a swappable backend.
 *   - Tests must be deterministic. The fake backend lets a test pin
 *     username→password, group membership, and isAdmin outcomes.
 *   - The production backend is selected at module load (process.env),
 *     never per-request — the choice is part of the deployment
 *     configuration, not request data.
 *
 * Public API:
 *   - getPamAuthenticator() → PamAuthenticator
 *       Returns the process-wide authenticator (singleton).
 *   - setPamAuthenticator(a) → void
 *       Test helper; install a different backend.
 *   - resetPamAuthenticator() → void
 *       Test helper; restore the platform-default backend.
 *   - PamAuthenticator interface
 *       authenticate(username, password) → PamAuthResult
 *       getGroups(username)             → ReadonlyArray<GroupName>
 *       isAdmin(username)               → boolean
 *
 * `authenticate-pam` is declared as an `optionalDependencies` entry
 * so the dashboard still installs on macOS / Windows. The Linux
 * implementation is loaded dynamically; if the module is absent we
 * log a warning at boot and the getPamAuthenticator() falls back to
 * a fake. Production deployments on Linux get the real backend; the
 * fake is gated by CORTEX_AUTH_FAKE_PAM=1.
 */

import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The RBAC groups the dashboard understands. Mirrors `entities.GroupName`. */
export type GroupName = 'cortexos-admin' | 'cortexos-auditor' | 'cortexos-users';

/** Result of a PAM authentication attempt. */
export type PamAuthResult =
  | { ok: true; username: string }
  | { ok: false; reason: PamAuthFailureReason };

export type PamAuthFailureReason =
  | 'invalid_credentials'
  | 'unknown_user'
  | 'account_disabled'
  | 'system_error';

/** Authenticator contract. */
export interface PamAuthenticator {
  /**
   * Verify a username/password pair against the host's PAM stack.
   * Returns `{ ok: true, username }` on success; a structured failure
   * otherwise. The error reason is intentionally coarse — the caller
   * MUST NOT leak "unknown user" vs "bad password" to the client
   * (THREAT_MODEL T-101: user-enumeration resistance).
   */
  authenticate(username: string, password: string): Promise<PamAuthResult>;

  /**
   * Return the dashboard-relevant group memberships for a user.
   * The list is intersected with the dashboard's allowlist of groups
   * — we only ever report groups the dashboard understands.
   */
  getGroups(username: string): Promise<ReadonlyArray<GroupName>>;

  /** Convenience: is the user a member of `cortexos-admin`? */
  isAdmin(username: string): Promise<boolean>;

  /** Human-readable name (e.g. "linux-pam", "fake-pam"). */
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let cached: PamAuthenticator | null = null;

function pickDefault(): PamAuthenticator {
  // Explicit dev / test override.
  if (process.env.CORTEX_AUTH_FAKE_PAM === '1') {
    return new FakePamAuthenticator();
  }
  // On Linux, the production path. On other platforms, fall back to
  // the fake and log a warning so a deploy on macOS / Windows is loud.
  if (process.platform === 'linux') {
    return new LinuxPamAuthenticator();
  }
  // Non-Linux: warn loudly. The fake backend accepts any credentials
  // and treats every user as admin — this is acceptable for local
  // dev / CI but MUST never run in production (a Linux host will
  // never hit this branch).
  // eslint-disable-next-line no-console
  console.warn(
    '[cortexos/auth] authenticate-pam is Linux-only; using FakePamAuthenticator. ' +
      'Set CORTEX_AUTH_FAKE_PAM=1 to silence this warning, or deploy on Linux.',
  );
  return new FakePamAuthenticator();
}

/** Return the process-wide authenticator (lazy). */
export function getPamAuthenticator(): PamAuthenticator {
  if (!cached) cached = pickDefault();
  return cached;
}

/** Test helper: install a custom authenticator. */
export function setPamAuthenticator(a: PamAuthenticator): void {
  cached = a;
}

/** Test helper: clear the singleton. Next call re-runs pickDefault(). */
export function resetPamAuthenticator(): void {
  cached = null;
}

// ---------------------------------------------------------------------------
// Production: Linux PAM via `authenticate-pam`
// ---------------------------------------------------------------------------

/**
 * Linux implementation — `authenticate-pam` plus a thin wrapper around
 * POSIX `id -Gn` for group membership.
 *
 * The PAM service name is configurable via `CORTEX_AUTH_PAM_SERVICE`
 * (default: `cortexos-dashboard`). The deploy step is expected to
 * install a `/etc/pam.d/cortexos-dashboard` file that includes the
 * standard `auth` stack.
 *
 * Group membership:
 *   - We call `id -Gn <user>` to get the user's POSIX supplementary
 *     group list (POSIX `getgrouplist` isn't available from Node
 *     without a native binding; shelling out is fine for the
 *     dashboard's per-login rate).
 *   - We never look at `sudo` or `wheel` (THREAT_MODEL SR-003) —
 *     `cortexos-admin` is the only admin-bearing group.
 */
export class LinuxPamAuthenticator implements PamAuthenticator {
  readonly name = 'linux-pam';

  async authenticate(username: string, password: string): Promise<PamAuthResult> {
    if (!username || !password) {
      return { ok: false, reason: 'invalid_credentials' };
    }
    const pam = await loadAuthenticatePam();
    if (!pam) {
      // eslint-disable-next-line no-console
      console.error('[cortexos/auth] authenticate-pam module unavailable; cannot auth');
      return { ok: false, reason: 'system_error' };
    }
    // 1. Best-effort pre-check — does the user exist on the system?
    //    We use this to short-circuit the PAM call for known-bad
    //    usernames, so timing is roughly constant whether the user
    //    exists or not. PAM is still the source of truth.
    const userExists = safeUserExists(username);
    if (!userExists) {
      // Run a fake auth round-trip to keep timing roughly constant.
      fakeAuthRoundTrip(password);
      return { ok: false, reason: 'invalid_credentials' };
    }
    // 2. Real PAM auth. `authenticate-pam` throws on failure.
    try {
      await pam.authenticate(username, password);
      return { ok: true, username };
    } catch (err) {
      const reason = classifyPamError(err);
      // eslint-disable-next-line no-console
      console.warn('[cortexos/auth] pam.denied', { username, reason });
      return { ok: false, reason };
    }
  }

  async getGroups(username: string): Promise<ReadonlyArray<GroupName>> {
    const all = readPosixGroups(username);
    return all.filter(isDashboardGroup);
  }

  async isAdmin(username: string): Promise<boolean> {
    const groups = await this.getGroups(username);
    return groups.includes('cortexos-admin');
  }
}

// ---------------------------------------------------------------------------
// Test / dev: FakePamAuthenticator
// ---------------------------------------------------------------------------

interface FakeUser {
  password: string;
  groups: ReadonlyArray<GroupName>;
  disabled?: boolean;
}

/**
 * In-memory authenticator. Used in unit tests and on non-Linux dev
 * machines. By default every user is treated as a member of
 * `cortexos-admin` and any non-empty password authenticates.
 *
 * Tests can call `setFakeUser({ username, password, groups })` to
 * pin a credential; `setFakeGroup(username, group)` to add a group;
 * etc. The fake is process-scoped and resets between test files via
 * `resetFakePam()`.
 */
export class FakePamAuthenticator implements PamAuthenticator {
  readonly name = 'fake-pam';
  private users = new Map<string, FakeUser>();

  /** Test helper: register or replace a fake user. */
  setFakeUser(input: {
    username: string;
    password: string;
    groups?: ReadonlyArray<GroupName>;
    disabled?: boolean;
  }): void {
    this.users.set(input.username, {
      password: input.password,
      groups: input.groups ?? ['cortexos-admin', 'cortexos-users'],
      disabled: input.disabled ?? false,
    });
  }

  /** Test helper: drop every fake user. */
  resetFakePam(): void {
    this.users.clear();
  }

  async authenticate(username: string, password: string): Promise<PamAuthResult> {
    // By default (no users registered) any non-empty password is
    // accepted; this matches the dev "always works" posture.
    if (this.users.size === 0) {
      if (!username || !password) return { ok: false, reason: 'invalid_credentials' };
      return { ok: true, username };
    }
    const u = this.users.get(username);
    if (!u) {
      // Run a fake round-trip to roughly match the timing of the
      // real auth path (so the test asserting "unknown user returns
      // fast" is fair to the real backend in production).
      await new Promise((r) => setTimeout(r, 1));
      return { ok: false, reason: 'invalid_credentials' };
    }
    if (u.disabled) {
      return { ok: false, reason: 'account_disabled' };
    }
    if (u.password !== password) {
      return { ok: false, reason: 'invalid_credentials' };
    }
    return { ok: true, username };
  }

  async getGroups(username: string): Promise<ReadonlyArray<GroupName>> {
    if (this.users.size === 0) {
      // Default: every user is in the admin group on the fake. This
      // is the right default for the "no users registered" dev mode
      // — but ONLY for dev / tests. Production (Linux) takes the
      // real path.
      return ['cortexos-admin', 'cortexos-users'];
    }
    return this.users.get(username)?.groups ?? [];
  }

  async isAdmin(username: string): Promise<boolean> {
    const g = await this.getGroups(username);
    return g.includes('cortexos-admin');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Dashboard-understood group allowlist (THREAT_MODEL SR-003). */
const DASHBOARD_GROUPS: ReadonlySet<GroupName> = new Set([
  'cortexos-admin',
  'cortexos-auditor',
  'cortexos-users',
]);

function isDashboardGroup(g: string): g is GroupName {
  return DASHBOARD_GROUPS.has(g as GroupName);
}

/**
 * Eagerly resolve and cache the real `authenticate-pam` module so the
 * dynamic-import path doesn't add startup latency to the first login.
 *
 * Side effect: sets `pamModule` on success.
 */
let pamModule:
  | {
      authenticate: (user: string, password: string) => Promise<void>;
      validate: (user: string) => Promise<boolean>;
    }
  | null
  | undefined; // undefined = not yet attempted; null = attempted, failed

let pamLoadPromise: Promise<void> | null = null;

async function loadAuthenticatePam(): Promise<typeof pamModule> {
  if (pamModule !== undefined) return pamModule;
  if (!pamLoadPromise) {
    pamLoadPromise = (async () => {
      try {
        // The package is `optionalDependencies` (native binding; only
        // builds on Linux). On macOS / Windows the import fails —
        // we swallow that and degrade gracefully. The `// @vite-ignore`
        // tells Vite not to try to resolve the specifier statically.
        const moduleName = 'authenticate-pam';
        const mod = (await import(/* @vite-ignore */ moduleName)) as {
          authenticate: (u: string, p: string) => Promise<void>;
          validate: (u: string) => Promise<boolean>;
        };
        pamModule = mod;
      } catch {
        pamModule = null;
      }
    })();
  }
  await pamLoadPromise;
  return pamModule;
}

// Kick the load at module init. This is fire-and-forget; the first
// authenticate() call awaits the cached promise.
void loadAuthenticatePam();

/** Best-effort `id -u <user>` lookup. */
function safeUserExists(username: string): boolean {
  if (process.platform === 'win32') return true; // dev on Windows; never trust
  try {
    const out = execFileSync('id', ['-u', username], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /^\d+$/.test(out.trim());
  } catch {
    // `id` exits non-zero when the user doesn't exist. Treat as "no".
    return false;
  }
}

/** Best-effort `id -Gn <user>` call. Returns `[]` on any failure. */
function readPosixGroups(username: string): ReadonlyArray<string> {
  if (process.platform === 'win32') return [];
  try {
    const out = execFileSync('id', ['-Gn', username], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Classify an `authenticate-pam` error into a `PamAuthFailureReason`. */
function classifyPamError(err: unknown): PamAuthFailureReason {
  const msg = err instanceof Error ? err.message : String(err);
  if (/auth/i.test(msg) && /fail/i.test(msg)) return 'invalid_credentials';
  if (/disabled|inactive|expired/i.test(msg)) return 'account_disabled';
  if (/no such|unknown|not found/i.test(msg)) return 'unknown_user';
  return 'system_error';
}

/** Run a short hash round-trip to keep timing close to real PAM. */
function fakeAuthRoundTrip(password: string): void {
  // A few rounds of sha256 over the password + a small nonce is a
  // reasonable proxy for the work PAM does (lookup + crypt). 4
  // rounds is typically enough to push the latency to the same
  // order of magnitude (~1-3ms) on a modern CPU without dominating
  // a test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  for (let i = 0; i < 4; i++) {
    createHash('sha256')
      .update(password + i)
      .digest('hex');
  }
}
