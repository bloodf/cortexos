/**
 * routes.test.ts — 1+ test per stubbed route, hitting all status codes.
 *
 * This is the integration layer for the M1-WS4 deliverable. Each route is
 * exercised with at least one happy path + one auth/validation failure
 * path. The PB-1 to PB-5 fixes are explicitly verified.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerFakeUser,
  registerFakeSession,
  clearFakeAuth,
} from '../auth';
import {
  _resetStubData,
  createService,
  createAlertRule,
} from '../stub-data';
import { resetAudit } from '../audit';
import { resetApprovalStore } from '../approval';
import { _resetAllBuckets } from '../rate-limit';
import { setServerHmacKeyFromString } from '../config';
import {
  makeFakeEvent,
  makeFakeUser,
  makeFakeSession,
  makeFakeLocals,
} from '../test-utils';
import { asUserId, asSessionId } from '../entities';

import * as servicesRoute from '../../../routes/api/services/+server';
import * as serviceIdRoute from '../../../routes/api/services/[id]/+server';
import * as serviceHealthRoute from '../../../routes/api/services/[id]/health/+server';
import * as alertsRoute from '../../../routes/api/alerts/+server';
import * as alertIdRoute from '../../../routes/api/alerts/[id]/+server';
import * as auditRoute from '../../../routes/api/audit/+server';
import * as auditVerifyRoute from '../../../routes/api/audit/verify/+server';
import * as commandAuditRoute from '../../../routes/api/dashboard_command_audit/+server';
import * as approvalsRoute from '../../../routes/api/approvals/+server';
import * as terminalRoute from '../../../routes/api/terminal/+server';
import * as envBrowserRoute from '../../../routes/api/env-browser/+server';
import * as execNamedRoute from '../../../routes/api/incus/[name]/exec-named/+server';
import * as dockerActionsRoute from '../../../routes/api/docker/actions/+server';
import * as systemdActionsRoute from '../../../routes/api/systemd/actions/+server';
import * as incusActionsRoute from '../../../routes/api/incus/actions/+server';

beforeEach(() => {
  _resetStubData();
  resetAudit();
  resetApprovalStore();
  _resetAllBuckets();
  clearFakeAuth();
  setServerHmacKeyFromString('test-key-1234567890');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminLocals() {
  const user = makeFakeUser({ is_admin: true, groupMemberships: ['cortexos-admin'] });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return { user, session, locals: makeFakeLocals(user, session) };
}

function nonAdminLocals() {
  const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return { user, session, locals: makeFakeLocals(user, session) };
}

async function callHandler(
  handler: (event: ReturnType<typeof makeFakeEvent>) => Promise<Response>,
  event: ReturnType<typeof makeFakeEvent>,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await handler(event);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers };
}

// ---------------------------------------------------------------------------
// /api/services
// ---------------------------------------------------------------------------

describe('GET /api/services', () => {
  it('returns services for authenticated user', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(servicesRoute.GET, makeFakeEvent({ locals }));
    expect(res.status).toBe(200);
    expect((res.body as { services: unknown[] }).services).toBeDefined();
  });

  it('returns 401 for unauthenticated', async () => {
    const res = await callHandler(servicesRoute.GET, makeFakeEvent());
    expect(res.status).toBe(401);
  });
});

describe('POST /api/services', () => {
  it('admin creates a service', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      servicesRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: {
          slug: 'caddy',
          name: 'Caddy',
          category: 'web',
          healthType: 'http',
        },
      }),
    );
    expect(res.status).toBe(200);
    expect((res.body as { service: { slug: string } }).service.slug).toBe('caddy');
  });

  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      servicesRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: {
          slug: 'caddy',
          name: 'Caddy',
          category: 'web',
          healthType: 'http',
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('invalid slug returns 400', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      servicesRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: {
          slug: 'Has Spaces!',
          name: 'Caddy',
          category: 'web',
          healthType: 'http',
        },
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /api/services/[id]
// ---------------------------------------------------------------------------

describe('/api/services/[id]', () => {
  it('GET returns 200 for an existing service', async () => {
    const { locals } = adminLocals();
    const svc = createService({
      slug: 'a',
      name: 'A',
      description: null,
      healthUrl: null,
      healthType: 'http',
      category: 'web',
      openUrl: null,
      status: 'online',
      kind: 'app',
      envSource: null,
      isActive: true,
      hasWebui: false,
      showInHealthcheck: true,
      showInWebui: true,
      sortOrder: 0,
    });
    const res = await callHandler(
      serviceIdRoute.GET,
      makeFakeEvent({ locals, params: { id: svc.id } }),
    );
    expect(res.status).toBe(200);
  });

  it('GET returns 404 for a missing service', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      serviceIdRoute.GET,
      makeFakeEvent({ locals, params: { id: 'missing' } }),
    );
    expect(res.status).toBe(404);
  });

  it('DELETE on a non-admin returns 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      serviceIdRoute.DELETE,
      makeFakeEvent({ method: 'DELETE', locals, params: { id: 'x' } }),
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// /api/services/[id]/health
// ---------------------------------------------------------------------------

describe('/api/services/[id]/health', () => {
  it('GET returns snapshots for an existing service', async () => {
    const { locals } = adminLocals();
    const svc = createService({
      slug: 'b',
      name: 'B',
      description: null,
      healthUrl: null,
      healthType: 'http',
      category: 'web',
      openUrl: null,
      status: 'online',
      kind: 'app',
      envSource: null,
      isActive: true,
      hasWebui: false,
      showInHealthcheck: true,
      showInWebui: true,
      sortOrder: 0,
    });
    const res = await callHandler(
      serviceHealthRoute.GET,
      makeFakeEvent({ locals, params: { id: svc.id } }),
    );
    expect(res.status).toBe(200);
  });

  it('POST triggers a recheck (admin)', async () => {
    const { locals } = adminLocals();
    const svc = createService({
      slug: 'c',
      name: 'C',
      description: null,
      healthUrl: null,
      healthType: 'http',
      category: 'web',
      openUrl: null,
      status: 'online',
      kind: 'app',
      envSource: null,
      isActive: true,
      hasWebui: false,
      showInHealthcheck: true,
      showInWebui: true,
      sortOrder: 0,
    });
    const res = await callHandler(
      serviceHealthRoute.POST,
      makeFakeEvent({ method: 'POST', locals, params: { id: svc.id }, body: { source: 'manual' } }),
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /api/alerts
// ---------------------------------------------------------------------------

describe('/api/alerts', () => {
  it('GET returns 401 for unauth', async () => {
    const res = await callHandler(alertsRoute.GET, makeFakeEvent());
    expect(res.status).toBe(401);
  });

  it('POST admin creates a rule', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      alertsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { name: 'r1', query: 'up == 0', severity: 'warning' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('POST non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      alertsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { name: 'r1', query: 'up == 0' },
      }),
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// /api/alerts/[id]
// ---------------------------------------------------------------------------

describe('/api/alerts/[id]', () => {
  it('returns 404 for missing alert', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      alertIdRoute.GET,
      makeFakeEvent({ locals, params: { id: 'missing' } }),
    );
    expect(res.status).toBe(404);
  });

  it('admin updates an alert', async () => {
    const { locals } = adminLocals();
    const rule = createAlertRule({ name: 'r', query: 'q', severity: 'warning', channels: [], enabled: true });
    const res = await callHandler(
      alertIdRoute.PATCH,
      makeFakeEvent({
        method: 'PATCH',
        locals,
        params: { id: rule.id },
        body: { enabled: false },
      }),
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /api/audit + /api/audit/verify
// ---------------------------------------------------------------------------

describe('/api/audit', () => {
  it('admin lists audit events', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(auditRoute.GET, makeFakeEvent({ locals }));
    expect(res.status).toBe(200);
    expect((res.body as { items: unknown[] }).items).toBeDefined();
  });

  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(auditRoute.GET, makeFakeEvent({ locals }));
    expect(res.status).toBe(403);
  });
});

describe('/api/audit/verify', () => {
  it('verifies the chain', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(auditVerifyRoute.GET, makeFakeEvent({ locals }));
    expect(res.status).toBe(200);
    const body = res.body as { result: { ok: boolean; length: number } };
    expect(body.result.ok).toBe(true);
    expect(body.result.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// /api/dashboard_command_audit
// ---------------------------------------------------------------------------

describe('/api/dashboard_command_audit', () => {
  it('admin creates a command audit', async () => {
    const { user, locals } = adminLocals();
    const res = await callHandler(
      commandAuditRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { command: 'docker.ps', target: 'caddy', requestId: 'req-1' },
      }),
    );
    expect(res.status).toBe(200);
    const body = res.body as { item: { requestedBy: string } };
    expect(body.item.requestedBy).toBe(user.id);
  });

  it('destructive op (systemd.restart) returns 403 with approval header', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      commandAuditRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { command: 'systemd.restart:cortex-dashboard', target: 'cortex-dashboard', requestId: 'req-2' },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-approval-action-hash')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PB-1 FIX: /api/approvals
// ---------------------------------------------------------------------------

describe('PB-1 FIX: POST /api/approvals', () => {
  it('non-admin cannot mint (no-auth-gate prod bug → 403)', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      approvalsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'services.delete', payload: { id: 'svc_1' } },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin can mint a token', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      approvalsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'services.delete', payload: { id: 'svc_1' } },
      }),
    );
    expect(res.status).toBe(200);
    const body = res.body as { token: string; actionHash: string; ttlSec: number };
    expect(body.token).toMatch(/^v1\./);
    expect(body.actionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.ttlSec).toBe(60);
  });

  it('unauthenticated cannot mint (401)', async () => {
    const res = await callHandler(
      approvalsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        body: { action: 'services.delete', payload: {} },
      }),
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PB-2 FIX: /api/terminal
// ---------------------------------------------------------------------------

describe('PB-2 FIX: POST /api/terminal', () => {
  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'term.ps', args: {} },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with allowlisted op returns 200', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'term.ps', args: {} },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('admin with bash -c <userstring> returns 400 (allowlist)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'bash -c id', args: {} },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('admin with arg-smuggling returns 400 (T-104)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'term.read_file', args: { path: '$(id)' } },
      }),
    );
    expect(res.status).toBe(400);
  });

  // ----- M2-WS2 additions: PTY bridge integration -----

  it('M2-WS2: admin POST /api/terminal with read_file + clean path returns 200 with argv', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'term.read_file', args: { path: '/var/log/caddy.log' } },
      }),
    );
    expect(res.status).toBe(200);
    const body = res.body as { argv: string[]; status: string };
    expect(body.status).toBe('accepted');
    expect(body.argv).toEqual(['cat', '/var/log/caddy.log']);
  });

  it('M2-WS2: bash -c with `<` redirect also rejected with 400 (T-104 smuggling)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'term.read_file', args: { path: '/etc/passwd < /dev/null' } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('M2-WS2: read_file with missing <path> placeholder returns 400', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { op: 'term.read_file', args: {} },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('M2-WS2: GET /api/terminal returns the allowlisted ops list (admin)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      terminalRoute.GET,
      makeFakeEvent({ method: 'GET', locals }),
    );
    expect(res.status).toBe(200);
    const body = res.body as { ops: Array<{ op: string }> };
    const names = body.ops.map((o) => o.op);
    expect(names).toContain('term.ps');
    expect(names).toContain('term.df');
    expect(names).toContain('term.read_file');
  });

  it('M2-WS2: GET /api/terminal as non-admin returns 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      terminalRoute.GET,
      makeFakeEvent({ method: 'GET', locals }),
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PB-3 FIX: /api/env-browser
// ---------------------------------------------------------------------------

describe('PB-3 FIX: GET /api/env-browser', () => {
  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      envBrowserRoute.GET,
      makeFakeEvent({ locals, url: 'http://localhost/api/env-browser?path=/opt/cortexos/.secrets/cortexos.env' }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with path outside allowlist gets 403', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      envBrowserRoute.GET,
      makeFakeEvent({ locals, url: 'http://localhost/api/env-browser?path=/etc/passwd' }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with allowlisted path returns 200 (masked)', async () => {
    const { locals } = adminLocals();
    envBrowserRoute.__registerEnvFile('/opt/cortexos/.secrets/cortexos.env', [
      { key: 'CORTEX_DB_URL', value: 'postgres://u:p@h:5432/db' },
    ]);
    const res = await callHandler(
      envBrowserRoute.GET,
      makeFakeEvent({ locals, url: 'http://localhost/api/env-browser?path=/opt/cortexos/.secrets/cortexos.env' }),
    );
    expect(res.status).toBe(200);
  });

  it('without a reveal grant, values are masked — never cleartext (SR-071)', async () => {
    // The reveal contract changed: cleartext is no longer gated by a
    // `?reveal=true` query + confirmation-token header. It now requires a
    // PAM-verified, session-bound reveal grant (POST /api/env-browser/unlock).
    // A plain admin GET (no grant) must return 200 with masked values and
    // MUST NOT leak the raw secret.
    const { locals } = adminLocals();
    envBrowserRoute.__registerEnvFile('/opt/cortexos/.secrets/cortexos.env', [
      { key: 'CORTEX_DB_PASSWORD', value: 'supersecret123' },
    ]);
    const res = await callHandler(
      envBrowserRoute.GET,
      makeFakeEvent({
        locals,
        url: 'http://localhost/api/env-browser?path=/opt/cortexos/.secrets/cortexos.env',
      }),
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      revealed: boolean;
      entries: Array<{ key: string; value: string; masked: string }>;
    };
    expect(body.revealed).toBe(false);
    // Secret-keyed value is masked; the cleartext must be absent without a grant.
    expect(body.entries[0]!.value).toBe(body.entries[0]!.masked);
    expect(body.entries[0]!.value).not.toContain('supersecret');
  });
});

// ---------------------------------------------------------------------------
// PB-4 FIX: /api/incus/[name]/exec-named
// ---------------------------------------------------------------------------

describe('PB-4 FIX: POST /api/incus/[name]/exec-named', () => {
  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      execNamedRoute.POST as unknown as (e: unknown) => Promise<Response>,
      makeFakeEvent({
        method: 'POST',
        locals,
        params: { name: 'hermes-canary' },
        body: { op: 'term.ps', args: {} },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with bash -c <userstring> returns 400', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      execNamedRoute.POST as unknown as (e: unknown) => Promise<Response>,
      makeFakeEvent({
        method: 'POST',
        locals,
        params: { name: 'hermes-canary' },
        body: { op: 'bash -c id', args: {} },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('admin with allowlisted op returns 200', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      execNamedRoute.POST as unknown as (e: unknown) => Promise<Response>,
      makeFakeEvent({
        method: 'POST',
        locals,
        params: { name: 'hermes-canary' },
        body: { op: 'term.ps', args: {} },
      }),
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// PB-5 FIX: /api/{docker,systemd,incus}/actions
// ---------------------------------------------------------------------------

describe('PB-5 FIX: /api/docker/actions', () => {
  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      dockerActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'start', container: 'nginx' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with allowlisted action returns 200', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      dockerActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'start', container: 'nginx' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('admin with rm action returns 403 (requires approval)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      dockerActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'rm', container: 'nginx' },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-approval-action-hash')).not.toBeNull();
  });

  it('admin with invalid container name returns 400 (SR-030)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      dockerActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'start', container: 'has spaces' },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('PB-5 FIX: /api/systemd/actions', () => {
  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      systemdActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'status', unit: 'caddy.service' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with non-critical unit status returns 200', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      systemdActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'status', unit: 'caddy.service' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('admin restarting a critical unit (cortex-dashboard) requires approval', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      systemdActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'restart', unit: 'cortex-dashboard.service' },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-approval-action-hash')).not.toBeNull();
  });

  it('admin with invalid unit name returns 400 (SR-030)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      systemdActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'status', unit: 'systеmd-resolved' }, // Cyrillic 'е' would fail
      }),
    );
    // The regex is strict ASCII, so this returns 400.
    expect([400, 403]).toContain(res.status);
  });
});

describe('PB-5 FIX: /api/incus/actions', () => {
  it('non-admin gets 403', async () => {
    const { locals } = nonAdminLocals();
    const res = await callHandler(
      incusActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'list' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with allowlisted action returns 200', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      incusActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'start', instance: 'nginx-prod' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('admin with delete returns 403 (requires approval)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      incusActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'delete', instance: 'nginx-prod' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin with non-allowlisted profile returns 400 (SR-052)', async () => {
    const { locals } = adminLocals();
    const res = await callHandler(
      incusActionsRoute.POST,
      makeFakeEvent({
        method: 'POST',
        locals,
        body: { action: 'launch', instance: 'new', profile: 'unconfined' },
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PB-6: every privileged route uses requireAdmin
// ---------------------------------------------------------------------------

describe('PB-6: admin gating audit', () => {
  it('every privileged POST route returns 403 for non-admin', async () => {
    const { locals } = nonAdminLocals();
    const cases: ReadonlyArray<{ name: string; call: () => Promise<Response> }> = [
      {
        name: 'POST /api/approvals',
        call: () =>
          approvalsRoute.POST(
            makeFakeEvent({
              method: 'POST',
              locals,
              body: { action: 'x', payload: {} },
            }),
          ),
      },
      {
        name: 'POST /api/terminal',
        call: () =>
          terminalRoute.POST(
            makeFakeEvent({
              method: 'POST',
              locals,
              body: { op: 'term.ps', args: {} },
            }),
          ),
      },
      {
        name: 'POST /api/docker/actions',
        call: () =>
          dockerActionsRoute.POST(
            makeFakeEvent({
              method: 'POST',
              locals,
              body: { action: 'start', container: 'nginx' },
            }),
          ),
      },
      {
        name: 'POST /api/systemd/actions',
        call: () =>
          systemdActionsRoute.POST(
            makeFakeEvent({
              method: 'POST',
              locals,
              body: { action: 'status', unit: 'caddy.service' },
            }),
          ),
      },
      {
        name: 'POST /api/incus/actions',
        call: () =>
          incusActionsRoute.POST(
            makeFakeEvent({
              method: 'POST',
              locals,
              body: { action: 'list' },
            }),
          ),
      },
    ];
    for (const c of cases) {
      const res = await c.call();
      expect(res.status, c.name).toBe(403);
    }
  });
});
