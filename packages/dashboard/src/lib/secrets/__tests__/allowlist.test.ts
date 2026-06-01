import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertPathAllowed, expandHome } from '../allowlist';

const ORIG_HOME = process.env.HOME;
const ORIG_OVERRIDE = process.env.__TEST_ALLOW_PREFIX__;

let tmpRoot: string;

beforeAll(async () => {
  // Resolve symlinks so the prefix matches what realpathSync returns on macOS
  // (/var/folders/... → /private/var/folders/...).
  tmpRoot = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), 'cortex-test-allowlist-')),
  );
});

afterAll(async () => {
  process.env.HOME = ORIG_HOME;
  if (ORIG_OVERRIDE === undefined) delete process.env.__TEST_ALLOW_PREFIX__;
  else process.env.__TEST_ALLOW_PREFIX__ = ORIG_OVERRIDE;
  await fsp.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.__TEST_ALLOW_PREFIX__;
});

describe('expandHome', () => {
  it('expands ~ to HOME', () => {
    process.env.HOME = '/home/cortex';
    expect(expandHome('~/foo')).toBe('/home/cortex/foo');
    expect(expandHome('~')).toBe('/home/cortex');
    expect(expandHome('/abs/path')).toBe('/abs/path');
  });
});

describe('assertPathAllowed — allowed', () => {
  it('passes /opt/cortexos/.secrets/* paths', () => {
    expect(() => assertPathAllowed('/opt/cortexos/.secrets/9router.env')).not.toThrow();
  });

  it('passes /opt/cortexos/stacks/<x>/* paths', () => {
    expect(() => assertPathAllowed('/opt/cortexos/stacks/postgres/docker-compose.yml')).not.toThrow();
  });

  it('passes systemd .d/override.conf paths', () => {
    expect(() =>
      assertPathAllowed('/etc/systemd/system/cortex.service.d/override.conf'),
    ).not.toThrow();
  });

  it('rejects home-directory agent config outside the allowlist', () => {
    process.env.HOME = '/home/cortex';
    expect(() => assertPathAllowed('~/.agent-runtime/config.json')).toThrowError(/Path denied/);
  });

  it('passes paths under __TEST_ALLOW_PREFIX__ override', () => {
    process.env.__TEST_ALLOW_PREFIX__ = tmpRoot;
    const target = path.join(tmpRoot, 'a.env');
    expect(() => assertPathAllowed(target)).not.toThrow();
  });
});

describe('assertPathAllowed — denied', () => {
  it('rejects paths outside the allowlist', () => {
    expect(() => assertPathAllowed('/etc/passwd')).toThrowError(/Path denied/);
  });

  it('rejects bare /etc/systemd/system/*.service files (not in .d)', () => {
    expect(() =>
      assertPathAllowed('/etc/systemd/system/cortex.service'),
    ).toThrowError(/Path denied/);
  });

  it('rejects paths containing .. segments', () => {
    expect(() =>
      assertPathAllowed('/opt/cortexos/.secrets/../../etc/shadow'),
    ).toThrowError(/parent traversal/);
  });

  it('rejects NUL bytes', () => {
    expect(() => assertPathAllowed('/opt/cortexos/.secrets/x\0y')).toThrowError(/NUL/);
  });

  it('rejects empty string', () => {
    expect(() => assertPathAllowed('')).toThrowError(/Path denied/);
  });

  it('rejects relative paths', () => {
    expect(() => assertPathAllowed('foo.env')).toThrowError(/Path denied/);
  });

  it('rejects symlink that points outside the allowlist', async () => {
    // tmp/allowed-link -> /etc — should still be rejected even with override
    // unrelated, because the resolved target is /etc.
    process.env.__TEST_ALLOW_PREFIX__ = tmpRoot;
    const linkPath = path.join(tmpRoot, 'escape');
    await fsp.symlink('/etc', linkPath).catch(async () => {
      // some CIs disallow symlinks; skip in that case
    });
    try {
      await fsp.lstat(linkPath);
    } catch {
      return; // no symlink support
    }
    const probe = path.join(linkPath, 'passwd');
    expect(() => assertPathAllowed(probe)).toThrowError(/Path denied/);
  });
});
