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
 *
 * TODO domains (server fns not yet implemented — throws "not yet wired"):
 *   alerts, approvals, audit, agents, mail, notifications,
 *   envFiles, backups, scheduler
 *
 * See docs/rebuild/ADR-001-server-transport.md for the RPC transport decision.
 * See src/lib/api/README.md for the full swap guide.
 */

// Re-export auth for the Wave-2 shell/login WP.
export * as auth from "./auth";

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

// ---------------------------------------------------------------------------
// Import mock row types so adapters can use them and client can type correctly.
// We import type-only — no runtime dependency on the mock data.
// ---------------------------------------------------------------------------
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
  PamUser,
  Project,
  Agent,
  MailReview,
  BackupSnapshot,
  SchedulerJob,
  DriveInfo,
  MountInfo,
} from "@/mocks/types";

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
  PamUser,
  Project,
  Agent,
  MailReview,
  BackupSnapshot,
  SchedulerJob,
  DriveInfo,
  MountInfo,
};

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-10 — services domain)
// ---------------------------------------------------------------------------
import {
  listServices as _listServices,
  listServiceHealth as _listServiceHealth,
} from "./services.functions";

import { toServiceRow } from "@/lib/adapters/services";
import type { HealthSnapshotRow } from "@/lib/adapters/services";

// The gate-middleware pattern (defineServerFn + serverFnNoop) means TypeScript
// infers the outer server fn return as `undefined` — the actual type is carried
// by the gate at runtime. Cast through `unknown` at the boundary to recover the
// typed payloads. This is the only place these casts live; call sites are typed.

type ListServicesInput = {
  category?: string;
  kind?: "app" | "service" | "docker" | "process" | "dashboard-launcher";
  status?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};
type ListServicesOutput = { rows: import("@cortexos/contracts/entities").Service[]; total: number };
type ServiceHealthInput = { id: number; limit?: number };
type ServiceHealthOutput = {
  snapshots: Array<{
    id: string;
    serviceId: number;
    status: string;
    latencyMs: number | null;
    checkedAt: string;
    note: string | null;
  }>;
};

const listServicesFn = _listServices as unknown as (
  opts: { data: ListServicesInput },
) => Promise<ListServicesOutput>;
const listServiceHealthFn = _listServiceHealth as unknown as (
  opts: { data: ServiceHealthInput },
) => Promise<ServiceHealthOutput>;

// Re-export the raw typed server fns for Wave-2 direct use.
export const listServices = _listServices;
export const listServiceHealth = _listServiceHealth;
export type { HealthSnapshotRow };

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-14 — system / network / processes / storage)
// ---------------------------------------------------------------------------
import {
  getSystem as _getSystem,
  getNetwork as _getNetwork,
  getProcesses as _getProcesses,
  getStorage as _getStorage,
} from "./system.functions";

// WP-14 gate-middleware boundary casts — same pattern as services above.
type GetSystemOutput = SystemData;
type GetNetworkOutput = NetworkData;
type GetProcessesOutput = { processes: ProcessInfo[] };
type GetStorageOutput = { disks: DriveInfo[]; mounts: MountInfo[] };

const getSystemFn = _getSystem as unknown as (
  opts: { data: Record<string, never> },
) => Promise<GetSystemOutput>;
const getNetworkFn = _getNetwork as unknown as (
  opts: { data: Record<string, never> },
) => Promise<GetNetworkOutput>;
const getProcessesFn = _getProcesses as unknown as (
  opts: { data: Record<string, never> },
) => Promise<GetProcessesOutput>;
const getStorageFn = _getStorage as unknown as (
  opts: { data: Record<string, never> },
) => Promise<GetStorageOutput>;

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-13 — systemd domain)
// ---------------------------------------------------------------------------
import {
  listUnits as _listUnits,
  getUnit as _getUnit,
  systemdAction as _systemdAction,
  unitLogs as _unitLogs,
} from "./systemd.functions";

// WP-13 gate-middleware boundary casts — same pattern as other domains.
type ListUnitsOutput = { units: SystemdUnit[] };
type GetUnitOutput = { unit: SystemdUnit };
// SystemdActionInput schema has only `action` + `name`; the approval token is
// passed via `x-cortex-approval-token` header (gate: approval: true), not in data.
type SystemdActionInputType = {
  action: "start" | "stop" | "restart" | "reload" | "enable" | "disable";
  name: string;
};
type SystemdActionOutput = {
  action: string;
  name: string;
  status: "accepted";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  unit: SystemdUnit | null;
  durationMs: number;
};
type UnitLogsInputType = { name: string; limit?: number };
type UnitLogsOutput = { unit: string; limit: number; count: number; lines: string[] };

