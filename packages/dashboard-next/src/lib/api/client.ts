/**
 * Frontend API client — RPC facade (WP-04, reworked per ADR-001).
 *
 * Transport = typed `createServerFn` RPC, NOT fetch("/api/...").
 * Each member calls the corresponding server function directly (typed) so
 * TanStack handles the client↔server serialisation — no hand-rolled fetch.
 *
 * Exposes an `api` object with the SAME member names and call shapes as
 * `src/mocks/api.ts` so Wave-2 route WPs can swap their import from
 *   `import { api } from "@/mocks/api"`
 * to
 *   `import { api } from "@/lib/api/client"`
 * without any call-site changes.
 *
 * Wired domains (Wave-1 server fns exist):
 *   services  — WP-10 (listServices, getService, listServiceHealth)
 *   system    — WP-14 (getSystem, getNetwork, getProcesses, getStorage)
 *   docker    — WP-11 (listContainers, listImages, listVolumes, dockerAction)
 *   incus     — WP-12 (listInstances, incusAction, instanceLogs)
 *   systemd   — WP-13 (listUnits, getUnit, systemdAction, unitLogs)
 *   alerts    — MP-025 (listAlerts, alertHistory)
 *   approvals — MP-025 (listApprovals)
 *   audit     — MP-025 (listAudit)
 *   agents    — MP-025 (listAgents)
 *   envFiles  — MP-025 (readEnv)
 *   mail      — WP-37 (listReviews)
 *   backups   — MP-024b (listBackupRuns)
 *   scheduler — MP-024a (listSchedulerJobs)
 *
 * Stub domain (no server fn yet — returns a typed empty list):
 *   notifications (TopBar bell)
 *
 * See docs/rebuild/ADR-001-server-transport.md for the RPC transport decision.
 * See src/lib/api/README.md for the full swap guide.
 */

// ---------------------------------------------------------------------------
// Import mock row types so adapters can use them and client can type correctly.
// We import type-only — no runtime dependency on the mock data.
// ---------------------------------------------------------------------------
import type { Service as ContractService } from "@cortexos/contracts/entities";
import type { IncusInstance as ContractIncusInstance } from "@cortexos/contracts";
import type {
  Service,
  SystemData,
  ProcessInfo,
  NetworkData,
  DockerContainer,
  DockerImage,
  DockerVolume,
  IncusInstance,
  SystemdUnit,
  AlertRule,
  AlertHistory,
  ApprovalRequest,
  AuditEntry,
  Agent,
  MailReview,
  SchedulerJob,
  DriveInfo,
  MountInfo,
} from "@/mocks/types";
import type { BackupRunRow } from "./backups.functions";
import type {
  Container as StubContainer,
  DockerImage as StubDockerImage,
  DockerVolume as StubDockerVolume,
} from "@/server/docker/stub-data";

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-10 — services domain)
// ---------------------------------------------------------------------------
import {
  listServices as _listServices,
  listServiceHealth as _listServiceHealth,
} from "./services.functions";

import { toServiceRow } from "@/lib/adapters/services";
import type { HealthSnapshotRow } from "@/lib/adapters/services";

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-14 — system / network / processes / storage)
// ---------------------------------------------------------------------------
import {
  getSystem as _getSystem,
  getNetwork as _getNetwork,
  getProcesses as _getProcesses,
  getStorage as _getStorage,
} from "./system.functions";

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-13 — systemd domain)
// ---------------------------------------------------------------------------
import {
  listUnits as _listUnits,
  getUnit as _getUnit,
  systemdAction as _systemdAction,
  unitLogs as _unitLogs,
  hostLogs as _hostLogs,
} from "./systemd.functions";

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-12 — incus domain)
// ---------------------------------------------------------------------------
import {
  listInstances as _listInstances,
  incusAction as _incusAction,
  instanceLogs as _instanceLogs,
} from "./incus.functions";

// ---------------------------------------------------------------------------
// Wired server-function imports (MP-024a — scheduler domain)
// ---------------------------------------------------------------------------
import { listSchedulerJobs as _listSchedulerJobs } from "./scheduler.functions";

// ---------------------------------------------------------------------------
// Wired server-function imports (MP-024b — backups domain)
// ---------------------------------------------------------------------------
import { listBackupRuns as _listBackupRuns } from "./backups.functions";

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-11 — docker domain)
// ---------------------------------------------------------------------------
import {
  listContainers as _listContainers,
  listImages as _listImages,
  listVolumes as _listVolumes,
  dockerAction as _dockerAction,
  containerLogs as _containerLogs,
} from "./docker.functions";
import {
  mintApproval as _mintApproval,
  verifyAudit as _verifyAudit,
  grantApproval as _grantApproval,
  revokeApproval as _revokeApproval,
  listApprovals as _listApprovals,
  listAudit as _listAudit,
} from "./approvals.functions";

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-37 — mail-guardian domain)
// ---------------------------------------------------------------------------
import {
  listReviews as _listReviews,
  listAccounts as _listAccounts,
  createAccount as _createAccount,
  updateAccount as _updateAccount,
  deleteAccount as _deleteAccount,
  flagReview as _flagReview,
  approveReview as _approveReview,
  batch as _batchDecision,
} from "./mail-guardian.functions";

import { toMailReviewRow } from "@/lib/adapters/mail";
import type { ServerMailReview, ServerMailAccount } from "@/lib/adapters/mail";

