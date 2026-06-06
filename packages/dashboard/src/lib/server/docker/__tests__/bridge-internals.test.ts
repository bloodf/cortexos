/**
 * docker-bridge-internals.test.ts — coverage of the internal helpers
 * + pure-function paths in bridge.ts.
 *
 * Tests pure / deterministic functions only — collectArgSmugglingHits,
 * argvContainsBashDashC, renderArgv, hasSmugglingPattern, listDockerOps.
 * The dispatch() rejection paths are covered by the route-level tests
 * (docker-exec-route.test.ts) which exercise the full PB-2 / PB-5
 * gate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  _internals,
  _STUB_MARKER,
  listDockerOps,
} from '../bridge';
import { resetAudit } from '../../audit';
import type { AllowlistEntry } from '../../policy';

const {
  collectArgSmugglingHits,
  argvContainsBashDashC,
  renderArgv,
  hasSmugglingPattern,
} = _internals;

beforeEach(() => {
  resetAudit();
});

describe('docker bridge — collectArgSmugglingHits (recursion)', () => {
  it('returns no hits for a clean string', () => {
    const hits: { field: string; reason: string; matched: string }[] = [];
    collectArgSmugglingHits('hello', 'f', hits);
    expect(hits).toEqual([]);
  });

  it('flags a string with a metacharacter', () => {
    const hits: { field: string; reason: string; matched: string }[] = [];
    collectArgSmugglingHits('foo|bar', 'f', hits);
    expect(hits.length).toBe(1);
    expect(hits[0]!.field).toBe('f');
  });

  it('walks nested objects and reports the dotted field path', () => {
    const hits: { field: string; reason: string; matched: string }[] = [];
    collectArgSmugglingHits({ outer: { inner: 'bad;arg' } }, '', hits);
    expect(hits.length).toBe(1);
    expect(hits[0]!.field).toBe('outer.inner');
  });

  it('walks arrays with bracketed index in the path', () => {
    const hits: { field: string; reason: string; matched: string }[] = [];
    collectArgSmugglingHits({ list: ['ok', 'bad;arg'] }, '', hits);
    expect(hits.length).toBe(1);
    expect(hits[0]!.field).toBe('list[1]');
  });

  it('skips numbers, booleans, and null at the leaves', () => {
    const hits: { field: string; reason: string; matched: string }[] = [];
    collectArgSmugglingHits(
      { n: 42, b: true, z: null, ok: 'hello' },
      '',
      hits,
    );
    expect(hits).toEqual([]);
  });
});

describe('docker bridge — argvContainsBashDashC', () => {
  it('returns false for an empty argv', () => {
    expect(argvContainsBashDashC([])).toBe(false);
  });
  it('returns true for `bash -c id`', () => {
    expect(argvContainsBashDashC(['bash', '-c', 'id'])).toBe(true);
  });
  it('returns true for `/bin/bash -c id`', () => {
    expect(argvContainsBashDashC(['/bin/bash', '-c', 'id'])).toBe(true);
  });
  it('returns true for `sh -c whoami`', () => {
    expect(argvContainsBashDashC(['sh', '-c', 'whoami'])).toBe(true);
  });
  it('returns true for `zsh -c echo`', () => {
    expect(argvContainsBashDashC(['zsh', '-c', 'echo'])).toBe(true);
  });
  it('returns true for `ksh -c echo`', () => {
    expect(argvContainsBashDashC(['ksh', '-c', 'echo'])).toBe(true);
  });
  it('returns false for `bash` alone (no -c)', () => {
    expect(argvContainsBashDashC(['bash', 'something'])).toBe(false);
  });
  it('returns false for `-c bash` (wrong order)', () => {
    expect(argvContainsBashDashC(['-c', 'bash'])).toBe(false);
  });
  it('returns false for a clean docker argv', () => {
    expect(argvContainsBashDashC(['docker', 'exec', 'caddy', 'ls', '-la'])).toBe(false);
  });
});

describe('docker bridge — renderArgv (placeholder binding)', () => {
  it('renders a string placeholder', () => {
    const r = renderArgv(
      { argv: ['docker', 'start', '<name>'] } as unknown as AllowlistEntry,
      { name: 'caddy' },
    );
    expect('argv' in r).toBe(true);
    if ('argv' in r) {
      expect(r.argv).toEqual(['docker', 'start', 'caddy']);
    }
  });

  it('renders a number placeholder (coerced to string)', () => {
    const r = renderArgv(
      { argv: ['docker', 'kill', '<id>'] } as unknown as AllowlistEntry,
      { id: 42 },
    );
    expect('argv' in r).toBe(true);
    if ('argv' in r) {
      expect(r.argv).toEqual(['docker', 'kill', '42']);
    }
  });

  it('rejects a non-finite number placeholder (arg_type)', () => {
    const r = renderArgv(
      { argv: ['docker', 'kill', '<id>'] } as unknown as AllowlistEntry,
      { id: Number.NaN },
    );
    expect('code' in r).toBe(true);
    if ('code' in r) {
      expect(r.code).toBe('arg_type');
    }
  });

  it('rejects a boolean placeholder (arg_type)', () => {
    const r = renderArgv(
      { argv: ['docker', 'kill', '<id>'] } as unknown as AllowlistEntry,
      { id: true as never },
    );
    expect('code' in r).toBe(true);
    if ('code' in r) {
      expect(r.code).toBe('arg_type');
    }
  });

  it('returns placeholder_unbound when arg is missing', () => {
    const r = renderArgv(
      { argv: ['docker', 'start', '<name>'] } as unknown as AllowlistEntry,
      {},
    );
    expect('code' in r).toBe(true);
    if ('code' in r) {
      expect(r.code).toBe('placeholder_unbound');
      expect(r.field).toBe('name');
    }
  });

  it('returns placeholder_unbound when arg is null', () => {
    const r = renderArgv(
      { argv: ['docker', 'start', '<name>'] } as unknown as AllowlistEntry,
      { name: null as never },
    );
    expect('code' in r).toBe(true);
  });

  it('passes through literal tokens unchanged', () => {
    const r = renderArgv(
      { argv: ['docker', 'ps', '-a', '--no-trunc'] } as unknown as AllowlistEntry,
      {},
    );
    expect('argv' in r).toBe(true);
    if ('argv' in r) {
      expect(r.argv).toEqual(['docker', 'ps', '-a', '--no-trunc']);
    }
  });
});

describe('docker bridge — hasSmugglingPattern (PB-2 shell metachar scan)', () => {
  it('returns null for a clean string', () => {
    expect(hasSmugglingPattern('hello-world_1.0')).toBeNull();
  });
  it('detects a semicolon followed by a word', () => {
    expect(hasSmugglingPattern('a;b')).not.toBeNull();
  });
  it('detects $ (variable expansion / subshell)', () => {
    expect(hasSmugglingPattern('a$(b)')).not.toBeNull();
  });
  it('detects backticks', () => {
    expect(hasSmugglingPattern('a`b`c')).not.toBeNull();
  });
  it('detects bash -c', () => {
    expect(hasSmugglingPattern('bash -c id')).not.toBeNull();
  });
  it('detects pipe', () => {
    expect(hasSmugglingPattern('foo|bar')).not.toBeNull();
  });
  it('detects path traversal', () => {
    expect(hasSmugglingPattern('../etc/passwd')).not.toBeNull();
  });
  it('returns a hit with reason and matched fields', () => {
    const hit = hasSmugglingPattern('bad$(id)');
    expect(hit).not.toBeNull();
    if (hit) {
      expect(hit.reason).toBeTruthy();
      expect(hit.matched).toBeTruthy();
    }
  });
});

describe('docker bridge — list + stubs', () => {
  it('listDockerOps returns the catalog', () => {
    const ops = listDockerOps();
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBeGreaterThan(0);
    for (const op of ops) {
      expect(op.op).toBeTruthy();
      expect(typeof op.description).toBe('string');
      expect(typeof op.requiresApproval).toBe('boolean');
      expect(Array.isArray(op.placeholders)).toBe(true);
    }
  });

  it('_STUB_MARKER is a non-empty string', () => {
    expect(typeof _STUB_MARKER).toBe('string');
    expect(_STUB_MARKER.length).toBeGreaterThan(0);
  });
});
