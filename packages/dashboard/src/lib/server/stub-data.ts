/**
 * In-memory stub data — M1 mock for the M3 real DB-backed repositories.
 *
 * Each entity has a list, a counter for ids, and minimal CRUD. The store
 * resets per process (no persistence). Real repos land in M1-WS6 (Kleppmann).
 *
 * Not a public API; consumed by the +server.ts stubs.
 */

import {
  asAlertId,
  asApprovalTokenId,
  asDashboardCommandAuditId,
  asServiceId,
  type AlertEvent,
  type AlertRule,
  type DashboardCommandAudit,
  type PendingApproval,
  type Service,
  type ServiceHealthSnapshot,
  type User,
  asUserId,
} from './entities';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const users: User[] = [];

/** Register a user. */
export function upsertUser(u: User): User {
  const i = users.findIndex((x) => x.id === u.id);
  if (i >= 0) users[i] = u;
  else users.push(u);
  return u;
}

export function getUserById(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

let serviceCounter = 0;
const services: Service[] = [];

export function listServices(): Service[] {
  return services.slice();
}

export function getServiceById(id: string): Service | null {
  return services.find((s) => s.id === id) ?? null;
}

export function getServiceBySlug(slug: string): Service | null {
  return services.find((s) => s.slug === slug) ?? null;
}

export function createService(s: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Service {
  const now = new Date().toISOString();
  const next: Service = {
    ...s,
    id: asServiceId(`svc_${++serviceCounter}_${now}`),
    createdAt: now,
    updatedAt: now,
  };
  services.push(next);
  return next;
}

export function updateService(id: string, patch: Partial<Omit<Service, 'id' | 'createdAt'>>): Service | null {
  const i = services.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const now = new Date().toISOString();
  const next: Service = { ...services[i]!, ...patch, updatedAt: now };
  services[i] = next;
  return next;
}

export function deleteService(id: string): boolean {
  const i = services.findIndex((s) => s.id === id);
  if (i < 0) return false;
  services.splice(i, 1);
  return true;
}

// ---------------------------------------------------------------------------
// Health snapshots
// ---------------------------------------------------------------------------

const healthByService = new Map<string, ServiceHealthSnapshot[]>();

export function listHealthForService(serviceId: string, limit: number): ServiceHealthSnapshot[] {
  const all = healthByService.get(serviceId) ?? [];
  return all.slice(-limit);
}

export function recordHealth(snap: ServiceHealthSnapshot): void {
  const list = healthByService.get(snap.serviceId) ?? [];
  list.push(snap);
  // Keep last 1000 per service.
  if (list.length > 1000) list.splice(0, list.length - 1000);
  healthByService.set(snap.serviceId, list);
}

export function triggerRecheck(serviceId: string): ServiceHealthSnapshot {
  const snap: ServiceHealthSnapshot = {
    serviceId: asServiceId(serviceId),
    status: 'checking',
    latencyMs: null,
    checkedAt: new Date().toISOString(),
  };
  recordHealth(snap);
  return snap;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

let alertCounter = 0;
const alertRules: AlertRule[] = [];
const alertEvents: AlertEvent[] = [];

export function listAlertRules(): AlertRule[] {
  return alertRules.slice();
}

export function getAlertRule(id: string): AlertRule | null {
  return alertRules.find((r) => r.id === id) ?? null;
}

export function createAlertRule(r: Omit<AlertRule, 'id'>): AlertRule {
  const now = new Date().toISOString();
  const next: AlertRule = { ...r, id: asAlertId(`alert_${++alertCounter}_${now}`) };
  alertRules.push(next);
  return next;
}

export function updateAlertRule(id: string, patch: Partial<Omit<AlertRule, 'id'>>): AlertRule | null {
  const i = alertRules.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const next: AlertRule = { ...alertRules[i]!, ...patch };
  alertRules[i] = next;
  return next;
}

export function deleteAlertRule(id: string): boolean {
  const i = alertRules.findIndex((r) => r.id === id);
  if (i < 0) return false;
  alertRules.splice(i, 1);
  return true;
}

export function listAlertEvents(): AlertEvent[] {
  return alertEvents.slice();
}

export function getAlertEvent(id: string): AlertEvent | null {
  return alertEvents.find((e) => e.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard command audit (two-phase lifecycle)
// ---------------------------------------------------------------------------

const commandAudits: DashboardCommandAudit[] = [];

export function listCommandAudits(): DashboardCommandAudit[] {
  return commandAudits.slice();
}

export function getCommandAudit(id: string): DashboardCommandAudit | null {
  return commandAudits.find((c) => c.id === id) ?? null;
}

export function createCommandAudit(input: {
  requestId: string;
  requestedBy: string;
  command: string;
  target: string | null;
}): DashboardCommandAudit {
  const now = new Date().toISOString();
  const next: DashboardCommandAudit = {
    id: asDashboardCommandAuditId(`cmd_${now}_${Math.random().toString(36).slice(2, 8)}`),
    requestId: input.requestId,
    requestedBy: asUserId(input.requestedBy),
    command: input.command,
    target: input.target,
    status: 'created',
    output: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    errorCode: null,
  };
  commandAudits.push(next);
  return next;
}

export function advanceCommandAudit(
  id: string,
  patch: Partial<Pick<DashboardCommandAudit, 'status' | 'output' | 'finishedAt' | 'errorCode'>>,
): DashboardCommandAudit | null {
  const i = commandAudits.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const now = new Date().toISOString();
  // Auto-set finishedAt for terminal statuses (THREAT_MODEL §6.1 SR-090
  // two-phase lifecycle). The caller may still set it explicitly.
  const terminalStatuses: ReadonlyArray<DashboardCommandAudit['status']> = [
    'finished',
    'failed',
    'cancelled',
  ];
  const finishedAt =
    patch.finishedAt ??
    (patch.status && terminalStatuses.includes(patch.status) ? now : null);
  const next: DashboardCommandAudit = {
    ...commandAudits[i]!,
    ...patch,
    finishedAt,
    updatedAt: now,
  };
  commandAudits[i] = next;
  return next;
}

// ---------------------------------------------------------------------------
// Pending approvals (admin review queue — THREAT_MODEL §3.5)
// ---------------------------------------------------------------------------

let approvalCounter = 0;
const pendingApprovals: PendingApproval[] = [];

export function listPendingApprovals(): PendingApproval[] {
  // Newest first.
  return pendingApprovals
    .slice()
    .sort((a, b) => (a.requestedAt > b.requestedAt ? -1 : a.requestedAt < b.requestedAt ? 1 : 0));
}

export function getPendingApproval(id: string): PendingApproval | null {
  return pendingApprovals.find((a) => a.id === id) ?? null;
}

export interface CreatePendingApprovalInput {
  runId: string;
  signalName: string;
  role?: string | null;
  issueId?: string | null;
  reason?: string | null;
  /** ISO timestamp. Defaults to now(). */
  requestedAt?: string;
  /** ISO timestamp. Optional — if absent, the row never times out. */
  timeoutAt?: string | null;
}

export function createPendingApproval(input: CreatePendingApprovalInput): PendingApproval {
  const now = new Date().toISOString();
  const requestedAt = input.requestedAt ?? now;
  const next: PendingApproval = {
    id: asApprovalTokenId(`appr_${++approvalCounter}_${now}`),
    runId: input.runId,
    signalName: input.signalName,
    role: input.role ?? null,
    issueId: input.issueId ?? null,
    reason: input.reason ?? null,
    requestedAt,
    timeoutAt: input.timeoutAt ?? null,
    resolvedAt: null,
    decision: null,
    approver: null,
  };
  pendingApprovals.push(next);
  return next;
}

/**
 * Resolve a pending approval. Returns the updated row, or `null` if no
 * row matched. The decision must be `'approve' | 'deny' | 'timeout'`
 * (matches the SQL CHECK constraint) and the approver must be a
 * username string. If the row is already resolved, returns the
 * existing row (idempotent — but the caller should treat that as an
 * error).
 */
export function resolvePendingApproval(
  id: string,
  decision: 'approve' | 'deny' | 'timeout',
  approver: string,
  resolvedAt: string = new Date().toISOString(),
): PendingApproval | null {
  const i = pendingApprovals.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const current = pendingApprovals[i]!;
  if (current.decision !== null) return current;
  const next: PendingApproval = {
    ...current,
    decision,
    approver,
    resolvedAt,
  };
  pendingApprovals[i] = next;
  return next;
}

/** Invalidate (revoke) a pending approval. Same as `deny` semantically
 *  — kept as a separate function for clarity at the call site. */
export function revokePendingApproval(
  id: string,
  approver: string,
  resolvedAt: string = new Date().toISOString(),
): PendingApproval | null {
  return resolvePendingApproval(id, 'deny', approver, resolvedAt);
}

// ---------------------------------------------------------------------------
// Test/seed helpers
// ---------------------------------------------------------------------------

/** Reset the entire stub data store. For tests. */
export function _resetStubData(): void {
  users.length = 0;
  services.length = 0;
  serviceCounter = 0;
  healthByService.clear();
  alertRules.length = 0;
  alertEvents.length = 0;
  alertCounter = 0;
  commandAudits.length = 0;
  pendingApprovals.length = 0;
  approvalCounter = 0;
}
