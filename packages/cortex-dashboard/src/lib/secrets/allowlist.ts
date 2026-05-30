/**
 * Path allowlist for live VPS env-file IO.
 *
 * Security model: dashboard reads/writes real files on the host filesystem.
 * Every IO path must be normalized, expanded, symlink-resolved, and matched
 * against an explicit allowlist before any read/write occurs.
 *
 * Allowed roots (from plan §3.5):
 *   - /opt/cortexos/.secrets/**
 *   - /opt/cortexos/stacks/<stack>/**
 *   - /etc/systemd/system/*.d/**  (overrides only, never the .service file)
 *
 * Test override: when NODE_ENV !== 'production', the env var
 * __TEST_ALLOW_PREFIX__ may add an additional absolute prefix (used by
 * the unit tests that operate inside an OS tmpdir).
 */

import fs from 'node:fs';
import path from 'node:path';

export interface PathDeniedError extends Error {
  code: 'EPATHDENIED';
}

const ENV_TEST_OVERRIDE = '__TEST_ALLOW_PREFIX__';

function makeDenied(reason: string): PathDeniedError {
  const err = new Error(`Path denied: ${reason}`) as PathDeniedError;
  err.code = 'EPATHDENIED';
  return err;
}

/**
 * Public list of allowed prefixes / exact paths.
 * Each entry is matched against the resolved absolute path.
 *
 */
export const ALLOWED_PREFIXES: ReadonlyArray<
  | { kind: 'prefix'; value: string }
  | { kind: 'exact'; value: string }
  | { kind: 'systemd-override'; value: string }
> = Object.freeze([
  { kind: 'prefix', value: '/opt/cortexos/.secrets/' },
  { kind: 'prefix', value: '/opt/cortexos/stacks/' },
  { kind: 'systemd-override', value: '/etc/systemd/system/' },
]);

/**
 * Expand a leading `~` to $HOME. Pure.
 */
export function expandHome(p: string): string {
  if (p === '~') return process.env.HOME ?? '/';
  if (p.startsWith('~/')) return path.join(process.env.HOME ?? '/', p.slice(2));
  return p;
}

/**
 * Canonical systemd path after symlink resolution.
 * On macOS /etc → /private/etc, so we accept both.
 */
const SYSTEMD_PREFIXES = ['/etc/systemd/system/', '/private/etc/systemd/system/'];

/**
 * Returns true if path lives under /etc/systemd/system and is inside a `.d/`
 * override directory (never the bare .service file itself).
 * Accepts both /etc/... and /private/etc/... to handle macOS symlink resolution.
 */
function isSystemdOverride(absPath: string): boolean {
  const prefix = SYSTEMD_PREFIXES.find(p => absPath.startsWith(p));
  if (!prefix) return false;
  const rest = absPath.slice(prefix.length);
  // Must contain a segment ending in `.d` followed by `/`.
  return /(^|\/)[^/]+\.d\//.test(rest);
}

/**
 * Returns true if any path component is exactly `..`.
 */
function hasParentTraversal(p: string): boolean {
  return p.split('/').some(seg => seg === '..');
}

function getTestOverride(): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  const v = process.env[ENV_TEST_OVERRIDE];
  if (!v) return null;
  // Must itself be absolute.
  if (!path.isAbsolute(v)) return null;
  return v.endsWith('/') ? v : v + '/';
}

/**
 * Throws PathDeniedError if `absPath` is outside the allowlist.
 * Performs (in order):
 *   1. NUL-byte rejection
 *   2. `..` segment rejection (pre-normalize, defense-in-depth)
 *   3. `~` expansion + normalization + absolute-ness check
 *   4. `fs.realpathSync` symlink resolution (if exists)
 *   5. Prefix / exact match against ALLOWED_PREFIXES
 */
export function assertPathAllowed(inputPath: string): void {
  if (typeof inputPath !== 'string' || inputPath.length === 0) {
    throw makeDenied('empty path');
  }
  if (inputPath.includes('\0')) {
    throw makeDenied('NUL byte in path');
  }
  if (hasParentTraversal(inputPath)) {
    throw makeDenied('parent traversal segment');
  }

  const expanded = expandHome(inputPath);
  const normalized = path.normalize(expanded);
  if (!path.isAbsolute(normalized)) {
    throw makeDenied('not absolute');
  }
  if (hasParentTraversal(normalized)) {
    throw makeDenied('parent traversal after normalize');
  }

  // Resolve symlinks if the path exists; non-existent paths are allowed for
  // first-time writes — we then validate the parent directory.
  let resolved = normalized;
  try {
    resolved = fs.realpathSync(normalized);
  } catch {
    // Path doesn't exist yet. Resolve realpath of its existing ancestor and
    // append the remaining tail, so a symlinked allowed dir still matches.
    resolved = resolveExistingAncestor(normalized);
  }

  if (!matchesAllowlist(resolved)) {
    throw makeDenied(`outside allowlist: ${resolved}`);
  }
}

function resolveExistingAncestor(absPath: string): string {
  const segments = absPath.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const prefix = '/' + segments.slice(0, i).join('/');
    try {
      const real = fs.realpathSync(prefix);
      const tail = segments.slice(i).join('/');
      return tail ? path.join(real, tail) : real;
    } catch {
      // continue up
    }
  }
  return absPath;
}

function matchesAllowlist(absPath: string): boolean {
  const testOverride = getTestOverride();
  if (testOverride && absPath.startsWith(testOverride)) return true;

  for (const entry of ALLOWED_PREFIXES) {
    if (entry.kind === 'exact' && absPath === entry.value) return true;
    if (entry.kind === 'prefix' && absPath.startsWith(entry.value)) return true;
    if (entry.kind === 'systemd-override' && isSystemdOverride(absPath)) return true;
  }
  return false;
}
