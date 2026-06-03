/**
 * stub-data.test.ts — basic CRUD coverage for the in-memory stub store.
 *
 * Real repos land in M1-WS6 (Kleppmann). The stub exists so the +server.ts
 * routes can return non-empty responses in M1.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetStubData,
  createService,
  getServiceById,
  listServices,
  updateService,
  deleteService,
  createAlertRule,
  getAlertRule,
  listAlertRules,
  createCommandAudit,
  advanceCommandAudit,
  listCommandAudits,
  getCommandAudit,
  triggerRecheck,
  listHealthForService,
  upsertUser,
  getUserById,
} from '../stub-data';
import { asServiceId, asUserId } from '../entities';

beforeEach(() => {
  _resetStubData();
});

describe('services stub', () => {
  it('CRUD roundtrip', () => {
    const s = createService({
      slug: 'x',
      name: 'X',
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
    expect(getServiceById(s.id)?.slug).toBe('x');
    expect(listServices().length).toBe(1);
    const updated = updateService(s.id, { name: 'X2' });
    expect(updated?.name).toBe('X2');
    expect(deleteService(s.id)).toBe(true);
    expect(getServiceById(s.id)).toBeNull();
  });
  it('returns null on missing update', () => {
    expect(updateService('nope', { name: 'x' })).toBeNull();
  });
  it('returns false on missing delete', () => {
    expect(deleteService('nope')).toBe(false);
  });
});

describe('health snapshots', () => {
  it('records and lists', () => {
    const s = createService({
      slug: 'h',
      name: 'H',
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
    triggerRecheck(s.id);
    triggerRecheck(s.id);
    const all = listHealthForService(s.id, 10);
    expect(all.length).toBe(2);
  });
});

describe('alerts stub', () => {
  it('CRUD roundtrip', () => {
    const r = createAlertRule({ name: 'r', query: 'q', severity: 'warning', channels: [], enabled: true });
    expect(getAlertRule(r.id)?.name).toBe('r');
    expect(listAlertRules().length).toBe(1);
  });
});

describe('dashboard command audit (two-phase)', () => {
  it('inserts → advances → finalises', () => {
    const c = createCommandAudit({
      requestId: 'r1',
      requestedBy: 'u1',
      command: 'docker.ps',
      target: 'caddy',
    });
    expect(c.status).toBe('created');
    const running = advanceCommandAudit(c.id, { status: 'running' });
    expect(running?.status).toBe('running');
    const finished = advanceCommandAudit(c.id, { status: 'finished', output: 'ok' });
    expect(finished?.status).toBe('finished');
    expect(finished?.finishedAt).not.toBeNull();
    expect(listCommandAudits().length).toBe(1);
    expect(getCommandAudit(c.id)?.status).toBe('finished');
  });

  it('returns null for missing audit', () => {
    expect(advanceCommandAudit('nope', { status: 'running' })).toBeNull();
    expect(getCommandAudit('nope')).toBeNull();
  });
});

describe('users stub', () => {
  it('upsert + get', () => {
    const u = upsertUser({
      id: asUserId('u1'),
      username: 'a',
      is_admin: false,
      isActive: true,
      groupMemberships: [],
    });
    expect(u.id).toBe('u1');
    expect(getUserById('u1')?.username).toBe('a');
    expect(getUserById('nope')).toBeNull();
  });
});
