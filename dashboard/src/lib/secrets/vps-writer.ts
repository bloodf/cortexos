/**
 * Live VPS env-file writer.
 *
 * Read-modify-write under a file-based advisory lock (`<path>.lock`) with
 * atomic replace via `rename(2)`. Preserves comments, blank lines, and the
 * original ordering of unchanged keys. New keys are appended at the end.
 * Returns sha256 of file content before and after the write so the caller
 * can persist them in `agent_gateway_audit`.
 *
 * NOTE: `proper-lockfile` is not a project dependency, so we implement a
 * lockfile-based advisory lock here. If `proper-lockfile` is added later,
 * swap `acquireLock` to use it.
 */

import { createHash } from 'node:crypto';
import { promises as fsp, type Stats } from 'node:fs';
import path from 'node:path';
import { assertPathAllowed } from './allowlist';
import { parseEnvFile, type EnvLine } from './vps-reader';

export interface EnvUpdate {
  readonly key: string;
  /** `null` deletes the key. */
  readonly value: string | null;
}

export interface WriteResult {
  readonly beforeSha256: string;
  readonly afterSha256: string;
}

export interface EnvKeyError extends Error {
  code: 'EENVKEY';
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

function makeKeyError(msg: string): EnvKeyError {
  const err = new Error(msg) as EnvKeyError;
  err.code = 'EENVKEY';
  return err;
}

function sha256(buf: string | Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function validateUpdates(updates: readonly EnvUpdate[]): void {
  for (const u of updates) {
    if (!u || typeof u.key !== 'string') throw makeKeyError('update missing key');
    if (u.key.length === 0) throw makeKeyError('empty key');
    if (/\s/.test(u.key)) throw makeKeyError(`whitespace in key: ${JSON.stringify(u.key)}`);
    if (u.key.includes('=')) throw makeKeyError(`'=' in key: ${JSON.stringify(u.key)}`);
    if (!KEY_PATTERN.test(u.key)) throw makeKeyError(`invalid key: ${JSON.stringify(u.key)}`);
    if (u.value !== null && typeof u.value !== 'string') {
      throw makeKeyError(`value must be string or null for ${u.key}`);
    }
  }
}

/**
 * Serialize a value back to env-file syntax. Quotes with double quotes when
 * the value contains whitespace, `#`, quotes, or backslashes; escapes inner
 * quotes and backslashes. Empty string serializes as bare `KEY=`.
 */
export function serializeValue(value: string): string {
  if (value.length === 0) return '';
  const needsQuote = /[\s"'#\\$`]/.test(value);
  if (!needsQuote) return value;
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Pure: apply updates to a parsed env file and return the new file content
 * (including a trailing newline). Preserves original ordering, comments,
 * blank lines, and the `export` prefix for keys that already used it.
 */
export function applyUpdates(
  original: readonly EnvLine[],
  updates: readonly EnvUpdate[],
): string {
  const updateMap = new Map<string, string | null>();
  for (const u of updates) updateMap.set(u.key, u.value);

  const handled = new Set<string>();
  const outLines: string[] = [];

  for (const line of original) {
    if (line.type !== 'kv' || !line.key) {
      outLines.push(line.raw);
      continue;
    }
    if (!updateMap.has(line.key)) {
      outLines.push(line.raw);
      continue;
    }
    const nextValue = updateMap.get(line.key) ?? null;
    handled.add(line.key);
    if (nextValue === null) {
      // delete: skip line entirely
      continue;
    }
    const prefix = line.exported ? 'export ' : '';
    outLines.push(`${prefix}${line.key}=${serializeValue(nextValue)}`);
  }

  // Append new keys (those in updates but not present in file).
  for (const u of updates) {
    if (handled.has(u.key)) continue;
    if (u.value === null) continue; // deleting a non-existent key is a no-op
    outLines.push(`${u.key}=${serializeValue(u.value)}`);
  }

  return outLines.join('\n') + '\n';
}

interface LockHandle {
  readonly lockPath: string;
  release(): Promise<void>;
}

async function acquireLock(targetPath: string): Promise<LockHandle> {
  const lockPath = `${targetPath}.lock`;
  const start = Date.now();
  // Ensure parent dir exists for the lockfile.
  await fsp.mkdir(path.dirname(lockPath), { recursive: true });

  while (true) {
    try {
      const handle = await fsp.open(lockPath, 'wx');
      await handle.writeFile(String(process.pid));
      await handle.close();
      return {
        lockPath,
        release: async () => {
          try {
            await fsp.unlink(lockPath);
          } catch {
            /* lock already removed */
          }
        },
      };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') throw err;
      // Check for stale lock.
      try {
        const stat = await fsp.stat(lockPath);
        const age = Date.now() - stat.mtimeMs;
        if (age > LOCK_STALE_MS) {
          await fsp.unlink(lockPath).catch(() => undefined);
          continue;
        }
      } catch {
        // race: lock disappeared; retry immediately
        continue;
      }
      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        throw new Error(`timed out acquiring lock: ${lockPath}`);
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function preserveOwner(
  targetPath: string,
  stat: Stats,
): Promise<void> {
  try {
    await fsp.chown(targetPath, stat.uid, stat.gid);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'EPERM') {
      // Non-root dev environments: chown not permitted. Skip silently;
      // production deployment runs as the file owner.
      return;
    }
    throw err;
  }
}

/**
 * IO: atomically apply updates to an env file. Holds an advisory lock
 * (`<path>.lock`) for the duration of the read-modify-write. Preserves
 * the original mode and (best-effort) ownership.
 *
 * Returns the sha256 of the file content before and after the write.
 *
 * Throws:
 *   - `EPATHDENIED` if `absPath` is outside the allowlist.
 *   - `EENVKEY`     if any update has an invalid key.
 *   - Native fs errors otherwise (propagated, never swallowed).
 */
export async function writeEnvFile(
  absPath: string,
  updates: readonly EnvUpdate[],
): Promise<WriteResult> {
  assertPathAllowed(absPath);
  validateUpdates(updates);

  const lock = await acquireLock(absPath);
  try {
    let beforeContent = '';
    let stat: Stats | null = null;
    try {
      stat = await fsp.stat(absPath);
      beforeContent = await fsp.readFile(absPath, 'utf8');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') throw err;
      // First-time write: file doesn't exist yet.
    }

    const beforeSha256 = sha256(beforeContent);
    const parsed = parseEnvFile(beforeContent);
    const nextContent = applyUpdates(parsed, updates);

    const tmpPath = `${absPath}.tmp`;
    const mode = stat ? stat.mode & 0o7777 : 0o600;

    // H-4: open with O_CREAT|O_EXCL|O_WRONLY and explicit mode so the tmp
    // file never exists with looser umask-applied permissions. Chmod again
    // immediately to defeat any umask interference, then chown — all BEFORE
    // the rename so the final file lands fully permissioned in one syscall.
    const handle = await fsp.open(tmpPath, 'wx', mode);
    try {
      await handle.writeFile(nextContent);
    } finally {
      await handle.close();
    }
    await fsp.chmod(tmpPath, mode);
    if (stat) await preserveOwner(tmpPath, stat);

    // H-4: afterSha256 is computed from the in-memory buffer we just wrote,
    // NOT by re-reading the file after rename. The contract is "what we
    // wrote", not "what is on disk now" — eliminating a TOCTOU window where
    // another process could replace the file between rename(2) and re-read.
    const afterSha256 = sha256(nextContent);

    await fsp.rename(tmpPath, absPath);

    return { beforeSha256, afterSha256 };
  } finally {
    await lock.release();
  }
}
