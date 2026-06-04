/**
 * docker-bridge.test.ts — exercises the docker-bridge dispatcher.
 *
 * This is the PB-2 + PB-5 + swappable-Executor safety net. The
 * pattern mirrors `terminal/__tests__/pty-bridge.test.ts`:
 *
 *   1. Unknown op is rejected (`unknown_op`).
 *   2. `bash -c <userstring>` is rejected at the route layer (we
 *      simulate this by passing `op: 'bash -c id'` — the policy
 *      allowlist does not contain it, so `allowlistedCommand`
 *      returns undefined and the bridge rejects with
 *      `unknown_op`).
 *   3. A rendered argv containing a literal `bash -c` pair is
 *      rejected with `argv_bash_c` (defence in depth — PB-2
 *      belt-and-braces).
 *   4. Arg-smuggling (`;`, `&&`, `|`, `$()`, etc.) is rejected
 *      with `arg_smuggling`.
 *   5. An op on the allowlist without a valid approval token is
 *      rejected with `missing_approval` (PB-5).
 *   6. An op with a valid approval token is accepted; the
 *      executor receives the rendered argv.
 *   7. The Executor is swappable: `setExecutorForTests` swaps in
 *      a custom function that records the argv it received.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  dispatch,
  setExecutorForTests,
  _STUB_MARKER,
  _internals,
  type DispatchContext,
  type Executor,
} from '../bridge';
import {
  mintApproval,
  resetApprovalStore,
  _isTokenConsumed,
  actionHashFor,
} from '../../approval';
import { asSessionId, asUserId, type User } from '../../entities';

const user: User = {
  id: asUserId('user_test'),
  username: 'tester',
  is_admin: true,
  isActive: true,
  groupMemberships: ['cortexos-admin', 'cortexos-users'],
};

const ctx: DispatchContext = {
  user,
  ip: '127.0.0.1',
  userAgent: 'test',
  requestId: 'req_test',
};

describe('docker-bridge — PB-2 + PB-5 + swappable executor', () => {
  beforeEach(() => {
    resetApprovalStore();
  });

  afterEach(() => {
    setExecutorForTests(null);
  });

  it('rejects an unknown op with code=unknown_op', async () => {
    const r = await dispatch({ op: 'docker.weird', args: {} }, ctx);
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('unknown_op');
      expect(r.reason).toMatch(/not on the allowlist/);
    }
  });

  it('rejects `bash -c <userstring>` at the route layer (op not on allowlist)', async () => {
    const r = await dispatch(
      { op: 'bash -c id', args: { userstring: 'id' } },
      ctx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('unknown_op');
    }
  });

  it('rejects arg-smuggling patterns (T-104) in the args', async () => {
    const token = mintApproval({
      action: 'docker.exec',
      payload: { op: 'docker.exec', args: { container: 'foo', command: 'ls' } },
      sessionId: asSessionId('sess_x'),
      userId: user.id,
    }).token;
    const r = await dispatch(
      {
        op: 'docker.exec',
        args: { container: 'foo', command: 'ls; rm -rf /' },
        approvalToken: token,
        sessionId: 'sess_x',
      },
      ctx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('arg_smuggling');
    }
  });

  it('rejects `$(...)` command substitution in the args', async () => {
    const token = mintApproval({
      action: 'docker.exec',
      payload: { op: 'docker.exec', args: { container: 'foo', command: 'ls' } },
      sessionId: asSessionId('sess_y'),
      userId: user.id,
    }).token;
    const r = await dispatch(
      {
        op: 'docker.exec',
        args: { container: 'foo', command: '$(whoami)' },
        approvalToken: token,
        sessionId: 'sess_y',
      },
      ctx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('arg_smuggling');
    }
  });

  it('rejects a known op without an approval token (PB-5)', async () => {
    const r = await dispatch(
      { op: 'docker.start', args: { container: 'foo' } },
      ctx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('missing_approval');
    }
  });

  it('rejects a known op with a stale/expired approval token (PB-5)', async () => {
    const token = mintApproval({
      action: 'docker.start',
      payload: { op: 'docker.start', args: { container: 'foo' } },
      sessionId: asSessionId('sess_z'),
      userId: user.id,
      ttlSec: 1,
    }).token;
    // Wait past the TTL.
    await new Promise((r) => setTimeout(r, 1100));
    const r = await dispatch(
      {
        op: 'docker.start',
        args: { container: 'foo' },
        approvalToken: token,
        sessionId: 'sess_z',
      },
      ctx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('invalid_approval');
    }
  });

  it('rejects a known op with a token bound to a different action-hash (PB-5)', async () => {
    // Mint a token for `stop`, try to use it for `start`.
    const token = mintApproval({
      action: 'docker.stop',
      payload: { op: 'docker.stop', args: { container: 'foo' } },
      sessionId: asSessionId('sess_a'),
      userId: user.id,
    }).token;
    const r = await dispatch(
      {
        op: 'docker.start',
        args: { container: 'foo' },
        approvalToken: token,
        sessionId: 'sess_a',
      },
      ctx,
    );
    expect(r.status).toBe('rejected');
    if (r.status === 'rejected') {
      expect(r.code).toBe('invalid_approval');
      expect(r.reason).toMatch(/action-hash mismatch/);
    }
  });

  it('accepts a known op with a valid approval token (PB-5 happy path)', async () => {
    // Swap the executor with a recorder.
    const received: string[][] = [];
    const recorder: Executor = async (argv) => {
      received.push([...argv]);
      return { stdout: 'recorder-ok', stderr: '', exitCode: 0 };
    };
    setExecutorForTests(recorder);

    // The bridge recomputes the action-hash from
    // `actionHashFor('docker.start', { op: 'docker.start', args: { container: 'foo' } })`.
    // The token must be minted with the SAME (action, payload)
    // tuple so the hash matches.
    const token = mintApproval({
      action: 'docker.start',
      payload: { op: 'docker.start', args: { container: 'foo' } },
      sessionId: asSessionId('sess_b'),
      userId: user.id,
    }).token;

    const r = await dispatch(
      {
        op: 'docker.start',
        args: { container: 'foo' },
        approvalToken: token,
        sessionId: 'sess_b',
      },
      ctx,
    );
    if (r.status !== 'accepted') {
      const expected = actionHashFor('docker.start', { op: 'docker.start', args: { container: 'foo' } });
      console.log('DEBUG expected hash:', expected);
      console.log('DEBUG mint hash:', mintApproval({
        action: 'docker.start',
        payload: { op: 'docker.start', args: { container: 'foo' } },
        sessionId: asSessionId('sess_b'),
        userId: user.id,
      }).actionHash);
      console.log('DEBUG dispatch result:', JSON.stringify(r));
    }
    expect(r.status).toBe('accepted');
    if (r.status === 'accepted') {
      expect(r.op).toBe('docker.start');
      expect(r.argv).toContain('start');
      expect(r.argv).toContain('foo');
      expect(r.output).toBe('recorder-ok');
    }
    expect(received).toHaveLength(1);
    expect(received[0]).toContain('start');
    // The token is consumed — a second dispatch with the same
    // token is rejected with `invalid_approval` (already_used).
    expect(_isTokenConsumed(token)).toBe(true);
  });

  it('argvContainsBashDashC catches a literal `bash -c` pair', () => {
    expect(_internals.argvContainsBashDashC(['bash', '-c', 'id'])).toBe(true);
    expect(_internals.argvContainsBashDashC(['/bin/sh', '-c', 'x'])).toBe(true);
    expect(_internals.argvContainsBashDashC(['ls', '-la'])).toBe(false);
  });

  it('uses the M2 stub marker by default', async () => {
    // Don't set an executor — the default M2 stub runs.
    const token = mintApproval({
      action: 'docker.start',
      payload: { op: 'docker.start', args: { container: 'foo' } },
      sessionId: asSessionId('sess_c'),
      userId: user.id,
    }).token;
    const r = await dispatch(
      {
        op: 'docker.start',
        args: { container: 'foo' },
        approvalToken: token,
        sessionId: 'sess_c',
      },
      ctx,
    );
    expect(r.status).toBe('accepted');
    if (r.status === 'accepted') {
      expect(r.output).toContain(_STUB_MARKER);
    }
  });
});
