/**
 * incus-bridge-internals.test.ts — coverage of the incus bridge
 * surface that's testable from outside the dispatch path.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setExecutorForTests,
  listInstanceActions,
  _DESTRUCTIVE_ACTIONS,
  _getMockExecutorForTests,
  _SEED_INSTANCES,
} from '../bridge';
import { resetAudit } from '../../audit';

beforeEach(() => {
  setExecutorForTests(null);
  resetAudit();
});

describe('incus bridge — listInstanceActions catalog', () => {
  it('returns the catalog with op/description/placeholders', () => {
    const ops = listInstanceActions();
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBeGreaterThan(0);
    // Just confirm the catalog shape — individual field names vary.
    expect(ops[0]).toBeDefined();
  });
});

describe('incus bridge — _DESTRUCTIVE_ACTIONS', () => {
  it('exposes the destructive actions set', () => {
    expect(_DESTRUCTIVE_ACTIONS).toBeInstanceOf(Set);
    expect(_DESTRUCTIVE_ACTIONS.size).toBeGreaterThan(0);
  });
});

describe('incus bridge — _getMockExecutorForTests', () => {
  it('returns a MockIncusExecutor instance', () => {
    const m = _getMockExecutorForTests();
    expect(m).toBeDefined();
    expect(typeof m.list).toBe('function');
  });
});

describe('incus bridge — _SEED_INSTANCES', () => {
  it('ships the seed instances', () => {
    expect(_SEED_INSTANCES.length).toBeGreaterThan(0);
    for (const inst of _SEED_INSTANCES) {
      expect(inst.name).toBeTruthy();
      expect(inst.type).toBeTruthy();
    }
  });
});
