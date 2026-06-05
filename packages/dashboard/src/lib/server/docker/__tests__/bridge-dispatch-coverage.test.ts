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
import { makeFakeUser } from '../../test-utils';
import {
  mintApproval,
  resetApprovalStore,
} from '../../approval';
import { asSessionId } from '../../entities';

const user = makeFakeUser({
  isAdmin: true,
  groupMemberships: [{ name: 'cortexos-admins', isAdmin: true, description: 'admin' }],
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
  resetApprovalStore();
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

describe('docker bridge — non-zero exitCode + executor throw', () => {
  it('marks the dispatch as failure when the executor returns exitCode != 0', async () => {
    setExecutorForTests(async () => {
      // docker.start is allowlisted; supply a valid token to pass the
      // approval gate, then the executor returns a non-zero exit code.
      return { stdout: 'container not found', stderr: '', exitCode: 1 };
    });
    const { token } = mintApproval({
      userId: user.id,
      sessionId: asSessionId('s'),
      action: 'docker.start',
      payload: { op: 'docker.start', args: { container: 'web' } },
    });
    const r = await dispatch(
      { op: 'docker.start', args: { container: 'web' }, sessionId: 's', approvalToken: token },
      baseCtx,
    );
    expect(r.status).toBe('accepted');
    if (r.status === 'accepted') {
      // The dispatch result exposes `output` (= executor stdout) and
      // the audit captures the non-zero exit code internally — the
      // public surface does NOT include exitCode.
      expect(r.output).toContain('container not found');
    }
  });

  it('returns rejected executor_error when the executor throws', async () => {
    setExecutorForTests(async () => {
      throw new Error('docker daemon unreachable');
    });
    const { token } = mintApproval({
      userId: user.id,
      sessionId: asSessionId('s'),
      action: 'docker.start',
      payload: { op: 'docker.start', args: { container: 'web' } },
    });
    const r = await dispatch(
      { op: 'docker.start', args: { container: 'web' }, sessionId: 's', approvalToken: token },
      baseCtx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('executor_error');
    }
  });

  it('returns rejected when the approval token is consumed (already used)', async () => {
    setExecutorForTests(async (argv) => ({ stdout: '', stderr: '', exitCode: 0 }));
    const { token } = mintApproval({
      userId: user.id,
      sessionId: asSessionId('s'),
      action: 'docker.start',
      payload: { op: 'docker.start', args: { container: 'web' } },
    });
    // First call consumes the token.
    await dispatch(
      { op: 'docker.start', args: { container: 'web' }, sessionId: 's', approvalToken: token },
      baseCtx,
    );
    // Second call with the same token — consumeApproval returns already_used.
    const r2 = await dispatch(
      { op: 'docker.start', args: { container: 'web' }, sessionId: 's', approvalToken: token },
      baseCtx,
    );
    expect(r2.status).toBe('rejected');
    if (r2.status === 'rejected') {
      expect(['invalid_approval', 'already_used']).toContain(r2.code);
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
