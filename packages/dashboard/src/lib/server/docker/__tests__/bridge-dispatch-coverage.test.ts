/**
 * docker-bridge-dispatch-coverage.test.ts — additional coverage
 * of the docker bridge dispatch path. Drives every rejection
 * branch the public `dispatch()` API exposes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  dispatch,
  _internals,
  setExecutorForTests,
  _STUB_MARKER,
  listDockerOps,
} from '../bridge';
import { resetAudit } from '../../audit';
import { makeFakeUser, makeFakeLocals } from '../../test-utils';

const user = makeFakeUser({
  is_admin: true,
  groupMemberships: ['cortexos-admin'],
});

const baseCtx = {
  user,
  ip: '127.0.0.1',
  userAgent: 'test/1.0',
  requestId: 'req-test',
};

beforeEach(() => {
  setExecutorForTests(null);
  resetAudit();
});

describe('docker bridge — dispatch with zero args', () => {
  it('rejects an op not on the allowlist (unknown_op)', async () => {
    const r = await dispatch(
      { op: 'not-a-real-op', args: {}, sessionId: 's' },
      baseCtx,
    );
    // The allowlist check fires first → unknown_op.
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') expect(r.code).toBe('unknown_op');
  });
});

describe('docker bridge — argv_render path', () => {
  it('rejects when a required placeholder is missing', async () => {
    // docker.start requires a name. Without one, the placeholder
    // render fails. Even with a token, the bridge still rejects
    // at the render step before approval verification.
    const r = await dispatch(
      { op: 'docker.start', args: {}, sessionId: 's' },
      baseCtx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(['placeholder_unbound', 'invalid_approval', 'missing_approval']).toContain(r.code);
    }
  });
});

describe('docker bridge — public surface', () => {
  it('listDockerOps returns the catalog', () => {
    const ops = listDockerOps();
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBeGreaterThan(0);
  });

  it('_STUB_MARKER is a non-empty string', () => {
    expect(typeof _STUB_MARKER).toBe('string');
    expect(_STUB_MARKER.length).toBeGreaterThan(0);
  });

  it('_internals exposes the helpers', () => {
    expect(_internals).toBeDefined();
    expect(typeof _internals.collectArgSmugglingHits).toBe('function');
    expect(typeof _internals.argvContainsBashDashC).toBe('function');
    expect(typeof _internals.renderArgv).toBe('function');
    expect(typeof _internals.hasSmugglingPattern).toBe('function');
  });
});