// ---------------------------------------------------------------------------
// Reconciliation block — restores call helpers that concurrent Wave-2 edits to
// this facade dropped (WP-38 approvals/audit, WP-39 alerts, WP-41 agents).
// Same `as unknown as` boundary-cast pattern as the helpers above.
// ---------------------------------------------------------------------------
import {
  createAlert as _createAlert,
  patchAlert as _patchAlert,
  deleteAlert as _deleteAlert,
  listAlerts as _listAlerts,
  alertHistory as _alertHistory,
} from "./alerts.functions";
import { uploadAgentFile as _uploadAgentFile, listAgents as _listAgents } from "./agents.functions";
import { readEnv as _readEnv } from "./env-browser.functions";
import type { HermesProfile } from "@/server/agents/registry";

// Topbar bell notifications — no server fn yet; returns a typed empty list.
// Shape mirrors the legacy mock `Notification` so the TopBar consumer stays typed.
export interface DashNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  severity: "info" | "warn" | "error";
}

// Re-export error types so Wave-2 consumers can import from one place.
export type { ApiClientError, ApiErrorCode, ApiErrorEnvelope } from "./http";

// ---------------------------------------------------------------------------
// Shared pagination types (mirrors mocks/api.ts — keep in sync)
// ---------------------------------------------------------------------------

export type SortDir = "asc" | "desc";

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  sortKey?: string | null;
  sortDir?: SortDir;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Re-export these so Wave-2 consumers that used to `import type { X }
// from "@/mocks/types"` can switch to `@/lib/api/client` in one step.
export type {
  Service,
  SystemData,
  ProcessInfo,
  NetworkData,
  DockerContainer,
  DockerImage,
  DockerVolume,
  IncusInstance,
  SystemdUnit,
  AlertRule,
  AlertHistory,
  ApprovalRequest,
  AuditEntry,
  Agent,
  MailReview,
  BackupRunRow,
  SchedulerJob,
  DriveInfo,
  MountInfo,
};

// The gate-middleware pattern (defineServerFn + serverFnNoop) means TypeScript
// infers the outer server fn return as `undefined` — the actual type is carried
// by the gate at runtime. Cast through `unknown` at the boundary to recover the
// typed payloads. This is the only place these casts live; call sites are typed.

interface ListServicesInput {
  category?: string;
  kind?: "app" | "service" | "docker" | "process" | "dashboard-launcher";
  status?: string;
  activeOnly?: boolean;
  hasWebui?: boolean;
  page?: number;
  pageSize?: number;
}
interface ListServicesOutput {
  rows: ContractService[];
  total: number;
}
interface ServiceHealthInput {
  id: number;
  limit?: number;
}
interface ServiceHealthOutput {
  snapshots: {
    id: string;
    serviceId: number;
    status: string;
    latencyMs: number | null;
    checkedAt: string;
    note: string | null;
  }[];
}

const listServicesFn = _listServices as unknown as (opts: {
  data: ListServicesInput;
}) => Promise<ListServicesOutput>;
const listServiceHealthFn = _listServiceHealth as unknown as (opts: {
  data: ServiceHealthInput;
}) => Promise<ServiceHealthOutput>;

// Re-export the raw typed server fns for Wave-2 direct use.
export const listServices = _listServices;
export const listServiceHealth = _listServiceHealth;
export type { HealthSnapshotRow };

// WP-14 gate-middleware boundary casts — same pattern as services above.
type GetSystemOutput = SystemData;
type GetNetworkOutput = NetworkData;
interface GetProcessesOutput {
  processes: ProcessInfo[];
}
interface GetStorageOutput {
  disks: DriveInfo[];
  mounts: MountInfo[];
}

const getSystemFn = _getSystem as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<GetSystemOutput>;
const getNetworkFn = _getNetwork as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<GetNetworkOutput>;
const getProcessesFn = _getProcesses as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<GetProcessesOutput>;
const getStorageFn = _getStorage as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<GetStorageOutput>;

// WP-13 gate-middleware boundary casts — same pattern as other domains.
interface ListUnitsOutput {
  units: SystemdUnit[];
}
interface GetUnitOutput {
  unit: SystemdUnit;
}
// SystemdActionInput schema has only `action` + `name`; the approval token is
// passed via `x-cortex-approval-token` header (gate: approval: true), not in data.
interface SystemdActionInputType {
  action: "start" | "stop" | "restart" | "reload" | "enable" | "disable";
  name: string;
}
interface SystemdActionOutput {
  action: string;
  name: string;
  status: "accepted";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  unit: SystemdUnit | null;
  durationMs: number;
}
interface UnitLogsInputType {
  name: string;
  limit?: number;
}
interface UnitLogsOutput {
  unit: string;
  limit: number;
  count: number;
  lines: string[];
}
// MP-009 — hostLogs (admin only): returns host-journal lines, no unit filter.
// Each `lines` entry is a structured SystemdLogLine from the @cortexos/contracts
// schema (AN-004 §4 data-shape note), mapped to display text by the caller.
interface HostLogsInputType {
  limit?: number;
}
interface HostLogsLogLine {
  ts: string;
  priority: "emerg" | "alert" | "crit" | "err" | "warning" | "notice" | "info" | "debug";
  unit: string;
  message: string;
}
interface HostLogsOutput {
  limit: number;
  count: number;
  lines: HostLogsLogLine[];
}

const listUnitsFn = _listUnits as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListUnitsOutput>;
const getUnitFn = _getUnit as unknown as (opts: {
  data: { name: string };
}) => Promise<GetUnitOutput>;
const hostLogsFn = _hostLogs as unknown as (opts: {
  data: HostLogsInputType;
}) => Promise<HostLogsOutput>;

/**
 * Call systemdAction RPC — admin only; approval: true gate.
 * Pass the pre-minted token as `x-cortex-approval-token` + CSRF in `headers`.
 */