const listUnitsFn = _listUnits as unknown as (
  opts: { data: Record<string, never> },
) => Promise<ListUnitsOutput>;
const getUnitFn = _getUnit as unknown as (
  opts: { data: { name: string } },
) => Promise<GetUnitOutput>;

/**
 * Call systemdAction RPC — admin only; approval: true gate.
 * Pass the pre-minted token as `x-cortex-approval-token` + CSRF in `headers`.
 */
export const callSystemdAction = _systemdAction as unknown as (opts: {
  data: SystemdActionInputType;
  headers?: Record<string, string>;
}) => Promise<SystemdActionOutput>;
/** Call unitLogs RPC directly — returns journal lines for a unit. */
export const callUnitLogs = _unitLogs as unknown as (
  opts: { data: UnitLogsInputType },
) => Promise<UnitLogsOutput>;

// Re-export the raw typed server fns for direct use.
export const listUnits = _listUnits;
export const getUnit = _getUnit;

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-12 — incus domain)
// ---------------------------------------------------------------------------
import {
  listInstances as _listInstances,
  incusAction as _incusAction,
  instanceLogs as _instanceLogs,
} from "./incus.functions";

// WP-12 gate-middleware boundary casts — same pattern as other domains.
type ListInstancesOutput = { items: import("@cortexos/contracts").IncusInstance[] };
type IncusActionInputType = {
  action: "start" | "stop" | "restart" | "delete" | "launch" | "list";
  name: string;
  confirmation?: string;
  approvalToken?: string;
};
type IncusActionOutput = {
  result: {
    action: string;
    name: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    instance: import("@cortexos/contracts").IncusInstance;
    durationMs: number;
  };
};
type InstanceLogsInputType = { name: string; tail?: number };
export type IncusLogLine = {
  ts: string;
  priority: "info" | "warn" | "error" | "debug";
  name: string;
  message: string;
};
type InstanceLogsOutput = { lines: IncusLogLine[] };

const listInstancesFn = _listInstances as unknown as (
  opts: { data: Record<string, never> },
) => Promise<ListInstancesOutput>;

/** Call incusAction RPC directly — requires a pre-minted approval token for destructive ops. */
export const callIncusAction = _incusAction as unknown as (
  opts: { data: IncusActionInputType },
) => Promise<IncusActionOutput>;
/** Call instanceLogs RPC — returns newest-first log lines for a named instance. */
export const callInstanceLogs = _instanceLogs as unknown as (
  opts: { data: InstanceLogsInputType },
) => Promise<InstanceLogsOutput>;

/** Map a contracts IncusInstance to the mock IncusInstance shape used by the UI. */
function toIncusInstance(inst: import("@cortexos/contracts").IncusInstance): IncusInstance {
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
    cpu: inst.cpu ?? 0,
    memory: inst.memory ?? 0,
    config: {} as Record<string, string>,
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

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-11 — docker domain)
// ---------------------------------------------------------------------------
import {
  listContainers as _listContainers,
  listImages as _listImages,
  listVolumes as _listVolumes,
  dockerAction as _dockerAction,
} from "./docker.functions";
import { mintApproval as _mintApproval } from "./approvals.functions";

// WP-11 gate-middleware boundary casts — same pattern as other domains.
type ListContainersOutput = { items: import("@/server/docker/stub-data").Container[] };
type ListImagesOutput = { items: import("@/server/docker/stub-data").DockerImage[] };
type ListVolumesOutput = { items: import("@/server/docker/stub-data").DockerVolume[] };
type DockerActionInputType = { op: string; args: Record<string, unknown>; approvalToken?: string };
type DockerActionOutput = {
  result: { op: string; argv: readonly string[]; output: string; durationMs: number };
};
type MintApprovalInputType = {
  action: string;
  payload: Record<string, unknown>;
  ttlSec?: number;
};
type MintApprovalOutput = {
  token: string;
  expiresAt: number;
  issuedAt: number;
  actionHash: string;
  ttlSec: number;
};

const listContainersFn = _listContainers as unknown as (
  opts: { data: { filter?: string; query?: string } },
) => Promise<ListContainersOutput>;
const listImagesFn = _listImages as unknown as (
  opts: { data: { query?: string } },
) => Promise<ListImagesOutput>;
const listVolumesFn = _listVolumes as unknown as (
  opts: { data: { query?: string } },
) => Promise<ListVolumesOutput>;

/** Call dockerAction RPC directly — requires a pre-minted approval token. */
export const callDockerAction = _dockerAction as unknown as (
  opts: { data: DockerActionInputType },
) => Promise<DockerActionOutput>;
/** Call mintApproval RPC directly — admin only; mints a single-use approval token. */
export const callMintApproval = _mintApproval as unknown as (
  opts: { data: MintApprovalInputType },
) => Promise<MintApprovalOutput>;

