/**
 * api-systemd-actions-extra.test.ts — coverage of the remaining
 * branches in /api/systemd/actions POST.
 *
 * The base test (`api-systemd-actions.test.ts`) covers method gating
 * and the input-validation path. This file drives the 6 uncovered
 * lines in the route handler:
 *
 *   - L56  validateShellArg fail   (unit name passes regex, fails smuggling)
 *   - L66  allowlist miss          (action in Zod enum but not in allowlist)
 *   - L83  list-units accepted     (no unit required)
 *   - L86  unit-required path      (non-list-units action without a unit)
 *   - L114 rejected result         (bridge returns unknown_unit)
 *   - L122 approval_required result (bridge returns approval_required)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as actionsPost } from '../+server';
import {
  _resetSystemdBridgeForTests,
  _getMockExecutorForTests,
  type DispatchResult,
} from '$lib/server/systemd/bridge';
import { resetPolicy, installDefaultAllowlist } from '$lib/server/policy';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import {
  makeFakeEvent,
  makeFakeUser,
  makeFakeLocals,
  makeFakeSession,
} from '$lib/server/test-utils';
import type { SystemdActionKind } from '@cortexos/contracts';

const adminUser = makeFakeUser({
  is_admin: true,
  isAdmin: true,
  groupMemberships: [{ name: 'cortexos-admin', isAdmin: true, description: 'admin' }],
});

async function call(body: unknown) {
  const event = makeFakeEvent({
    method: 'POST',
    url: 'http://localhost/api/systemd/actions',
    body,
    locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
  });
  return (actionsPost as unknown as (e: unknown) => Promise<Response>)(event);
}

beforeEach(() => {
  _resetSystemdBridgeForTests();
  resetPolicy();
  installDefaultAllowlist();
  resetAudit();
  _resetAllBuckets();
  vi.restoreAllMocks();
});

describe('/api/systemd/actions — extra coverage', () => {
  it('returns 400 when the unit name passes the regex but fails validateShellArg', async () => {
    // `eval.service` matches the systemd unit regex (alphanumeric
    // + `.service`) but `\beval\b` triggers the smuggling scan in
    // `validateShellArg`. The route's L56 branch is the only place
    // this case is handled.
    const res = await call({ action: 'start', unit: 'eval.service' });
    expect(res.status).toBe(400);
    const body = await res.json();
    // Print body for debugging if assertion fails.
    if (!body.details || !body.details.some((d: { field: string }) => d.field === 'unit')) {
      throw new Error(`unexpected body: ${JSON.stringify(body)}`);
    }
  });

  it('returns 400 when the action is not in the policy allowlist', async () => {
    // Drop the allowlist entirely so any action is treated as "not
    // in allowlist". The Zod schema still accepts enum members, so
    // we exercise the L66 branch.
    resetPolicy();
    const res = await call({ action: 'start', unit: 'caddy.service' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/allowlist|Unsupported/i);
  });

  it('returns 200 with status=accepted for list-units (no unit required)', async () => {
    const res = await call({ action: 'list-units' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('list-units');
    expect(body.status).toBe('accepted');
    expect(body.unit).toBeNull();
  });

  it('returns 400 when a unit-required action is sent without a unit', async () => {
    // `start` requires a unit; the route's L86 branch surfaces the
    // validation error in the right shape.
    const res = await call({ action: 'start' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/unit is required/i);
    expect(body.details.some((d: { field: string }) => d.field === 'unit')).toBe(true);
  });

  it('returns 400 with code=unknown_unit when the bridge returns rejected', async () => {
    // The bridge's MockUnitExecutor ships a default seed; 'ghost.service'
    // is not in the snapshot, so the bridge returns
    // { status: 'rejected', code: 'unknown_unit', ... } which the
    // route maps to a 400 with that code (L114).
    _getMockExecutorForTests(); // ensure default seed is loaded
    const res = await call({ action: 'start', unit: 'ghost.service' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.some((d: { field: string; message: string }) =>
      d.field === 'op' && d.message === 'unknown_unit',
    )).toBe(true);
  });

  it('returns 403 with actionHash when the bridge returns approval_required', async () => {
    // The route always mints a token, so the bridge's natural
    // approval_required path is unreachable through it. We
    // `vi.mock` the bridge to return approval_required directly,
    // exercising the route's L122 branch.
    const { dispatchAction } = await import('$lib/server/systemd/bridge');
    const spy = vi
      .spyOn(await import('$lib/server/systemd/bridge'), 'dispatchAction')
      .mockImplementation(
        async (
          _input: { action: SystemdActionKind; name: string },
        ): Promise<DispatchResult> => ({
          status: 'approval_required',
          action: 'restart' as SystemdActionKind,
          name: 'caddy.service',
          actionHash: 'test-hash-123',
          ttlSec: 60,
          message: 'approval required (test mock)',
        }),
      );
    void dispatchAction; // silence unused-import warning
    void spy;
    const res = await call({ action: 'start', unit: 'caddy.service' });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.actionHash).toBe('test-hash-123');
    expect(body.ttlSec).toBe(60);
  });
});