export const callSystemdAction = _systemdAction as unknown as (opts: {
  data: SystemdActionInputType;
  headers?: Record<string, string>;
}) => Promise<SystemdActionOutput>;
/** Call unitLogs RPC directly — returns journal lines for a unit. */
export const callUnitLogs = _unitLogs as unknown as (opts: {
  data: UnitLogsInputType;
}) => Promise<UnitLogsOutput>;
/**
 * MP-009 — Call hostLogs RPC directly (admin only). Returns the most-recent
 * `limit` lines from the whole host journal (no unit filter, no
 * `getUnit` precondition).
 */
export const callHostLogs = hostLogsFn;

// Re-export the raw typed server fns for direct use.
export const listUnits = _listUnits;
export const getUnit = _getUnit;
export const hostLogs = _hostLogs;

// WP-12 gate-middleware boundary casts — same pattern as other domains.
interface ListInstancesOutput {
  items: ContractIncusInstance[];
}
interface IncusActionInputType {
  action: "start" | "stop" | "restart" | "delete" | "launch" | "list";
  name: string;
  confirmation?: string;
  approvalToken?: string;
}
interface IncusActionOutput {
  result: {
    action: string;
    name: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    instance: ContractIncusInstance;
    durationMs: number;
  };
}
interface InstanceLogsInputType {
  name: string;
  tail?: number;
}
export interface IncusLogLine {
  ts: string;
  priority: "info" | "warn" | "error" | "debug";
  name: string;
  message: string;
}
interface InstanceLogsOutput {
  lines: IncusLogLine[];
}

const listInstancesFn = _listInstances as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListInstancesOutput>;

// MP-024a gate-middleware boundary cast — same pattern as other domains.
interface ListSchedulerJobsOutput {
  jobs: SchedulerJob[];
}

const listSchedulerJobsFn = _listSchedulerJobs as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListSchedulerJobsOutput>;

// MP-024b gate-middleware boundary cast — same pattern as other domains.
interface ListBackupRunsOutput {
  backups: BackupRunRow[];
}

const listBackupRunsFn = _listBackupRuns as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListBackupRunsOutput>;

/** Call incusAction RPC directly — requires a pre-minted approval token for destructive ops. */
export const callIncusAction = _incusAction as unknown as (opts: {
  data: IncusActionInputType;
}) => Promise<IncusActionOutput>;
/** Call instanceLogs RPC — returns newest-first log lines for a named instance. */
export const callInstanceLogs = _instanceLogs as unknown as (opts: {
  data: InstanceLogsInputType;
}) => Promise<InstanceLogsOutput>;

/** Map a contracts IncusInstance to the mock IncusInstance shape used by the UI. */
function toIncusInstance(inst: ContractIncusInstance): IncusInstance {
  const cfg = inst.config;
  const lv = inst.lastValidation as
    | { ok?: boolean; ranAt?: string; notes?: string }
    | null
    | undefined;
  return {
    name: inst.name,
    slug: inst.slug,
    status: inst.status as IncusInstance["status"],
    type: inst.type,
    image: inst.image,
    cpu: inst.cpu ?? null,
    memory: inst.memory ?? null,
    config: {},
    devices: inst.devices as Record<string, Record<string, string>>,
    last_validation: lv
      ? { ok: lv.ok ?? false, ran_at: lv.ranAt ?? inst.updatedAt, notes: lv.notes ?? "" }
      : null,
    created_at: inst.createdAt,
    project: {
      name: cfg.target.slug,
      description: cfg.target.description ?? "",
      repo_url: cfg.target.repoUrl ?? "",
      branch: cfg.target.branch,
    },
  };
}

// WP-11 gate-middleware boundary casts — same pattern as other domains.
interface ListContainersOutput {
  items: StubContainer[];
}
interface ListImagesOutput {
  items: StubDockerImage[];
}
interface ListVolumesOutput {
  items: StubDockerVolume[];
}
interface DockerActionInputType {
  op: string;
  args: Record<string, unknown>;
  approvalToken?: string;
}
interface DockerActionOutput {
  result: { op: string; argv: readonly string[]; output: string; durationMs: number };
}
interface MintApprovalInputType {
  action: string;
  payload: Record<string, unknown>;
  ttlSec?: number;
}
interface MintApprovalOutput {
  token: string;
  expiresAt: number;
  issuedAt: number;
  actionHash: string;
  ttlSec: number;
}

const listContainersFn = _listContainers as unknown as (opts: {
  data: { filter?: string; query?: string };
}) => Promise<ListContainersOutput>;
const listImagesFn = _listImages as unknown as (opts: {
  data: { query?: string };
}) => Promise<ListImagesOutput>;
const listVolumesFn = _listVolumes as unknown as (opts: {
  data: { query?: string };
}) => Promise<ListVolumesOutput>;
// MP-009 — containerLogs (admin only): returns tail-N docker logs.
interface ContainerLogsInputType {
  id: string;
  limit?: number;
}
interface ContainerLogsOutput {
  id: string;
  limit: number;
  count: number;
  lines: string[];
}
const containerLogsFn = _containerLogs as unknown as (opts: {
  data: ContainerLogsInputType;
}) => Promise<ContainerLogsOutput>;

/** Call dockerAction RPC directly — requires a pre-minted approval token. */
export const callDockerAction = _dockerAction as unknown as (opts: {
  data: DockerActionInputType;
}) => Promise<DockerActionOutput>;
/** Call mintApproval RPC directly — admin only; mints a single-use approval token. */
export const callMintApproval = _mintApproval as unknown as (opts: {
  data: MintApprovalInputType;
}) => Promise<MintApprovalOutput>;
/**
 * MP-009 — Call containerLogs RPC directly (admin only). Returns the
 * most-recent `limit` lines from `docker logs` for a single container
 * id (stdout+stderr merged inside the bridge).
 */
export const callContainerLogs = containerLogsFn;

