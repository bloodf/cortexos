/**
 * /api/env-browser — read env vars from the host filesystem.
 *
 * PB-3 FIX (THREAT_MODEL §1.2 surface 8, T-070..T-074):
 *   - requireAdmin on every read
 *   - Path allowlist with realpath resolution (SR-073)
 *   - Masking by default; reveal requires approval token (SR-071)
 *
 * M1 endpoints:
 *   - GET  /api/env-browser?path=/opt/cortexos/.secrets/cortexos.env
 *
 * M1 implementation: in-memory path-allowlist + value store. The real
 * filesystem read + symlink resolution lands in M3 (gated on the same
 * allowlist as the existing `src/lib/secrets/allowlist.ts`).
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { notFoundError, permissionError, approvalRequiredError } from '$lib/server/errors/types';

const QueryInput = z.object({
  path: z.string().min(1).max(2048),
  reveal: z.coerce.boolean().default(false),
});

/** Path allowlist — must be resolved + checked after realpath. */
const ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/opt/cortexos/.secrets/',
  '/opt/cortexos/stacks/',
];

/** In-memory stub: maps path → key=value lines. M3 reads from real fs. */
const envFiles = new Map<string, ReadonlyArray<{ key: string; value: string; masked: string }>>();

/** Test helper: register an env file. */
export function _registerEnvFile(
  path: string,
  entries: ReadonlyArray<{ key: string; value: string }>,
): void {
  envFiles.set(
    path,
    entries.map((e) => ({
      key: e.key,
      value: e.value,
      masked: maskValue(e.key, e.value),
    })),
  );
}

const SECRET_KEY_RE = new RegExp(
  '(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|session[_-]?id|cookie|authorization|bearer)',
  'i',
);

/** Mask a value if its key matches a secret pattern, otherwise return as-is. */
function maskValue(key: string, value: string): string {
  if (SECRET_KEY_RE.test(key)) {
    if (value.length <= 4) return '••••';
    return `••••••••${value.slice(-4)}`;
  }
  // Entropy-based fallback — kept simple for the M1 stub.
  if (value.length >= 40 && /^[A-Za-z0-9+/=_-]+$/.test(value)) {
    return `••••••••${value.slice(-4)}`;
  }
  return value;
}

function isPathAllowed(path: string): boolean {
  for (const prefix of ALLOWED_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export const GET = defineRoute({
  methods: ['GET'],
  input: QueryInput,
  auth: 'admin', // PB-3 FIX: admin gate, not just any authed user.
  surface: 'env-browser',
  action: 'env-browser.read',
  target: (i) => i.path,
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    // SR-073: check against the allowlist after realpath resolution.
    // M1 doesn't do realpath — we apply the simple prefix check. M3
    // swaps in realpathSync + post-resolution re-check.
    if (!isPathAllowed(input.path)) {
      throw permissionError(`Path not in allowlist: ${input.path}`);
    }

    const entries = envFiles.get(input.path);
    if (!entries) {
      throw notFoundError(`Env file not found: ${input.path}`, 'env_file');
    }

    // SR-071: reveal requires an approval token. M1 throws
    // approval_required unless the caller has indicated a valid token
    // (header x-cortex-approval-token).
    if (input.reveal) {
      // The real flow:
      //   1. verifyApproval(token, sessionId)
      //   2. on ok, return the unmasked value
      // M1 stub: just throw.
      throw approvalRequiredError(`env.reveal:${input.path}`, 300);
    }

    // Return masked values.
    return {
      path: input.path,
      entries: entries.map(({ key, masked }) => ({ key, value: masked, masked: true })),
    };
  },
});
