import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvFile, readEnvFile, isSecretKey } from '../vps-reader';

let tmpRoot: string;
const ORIG_OVERRIDE = process.env.__TEST_ALLOW_PREFIX__;

beforeAll(async () => {
  // Resolve symlinks so the prefix matches what realpathSync returns on macOS
  // (/var/folders/... → /private/var/folders/...).
  tmpRoot = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), 'cortex-test-reader-')),
  );
});

afterAll(async () => {
  if (ORIG_OVERRIDE === undefined) delete process.env.__TEST_ALLOW_PREFIX__;
  else process.env.__TEST_ALLOW_PREFIX__ = ORIG_OVERRIDE;
  await fsp.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.__TEST_ALLOW_PREFIX__ = tmpRoot;
});

describe('parseEnvFile', () => {
  it('parses simple KEY=value', () => {
    const out = parseEnvFile('FOO=bar\n');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ line: 1, type: 'kv', key: 'FOO', value: 'bar' });
  });

  it('parses double-quoted values with escapes', () => {
    const out = parseEnvFile('FOO="hello \\"world\\""\n');
    expect(out[0].value).toBe('hello "world"');
  });

  it('parses single-quoted values literally', () => {
    const out = parseEnvFile("FOO='ab\\nc'\n");
    expect(out[0].value).toBe('ab\\nc');
  });

  it('parses export prefix', () => {
    const out = parseEnvFile('export PATH=/usr/bin\n');
    expect(out[0]).toMatchObject({ key: 'PATH', value: '/usr/bin', exported: true });
  });

  it('preserves comments and blank lines with line numbers', () => {
    const out = parseEnvFile('# header\n\nKEY=val\n');
    expect(out[0]).toMatchObject({ line: 1, type: 'comment' });
    expect(out[1]).toMatchObject({ line: 2, type: 'blank' });
    expect(out[2]).toMatchObject({ line: 3, type: 'kv', key: 'KEY', value: 'val' });
  });

  it('strips trailing inline comments from unquoted values', () => {
    const out = parseEnvFile('FOO=bar # inline\n');
    expect(out[0].value).toBe('bar');
  });

  it('throws EENVPARSE on invalid key', () => {
    expect(() => parseEnvFile('1BAD=x\n')).toThrowError(/invalid key/);
  });

  it('throws EENVPARSE when = is missing', () => {
    expect(() => parseEnvFile('NOEQ\n')).toThrowError(/missing '='/);
  });
});

describe('isSecretKey', () => {
  it.each([
    'API_TOKEN',
    'DB_PASSWORD',
    'JWT_SECRET',
    'HMAC_KEY',
    'BEARER_TOKEN',
    'OPENAI_API_KEY',
    'CREDENTIAL_FILE',
    'PASSPHRASE',
  ])('masks %s', k => {
    expect(isSecretKey(k)).toBe(true);
  });

  it.each(['PORT', 'HOST', 'DEBUG', 'LOG_LEVEL'])('does not mask %s', k => {
    expect(isSecretKey(k)).toBe(false);
  });
});

describe('readEnvFile', () => {
  it('masks values for secret-shaped keys, fixed length', async () => {
    const file = path.join(tmpRoot, 'a.env');
    await fsp.writeFile(file, 'API_KEY=supersecretvalue\nPORT=3080\n');
    const out = await readEnvFile(file);
    const apiKey = out.find(l => l.key === 'API_KEY');
    const port = out.find(l => l.key === 'PORT');
    expect(apiKey?.value).toBe('supersecretvalue');
    expect(apiKey?.masked).toBe('••••••••');
    expect(port?.masked).toBeUndefined();
  });

  it('rejects paths outside the allowlist', async () => {
    delete process.env.__TEST_ALLOW_PREFIX__;
    await expect(readEnvFile('/etc/passwd')).rejects.toThrowError(/Path denied/);
  });

  it('returns empty-string masked when secret value is empty', async () => {
    const file = path.join(tmpRoot, 'b.env');
    await fsp.writeFile(file, 'API_KEY=\n');
    const out = await readEnvFile(file);
    expect(out[0].masked).toBe('');
  });
});