/** Map a server Container to the mock DockerContainer shape. */
function toDockerContainer(c: StubContainer): DockerContainer {
  return {
    id: c.id,
    name: c.name,
    image: c.image,
    status: c.status,
    state: c.state as DockerContainer["state"],
    ports: Array.isArray(c.ports) ? c.ports.join(", ") : String(c.ports),
    created: c.created,
  };
}

/** Map a server DockerImage to the mock DockerImage shape. */
function toDockerImage(i: StubDockerImage): DockerImage {
  return { id: i.id, repo: i.repo, tag: i.tag, size: i.size ?? null, created: i.created };
}

/** Map a server DockerVolume to the mock DockerVolume shape. */
function toDockerVolume(v: StubDockerVolume): DockerVolume {
  return { name: v.name, driver: v.driver, mountpoint: v.mountpoint, size: v.size ?? null };
}

// MP-025 gate-middleware boundary casts — same pattern as other domains.
interface ListAlertsOutput {
  rules: {
    id: number;
    serviceId: number;
    name: string;
    condition: string;
    thresholdMs: number | null;
    enabled: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  }[];
}
interface AlertHistoryOutput {
  history: {
    id: number;
    ruleName: string;
    serviceName: string;
    status: string;
    message: string;
    timestamp: string;
  }[];
}
interface ListApprovalsOutput {
  pending: {
    id: number;
    runId: string;
    signalName: string;
    role: string | null;
    issueId: string | null;
    reason: string | null;
    requestedAt: Date | string;
    timeoutAt: Date | string | null;
    resolvedAt: Date | string | null;
    decision: string | null;
    approver: string | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
}
interface ListAuditOutput {
  events: {
    id: string;
    eventId: string;
    occurredAt: string;
    surface: string;
    action: string;
    actor: string | null;
    subject: string | null;
    result: string | null;
    payloadHash: string;
    payload: Record<string, unknown>;
  }[];
  surfaces: string[];
  actions: string[];
  total: number;
  page: number;
  pageSize: number;
}
interface ListAgentsOutput {
  agents: HermesProfile[];
}
interface ReadEnvOutput {
  path: string;
  revealed: boolean;
  revealExpiresAt: number | null;
  entries: { key: string; value: string; masked: string }[];
}

const listAlertsFn = _listAlerts as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListAlertsOutput>;
const alertHistoryFn = _alertHistory as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<AlertHistoryOutput>;
const listApprovalsFn = _listApprovals as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListApprovalsOutput>;
const listAuditFn = _listAudit as unknown as (opts: {
  data: {
    actor?: string;
    page?: number;
    pageSize?: number;
  };
}) => Promise<ListAuditOutput>;
const listAgentsFn = _listAgents as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListAgentsOutput>;
const readEnvFn = _readEnv as unknown as (opts: {
  data: { path: string };
}) => Promise<ReadEnvOutput>;

/** Map a server alert_rules row to the mock AlertRule shape. */
function toAlertRuleRow(r: ListAlertsOutput["rules"][number]): AlertRule {
  return {
    id: String(r.id),
    name: r.name,
    service_id: r.serviceId,
    condition: r.condition as AlertRule["condition"],
    threshold_ms: r.thresholdMs ?? null,
    enabled: r.enabled,
  };
}

/** Map a server alert-history item to the mock AlertHistory shape. */
function toAlertHistoryRow(h: AlertHistoryOutput["history"][number]): AlertHistory {
  return {
    id: String(h.id),
    ruleName: h.ruleName,
    serviceName: h.serviceName,
    status: h.status as AlertHistory["status"],
    message: h.message,
    timestamp: h.timestamp,
  };
}

/** Map a server pending_approvals row to the mock ApprovalRequest shape. */
function toApprovalRequestRow(a: ListApprovalsOutput["pending"][number]): ApprovalRequest {
  const resolvedDecision: ApprovalRequest["status"] =
    a.decision === "approve" ? "approved" : "denied";
  const status: ApprovalRequest["status"] = a.decision === null ? "pending" : resolvedDecision;
  const requestedAt =
    a.requestedAt instanceof Date ? a.requestedAt.toISOString() : String(a.requestedAt);
  return {
    id: String(a.id),
    actor: a.runId,
    tool: a.signalName,
    summary: a.signalName,
    args_preview: JSON.stringify({
      runId: a.runId,
      role: a.role ?? undefined,
      issueId: a.issueId ?? undefined,
    }),
    requested_at: requestedAt,
    status,
    reason: a.reason ?? undefined,
  };
}

/** Map a server audit_log event to the mock AuditEntry shape. */
function toAuditEntryRow(e: ListAuditOutput["events"][number]): AuditEntry {
  const payload = e.payload ?? {};
  const result = e.result ?? (typeof payload.result === "string" ? payload.result : "");
  const detail = typeof payload.detail === "string" ? payload.detail : result;
  return {
    id: e.id,
    actor: e.actor ?? "",
    tool: e.action,
    tool_class: e.surface,
    args_hash: e.payloadHash,
    decision: result === "deny" || result === "error" ? "deny" : "allow",
    decision_reason: detail,
    result,
    created_at: e.occurredAt,
  };
}

/** Infer a display provider name from a model identifier. */
function inferModelProvider(model: string): string {
  const lower = model.toLowerCase();
  if (lower.startsWith("claude-")) return "anthropic";
  if (lower.startsWith("gpt-")) return "openai";
  if (lower.startsWith("llama") || lower.startsWith("qwen") || lower.startsWith("mistral")) {
    return "ollama";
  }
  const slash = model.indexOf("/");
  if (slash > 0) return model.slice(0, slash);
  return "unknown";
}

/** Map a server HermesProfile to the mock Agent shape with safe defaults. */
function toAgentRow(p: HermesProfile): Agent {
  const slug = p.profile;
  const hermesUrl = p.apiPort ? `http://localhost:${p.apiPort}` : "http://localhost";
  const modelProvider = inferModelProvider(p.model ?? "");
  return {
    slug,
    name: slug,
    description: `Hermes profile: ${slug}`,
    state: "idle",
    model: p.model ?? "unknown",
    modelProvider,
    health: "healthy",
    hermesUrl,
    version: "0.0.0",
    uptimeSec: 0,
    queueDepth: 0,
    requestsPerMin: 0,
    errorRatePct: 0,
    p95LatencyMs: 0,
    lastActivity: new Date().toISOString(),
    files: [],
  };
}

/** Map a readEnv result to the legacy { path, keys } summary shape. */
function toEnvFileRow(r: ReadEnvOutput): unknown {
  return { path: r.path, keys: r.entries.map((e) => e.key) };
}

// WP-37 gate-middleware boundary casts — same pattern as other domains.
interface ListReviewsInput {
  accountSlug?: string;
  pendingOnly?: boolean;
  page?: number;
  pageSize?: number;
}
interface ListReviewsOutput {
  reviews: ServerMailReview[];
  total: number;
  page: number;
  pageSize: number;
}
interface ListAccountsOutput {
  accounts: ServerMailAccount[];
}
interface AccountCreateInput {
  slug: string;
  address: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  inbox: string;
  trashMailbox?: string | null;
  reviewMailbox: string;
  enabled: boolean;
}
interface AccountUpdateInput {
  slug: string;
  address: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  inbox: string;
  trashMailbox?: string | null;
  reviewMailbox: string;
  enabled: boolean;
}
interface AccountDeleteInput {
  slug: string;
}
interface AccountMutationOutput {
  account: ServerMailAccount;
}
interface AccountDeleteOutput {
  ok: true;
  slug: string;
}
interface ReviewIdInput {
  id: number;
}
interface ReviewDecisionOutput {
  id: number;
  ownerDecision: string | null;
  resolvedAt: string | null;
  approver: string | null;
}
interface MailBatchInput {
  ids: number[];
  action: "approve" | "flag";
}
interface MailBatchOutput {
  updated: number;
  action: string;
}

const listReviewsFn = _listReviews as unknown as (opts: {
  data: ListReviewsInput;
}) => Promise<ListReviewsOutput>;

/** Call mail-guardian account CRUD server fns directly — admin only, CSRF required. */
export const callListMailAccounts = _listAccounts as unknown as (opts: {
  data: Record<string, never>;
}) => Promise<ListAccountsOutput>;
export const callCreateMailAccount = _createAccount as unknown as (opts: {
  data: AccountCreateInput;
  headers?: Record<string, string>;
}) => Promise<AccountMutationOutput>;
export const callUpdateMailAccount = _updateAccount as unknown as (opts: {
  data: AccountUpdateInput;
  headers?: Record<string, string>;
}) => Promise<AccountMutationOutput>;
export const callDeleteMailAccount = _deleteAccount as unknown as (opts: {
  data: AccountDeleteInput;
  headers?: Record<string, string>;
}) => Promise<AccountDeleteOutput>;
/** Call flagReview/approveReview/batch directly — admin only, CSRF required. */
export const callFlagReview = _flagReview as unknown as (opts: {
  data: ReviewIdInput;
  headers?: Record<string, string>;
}) => Promise<ReviewDecisionOutput>;
export const callApproveReview = _approveReview as unknown as (opts: {
  data: ReviewIdInput;
  headers?: Record<string, string>;
}) => Promise<ReviewDecisionOutput>;
export const callBatchDecision = _batchDecision as unknown as (opts: {
  data: MailBatchInput;
  headers?: Record<string, string>;
}) => Promise<MailBatchOutput>;

export type { ServerMailAccount };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return a typed empty ListResult for domains without a backend yet. */
function emptyList<T>(p: ListParams = {}): ListResult<T> {
  return { rows: [], total: 0, page: p.page ?? 0, pageSize: p.pageSize ?? 25 };
}

/**
 * Apply client-side pagination/sorting to an already-filtered array.
 * Used when the server fn returns a full array without server-side pagination.
 */
function clientSideList<T>(rows: T[], p: ListParams = {}): ListResult<T> {
  const pageSize = Math.max(1, p.pageSize ?? 25);
  const page = Math.max(0, p.page ?? 0);
  const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
  return { rows: slice, total: rows.length, page, pageSize };
}

// ---------------------------------------------------------------------------
// API surface — mirrors mocks/api.ts exactly
// ---------------------------------------------------------------------------

export const api = {
  // ── System / host metrics (WIRED — WP-14) ─────────────────────────────
  /**
   * Returns live host metrics: CPU %, memory, drives, mounts, load, uptime, sensors.
   * Calls getSystem RPC → server/system/readers.collectSystem().
   */
  system: (): Promise<SystemData> => getSystemFn({ data: {} }),

  /**
   * Returns top processes sorted by CPU.
   * Calls getProcesses RPC → server/system/processes.readProcesses().
   */
  processes: (): Promise<ProcessInfo[]> => getProcessesFn({ data: {} }).then((r) => r.processes),

  /**
   * Returns physical network interface stats (rx/tx kbps + totals).
   * Calls getNetwork RPC → server/system/network.getNetworkData().
   */
  network: (): Promise<NetworkData> => getNetworkFn({ data: {} }),

  // ── Services (WIRED — WP-10) ───────────────────────────────────────────
  /**
   * Returns all active services as a flat array.
   * Calls listServices RPC → maps contract rows → mock Service shape.
   */
  services: async (): Promise<Service[]> => {
    const { rows } = await listServicesFn({
      data: { activeOnly: true, hasWebui: true, pageSize: 500 },
    });
    return rows.map(toServiceRow);
  },

  /**
   * Paginated services list (WIRED — WP-10).
   */
  servicesList: async (p?: ListParams): Promise<ListResult<Service>> => {
    const page = (p?.page ?? 0) + 1; // contract is 1-based, mock is 0-based
    const pageSize = p?.pageSize ?? 25;
    const result = await listServicesFn({
      data: {
        page,
        pageSize,
        ...(p?.q ? { category: p.q } : {}),
      },
    });
    return {
      rows: result.rows.map(toServiceRow),
      total: result.total,
      page: p?.page ?? 0,
      pageSize,
    };
  },

  /**
   * Service health snapshots — returns empty until Wave-2 provides a serviceId.
   * The mock `history()` returns a flat array with no service filter; the real
   * `listServiceHealth` requires a specific id. Wave-2 components that need
   * per-service history should call `listServiceHealth` directly.
   */
  history: (): Promise<HealthSnapshotRow[]> => Promise.resolve([]),

  /**
   * Paginated healthcheck view — services with activeOnly=true (WIRED — WP-10).
   */
  healthcheckList: async (p?: ListParams): Promise<ListResult<Service>> => {
    const page = (p?.page ?? 0) + 1;
    const pageSize = p?.pageSize ?? 25;
    const result = await listServicesFn({
      data: {
        activeOnly: true,
        page,
        pageSize,
      },
    });
    const rows = result.rows.map(toServiceRow);
    // Apply q filter client-side (contract does not support freetext q)
    const q = (p?.q ?? "").trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q),
        )
      : rows;
    return {
      rows: filtered,
      total: result.total,
      page: p?.page ?? 0,
      pageSize,
    };
  },

  // ── Docker (WIRED — WP-11) ───────────────────────────────────────────
  /**
   * Returns all containers mapped to the mock DockerContainer shape.
   * Calls listContainers RPC → server/docker/real-data.listContainers().
   */
  docker: {
    containers: async (): Promise<DockerContainer[]> => {
      const { items } = await listContainersFn({ data: {} });
      return items.map(toDockerContainer);
    },
    images: async (): Promise<DockerImage[]> => {
      const { items } = await listImagesFn({ data: {} });
      return items.map(toDockerImage);
    },
    volumes: async (): Promise<DockerVolume[]> => {
      const { items } = await listVolumesFn({ data: {} });
      return items.map(toDockerVolume);
    },
    containersList: async (p?: ListParams): Promise<ListResult<DockerContainer>> => {
      const { items } = await listContainersFn({ data: { query: p?.q } });
      return clientSideList(items.map(toDockerContainer), p);
    },
    imagesList: async (p?: ListParams): Promise<ListResult<DockerImage>> => {
      const { items } = await listImagesFn({ data: { query: p?.q } });
      return clientSideList(items.map(toDockerImage), p);
    },
    volumesList: async (p?: ListParams): Promise<ListResult<DockerVolume>> => {
      const { items } = await listVolumesFn({ data: { query: p?.q } });
      return clientSideList(items.map(toDockerVolume), p);
    },
  },

  // ── Incus (WIRED — WP-12) ─────────────────────────────────────────────
  /**
   * Returns all Incus instances mapped to the mock IncusInstance shape.
   * Calls listInstances RPC → server/incus/bridge.listInstances().
   */
  incus: async (): Promise<IncusInstance[]> => {
    const { items } = await listInstancesFn({ data: {} });
    return items.map(toIncusInstance);
  },

  /**
   * Paginated Incus instances list (WIRED — WP-12).
   */
  incusList: async (p?: ListParams): Promise<ListResult<IncusInstance>> => {
    const { items } = await listInstancesFn({ data: {} });
    const mapped = items.map(toIncusInstance);
    const q = (p?.q ?? "").trim().toLowerCase();
    const filtered = q
      ? mapped.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.image.toLowerCase().includes(q) ||
            i.status.toLowerCase().includes(q),
        )
      : mapped;
    return clientSideList<IncusInstance>(filtered, p);
  },

  // ── Systemd (WIRED — WP-13 / WP-35) ──────────────────────────────────
  /**
   * Returns all systemd units as a flat array.
   * Calls listUnits RPC → server/system/systemd.listUnits().
   */
  systemd: async (): Promise<SystemdUnit[]> => {
    const { units } = await listUnitsFn({ data: {} });
    return units;
  },

  /**
   * Paginated + filtered systemd units list (WIRED — WP-13 / WP-35).
   */
  systemdList: async (p?: ListParams): Promise<ListResult<SystemdUnit>> => {
    const { units } = await listUnitsFn({ data: {} });
    const q = (p?.q ?? "").trim().toLowerCase();
    const filtered = q
      ? units.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.description.toLowerCase().includes(q) ||
            u.active.toLowerCase().includes(q),
        )
      : units;
    return clientSideList<SystemdUnit>(filtered, p);
  },

  // ── Alerts (WIRED — MP-025) ───────────────────────────────────────────
  alerts: {
    /**
     * Returns all alert rules mapped to the mock AlertRule shape.
     * Calls listAlerts RPC → server/db/repos/alerts.listAlertRules().
     */
    rules: async (): Promise<AlertRule[]> => {
      const { rules } = await listAlertsFn({ data: {} });
      return rules.map(toAlertRuleRow);
    },

    /**
     * Returns alert history (rule firings) mapped to the mock AlertHistory shape.
     * Calls alertHistory RPC → server/db/repos/alerts.listAlertHistoryWithNames().
     */
    history: async (): Promise<AlertHistory[]> => {
      const { history } = await alertHistoryFn({ data: {} });
      return history.map(toAlertHistoryRow);
    },

    /**
     * Paginated alert rules list (WIRED — MP-025).
     */
    rulesList: async (p?: ListParams): Promise<ListResult<AlertRule>> => {
      const { rules } = await listAlertsFn({ data: {} });
      const mapped = rules.map(toAlertRuleRow);
      const q = (p?.q ?? "").trim().toLowerCase();
      const filtered = q
        ? mapped.filter(
            (r) => r.name.toLowerCase().includes(q) || r.condition.toLowerCase().includes(q),
          )
        : mapped;
      return clientSideList<AlertRule>(filtered, p);
    },

    /**
     * Paginated alert history list (WIRED — MP-025).
     */
    historyList: async (p?: ListParams): Promise<ListResult<AlertHistory>> => {
      const { history } = await alertHistoryFn({ data: {} });
      const mapped = history.map(toAlertHistoryRow);
      const q = (p?.q ?? "").trim().toLowerCase();
      const filtered = q
        ? mapped.filter(
            (h) =>
              h.ruleName.toLowerCase().includes(q) ||
              h.serviceName.toLowerCase().includes(q) ||
              h.status.toLowerCase().includes(q),
          )
        : mapped;

      const sortKey = p?.sortKey;
      const sortDir = p?.sortDir ?? "desc";
      const getSortValue: Record<string, (h: AlertHistory) => string | number> = {
        timestamp: (h) => h.timestamp,
        ruleName: (h) => h.ruleName,
        status: (h) => h.status,
      };
      const accessor = sortKey ? getSortValue[sortKey] : undefined;
      if (accessor) {
        const sorted = [...filtered].sort((a, b) => {
          const av = accessor(a);
          const bv = accessor(b);
          if (av === bv) return 0;
          const d = av > bv ? 1 : -1;
          return sortDir === "desc" ? -d : d;
        });
        return clientSideList<AlertHistory>(sorted, p);
      }

      return clientSideList<AlertHistory>(filtered, p);
    },
  },

  // ── Approvals (WIRED — MP-025) ─────────────────────────────────────────
  /**
   * Returns pending approvals mapped to the mock ApprovalRequest shape.
   * Calls listApprovals RPC → server/db/repos/pending_approvals.listPendingApprovals().
   */
  approvals: async (): Promise<ApprovalRequest[]> => {
    const { pending } = await listApprovalsFn({ data: {} });
    return pending.map(toApprovalRequestRow);
  },

  // ── Audit (WIRED — MP-025) ─────────────────────────────────────────────
  /**
   * Returns audit events mapped to the mock AuditEntry shape.
   * Calls listAudit RPC → server/db/repos/audit (via approvals.functions.ts).
   * Requests pageSize 500 (the server-enforced maximum) so the flat view
   * returns the broadest available window in a single round-trip.
   */
  audit: async (): Promise<AuditEntry[]> => {
    const { events } = await listAuditFn({ data: { pageSize: 500 } });
    return events.map(toAuditEntryRow);
  },

  /**
   * Paginated audit events list (WIRED — MP-025).
   * Forwards page/pageSize to the server-side paginated listAudit RPC and
   * returns the server's rows/total/page/pageSize directly.
   */
  auditList: async (p?: ListParams): Promise<ListResult<AuditEntry>> => {
    const page = (p?.page ?? 0) + 1; // server contract is 1-based, UI is 0-based
    const pageSize = p?.pageSize ?? 25;
    const q = (p?.q ?? "").trim();
    const result = await listAuditFn({
      data: {
        page,
        pageSize,
        ...(q ? { actor: q } : {}),
      },
    });
    return {
      rows: result.events.map(toAuditEntryRow),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  },

  // ── Agents (WIRED — MP-025) ───────────────────────────────────────────
  /**
   * Returns Hermes agent profiles mapped to the mock Agent shape.
   * Calls listAgents RPC → server/agents/registry.readRegistry().
   */
  agents: async (): Promise<Agent[]> => {
    const { agents } = await listAgentsFn({ data: {} });
    return agents.map(toAgentRow);
  },

  // ── Mail-Guardian (WIRED — WP-37) ────────────────────────────────────
  /**
   * Returns all reviews mapped to the mock MailReview shape.
   * Calls listReviews RPC → server/db/repos/mail_guardian.listMailReviews().
   */
  mail: async (): Promise<MailReview[]> => {
    const { reviews } = await listReviewsFn({ data: {} });
    return reviews.map(toMailReviewRow);
  },

  /**
   * Paginated reviews list (WIRED — WP-37).
   */
  mailList: async (p?: ListParams): Promise<ListResult<MailReview>> => {
    const page = (p?.page ?? 0) + 1; // contract is 1-based, UI is 0-based
    const pageSize = p?.pageSize ?? 25;
    const result = await listReviewsFn({ data: { page, pageSize } });
    return {
      rows: result.reviews.map(toMailReviewRow),
      total: result.total,
      page: p?.page ?? 0,
      pageSize,
    };
  },

  // ── Notifications ──────────────────────────────────────────────────────
  // No live notifications server fn yet — typed empty stub until one ships.
  notifications: (): Promise<DashNotification[]> => Promise.resolve([]),

  // ── Env browser (WIRED — MP-025) ───────────────────────────────────────
  /**
   * Returns an env file summary mapped to the legacy { path, keys } shape.
   * Calls readEnv RPC → server/env-browser.readEnvFile().
   */
  envFiles: async (): Promise<unknown[]> => {
    const result = await readEnvFn({ data: { path: "/opt/cortexos/.secrets/dashboard.env" } });
    return [toEnvFileRow(result)];
  },

  // ── Badges ────────────────────────────────────────────────────────────
  badges: (): Promise<unknown[]> => Promise.resolve([]),

  badgesList: (p?: ListParams): Promise<ListResult<unknown>> =>
    Promise.resolve(emptyList<unknown>(p)),

  // ── Backups (WIRED — MP-024b) ──────────────────────────────────────────
  /**
   * Returns all backup runs as fixed-row contract objects.
   * Calls listBackupRuns RPC → server/backups.listBackupRuns().
   */
  backups: async (): Promise<BackupRunRow[]> => {
    const { backups } = await listBackupRunsFn({ data: {} });
    return backups;
  },

  /**
   * Paginated backup runs list (WIRED — MP-024b).
   */
  backupsList: async (p?: ListParams): Promise<ListResult<BackupRunRow>> => {
    const { backups } = await listBackupRunsFn({ data: {} });
    const q = (p?.q ?? "").trim().toLowerCase();
    const filtered = q
      ? backups.filter(
          (b) => b.target.toLowerCase().includes(q) || b.status.toLowerCase().includes(q),
        )
      : backups;

    const sortKey = p?.sortKey;
    const sortDir = p?.sortDir ?? "asc";
    const getSortValue: Record<string, (b: BackupRunRow) => string | number | null> = {
      timestamp: (b) => b.timestamp,
      target: (b) => b.target,
      sizeBytes: (b) => b.sizeBytes,
      status: (b) => b.status,
    };
    const accessor = sortKey ? getSortValue[sortKey] : undefined;
    if (accessor) {
      const sorted = [...filtered].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av === bv) return 0;
        if (av === null) return sortDir === "desc" ? 1 : -1;
        if (bv === null) return sortDir === "desc" ? -1 : 1;
        const d = av > bv ? 1 : -1;
        return sortDir === "desc" ? -d : d;
      });
      return clientSideList<BackupRunRow>(sorted, p);
    }

    return clientSideList<BackupRunRow>(filtered, p);
  },

  // ── Scheduler (WIRED — MP-024a) ───────────────────────────────────────
  /**
   * Returns all systemd timer jobs mapped to the mock SchedulerJob shape.
   * Calls listSchedulerJobs RPC → server/scheduler.listTimers().
   */
  scheduler: async (): Promise<SchedulerJob[]> => {
    const { jobs } = await listSchedulerJobsFn({ data: {} });
    return jobs;
  },

  /**
   * Paginated scheduler jobs list (WIRED — MP-024a).
   */
  schedulerList: async (p?: ListParams): Promise<ListResult<SchedulerJob>> => {
    const { jobs } = await listSchedulerJobsFn({ data: {} });
    const q = (p?.q ?? "").trim().toLowerCase();
    let filtered = q
      ? jobs.filter(
          (j) =>
            j.name.toLowerCase().includes(q) ||
            j.cron.toLowerCase().includes(q) ||
            j.target.toLowerCase().includes(q),
        )
      : jobs;

    const sortKey = p?.sortKey;
    const sortDir = p?.sortDir ?? "asc";
    const getSortValue: Record<string, (j: SchedulerJob) => string | number> = {
      name: (j) => j.name,
      cron: (j) => j.cron,
      target: (j) => j.target,
      lastRun: (j) => j.lastRun,
      nextRun: (j) => j.nextRun,
      status: (j) => j.status,
    };
    const accessor = sortKey ? getSortValue[sortKey] : undefined;
    if (accessor) {
      filtered = [...filtered].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av === bv) return 0;
        const d = av > bv ? 1 : -1;
        return sortDir === "desc" ? -d : d;
      });
    }

    return clientSideList<SchedulerJob>(filtered, p);
  },

  // ── Drives (from storage server fn — WIRED WP-14) ─────────────────────
  drivesList: async (p?: ListParams): Promise<ListResult<DriveInfo>> => {
    const { disks } = await getStorageFn({ data: {} });
    return clientSideList<DriveInfo>(disks, p);
  },
} as const;