/** Map a server Container to the mock DockerContainer shape. */
function toDockerContainer(c: import("@/server/docker/stub-data").Container): DockerContainer {
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
function toDockerImage(i: import("@/server/docker/stub-data").DockerImage): DockerImage {
  return { id: i.id, repo: i.repo, tag: i.tag, size: i.size, created: i.created };
}

/** Map a server DockerVolume to the mock DockerVolume shape. */
function toDockerVolume(v: import("@/server/docker/stub-data").DockerVolume): DockerVolume {
  return { name: v.name, driver: v.driver, mountpoint: v.mountpoint, size: v.size ?? 0 };
}

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

// WP-37 gate-middleware boundary casts — same pattern as other domains.
type ListReviewsInput = { accountSlug?: string; pendingOnly?: boolean; page?: number; pageSize?: number };
type ListReviewsOutput = { reviews: ServerMailReview[]; total: number; page: number; pageSize: number };
type ListAccountsOutput = { accounts: ServerMailAccount[] };
type AccountCreateInput = {
  slug: string; address: string; host: string; port: number; secure: boolean;
  username: string; password: string; inbox: string; trashMailbox?: string | null;
  reviewMailbox: string; enabled: boolean;
};
type AccountUpdateInput = {
  slug: string; address: string; host: string; port: number; secure: boolean;
  username: string; password?: string; inbox: string; trashMailbox?: string | null;
  reviewMailbox: string; enabled: boolean;
};
type AccountDeleteInput = { slug: string };
type AccountMutationOutput = { account: ServerMailAccount };
type AccountDeleteOutput = { ok: true; slug: string };
type ReviewIdInput = { id: number };
type ReviewDecisionOutput = { id: number; ownerDecision: string | null; resolvedAt: string | null; approver: string | null };
type MailBatchInput = { ids: number[]; action: "approve" | "flag" };
type MailBatchOutput = { updated: number; action: string };

const listReviewsFn = _listReviews as unknown as (opts: { data: ListReviewsInput }) => Promise<ListReviewsOutput>;

/** Call mail-guardian account CRUD server fns directly — admin only, CSRF required. */
export const callListMailAccounts = _listAccounts as unknown as (opts: { data: Record<string, never> }) => Promise<ListAccountsOutput>;
export const callCreateMailAccount = _createAccount as unknown as (opts: { data: AccountCreateInput; headers?: Record<string, string> }) => Promise<AccountMutationOutput>;
export const callUpdateMailAccount = _updateAccount as unknown as (opts: { data: AccountUpdateInput; headers?: Record<string, string> }) => Promise<AccountMutationOutput>;
export const callDeleteMailAccount = _deleteAccount as unknown as (opts: { data: AccountDeleteInput; headers?: Record<string, string> }) => Promise<AccountDeleteOutput>;
/** Call flagReview/approveReview/batch directly — admin only, CSRF required. */
export const callFlagReview = _flagReview as unknown as (opts: { data: ReviewIdInput; headers?: Record<string, string> }) => Promise<ReviewDecisionOutput>;
export const callApproveReview = _approveReview as unknown as (opts: { data: ReviewIdInput; headers?: Record<string, string> }) => Promise<ReviewDecisionOutput>;
export const callBatchDecision = _batchDecision as unknown as (opts: { data: MailBatchInput; headers?: Record<string, string> }) => Promise<MailBatchOutput>;

export type { ServerMailAccount };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Typed stub for domains whose server fns are not yet implemented (Wave-1). */
function notYetWired(domain: string): never {
  throw new Error(
    `[WP-04 TODO] api.${domain} — server function not yet wired (Wave-1 WP pending)`,
  );
}

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
  processes: (): Promise<ProcessInfo[]> =>
    getProcessesFn({ data: {} }).then((r) => r.processes),

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
    const { rows } = await listServicesFn({ data: { activeOnly: true, pageSize: 500 } });
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

  // ── Alerts ────────────────────────────────────────────────────────────
  alerts: {
    rules: (): Promise<AlertRule[]> => Promise.reject(notYetWired("alerts.rules")),
    history: (): Promise<AlertHistory[]> => Promise.reject(notYetWired("alerts.history")),
    rulesList: (_p?: ListParams): Promise<ListResult<AlertRule>> =>
      Promise.reject(notYetWired("alerts.rulesList")),
    historyList: (_p?: ListParams): Promise<ListResult<AlertHistory>> =>
      Promise.reject(notYetWired("alerts.historyList")),
  },

  // ── Approvals ──────────────────────────────────────────────────────────
  approvals: (): Promise<ApprovalRequest[]> => Promise.reject(notYetWired("approvals")),

  // ── Audit ──────────────────────────────────────────────────────────────
  audit: (): Promise<AuditEntry[]> => Promise.reject(notYetWired("audit")),

  auditList: (_p?: ListParams): Promise<ListResult<AuditEntry>> =>
    Promise.reject(notYetWired("auditList")),

  // ── Users ──────────────────────────────────────────────────────────────
  users: (): Promise<PamUser[]> => Promise.resolve([]),

  usersList: (p?: ListParams): Promise<ListResult<PamUser>> =>
    Promise.resolve(emptyList<PamUser>(p)),

  // ── Projects ──────────────────────────────────────────────────────────
  projects: (): Promise<Project[]> => Promise.resolve([]),

  projectsList: (p?: ListParams): Promise<ListResult<Project>> =>
    Promise.resolve(emptyList<Project>(p)),

  // ── Agents ────────────────────────────────────────────────────────────
  agents: (): Promise<Agent[]> => Promise.reject(notYetWired("agents")),

  // ── Mail-Guardian (WIRED — WP-37) ────────────────────────────────────
  /**
   * Returns all reviews mapped to the mock MailReview shape.
   * Calls listReviews RPC → server/db/repos/mail_guardian.listMailReviews().
   */
  mail: async (): Promise<MailReview[]> => {
    const { reviews } = await listReviewsFn({ data: {} });
    return (reviews as ServerMailReview[]).map(toMailReviewRow);
  },

  /**
   * Paginated reviews list (WIRED — WP-37).
   */
  mailList: async (p?: ListParams): Promise<ListResult<MailReview>> => {
    const page = (p?.page ?? 0) + 1; // contract is 1-based, UI is 0-based
    const pageSize = p?.pageSize ?? 25;
    const result = await listReviewsFn({ data: { page, pageSize } });
    return {
      rows: (result.reviews as ServerMailReview[]).map(toMailReviewRow),
      total: result.total,
      page: p?.page ?? 0,
      pageSize,
    };
  },

  // ── Notifications ──────────────────────────────────────────────────────
  notifications: (): Promise<unknown[]> => Promise.resolve([]),

  // ── Env browser ────────────────────────────────────────────────────────
  envFiles: (): Promise<unknown[]> => Promise.reject(notYetWired("envFiles")),

  // ── Badges ────────────────────────────────────────────────────────────
  badges: (): Promise<unknown[]> => Promise.resolve([]),

  badgesList: (p?: ListParams): Promise<ListResult<unknown>> =>
    Promise.resolve(emptyList<unknown>(p)),

  // ── Backups ────────────────────────────────────────────────────────────
  backups: (): Promise<BackupSnapshot[]> => Promise.resolve([]),

  backupsList: (p?: ListParams): Promise<ListResult<BackupSnapshot>> =>
    Promise.resolve(emptyList<BackupSnapshot>(p)),

  // ── Scheduler ──────────────────────────────────────────────────────────
  scheduler: (): Promise<SchedulerJob[]> => Promise.resolve([]),

  schedulerList: (p?: ListParams): Promise<ListResult<SchedulerJob>> =>
    Promise.resolve(emptyList<SchedulerJob>(p)),

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
void (listServiceHealthFn satisfies typeof listServiceHealthFn);
void (getUnitFn satisfies typeof getUnitFn);

// ---------------------------------------------------------------------------
// Wired server-function re-exports (WP-19 — terminal named ops)
// ---------------------------------------------------------------------------
export { listTerminalOps, dispatchTerminalOp } from "./terminal.functions";

// ---------------------------------------------------------------------------
// Reconciliation block — restores call helpers that concurrent Wave-2 edits to
// this facade dropped (WP-38 approvals/audit, WP-39 alerts, WP-41 agents).
// Same `as unknown as` boundary-cast pattern as the helpers above.
// ---------------------------------------------------------------------------
import { grantApproval as _grantApproval, revokeApproval as _revokeApproval } from "./approvals.functions";
import { verifyAudit as _verifyAudit } from "./approvals.functions";
import { createAlert as _createAlert, patchAlert as _patchAlert, deleteAlert as _deleteAlert } from "./alerts.functions";
import { uploadAgentFile as _uploadAgentFile } from "./agents.functions";
export type { HermesProfile } from "@/server/agents/registry";

type CsrfOpts = { headers?: Record<string, string> };

export const callGrantApproval = _grantApproval as unknown as (
  opts: { data: { id: number } } & CsrfOpts,
) => Promise<{ ok: boolean }>;
export const callRevokeApproval = _revokeApproval as unknown as (
  opts: { data: { id: number } } & CsrfOpts,
) => Promise<{ ok: boolean }>;
export const callVerifyAudit = _verifyAudit as unknown as (
  opts: { data: { from?: number } },
) => Promise<{ ok: boolean; count: number; brokenAt: { id: number } }>;
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
