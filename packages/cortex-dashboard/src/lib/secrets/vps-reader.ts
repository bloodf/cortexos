/**
 * Live VPS env-file reader.
 *
 * Parses POSIX env-file format and applies key-based masking. Caller controls
 * reveal (and is responsible for writing an `agent_gateway_audit` row when
 * unmasked values are accessed via `readEnvFileRaw`).
 */

import { promises as fsp } from 'node:fs';
import { assertPathAllowed } from './allowlist';

export type EnvLineType = 'kv' | 'comment' | 'blank';

export interface EnvLine {
  readonly line: number;
  readonly raw: string;
  readonly type: EnvLineType;
  readonly key?: string;
  readonly value?: string;
  readonly exported?: boolean;
}

export interface EnvLineWithMask extends EnvLine {
  readonly masked?: string;
}

export interface ParseError extends Error {
  code: 'EENVPARSE';
  line: number;
}

const MASK_PATTERN =
  /(token|secret|password|key|api|hmac|jwt|bearer|credential|passphrase)/i;

const MASK_DOTS = '••••••••';

/**
 * Return true if a key should be masked when surfaced to the UI.
 * Pure.
 */
export function isSecretKey(key: string): boolean {
  return MASK_PATTERN.test(key);
}

/**
 * Pure: parse env-file content. No IO.
 * Preserves line numbers (1-indexed) and the original raw line text so the
 * writer can round-trip unchanged content byte-for-byte.
 */
export function parseEnvFile(content: string): readonly EnvLine[] {
  const out: EnvLine[] = [];
  // Split on \n; keep \r in raw if present.
  const lines = content.split('\n');
  // Drop trailing empty element produced by a trailing newline so we don't
  // record a spurious blank line; callers serializing back will re-add it.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      out.push({ line: lineNo, raw, type: 'blank' });
      continue;
    }
    if (trimmed.startsWith('#')) {
      out.push({ line: lineNo, raw, type: 'comment' });
      continue;
    }

    const parsed = parseKvLine(trimmed, lineNo);
    out.push({
      line: lineNo,
      raw,
      type: 'kv',
      key: parsed.key,
      value: parsed.value,
      exported: parsed.exported,
    });
  }

  return Object.freeze(out);
}

interface KvParts {
  key: string;
  value: string;
  exported: boolean;
}

function parseKvLine(trimmed: string, lineNo: number): KvParts {
  let work = trimmed;
  let exported = false;
  if (work.startsWith('export ')) {
    exported = true;
    work = work.slice('export '.length).trimStart();
  }

  const eq = work.indexOf('=');
  if (eq <= 0) {
    throw makeParseError(`missing '=' in env line`, lineNo);
  }
  const key = work.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw makeParseError(`invalid key: ${JSON.stringify(key)}`, lineNo);
  }
  const rawValue = work.slice(eq + 1);
  const value = unquoteValue(rawValue, lineNo);
  return { key, value, exported };
}

function unquoteValue(v: string, lineNo: number): string {
  // Strip trailing inline comment for unquoted values: `KEY=val # cmt`.
  // For quoted values, the closing quote ends the literal.
  const s = v.trimStart();
  if (s.length === 0) return '';

  const q = s[0];
  if (q === '"' || q === "'") {
    const end = findClosingQuote(s, q);
    if (end < 0) {
      // L-1: never silently strip an unterminated quote — writer round-trip
      // would corrupt the file. Surface as a parse error.
      throw makeParseError(`unterminated ${q === '"' ? 'double' : 'single'} quote`, lineNo);
    }
    const inner = s.slice(1, end);
    return q === '"' ? unescapeDoubleQuoted(inner) : inner;
  }
  // Unquoted: cut at first ` #` (space + hash) for inline comments.
  const hashIdx = s.search(/\s+#/);
  const rawTail = hashIdx >= 0 ? s.slice(0, hashIdx) : s;
  return rawTail.trim();
}

function findClosingQuote(s: string, q: string): number {
  for (let i = 1; i < s.length; i++) {
    if (s[i] === '\\' && q === '"') {
      i++;
      continue;
    }
    if (s[i] === q) return i;
  }
  return -1;
}

function unescapeDoubleQuoted(inner: string): string {
  return inner.replace(/\\(["\\nrt$])/g, (_, c) => {
    switch (c) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return c;
    }
  });
}

function makeParseError(msg: string, line: number): ParseError {
  const err = new Error(`${msg} (line ${line})`) as ParseError;
  err.code = 'EENVPARSE';
  err.line = line;
  return err;
}

function applyMask(line: EnvLine): EnvLineWithMask {
  if (line.type !== 'kv' || !line.key) return line;
  if (!isSecretKey(line.key)) return line;
  const masked = (line.value && line.value.length > 0) ? MASK_DOTS : '';
  return { ...line, masked };
}

/**
 * IO: read an env file from disk, parse, and apply masking by default.
 * The returned objects expose `value` (real value) and `masked` (UI-safe).
 * Callers rendering to non-admin contexts MUST use `masked` when present.
 *
 * Throws `EPATHDENIED` if the path is outside the allowlist.
 */
export async function readEnvFile(absPath: string): Promise<readonly EnvLineWithMask[]> {
  assertPathAllowed(absPath);
  const content = await fsp.readFile(absPath, 'utf8');
  const parsed = parseEnvFile(content);
  return Object.freeze(parsed.map(applyMask));
}

/**
 * IO: read an env file with no masking applied. Intended ONLY for the
 * env-writer's read-modify-write cycle. Callers MUST write an
 * `agent_gateway_audit` row recording the access before invoking this.
 *
 * @internal
 */
export async function readEnvFileRaw(
  absPath: string,
  opts: { reveal: true },
): Promise<readonly EnvLine[]> {
  if (!opts || opts.reveal !== true) {
    throw new Error('readEnvFileRaw requires { reveal: true }');
  }
  assertPathAllowed(absPath);
  const content = await fsp.readFile(absPath, 'utf8');
  return parseEnvFile(content);
}