// listServices, listServiceHealth, and HealthSnapshotRow are already exported
// above via `export const` / `export type` declarations.

// Suppress unused-variable warnings for typed boundary casts used only
// in cast expressions above.
listServiceHealthFn satisfies typeof listServiceHealthFn;
getUnitFn satisfies typeof getUnitFn;

// ---------------------------------------------------------------------------
// Wired server-function re-exports (WP-19 — terminal named ops)
// ---------------------------------------------------------------------------
export { listTerminalOps, dispatchTerminalOp } from "./terminal.functions";
export type { HermesProfile } from "@/server/agents/registry";

interface CsrfOpts {
  headers?: Record<string, string>;
}

export const callGrantApproval = _grantApproval as unknown as (
  opts: { data: { id: number } } & CsrfOpts,
) => Promise<{ ok: boolean }>;
export const callRevokeApproval = _revokeApproval as unknown as (
  opts: { data: { id: number } } & CsrfOpts,
) => Promise<{ ok: boolean }>;
export const callVerifyAudit = _verifyAudit as unknown as (opts: {
  data: { from?: number };
}) => Promise<{ ok: boolean; count: number; brokenAt: { id: number } }>;
export const callCreateAlert = _createAlert as unknown as (
  opts: { data: Record<string, unknown> } & CsrfOpts,
) => Promise<unknown>;
export const callPatchAlert = _patchAlert as unknown as (
  opts: { data: Record<string, unknown> } & CsrfOpts,
) => Promise<unknown>;
export const callDeleteAlert = _deleteAlert as unknown as (
  opts: { data: { id: number } } & CsrfOpts,
) => Promise<unknown>;
export const uploadAgentFile = _uploadAgentFile as unknown as (
  opts: { data: { slug: string; filename: string; content: string } } & CsrfOpts,
) => Promise<{ ok: boolean }>;
