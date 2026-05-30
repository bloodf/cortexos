import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { writeEnvFile, applyUpdates, serializeValue } from '../vps-writer';
import { parseEnvFile } from '../vps-reader';

let tmpRoot: string;
const ORIG_OVERRIDE = process.env.__TEST_ALLOW_PREFIX__;

beforeAll(async () => {
  // Resolve symlinks so the prefix matches what realpathSync returns on macOS
  // (/var/folders/... → /private/var/folders/...).
  tmpRoot = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), 'cortex-test-writer-')),
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

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

describe('serializeValue', () => {
  it('leaves simple tokens unquoted', () => {
    expect(serializeValue('abc')).toBe('abc');
    expect(serializeValue('/usr/bin')).toBe('/usr/bin');
  });

  it('quotes values with whitespace', () => {
    expect(serializeValue('hello world')).toBe('"hello world"');
  });

  it('escapes inner double quotes and backslashes', () => {
    expect(serializeValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it('serializes empty as bare empty', () => {
    expect(serializeValue('')).toBe('');
  });
});

describe('applyUpdates (pure)', () => {
  it('updates existing keys in place', () => {
    const parsed = parseEnvFile('A=1\nB=2\n');
    const out = applyUpdates(parsed, [{ key: 'A', value: '99' }]);
    expect(out).toBe('A=99\nB=2\n');
  });

  it('appends new keys at end', () => {
    const parsed = parseEnvFile('A=1\n');
    const out = applyUpdates(parsed, [{ key: 'B', value: '2' }]);
    expect(out).toBe('A=1\nB=2\n');
  });

  it('deletes keys when value=null', () => {
    const parsed = parseEnvFile('A=1\nB=2\nC=3\n');
    const out = applyUpdates(parsed, [{ key: 'B', value: null }]);
    expect(out).toBe('A=1\nC=3\n');
  });

  it('preserves comments and blank lines', () => {
    const parsed = parseEnvFile('# header\n\nA=1\n');
    const out = applyUpdates(parsed, [{ key: 'A', value: '2' }]);
    expect(out).toBe('# header\n\nA=2\n');
  });

  it('preserves export prefix', () => {
    const parsed = parseEnvFile('export A=1\n');
    const out = applyUpdates(parsed, [{ key: 'A', value: '2' }]);
    expect(out).toBe('export A=2\n');
  });
});

describe('writeEnvFile (io)', () => {
  it('writes a new key and returns before/after sha256', async () => {
    const file = path.join(tmpRoot, 'w1.env');
    await fsp.writeFile(file, 'A=1\n');

    const { beforeSha256, afterSha256 } = await writeEnvFile(file, [
      { key: 'B', value: '2' },
    ]);

    expect(beforeSha256).toBe(sha256('A=1\n'));
    const content = await fsp.readFile(file, 'utf8');
    expect(content).toBe('A=1\nB=2\n');
    expect(afterSha256).toBe(sha256(content));
  });

  it('updates an existing key', async () => {
    const file = path.join(tmpRoot, 'w2.env');
    await fsp.writeFile(file, 'API_KEY=old\n');
    await writeEnvFile(file, [{ key: 'API_KEY', value: 'new' }]);
    expect(await fsp.readFile(file, 'utf8')).toBe('API_KEY=new\n');
  });

  it('deletes a key when value=null', async () => {
    const file = path.join(tmpRoot, 'w3.env');
    await fsp.writeFile(file, 'A=1\nB=2\n');
    await writeEnvFile(file, [{ key: 'A', value: null }]);
    expect(await fsp.readFile(file, 'utf8')).toBe('B=2\n');
  });

  it('preserves file mode across writes', async () => {
    const file = path.join(tmpRoot, 'w4.env');
    await fsp.writeFile(file, 'A=1\n', { mode: 0o600 });
    await fsp.chmod(file, 0o600);
    await writeEnvFile(file, [{ key: 'A', value: '2' }]);
    const stat = await fsp.stat(file);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('atomic: no .tmp or .lock left behind after success', async () => {
    const file = path.join(tmpRoot, 'w5.env');
    await fsp.writeFile(file, 'A=1\n');
    await writeEnvFile(file, [{ key: 'A', value: '2' }]);
    await expect(fsp.stat(`${file}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fsp.stat(`${file}.lock`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('creates the file on first write (no prior content)', async () => {
    const file = path.join(tmpRoot, 'w6-new.env');
    const { beforeSha256, afterSha256 } = await writeEnvFile(file, [
      { key: 'A', value: '1' },
    ]);
    expect(beforeSha256).toBe(sha256(''));
    expect(afterSha256).toBe(sha256('A=1\n'));
  });

  it('rejects denied paths', async () => {
    delete process.env.__TEST_ALLOW_PREFIX__;
    await expect(
      writeEnvFile('/etc/passwd', [{ key: 'A', value: '1' }]),
    ).rejects.toThrowError(/Path denied/);
  });

  it('rejects invalid keys with EENVKEY', async () => {
    const file = path.join(tmpRoot, 'w7.env');
    await fsp.writeFile(file, 'A=1\n');
    await expect(
      writeEnvFile(file, [{ key: 'BAD KEY', value: '1' }]),
    ).rejects.toMatchObject({ code: 'EENVKEY' });
    await expect(
      writeEnvFile(file, [{ key: '', value: '1' }]),
    ).rejects.toMatchObject({ code: 'EENVKEY' });
    await expect(
      writeEnvFile(file, [{ key: 'A=B', value: '1' }]),
    ).rejects.toMatchObject({ code: 'EENVKEY' });
  });
});
